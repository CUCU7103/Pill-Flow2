const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Queue state updates deliberately: persistence must not depend on React's
// optional eager evaluation of a state updater.
function hookRuntime(initialStates = []) {
  const slots = [], effects = [], updates = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = index in initialStates ? initialStates[index] : typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => updates.push(() => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      })];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useCallback(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((dep, i) => dep !== previous.deps[i])) {
        slots[index] = { deps, value: fn };
      }
      return slots[index].value;
    },
    useMemo(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((dep, i) => dep !== previous.deps[i])) {
        slots[index] = { deps, value: fn() };
      }
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((dep, i) => dep !== previous.deps[i])) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: fn() };
        });
      }
    },
  };
  return {
    react,
    render(fn) { cursor = 0; const result = fn(); effects.splice(0).forEach(effect => effect()); return result; },
    flush() { updates.splice(0).forEach(update => update()); return slots[0]; },
    setState(index, value) { slots[index] = value; },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function load(relativePath, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const rawSource = fs.readFileSync(filename, 'utf8');
  const transformedSource = overrides.sourceTransform ? overrides.sourceTransform(rawSource) : rawSource;
  const source = ts.transpileModule(transformedSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', ...Object.keys(overrides.globals ?? {}), source)(
    module, module.exports, name => overrides[name] ?? require(name),
    ...Object.values(overrides.globals ?? {}),
  );
  return module.exports;
}

const medication = { id: 'med-1', completed: false };
function medicationsRuntime(persist) {
  const runtime = hookRuntime([[medication], false, null]);
  const { useMedications } = load('hooks/use-medications.ts', {
    react: runtime.react,
    '@/lib/medicationDataSource': { fetchMedications: () => new Promise(() => {}), toggleMedicationLog: persist },
    '@/lib/consentUtils': load('lib/consentUtils.ts'),
  });
  const hook = runtime.render(() => useMedications('user-1'));
  return { runtime, hook };
}

function loadApiClient(session = { access_token: 'token-1' }, fetchImpl = async () => ({ ok: true, status: 204 })) {
  return load('lib/apiClient.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session } }) } } },
    globals: { fetch: fetchImpl },
    sourceTransform: source => source.replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify('https://api.test')),
  });
}

test('API client builds JWT headers, omits credentials, and converts API errors to messages', async () => {
  let request;
  const client = loadApiClient({ access_token: 'jwt-token' }, async (url, init) => {
    request = { url, init };
    return { ok: false, status: 400, json: async () => ({ code: 'INVALID_REQUEST', message: '입력이 올바르지 않아요.' }) };
  });
  assert.deepEqual(client.buildRequestHeaders('jwt-token'), { Authorization: 'Bearer jwt-token' });
  assert.deepEqual(client.buildRequestHeaders('jwt-token', true), { Authorization: 'Bearer jwt-token', 'Content-Type': 'application/json' });
  await assert.rejects(
    client.apiRequest('/api/v1/medications'),
    error => error instanceof Error && error.message === '입력이 올바르지 않아요.',
  );
  assert.equal(request.url, 'https://api.test/api/v1/medications');
  assert.equal(request.init.credentials, undefined);
  assert.equal(request.init.headers['Content-Type'], undefined);
  const fallback = await client.errorFromResponse({ json: async () => { throw new Error('not json'); } });
  assert.equal(fallback.message, client.DEFAULT_API_ERROR_MESSAGE);
});

test('API client requires a session and adds JSON content type only for JSON bodies', async () => {
  const noSession = loadApiClient(null);
  await assert.rejects(noSession.apiRequest('/api/v1/me'), /로그인이 필요합니다/);

  let request;
  const client = loadApiClient({ access_token: 'jwt-token' }, async (url, init) => {
    request = { url, init };
    return { ok: true, status: 204 };
  });
  const result = await client.apiRequest('/api/v1/medications', { method: 'POST', body: JSON.stringify({ name: '약' }) });
  assert.equal(result, undefined);
  assert.equal(request.init.headers.Authorization, 'Bearer jwt-token');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
});

test('API client preserves the error code and HTTP status from a 403 response', async () => {
  const client = loadApiClient({ access_token: 'jwt-token' }, async () => ({
    ok: false,
    status: 403,
    json: async () => ({ code: 'CONSENT_REQUIRED', message: '복약 정보 처리에 대한 동의가 필요합니다.' }),
  }));

  await assert.rejects(
    client.apiRequest('/api/v1/medications'),
    error => error instanceof Error && error.message === '복약 정보 처리에 대한 동의가 필요합니다.' && error.code === 'CONSENT_REQUIRED' && error.status === 403,
  );
});

test('consent API repository uses the expected URL, methods, and policy-version body', async () => {
  const calls = [];
  const repository = load('lib/consentApiRepository.ts', {
    '@/lib/apiClient': { apiRequest: async (...args) => { calls.push(args); return { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: true, photoAnalysis: false }; } },
    '@/lib/consentUtils': load('lib/consentUtils.ts'),
  });

  await repository.fetchConsentStatus('user-1');
  await repository.recordConsents('user-1', ['age_over_14', 'sensitive_health']);

  assert.deepEqual(calls, [
    ['/api/v1/consents'],
    ['/api/v1/consents', {
      method: 'POST',
      body: JSON.stringify({ policyVersion: '2026-09-27', types: ['age_over_14', 'sensitive_health'] }),
    }],
  ]);
});

test('consent decisions require both required checks and request photo consent independently', () => {
  const consent = load('lib/consentUtils.ts');
  assert.equal(consent.POLICY_VERSION, '2026-09-27');
  assert.equal(consent.canStartWithConsent(false, false), false);
  assert.equal(consent.canStartWithConsent(true, false), false);
  assert.equal(consent.canStartWithConsent(false, true), false);
  assert.equal(consent.canStartWithConsent(true, true), true);
  assert.equal(consent.isConsentComplete({ ageOver14: true, sensitiveHealth: true }), true);
  assert.equal(consent.isConsentComplete({ ageOver14: true, sensitiveHealth: false }), false);
  assert.equal(consent.isConsentComplete(null), false);
  assert.equal(consent.isConsentComplete({ ageOver14: 'true', sensitiveHealth: true }), false);
  assert.equal(consent.needsPhotoConsent(false), true);
  assert.equal(consent.needsPhotoConsent(true), false);
});

test('consent API responses fail closed when fields do not match the status contract', async () => {
  const consent = load('lib/consentUtils.ts');
  const validStatus = { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: true, photoAnalysis: false };
  assert.equal(consent.isConsentStatus(validStatus), true);
  assert.equal(consent.isConsentStatus({ ...validStatus, sensitiveHealth: 'false' }), false);
  assert.equal(consent.isConsentStatus({ ...validStatus, policyVersion: 1 }), false);

  const repository = load('lib/consentApiRepository.ts', {
    '@/lib/apiClient': { apiRequest: async () => ({ ...validStatus, sensitiveHealth: 'false' }) },
    '@/lib/consentUtils': consent,
  });
  await assert.rejects(repository.fetchConsentStatus('user-1'), /동의 상태 응답이 올바르지 않습니다/);
  await assert.rejects(repository.recordConsents('user-1', ['age_over_14']), /동의 상태 응답이 올바르지 않습니다/);
});

test('initial consent load failures stop loading and expose an error', async () => {
  const invalidStatus = { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: 'false', photoAnalysis: false };
  const scenarios = [
    {
      name: 'fetch rejection',
      fetchConsentStatus: async () => { throw new Error('network error'); },
    },
    {
      name: 'invalid response',
      fetchConsentStatus: async () => {
        const repository = load('lib/consentApiRepository.ts', {
          '@/lib/apiClient': { apiRequest: async () => invalidStatus },
          '@/lib/consentUtils': load('lib/consentUtils.ts'),
        });
        return repository.fetchConsentStatus('user-1');
      },
    },
  ];

  for (const scenario of scenarios) {
    const runtime = hookRuntime();
    const { useConsent } = load('hooks/use-consent.ts', {
      react: runtime.react,
      '@/lib/consentDataSource': {
        fetchConsentStatus: scenario.fetchConsentStatus,
        recordConsents: async () => ({}),
      },
    });

    runtime.render(() => useConsent('user-1'));
    await new Promise(resolve => setImmediate(resolve));
    runtime.flush();
    const consent = runtime.render(() => useConsent('user-1'));

    assert.equal(consent.loading, false, scenario.name);
    assert.equal(consent.status, null, scenario.name);
    assert.ok(consent.error, scenario.name);
  }
});

test('background consent revalidation keeps the existing status until the fresh result arrives', async () => {
  const runtime = hookRuntime();
  const requests = [];
  const completeStatus = { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: true, photoAnalysis: false };
  const incompleteStatus = { ...completeStatus, sensitiveHealth: false };
  const { useConsent } = load('hooks/use-consent.ts', {
    react: runtime.react,
    '@/lib/consentDataSource': {
      fetchConsentStatus: () => new Promise(resolve => requests.push(resolve)),
      recordConsents: async () => completeStatus,
    },
  });

  let consent = runtime.render(() => useConsent('user-1'));
  requests[0](completeStatus);
  await new Promise(resolve => setImmediate(resolve));
  runtime.flush();
  consent = runtime.render(() => useConsent('user-1'));
  assert.deepEqual(consent.status, completeStatus);
  assert.equal(consent.loading, false);

  const revalidation = consent.reload();
  runtime.flush();
  consent = runtime.render(() => useConsent('user-1'));
  assert.deepEqual(consent.status, completeStatus);
  assert.equal(consent.loading, false);
  assert.equal(consent.revalidating, true);

  requests[1](incompleteStatus);
  await revalidation;
  runtime.flush();
  consent = runtime.render(() => useConsent('user-1'));
  assert.deepEqual(consent.status, incompleteStatus);
  assert.equal(consent.revalidating, false);
});

test('background consent revalidation failure preserves status and exposes an error', async () => {
  const runtime = hookRuntime();
  let calls = 0;
  const completeStatus = { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: true, photoAnalysis: true };
  const { useConsent } = load('hooks/use-consent.ts', {
    react: runtime.react,
    '@/lib/consentDataSource': {
      fetchConsentStatus: async () => {
        if (++calls === 1) return completeStatus;
        throw new Error('refresh failed');
      },
      recordConsents: async () => completeStatus,
    },
  });

  runtime.render(() => useConsent('user-1'));
  await new Promise(resolve => setImmediate(resolve));
  runtime.flush();
  let consent = runtime.render(() => useConsent('user-1'));
  const revalidation = consent.reload();
  runtime.flush();
  await revalidation;
  runtime.flush();
  consent = runtime.render(() => useConsent('user-1'));

  assert.deepEqual(consent.status, completeStatus);
  assert.equal(consent.loading, false);
  assert.equal(consent.revalidating, false);
  assert.equal(consent.error, 'refresh failed');
});

test('withdrawal invalidates sensitive and photo consent even when revalidation fails', async () => {
  const runtime = hookRuntime();
  let fetchCalls = 0;
  const completeStatus = { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: true, photoAnalysis: true };
  const { useConsent } = load('hooks/use-consent.ts', {
    react: runtime.react,
    '@/lib/consentDataSource': {
      fetchConsentStatus: async () => {
        if (++fetchCalls === 1) return completeStatus;
        throw new Error('withdrawn status unavailable');
      },
      recordConsents: async () => completeStatus,
    },
  });

  runtime.render(() => useConsent('user-1'));
  await new Promise(resolve => setImmediate(resolve));
  runtime.flush();
  let consent = runtime.render(() => useConsent('user-1'));
  consent.markWithdrawn();
  const failedRevalidation = consent.reload();
  runtime.flush();
  await failedRevalidation;
  runtime.flush();
  consent = runtime.render(() => useConsent('user-1'));

  assert.equal(consent.status.ageOver14, true);
  assert.equal(consent.status.sensitiveHealth, false);
  assert.equal(consent.status.photoAnalysis, false);
});

test('consent save applies for the current user even when a later reload is pending', async () => {
  const runtime = hookRuntime();
  const requests = [];
  let resolveSave;
  const savedStatus = { policyVersion: '2026-09-27', ageOver14: true, sensitiveHealth: true, photoAnalysis: true };
  const { useConsent } = load('hooks/use-consent.ts', {
    react: runtime.react,
    '@/lib/consentDataSource': {
      fetchConsentStatus: () => new Promise(resolve => requests.push(resolve)),
      recordConsents: () => new Promise(resolve => { resolveSave = resolve; }),
    },
  });

  const consent = runtime.render(() => useConsent('user-1'));
  const saving = consent.save(['photo_analysis']);
  const reloading = consent.reload();
  resolveSave(savedStatus);
  await saving;
  runtime.flush();
  const afterSave = runtime.render(() => useConsent('user-1'));
  assert.deepEqual(afterSave.status, savedStatus);

  requests[0](savedStatus);
  requests[1](savedStatus);
  await reloading;
  await new Promise(resolve => setImmediate(resolve));
});

test('consent error utility recognizes current consent API errors only', () => {
  const consent = load('lib/consentUtils.ts');
  const { ApiError } = loadApiClient();

  assert.equal(consent.isConsentRequiredError(new ApiError('동의 필요', 403, 'CONSENT_REQUIRED')), true);
  assert.equal(consent.isConsentRequiredError({ code: 'OTHER' }), false);
  assert.equal(consent.isConsentRequiredError(null), false);
});

test('consent guard ignores in-flight reloads, resets after a successful query, and errors on repeated 403s', () => {
  const { transitionConsentGuard } = load('lib/consentUtils.ts');

  assert.deepEqual(transitionConsentGuard('consent_required', true, 1), {
    action: 'ignore',
    consecutiveFailures: 1,
  });

  const afterSuccess = transitionConsentGuard('medications_loaded', false, 1);
  assert.deepEqual(afterSuccess, { action: 'reset', consecutiveFailures: 0 });
  assert.deepEqual(transitionConsentGuard('consent_required', false, afterSuccess.consecutiveFailures), {
    action: 'reload',
    consecutiveFailures: 1,
  });
  assert.deepEqual(transitionConsentGuard('consent_required', false, 1), {
    action: 'show_error',
    consecutiveFailures: 2,
  });
});

test('medication fetch notifies once when current consent is required', async () => {
  const runtime = hookRuntime();
  const { ApiError } = loadApiClient();
  const expectedError = new ApiError('동의 필요', 403, 'CONSENT_REQUIRED');
  let notifications = 0;
  const { useMedications } = load('hooks/use-medications.ts', {
    react: runtime.react,
    '@/lib/medicationDataSource': { fetchMedications: async () => { throw expectedError; } },
    '@/lib/consentUtils': load('lib/consentUtils.ts'),
  });

  runtime.render(() => useMedications('user-1', () => { notifications++; }));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(notifications, 1);
});

test('photo consent starts capture only after the consent save succeeds', async () => {
  const consent = load('lib/consentUtils.ts');
  const events = [];

  const success = await consent.savePhotoConsentThenStart(
    async () => { events.push('saved'); },
    async () => { events.push('captured'); },
  );
  assert.deepEqual(success, { consentSaved: true });
  assert.deepEqual(events, ['saved', 'captured']);

  events.length = 0;
  const failure = await consent.savePhotoConsentThenStart(
    async () => { events.push('failed'); throw new Error('offline'); },
    async () => { events.push('captured'); },
  );
  assert.equal(failure.consentSaved, false);
  assert.deepEqual(events, ['failed']);
});

test('Supabase consent repository binds policy version and ignores duplicate user consent rows', async () => {
  const consent = load('lib/consentUtils.ts');
  const equalityChecks = [];
  let upsertCall;
  const query = {
    select() { return this; },
    eq(column, value) {
      equalityChecks.push([column, value]);
      if (column === 'policy_version') {
        return Promise.resolve({ data: [{ consent_type: 'age_over_14' }], error: null });
      }
      return this;
    },
    upsert(rows, options) {
      upsertCall = { rows, options };
      return Promise.resolve({ error: null });
    },
  };
  const repository = load('lib/consentRepository.ts', {
    '@/lib/supabase': { supabase: { from: table => { assert.equal(table, 'user_consents'); return query; } } },
    '@/lib/consentUtils': consent,
  });

  await repository.fetchConsentStatus('user-7');
  await repository.recordConsents('user-7', ['sensitive_health']);

  assert.ok(equalityChecks.some(([column, value]) => column === 'policy_version' && value === '2026-09-27'));
  assert.deepEqual(upsertCall.rows, [{ user_id: 'user-7', consent_type: 'sensitive_health', policy_version: '2026-09-27' }]);
  assert.deepEqual(upsertCall.options, { onConflict: 'user_id,consent_type,policy_version', ignoreDuplicates: true });
});

test('Supabase reset removes only the current user sensitive and photo consent rows', async () => {
  const calls = [];
  const repository = load('lib/medicationRepository.ts', {
    '@/lib/supabase': {
      supabase: {
        from(table) {
          let selection;
          const query = {
            select(columns) { selection = columns; calls.push([table, 'select', columns]); return this; },
            delete() { calls.push([table, 'delete']); return this; },
            eq(column, value) { calls.push([table, 'eq', column, value]); return this; },
            in(column, values) { calls.push([table, 'in', column, values]); return Promise.resolve({ error: null }); },
            then(resolve, reject) {
              return Promise.resolve({ data: selection === 'id' ? [{ id: 'med-1' }] : [], error: null }).then(resolve, reject);
            },
          };
          return query;
        },
      },
    },
    '@/lib/medicationMapper': { getToday: () => '2026-09-27', toMedication: row => row },
  });

  await repository.resetAllMedications('user-7');

  const firstConsentDelete = calls.findIndex(([table, action]) => table === 'user_consents' && action === 'delete');
  const firstMedicationRead = calls.findIndex(([table, action]) => table === 'medications' && action === 'select');
  const firstLogDelete = calls.findIndex(([table, action]) => table === 'medication_logs' && action === 'delete');
  const firstMedicationDelete = calls.findIndex(([table, action]) => table === 'medications' && action === 'delete');
  assert.ok(firstConsentDelete >= 0 && firstConsentDelete < firstMedicationRead);
  assert.ok(firstLogDelete > firstConsentDelete);
  assert.ok(firstMedicationDelete > firstLogDelete);
  assert.ok(calls.some(([table, action, column, userId]) => table === 'user_consents' && action === 'eq' && column === 'user_id' && userId === 'user-7'));
  assert.ok(calls.some(([table, action, column, types]) => table === 'user_consents' && action === 'in' && column === 'consent_type' && types.join(',') === 'sensitive_health,photo_analysis'));
});

test('Supabase reset stops before medication deletion when consent withdrawal fails', async () => {
  const calls = [];
  const repository = load('lib/medicationRepository.ts', {
    '@/lib/supabase': {
      supabase: {
        from(table) {
          let selection;
          const query = {
            select(columns) { selection = columns; calls.push([table, 'select', columns]); return this; },
            delete() { calls.push([table, 'delete']); return this; },
            eq(column, value) { calls.push([table, 'eq', column, value]); return this; },
            in(column, values) {
              calls.push([table, 'in', column, values]);
              return Promise.resolve({ error: table === 'user_consents' ? new Error('consent delete failed') : null });
            },
            then(resolve, reject) {
              return Promise.resolve({ data: selection === 'id' ? [{ id: 'med-1' }] : [], error: null }).then(resolve, reject);
            },
          };
          return query;
        },
      },
    },
    '@/lib/medicationMapper': { getToday: () => '2026-09-27', toMedication: row => row },
  });

  await assert.rejects(repository.resetAllMedications('user-7'), /consent delete failed/);
  assert.deepEqual(calls.map(([table, action]) => [table, action]), [
    ['user_consents', 'delete'],
    ['user_consents', 'eq'],
    ['user_consents', 'in'],
  ]);
});

test('medication API repository uses local dates and intake HTTP methods', async () => {
  const calls = [];
  const repository = load('lib/medicationApiRepository.ts', {
    '@/lib/apiClient': { apiRequest: async (...args) => { calls.push(args); return []; } },
    '@/lib/medicationMapper': { getToday: () => '2026-09-27' },
  });

  await repository.fetchMedications('user-1');
  await repository.toggleMedicationLog('med-1', 'user-1', true);
  await repository.toggleMedicationLog('med-1', 'user-1', false);

  assert.deepEqual(calls, [
    ['/api/v1/medications?date=2026-09-27'],
    ['/api/v1/medications/med-1/intakes/2026-09-27', { method: 'DELETE' }],
    ['/api/v1/medications/med-1/intakes/2026-09-27', { method: 'PUT' }],
  ]);
});

test('weekly stats exclude null rates from averages and parse API dates in local calendar time', () => {
  const stats = load('lib/statsUtils.ts');
  assert.equal(stats.averageRate([{ day: '일', rate: null }, { day: '월', rate: 100 }, { day: '화', rate: 50 }]), 75);
  assert.equal(stats.averageRate([{ day: '일', rate: null }]), null);
  assert.equal(stats.dateToDayLabel('2026-09-27'), '일');
  assert.equal(stats.dateToDayLabel('2026-09-28'), '월');
});

test('about modal platform label follows the running platform instead of a fixed Android label', () => {
  const { platformLabel } = load('lib/platform.ts');
  assert.equal(platformLabel('web'), '웹');
  assert.equal(platformLabel('android'), 'Android');
  assert.equal(platformLabel('ios'), 'iOS');
});

test('completion persists even when React defers its state updater', async () => {
  const calls = [];
  const { runtime, hook } = medicationsRuntime(async (...args) => calls.push(args));
  await hook.toggleMed('med-1');
  assert.deepEqual(calls, [['med-1', 'user-1', false]]);
  assert.equal(runtime.flush()[0].completed, true);
});

test('failed completion rolls back and can be retried', async () => {
  let attempts = 0;
  const { runtime, hook } = medicationsRuntime(async () => {
    if (++attempts === 1) throw new Error('offline');
  });
  await assert.rejects(hook.toggleMed('med-1'), /offline/);
  assert.equal(runtime.flush()[0].completed, false);
  await hook.toggleMed('med-1');
  assert.equal(attempts, 2);
  assert.equal(runtime.flush()[0].completed, true);
});

test('duplicate clicks send only one pending completion request', async () => {
  let finish, calls = 0;
  const { hook } = medicationsRuntime(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const pending = hook.toggleMed('med-1');
  await hook.toggleMed('med-1');
  assert.equal(calls, 1);
  finish();
  await pending;
});

test('midnight calls the latest authenticated callback and cleans up timers', () => {
  const runtime = hookRuntime();
  const timers = new Map();
  let timerId = 0, oldCalls = 0, newCalls = 0;
  const { useDayChange } = load('hooks/use-day-change.ts', {
    react: runtime.react,
    globals: {
      setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  runtime.render(() => useDayChange(() => oldCalls++));
  runtime.render(() => useDayChange(() => newCalls++));
  assert.equal(timers.size, 1);
  const [id, callback] = timers.entries().next().value;
  timers.delete(id);
  callback();
  assert.equal(oldCalls, 0);
  assert.equal(newCalls, 1);
  runtime.dispose();
  assert.equal(timers.size, 0);
});

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object') return [];
  return [node, ...elements(node.props?.children)];
}

for (const [dosage, valid] of [['', false], ['0', false], ['-1', false], ['1', true], ['0.5', true]]) {
  test(`dosage ${JSON.stringify(dosage)} ${valid ? 'allows' : 'blocks'} progression and direct save`, async () => {
    let saves = 0;
    const states = [1, undefined, '테스트약', 'tablet', dosage, '#fff', ['08:00'], [0], null, '', false];
    const runtime = hookRuntime(states);
    const jsx = (type, props) => ({ type, props });
    const { AddView } = load('components/views/AddView.tsx', {
      react: runtime.react,
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'framer-motion': { motion: new Proxy({}, { get: (_, key) => key }), useReducedMotion: () => true },
      'lucide-react': {},
      '@/hooks/use-photo-analyzer': { usePhotoAnalyzer: () => ({ status: 'idle' }) },
      '@/components/common/PhotoAnalyzeBadge': {},
      '@/components/modals/PhotoConsentModal': {},
      '@/lib/consentUtils': load('lib/consentUtils.ts'),
      sonner: { toast: { error() {} } },
      '@/hooks/use-theme': { useTheme: () => ({}) },
      '@/components/common/FormField': {},
      '@/components/modals/TimePicker': {},
      '@/constants': { MED_COLORS: ['#fff'], DAY_KEYS_MON_FIRST: ['mon'] },
      '@/types': load('types/index.ts'),
    });
    const render = () => AddView({ onBack() {}, onSave: async () => { saves++; }, dark: false });
    let tree = runtime.render(render);
    const next = elements(tree).find(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('다음'));
    assert.ok(next, 'next button exists');
    assert.equal(next.props.disabled, !valid);
    next.props.onClick();
    assert.equal(runtime.flush(), valid ? 2 : 1);

    // Saving must also reject invalid values independently of step navigation.
    runtime.setState(0, 3);
    tree = runtime.render(render);
    const save = elements(tree).find(node => node.type === 'button' && node.props.children === '저장하기');
    assert.ok(save);
    assert.equal(save.props.disabled, !valid);
    await save.props.onClick();
    assert.equal(saves, valid ? 1 : 0);
  });
}

test('existing notification scheduling regressions', () => {
  const category = load('lib/timeCategory.ts');
  const scheduling = load('lib/notificationSchedule.ts', { '@/lib/timeCategory': category });
  load('lib/notificationSchedule.test.ts', {
    './notificationSchedule': scheduling,
    './timeCategory': category,
  });
});

test('native notification hook cancels pending notifications on unmount', async () => {
  const runtime = hookRuntime();
  const pending = [{ id: 123, title: '복약 알림' }];
  const cancelled = [];
  const { useNotifications } = load('hooks/use-notifications.ts', {
    react: runtime.react,
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true } },
    '@capacitor/app': { App: { addListener: async () => ({ remove() {} }) } },
    '@capacitor/local-notifications': {
      LocalNotifications: {
        requestPermissions: async () => ({ display: 'denied' }),
        getPending: async () => ({ notifications: pending }),
        cancel: async request => cancelled.push(request.notifications),
      },
    },
    '@/lib/notificationSchedule': { buildMedicationNotifications: () => [] },
  });

  runtime.render(() => useNotifications([], true, { morning: true, lunch: true, evening: true }));
  runtime.dispose();
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(cancelled, [pending]);
});

test('App cancels notifications for confirmed incomplete consent and before consent sign-out', async () => {
  const runtime = hookRuntime();
  let cancelCalls = 0;
  let signOutCalls = 0;
  const jsx = (type, props) => ({ type, props });
  const { default: App } = load('App.tsx', {
    react: runtime.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'framer-motion': { motion: {}, AnimatePresence: 'AnimatePresence', useReducedMotion: () => false },
    sonner: { toast: {} },
    '@/hooks/use-persisted': { usePersisted: (_key, initial) => [initial, () => {}] },
    '@/hooks/use-theme': { useDarkMode() {} },
    '@/hooks/use-android-back-button': { useAndroidBackButton() {} },
    '@/hooks/use-medications': { useMedications() {} },
    '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'user-1' }, loading: false, signInWithGoogle() {}, signOut: async () => { signOutCalls++; } }) },
    '@/hooks/use-notifications': { useNotifications() {}, cancelAllNotifications: async () => { cancelCalls++; } },
    '@/hooks/use-day-change': { useDayChange() {} },
    '@/hooks/use-consent': { useConsent: () => ({
      status: { policyVersion: '2026-09-27', ageOver14: false, sensitiveHealth: false, photoAnalysis: false },
      loading: false,
      error: null,
      reload: async () => {},
      save: async () => ({}),
    }) },
    '@/lib/consentUtils': load('lib/consentUtils.ts'),
    '@/components/common/BottomNav': { BottomNav: 'BottomNav' },
    '@/components/views/TodayView': { TodayView: 'TodayView' },
    '@/components/views/AddView': { AddView: 'AddView' },
    '@/components/views/StatsView': { StatsView: 'StatsView' },
    '@/components/views/ConsentView': { ConsentView: 'ConsentView' },
    '@/components/views/LoginView': { LoginView: 'LoginView' },
    '@/components/modals/SettingsModal': { SettingsModal: 'SettingsModal' },
    '@/constants': { DAY_KEYS_SUN_FIRST: [] },
  });

  const tree = runtime.render(() => App());
  assert.equal(tree.type, 'ConsentView');
  assert.equal(cancelCalls, 1);
  await tree.props.onSignOut();
  assert.equal(cancelCalls, 2);
  assert.equal(signOutCalls, 1);
});

test('failed medication reset reloads consent and propagates the original error', async () => {
  const runtime = hookRuntime();
  const expectedError = new Error('medication reset failed');
  let consentReloads = 0;
  let successfulResetCallbacks = 0;
  const jsx = (type, props) => ({ type, props });
  const { AuthenticatedApp } = load('App.tsx', {
    react: runtime.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'framer-motion': { motion: new Proxy({}, { get: (_, key) => key }), AnimatePresence: 'AnimatePresence', useReducedMotion: () => false },
    sonner: { toast: { dismiss() {}, success() {}, error() {} } },
    '@/hooks/use-persisted': { usePersisted: (_key, initial) => runtime.react.useState(initial) },
    '@/hooks/use-theme': { useDarkMode() {} },
    '@/hooks/use-android-back-button': { useAndroidBackButton() {} },
    '@/hooks/use-medications': { useMedications: () => ({ meds: [], loading: false, error: null, addMed() {}, deleteMed() {}, toggleMed() {}, resetAll: async () => { throw expectedError; }, refetch() {} }) },
    '@/hooks/use-auth': { useAuth: () => ({}) },
    '@/hooks/use-notifications': { useNotifications() {}, cancelAllNotifications: async () => {} },
    '@/hooks/use-day-change': { useDayChange() {} },
    '@/hooks/use-consent': { useConsent: () => ({}) },
    '@/lib/consentUtils': load('lib/consentUtils.ts'),
    '@/components/common/BottomNav': { BottomNav: 'BottomNav' },
    '@/components/views/TodayView': { TodayView: 'TodayView' },
    '@/components/views/AddView': { AddView: 'AddView' },
    '@/components/views/StatsView': { StatsView: 'StatsView' },
    '@/components/views/ConsentView': { ConsentView: 'ConsentView' },
    '@/components/views/LoginView': { LoginView: 'LoginView' },
    '@/components/modals/SettingsModal': { SettingsModal: 'SettingsModal' },
    '@/constants': { DAY_KEYS_SUN_FIRST: [] },
    sourceTransform: source => `${source}\nexport { AuthenticatedApp };`,
  });
  const props = {
    user: { id: 'user-1' }, dark: false, setDark() {}, signOut: async () => {}, photoAnalysis: false,
    onPhotoConsent: async () => {}, onConsentRequired() {}, onMedicationQuerySucceeded() {},
    onMedicationReset() { successfulResetCallbacks++; },
    onMedicationResetFailed() { consentReloads++; },
  };

  let tree = runtime.render(() => AuthenticatedApp(props));
  elements(tree).find(node => node.type === 'TodayView').props.onOpenSettings();
  runtime.flush();
  tree = runtime.render(() => AuthenticatedApp(props));
  const settings = elements(tree).find(node => node.type === 'SettingsModal');

  await assert.rejects(settings.props.onResetAll(), error => error === expectedError);
  assert.equal(consentReloads, 1);
  assert.equal(successfulResetCallbacks, 0);
});

test('cancelAllNotifications does nothing on web', async () => {
  let calls = 0;
  const notifications = load('hooks/use-notifications.ts', {
    react: hookRuntime().react,
    '@capacitor/core': { Capacitor: { isNativePlatform: () => false } },
    '@capacitor/app': { App: { addListener: async () => ({ remove() {} }) } },
    '@capacitor/local-notifications': { LocalNotifications: { getPending: async () => { calls++; return { notifications: [] }; } } },
    '@/lib/notificationSchedule': { buildMedicationNotifications: () => [] },
  });

  await notifications.cancelAllNotifications();
  assert.equal(calls, 0);
});

test('native notifications do not schedule after an in-flight permission request is unmounted', async () => {
  const runtime = hookRuntime();
  let resolvePermissions;
  const permissionRequest = new Promise(resolve => { resolvePermissions = resolve; });
  const scheduled = [];
  const { useNotifications } = load('hooks/use-notifications.ts', {
    react: runtime.react,
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true } },
    '@capacitor/app': { App: { addListener: async () => ({ remove() {} }) } },
    '@capacitor/local-notifications': {
      LocalNotifications: {
        requestPermissions: () => permissionRequest,
        createChannel: async () => {},
        deleteChannel: async () => {},
        checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
        getPending: async () => ({ notifications: [] }),
        cancel: async () => {},
        schedule: async request => scheduled.push(request),
      },
    },
    '@/lib/notificationSchedule': { buildMedicationNotifications: () => [{ id: 456, title: '이전 사용자 알림' }] },
  });

  const scheduledMedication = { ...medication, name: '이전 약', times: ['08:00'], days: ['mon'] };
  runtime.render(() => useNotifications([scheduledMedication], true, { morning: true, lunch: true, evening: true }));
  runtime.dispose();
  resolvePermissions({ display: 'granted' });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(scheduled, []);
});

test('turning notifications off invalidates an in-flight schedule', async () => {
  const runtime = hookRuntime();
  let resolvePermissions;
  const permissionRequest = new Promise(resolve => { resolvePermissions = resolve; });
  const scheduled = [];
  const { useNotifications } = load('hooks/use-notifications.ts', {
    react: runtime.react,
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true } },
    '@capacitor/app': { App: { addListener: async () => ({ remove() {} }) } },
    '@capacitor/local-notifications': {
      LocalNotifications: {
        requestPermissions: () => permissionRequest,
        createChannel: async () => {},
        deleteChannel: async () => {},
        checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
        getPending: async () => ({ notifications: [] }),
        cancel: async () => {},
        schedule: async request => scheduled.push(request),
      },
    },
    '@/lib/notificationSchedule': { buildMedicationNotifications: () => [{ id: 457, title: '해제된 알림' }] },
  });

  const scheduledMedication = { ...medication, times: ['08:00'], days: ['mon'] };
  const categories = { morning: true, lunch: true, evening: true };
  runtime.render(() => useNotifications([scheduledMedication], true, categories));
  runtime.render(() => useNotifications([scheduledMedication], false, categories));
  resolvePermissions({ display: 'granted' });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(scheduled, []);
  runtime.dispose();
});

test('a newer medication schedule invalidates an older in-flight schedule', async () => {
  const runtime = hookRuntime();
  const permissionResolvers = [];
  const scheduled = [];
  const { useNotifications } = load('hooks/use-notifications.ts', {
    react: runtime.react,
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true } },
    '@capacitor/app': { App: { addListener: async () => ({ remove() {} }) } },
    '@capacitor/local-notifications': {
      LocalNotifications: {
        requestPermissions: () => new Promise(resolve => permissionResolvers.push(resolve)),
        createChannel: async () => {},
        deleteChannel: async () => {},
        checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
        getPending: async () => ({ notifications: [] }),
        cancel: async () => {},
        schedule: async request => scheduled.push(request),
      },
    },
    '@/lib/notificationSchedule': {
      buildMedicationNotifications: meds => meds.map(med => ({ id: med.id, title: med.name })),
    },
  });

  const categories = { morning: true, lunch: true, evening: true };
  const oldMedication = { ...medication, id: 101, name: '삭제된 약', times: ['08:00'], days: ['mon'] };
  const currentMedication = { ...medication, id: 202, name: '현재 약', times: ['09:00'], days: ['tue'] };
  runtime.render(() => useNotifications([oldMedication], true, categories));
  runtime.render(() => useNotifications([currentMedication], true, categories));

  permissionResolvers[1]({ display: 'granted' });
  await new Promise(resolve => setImmediate(resolve));
  permissionResolvers[0]({ display: 'granted' });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(scheduled.flatMap(request => request.notifications.map(notification => notification.id)), [202]);
  runtime.dispose();
});

test('off-day medicines can be inspected and deleted without changing today progress', () => {
  const runtime = hookRuntime();
  const jsx = (type, props) => ({ type, props });
  const { TodayView } = load('components/views/TodayView.tsx', {
    react: runtime.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'framer-motion': { motion: new Proxy({}, { get: (_, key) => key }), useReducedMotion: () => true },
    'lucide-react': {},
    '@/components/common/MedIcon': {},
    '@/components/modals/MedicationDetailModal': { MedicationDetailModal: 'detail-dialog' },
    '@/components/modals/DeleteModal': { DeleteModal: 'delete-dialog' },
    '@/lib/notificationSchedule': { formatMedicationTime: time => time },
    '@/components/NotificationPopover': {},
    globals: { window: { setInterval: () => 1, clearInterval() {} } },
  });
  const todayMed = { ...medication, name: '오늘약', times: ['23:59'], dosage: '1정', days: ['mon'] };
  const offDayMed = { ...todayMed, id: 'off-day', name: '다른요일약', times: ['00:01'], days: ['tue'] };
  const deleted = [], toggled = [];
  const props = {
    meds: [todayMed], allMeds: [todayMed, offDayMed], hasAnyMeds: true,
    onToggle: id => toggled.push(id), onDelete: id => deleted.push(id),
    onAddClick() {}, onOpenSettings() {}, onToggleNotif() {}, onToggleCategory() {},
    dark: false, notifEnabled: true, categories: { morning: true, lunch: true, evening: true },
  };
  const render = () => runtime.render(() => TodayView(props));
  let tree = render();
  const findButton = label => elements(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || node.props.children === label));
  assert.equal(findButton('다른요일약 상세정보 열기'), undefined);
  findButton('전체 약 보기').props.onClick();
  runtime.flush();
  tree = render();
  assert.ok(findButton('다른요일약 상세정보 열기'));
  assert.equal(findButton('다른요일약 오늘 복용 완료 기록'), undefined);
  assert.equal(elements(tree).find(node => node.props?.role === 'progressbar').props['aria-valuenow'], 0);
  const nextDose = elements(tree).find(node => node.props?.['aria-label'] === '다음 복용 예정');
  assert.ok(nextDose);
  assert.equal(elements(nextDose).some(node => Array.isArray(node.props?.children) && node.props.children.includes('다른요일약')), false);
  findButton('다른요일약 상세정보 열기').props.onClick();
  runtime.flush();
  tree = render();
  const detail = elements(tree).find(node => node.type === 'detail-dialog');
  assert.equal(detail.props.med.id, offDayMed.id);
  detail.props.onDelete();
  runtime.flush();
  tree = render();
  elements(tree).find(node => node.type === 'delete-dialog').props.onConfirm();
  assert.deepEqual(deleted, ['off-day']);
  assert.deepEqual(toggled, []);
  runtime.dispose();
});

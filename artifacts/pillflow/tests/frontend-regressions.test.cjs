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
    useCallback(fn) { return fn; },
    useMemo(fn) { return fn(); },
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
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
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
    '@/lib/medicationRepository': { fetchMedications: () => new Promise(() => {}), toggleMedicationLog: persist },
  });
  const hook = runtime.render(() => useMedications('user-1'));
  return { runtime, hook };
}

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

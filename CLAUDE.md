# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

PillFlow — 복약 관리 앱. React SPA 하나를 웹(Vercel)과 Android 앱(Capacitor)으로 함께 배포한다.
프론트엔드는 pnpm workspace에 있고, Kotlin Spring Boot 백엔드는 루트 `backend/`의 독립 Gradle 프로젝트다.
현재 앱은 Supabase Auth와 Supabase PostgreSQL에 직접 연결하며, Spring Boot API는 향후 전환을 위한 기반이다.

## 명령어

pnpm만 사용한다 (루트 `preinstall`이 npm/yarn 설치를 막는다).

```bash
pnpm install

# 프론트엔드 개발 서버 (기본 포트 5173, PORT 환경변수로 변경)
pnpm --filter @workspace/pillflow dev

# 프론트엔드 타입체크
pnpm typecheck
pnpm --filter @workspace/pillflow typecheck   # 프론트만

# 전체 빌드 (typecheck 후 각 패키지 build) — 출력: artifacts/pillflow/dist/public
pnpm build

# 백엔드 테스트 (Docker Desktop 필요)
cd backend
./gradlew test

# Android 동기화 (저장소 루트에서)
pnpm build && pnpm exec cap sync android
```

Android 빌드·APK 설치·에뮬레이터 실행은 `pillflow-build` 스킬이 자동화한다.

### 테스트

프론트엔드 테스트 러너(vitest/jest)는 없다. `*.test.ts`는 `node:assert`로 작성된 독립 실행 스크립트이며, `@/` 경로 별칭 때문에 반드시 `artifacts/pillflow`에서 tsconfig를 지정해 실행한다:

```bash
cd artifacts/pillflow
../../scripts/node_modules/.bin/tsx --tsconfig tsconfig.json src/lib/notificationSchedule.test.ts
```

실패 시 assert 예외로 종료 코드가 0이 아니고, 성공 시 "모든 테스트 실행 완료"를 출력한다.

### 환경변수

`artifacts/pillflow/.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 필요 (`.env.example` 참고). 없으면 `src/lib/supabase.ts`가 import 시점에 throw한다.

## 아키텍처

### 현재 데이터 흐름 (중요)

프론트엔드는 **Supabase에 직접 접근**한다 (supabase-js + RLS). 사용자별 데이터 격리는 `medications.user_id` + RLS 정책으로 이뤄지므로, insert 시 `user_id`를 반드시 넣어야 한다.

```
App.tsx ─ useAuth (Google OAuth, Supabase Auth)
        └ useMedications(user.id) ─ lib/medicationRepository.ts ─ Supabase PostgREST
                                     └ lib/medicationMapper.ts (DB row → Medication)
```

`backend/`에는 Spring Boot API 기반과 Flyway 소유 스키마가 있다. 이번 단계에서는 앱의 API 호출을 전환하지 않는다.
운영 Supabase에는 2026-09-25 데이터 보존 `ALTER` 방식으로 V1 스키마가 이미 적용되었다(당시 `medications` 약 4행, `medication_logs` 약 8행, 계정 3개). V1 이외의 서버 런타임 role(V2)은 아직 적용되지 않았다. Flyway 이력 스키마는 비어 있으므로 운영 서버 연결 전 버전 1로 명시적 baseline을 한 번 실행한 뒤 migrate한다. 운영 DB에서 V1을 실행하지 않는다. 이후 DB 변경은 `backend/src/main/resources/db/migration`의 Flyway 마이그레이션으로 관리하고, 이 작업에서는 실제 Supabase에 연결하거나 변경하지 않는다.
Flyway 이력은 전용 `flyway` 스키마에 저장한다.
로그 날짜 컬럼은 `taken_on`이며 앱은 로컬 날짜 `YYYY-MM-DD` 문자열을 그대로 사용한다.

### 앱 구조

- 라우터 없이 `App.tsx`의 `view` 상태(`"today" | "add" | "stats"`)로 화면 전환 (framer-motion `AnimatePresence`). wouter는 의존성에만 있다.
- 설정값(다크모드, 알림 on/off, 시간대별 알림)은 `usePersisted`로 localStorage에 저장.
- `components/views/*` = 화면, `components/modals/*` = 모달, `components/ui/*` = shadcn/ui 생성 컴포넌트(직접 수정 지양).
- 스타일 색상은 `index.css`의 `--pf-*` CSS 변수(`bg-pf-bg`, `text-pf-subtext` 등)로 라이트/다크를 처리한다.

### 도메인 규칙

- `Medication.times`: `"HH:MM"` 배열(최대 4개). `Medication.days`: `"mon".."sun"` 배열. 오늘 표시 대상은 `App.tsx`에서 `days`로 필터링한다.
- 매퍼는 구버전 데이터 호환을 위해 `times`가 없으면 `time` 컬럼, `days`가 없으면 전체 요일로 fallback한다.
- 복용 완료 여부는 컬럼이 아니라 `medication_logs`에 **오늘 날짜(`YYYY-MM-DD`) 로그가 있는지**로 결정된다. 날짜는 반드시 `toLocalDateStr`/`getToday`(로컬 시간 기준)를 쓴다 — `toISOString()`은 KST 자정 부근에서 날짜가 어긋난다.
- 시간대 분류(`lib/timeCategory.ts`): 11시 미만 아침, 11~16시 점심, 17시 이상 저녁. 알림 팝오버 UI 문구와 짝을 이루므로 함께 수정한다.
- `useDayChange`가 자정에 약 목록을 재조회해 완료 상태를 리셋한다.

### 네이티브(Capacitor) 연동

- `Capacitor.isNativePlatform()`으로 분기. 알림(`use-notifications` + `lib/notificationSchedule.ts`), Android 뒤로가기, 카메라는 네이티브에서만 동작한다.
- OAuth 리다이렉트: 네이티브는 `com.pillflow.app://callback`, 웹은 `window.location.origin`. `capacitor.config.ts`의 `androidScheme: "https"`는 Supabase Auth에 필요하므로 유지한다.
- vaul Drawer 안에서 서브 모달을 띄울 때 Drawer가 포인터 이벤트를 가로채 닫기 버튼이 동작하지 않은 전례가 있다(커밋 04bb38b).

### 사진 분석 (약 정보 자동 입력)

`lib/photoAnalyzer.ts`가 Capacitor Camera로 촬영 → canvas로 1024px 리사이즈 → Supabase Edge Function `supabase/functions/analyze-medication-photo`(Deno) 호출. Edge Function은 사용자 JWT를 검증한 뒤 Groq API(`GROQ_API_KEY` 시크릿, Llama 4 Scout 비전 모델)로 분석한다. 배포는 Supabase MCP `deploy_edge_function`.

### Kotlin 백엔드 기반 (`backend/`)

- 독립 Gradle Kotlin DSL 프로젝트. Kotlin + Spring Boot, Spring Data JPA, Flyway, Spring Security OAuth2 Resource Server, Actuator를 사용한다.
- 기능별 패키지: `common`, `security`, `me`, `medication`, `intake`. 현재 공개 API는 인증 확인용 `GET /api/v1/me`와 Actuator health뿐이며, 약/복용 CRUD와 앱 전환은 다음 단계 범위다.
- Supabase JWT는 JWKS에서 ES256 공개 키를 받아 서명, issuer, `authenticated` audience, 만료를 검증한다. JWT `sub`를 UUID 사용자 ID로 사용한다.
- Hibernate는 스키마를 변경하지 않고 검증만 한다(`ddl-auto=validate`, `open-in-view=false`). 스키마 변경은 Flyway로만 한다.
- 로컬 설정은 `backend/.env.example`을 참고한다. 실제 값은 `.env`/환경변수로 주입하며 비밀번호·키를 커밋하지 않는다.
- 테스트: `cd backend && ./gradlew test` (Testcontainers의 PostgreSQL 17을 사용하므로 Docker 필요).

## 배포

- Vercel(웹) + AWS EC2(`api.pillflow.app`, Terraform `infra/terraform`, GitHub Actions `deploy.yml`).
- 웹: Vercel이 `pnpm --filter @workspace/pillflow build`로 빌드, `artifacts/pillflow/dist/public` 서빙, 모든 경로를 `/index.html`로 rewrite (`vercel.json`).
- Android: 같은 `dist/public`을 Capacitor `webDir`로 사용. `appId`(`com.pillflow.app`)는 변경 불가.
- 백엔드(`backend/`): `infra/terraform/{bootstrap,main}`이 EC2·ECR·SSM·IAM을 프로비저닝하고, `.github/workflows/deploy.yml`이 push/workflow_dispatch에서 이미지 빌드(backend 트리 해시 태그)·Flyway 마이그레이션·EC2 배포(SSM)·스모크 테스트를 수행한다. 운영 스크립트(`infra/scripts/put-secret.sh`, `flyway-baseline.sh`, `set-api-role-password.sh`)와 최초 가동 절차·롤백 방법은 `backend/README.md`의 "운영 배포" 절 참고. 2026-09-26 기준 이 절차는 아직 실행되지 않았다 — 운영 Supabase에는 2026-09-25 ALTER로 V1 스키마만 적용되어 있고, Flyway baseline(1)과 V2(`pillflow_api` role)는 미적용이다.

## 저장소 관례

- 커밋 메시지: `[Feat]`, `[Fix]`, `[Style]` 등 대괄호 태그 + 한국어 요약.
- 기능 설계/계획 문서는 `docs/superpowers/specs/`, `docs/superpowers/plans/`에 날짜 접두어로 저장한다.
- `pnpm-workspace.yaml`의 `minimumReleaseAge`(공급망 공격 방어)는 끄지 않는다. `react`/`react-dom`은 카탈로그에서 19.1.0으로 고정되어 있다.

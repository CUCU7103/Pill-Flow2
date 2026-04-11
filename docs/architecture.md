# Pill-Flow2 프로젝트 아키텍처 문서

> 최종 업데이트: 2026-04-08

---

## 1. 개요

PillFlow는 약 복용 관리 앱으로, **React 웹 앱 + Android 네이티브 앱(Capacitor)** 구조로 구성되어 있습니다.  
프론트엔드는 **Vercel**, 백엔드 API 서버는 **Supabase**, 데이터베이스도 **Supabase PostgreSQL**을 사용합니다.

---

## 2. 전체 배포 구조

```
┌─────────────────────────────────────────────────────────┐
│                     클라이언트                           │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  Android 앱      │    │   웹 브라우저              │  │
│  │  (Capacitor)     │    │                           │  │
│  └────────┬─────────┘    └─────────────┬─────────────┘  │
└───────────┼──────────────────────────┼─────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel (프론트엔드)                         │
│  React SPA (Vite 빌드)                                  │
│  도메인: pillflow.vercel.app (또는 커스텀 도메인)        │
│  빌드 명령: pnpm --filter @workspace/pillflow build      │
│  출력 경로: artifacts/pillflow/dist/public              │
└──────────────┬──────────────────────┬───────────────────┘
               │ REST API 호출         │ Supabase Auth 직접 연결
               ▼                      ▼
┌──────────────────────┐  ┌─────────────────────────────┐
│ Supabase (백엔드)    │  │ Supabase (Auth)             │
│ Express.js API 서버  │  │ 사용자 인증/세션 관리        │
│ /api/healthz 등      │  │ androidScheme: https 필수   │
└──────────┬───────────┘  └─────────────────────────────┘
           │ Drizzle ORM (DATABASE_URL)
           ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL (DB)                   │
│  테이블: medications, medication_logs                   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 모노레포 패키지 구조

```
Pill-Flow2/                         ← pnpm workspace 루트
├── artifacts/                      ← 배포 대상 애플리케이션
│   ├── pillflow/                   ← 프론트엔드 (Vercel 배포)
│   └── api-server/                 ← 백엔드 API 서버 (Supabase 배포)
│
├── lib/                            ← 공유 라이브러리 (배포 X)
│   ├── api-client-react/           ← orval 자동 생성 API 클라이언트
│   ├── api-spec/                   ← OpenAPI 스펙 (openapi.yaml)
│   ├── api-zod/                    ← Zod 유효성 검사 스키마
│   └── db/                         ← Drizzle ORM + DB 스키마
│
├── scripts/                        ← 빌드/유틸 스크립트
├── vercel.json                     ← Vercel 배포 설정
└── pnpm-workspace.yaml             ← 워크스페이스 & 패키지 카탈로그
```

---

## 4. 각 패키지 상세

### 4-1. `artifacts/pillflow` — 프론트엔드

| 항목 | 내용 |
|------|------|
| 프레임워크 | React 19 + Vite 7 |
| UI 라이브러리 | shadcn/ui (Radix UI 기반) |
| 스타일링 | Tailwind CSS v4 |
| 라우팅 | wouter |
| 서버 상태 | TanStack Query v5 |
| 폼 | react-hook-form + zod |
| 애니메이션 | framer-motion |
| 차트 | recharts |
| 네이티브 앱 | Capacitor v8 (Android) |
| Supabase | @supabase/supabase-js v2 |
| 앱 ID | com.pillflow.app |

**필요 환경변수 (.env.local)**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4-2. `artifacts/api-server` — 백엔드 API 서버

| 항목 | 내용 |
|------|------|
| 런타임 | Node.js (ESM) |
| 프레임워크 | Express.js v5 |
| 로깅 | pino + pino-http |
| 빌드 | esbuild (build.mjs) |

**API 엔드포인트**
```
GET /api/healthz  → 서버 상태 확인
```

**필요 환경변수**
```env
PORT=3000
DATABASE_URL=postgresql://...supabase...
ALLOWED_ORIGIN=https://your-vercel-app.vercel.app
```

### 4-3. `lib/db` — 데이터베이스 스키마

| 항목 | 내용 |
|------|------|
| ORM | Drizzle ORM |
| DB | PostgreSQL (Supabase) |
| 마이그레이션 | drizzle-kit push |

**테이블 구조**

```
medications (약 정보)
├── id            TEXT  PK (UUID)
├── name          TEXT  약 이름
├── dosage        TEXT  복용량 (예: "500mg")
├── dosage_amount INT   복용 개수 (기본값: 1)
├── remaining_quantity INT 잔여 수량 (기본값: 30)
├── time          TEXT  복용 시간
├── category      ENUM  morning / lunch / evening
├── type          ENUM  pill / capsule / liquid / packet
├── color         TEXT  앱 표시 색상 (기본값: #6C63FF)
├── created_at    TIMESTAMP
└── updated_at    TIMESTAMP

medication_logs (복용 기록)
├── id            TEXT  PK (UUID)
├── medication_id TEXT  FK → medications.id (CASCADE DELETE)
├── taken_at      TIMESTAMP
└── date          TEXT  YYYY-MM-DD (날짜별 조회용)
```

### 4-4. `lib/api-spec` — OpenAPI 스펙

- `openapi.yaml` 파일로 API 스펙 관리
- `orval` 로 `lib/api-client-react` 자동 코드 생성
- 코드 생성: `pnpm --filter @workspace/api-spec codegen`

---

## 5. Vercel 배포 설정

```json
// vercel.json
{
  "buildCommand": "pnpm --filter @workspace/pillflow build",
  "outputDirectory": "artifacts/pillflow/dist/public",
  "installCommand": "pnpm install",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- 모든 경로를 `/index.html`로 rewrite → React Router SPA 방식 지원
- 빌드 시 `@workspace/pillflow` 패키지만 빌드

---

## 6. Android 앱 빌드

Capacitor를 사용해 웹 앱을 Android 네이티브 앱으로 래핑합니다.

```typescript
// capacitor.config.ts
{
  appId: "com.pillflow.app",
  appName: "PillFlow",
  webDir: "dist/public",
  server: {
    androidScheme: "https"  // Supabase Auth 쿠키 호환 필수
  }
}
```

**빌드 명령** (프로젝트 루트에서 실행)
```bash
pnpm build && npx cap sync android
```

**Capacitor 플러그인**
- `@capacitor/local-notifications` — 복약 알림
- `@capacitor/splash-screen` — 스플래시 화면 (#F5F7FF)
- `@capacitor/status-bar` — 상태바 스타일 (LIGHT)

---

## 7. 로컬 개발 환경 설정

### 사전 요건
- Node.js, pnpm 설치
- Supabase 프로젝트 생성 (supabase.com)

### 설정 단계

1. **의존성 설치**
   ```bash
   pnpm install
   ```

2. **환경변수 설정**
   ```bash
   cp .env.example artifacts/pillflow/.env.local
   # .env.local 에 Supabase URL과 anon key 입력
   ```

3. **DB 스키마 적용**
   ```bash
   DATABASE_URL=postgresql://... pnpm --filter @workspace/db push
   ```

4. **개발 서버 실행**
   ```bash
   # 프론트엔드
   pnpm --filter @workspace/pillflow dev

   # 백엔드
   PORT=3001 DATABASE_URL=... pnpm --filter @workspace/api-server dev
   ```

---

## 8. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, Vite 7, Tailwind CSS v4 |
| 백엔드 | Express.js v5, Node.js (ESM) |
| 데이터베이스 | Supabase PostgreSQL + Drizzle ORM |
| 인증 | Supabase Auth |
| API 계층 | OpenAPI + orval 코드 생성 |
| 타입 안전성 | TypeScript, Zod |
| 모바일 | Capacitor v8 (Android) |
| 프론트 배포 | Vercel |
| 백엔드 배포 | Supabase |
| 패키지 관리 | pnpm workspace (모노레포) |

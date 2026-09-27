# 앱 데이터 경로 Kotlin API 전환 설계

> 작성일: 2026-09-26
> 범위: 하위 프로젝트 2 — 약·복용·통계 REST API 구현과 프론트엔드 전환

## 배경과 목표

하위 프로젝트 1(`2026-09-25-kotlin-backend-foundation-design.md`)에서 Spring Boot 서버 골격을 만들었다. 2026-09-26부터 서버는 `https://api.pillflow.app`에서 가동 중이다. 앱은 여전히 supabase-js로 PostgREST에 직접 접근한다.

이번 작업의 목표는 세 가지다.

1. 서버에 약 CRUD, 복용 토글, 주간 통계 API를 추가한다.
2. 프론트엔드가 환경변수 스위치로 서버 API를 쓰게 한다.
3. 통계 계산을 서버로 옮기면서 기존 통계 버그 두 가지를 고친다.

로그인(Supabase Auth, Google OAuth)과 사진 분석 Edge Function은 그대로 둔다.

## 결정 사항

- **전환 방식:** 빌드 시점 환경변수 `VITE_API_BASE_URL`로 전환한다.
  - 값이 있으면 Kotlin API를 쓴다.
  - 값이 없으면 기존 Supabase 직접 경로를 쓴다. 기존 통계 계산도 이 경로에서 그대로 유지한다. 이 경로는 롤백용이므로 동작을 바꾸지 않는다.
- **통계:** 서버에서 계산한다(`GET /api/v1/stats/weekly`).
- **연속 복용 일수(streak):** 서버에 만들지 않는다. `use-stats.ts`가 계산하지만 어떤 화면도 표시하지 않기 때문이다(YAGNI).
- **"오늘"의 기준:** 서버는 UTC로 동작하므로 날짜를 스스로 정하지 않는다. 클라이언트가 로컬 날짜 `YYYY-MM-DD`와 IANA 시간대(`Intl.DateTimeFormat().resolvedOptions().timeZone`)를 보낸다.
- **DB 스키마 변경 없음:** Flyway 마이그레이션을 추가하지 않는다.

## A. 백엔드 API

모든 엔드포인트는 인증이 필요하다. 사용자 ID는 `@CurrentUser`(JWT `sub`)에서 가져온다.

### 소유권 규칙 (보안 핵심)

`pillflow_api` role은 `BYPASSRLS`다. 이 경로에서는 RLS가 아무것도 막지 않는다. 따라서 모든 조회·수정·삭제 쿼리는 반드시 `user_id = 현재 사용자`로 필터링한다. 다른 사용자의 약 ID로 요청하면 존재 여부를 드러내지 않도록 **404 `MEDICATION_NOT_FOUND`**를 반환한다(403 아님).

### 엔드포인트

| 메서드 | 경로 | 동작 | 성공 |
|---|---|---|---|
| GET | `/api/v1/medications?date=YYYY-MM-DD` | 내 약 목록(`created_at` 오름차순). `completed`는 `date`에 복용 기록이 있는지로 계산 | 200 `MedicationResponse[]` |
| POST | `/api/v1/medications` | 약 추가 | 201 `MedicationResponse` (`completed=false`) |
| DELETE | `/api/v1/medications/{id}` | 약 삭제(기록은 FK cascade) | 204 |
| DELETE | `/api/v1/medications` | 내 약 전체 삭제(기록은 FK cascade) | 204 |
| PUT | `/api/v1/medications/{id}/intakes/{date}` | 해당 날짜 복용 기록. 이미 있으면 그대로 둔다(멱등) | 204 |
| DELETE | `/api/v1/medications/{id}/intakes/{date}` | 해당 날짜 복용 취소. 기록이 없어도 성공(멱등) | 204 |
| GET | `/api/v1/stats/weekly?today=YYYY-MM-DD&tz=<IANA>` | 주간 통계 | 200 `WeeklyStatsResponse` |

- `PUT .../intakes/{date}`는 네이티브 `INSERT ... ON CONFLICT (medication_id, taken_on) DO NOTHING`으로 구현한다. 조회 후 저장하는 방식은 빠른 연타 때 unique 제약 위반으로 500이 난다.
- intake 엔드포인트는 먼저 약이 현재 사용자 소유인지 확인한다. 아니면 404다.

### 요청·응답 형식

```jsonc
// POST /api/v1/medications 요청
{ "name": "비타민D", "dosage": "1", "memo": "", "times": ["08:00"], "type": "tablet", "color": "#6C63FF", "days": ["mon","wed","fri"] }

// MedicationResponse — 프론트엔드 Medication 타입과 같은 모양
{ "id": "uuid", "name": "비타민D", "dosage": "1", "memo": "", "times": ["08:00"], "type": "tablet", "color": "#6C63FF", "days": ["mon","wed","fri"], "completed": false }

// WeeklyStatsResponse — today를 포함해 끝나는 7일, 날짜 오름차순
{ "days": [ { "date": "2026-09-20", "scheduled": 2, "taken": 1, "rate": 50 }, { "date": "2026-09-21", "scheduled": 0, "taken": 0, "rate": null } ] }
```

- `memo`를 생략하면 `""`, `color`를 생략하면 `"#6C63FF"`다.
- 성공 본문에 공통 래퍼를 씌우지 않는다. 오류는 기존 `{code, message}` 형식이다.

### 입력 검증 → 400

잘못된 입력은 500이 아니라 400 `{code, message}`로 응답한다. 검증은 서비스 계층에서 `BusinessException`과 새 `ErrorCode`로 한다. validation starter는 추가하지 않는다.

- `name`, `dosage`: 앞뒤 공백 제거 후 비어 있으면 거부
- `times`: 1~4개, 각 값이 `^([01][0-9]|2[0-3]):[0-5][0-9]$`
- `days`: 1개 이상, `mon..sun`의 부분집합
- `type`: `tablet|syrup|powder|ointment|drops|inhaler`. 알 수 없는 값은 JSON 역직렬화 오류로 나와도 400이어야 한다.
- `date`, `today`: `YYYY-MM-DD`가 아니면 400
- `tz`: `ZoneId.of` 실패 시 400
- `id`: UUID 형식이 아니면 400

### 통계 규칙

`D`는 `today`로 끝나는 7일 중 하루다.

- **scheduled(D):** `D`의 요일이 `days`에 들어 있고, `created_at`을 `tz` 기준 로컬 날짜로 바꾼 값이 `D` 이하인 내 약의 수
- **taken(D):** `D`에 scheduled인 약 중 `D` 날짜 복용 기록이 있는 약의 수. 복용 예정이 아닌 날의 기록은 세지 않는다. 그래서 복용률이 100%를 넘지 않는다.
- **rate(D):** `scheduled = 0`이면 `null`. 아니면 `round(taken / scheduled * 100)`이다. 반올림은 기존 프론트엔드의 `Math.round`와 같게 한다.

고치는 버그는 두 가지다.

1. **요일 무시:** 기존에는 월·수·금 약도 매일 복용 대상으로 셌다.
2. **분모 고정:** 기존에는 과거 날짜도 현재 약 개수로 나눴다. 그래서 새 약을 추가하면 지난 복용률이 떨어졌다.

삭제한 약은 FK cascade로 기록까지 사라지므로 과거 통계에서도 빠진다. 이는 기존 동작과 같다.

## B. 프론트엔드

- **토큰:** 요청마다 `supabase.auth.getSession()`으로 access token을 얻는다(필요하면 갱신됨). 헤더는 `Authorization: Bearer <token>`이고, `credentials: 'include'`는 쓰지 않는다.
- **오류 처리:** 2xx가 아닌 응답은 `{code,message}`의 `message`로 `Error`를 던진다. 기존 UI가 `err.message`를 그대로 보여 주기 때문이다.
- **데이터 소스 선택:** 기존 `lib/medicationRepository.ts`(Supabase)는 그대로 두고 API 구현을 별도 모듈로 만든다. `VITE_API_BASE_URL` 유무로 둘 중 하나를 고르는 진입점을 두고, `use-medications.ts`는 그 진입점만 import한다. 함수 시그니처는 기존과 같게 유지해 훅 변경을 최소화한다.
- **통계:**
  - API 모드에서는 `use-stats.ts`가 `/api/v1/stats/weekly`를 호출하고, `date`를 요일 라벨(`일`~`토`)로 바꾼다.
  - Supabase 모드에서는 기존 계산 코드를 그대로 쓴다.
  - `rate`는 `number | null`이다. `StatsView`는 `null`을 높이 0인 막대로 그리고, 평균에서 뺀다. 7일이 모두 `null`이면 기존 빈 상태를 보여 준다.
- **환경변수:** `VITE_API_BASE_URL`은 빌드 시점에 번들에 포함된다. Vercel과 Android 빌드 모두 빌드할 때 값이 있어야 한다. `artifacts/pillflow/.env.example`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`(선택, 비우면 Supabase 직접 경로)을 적는다.
- CORS는 이미 Vercel 도메인, `https://pillflow.app`, Capacitor `https://localhost`를 허용하므로 서버 설정을 바꾸지 않는다.

## C. 테스트

### 백엔드

`./gradlew test`는 기존과 같이 Testcontainers를 사용한다. MockMvc와 테스트 EC 키로 서명한 JWT로 다음을 검증한다. skip이나 disabled는 쓰지 않는다.

- 약 CRUD 정상 흐름과 응답 모양
- 다른 사용자의 약에 대한 GET 목록 누락, DELETE, intake PUT/DELETE가 404이고 데이터가 바뀌지 않음. 전체 삭제는 내 약만 지움.
- intake PUT 두 번 → 둘 다 204, 기록 1건. 없는 기록 DELETE → 204.
- 위 검증 항목 각각이 400
- 통계:
  - 요일 필터(월·수·금 약은 화요일에 scheduled 0)
  - 생성일 이전 날짜 제외
  - 예정이 아닌 날의 기록 제외
  - `rate` null
  - 7일 범위와 정렬
  - 시간대 경계: `created_at = 2026-09-25T16:00:00Z`, `tz=Asia/Seoul`이면 로컬 날짜는 2026-09-26이다. 따라서 09-25에는 scheduled가 아니고 09-26에는 scheduled다.

### 프론트엔드

`tests/frontend-regressions.test.cjs`의 기존 방식으로 다음을 추가한다.

- API 클라이언트의 Authorization 헤더 구성
- 오류 응답을 `message`로 변환
- 통계 평균 계산에서 null 제외

## 제외 범위

- 실제 Supabase·운영 서버 연결과 변경. `git push`도 하지 않는다.
- Flyway 마이그레이션, `deploy.yml`, `infra/` 변경
- `authenticated` role의 테이블 권한 회수. Supabase 직접 경로가 롤백용으로 남아 있으므로 전환이 안정된 뒤 별도로 한다.
- 사진 분석 Edge Function 이전, streak 표시, UI 디자인 변경

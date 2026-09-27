# 민감정보 별도 동의 설계

> 작성일: 2026-09-27
> 근거: `2026-09-27-privacy-policy-review.md`(개인정보 처리방침 법적 검토)의 H1(민감정보 별도 동의 부재)과 M3(연령)

## 배경과 목표

복약 정보는 개인정보 보호법 제23조의 "건강에 관한 정보"에 해당할 가능성이 높다. 그러면 다른 동의와 별도로 동의를 받아야 한다. 지금 앱에는 동의 절차가 없다.

이번 작업의 목표는 세 가지다.

1. 복약 기능을 쓰기 전에 **만 14세 이상 확인**과 **민감정보 처리 별도 동의**를 받는다.
2. 사진 분석 기능은 처음 쓸 때 **사진 분석·국외(미국) 전송 동의**를 따로 받는다.
3. 동의 기록(항목, 처리방침 버전, 시각)을 **서버 DB에 남긴다**. 서버는 동의하지 않은 사용자의 복약 데이터 요청을 거부한다.

처리방침 본문(`artifacts/pillflow/public/privacy.html`)은 운영자가 이미 개정했다. 시행일은 2026-09-27이다. 이 작업에서 그 파일은 수정하지 않는다.

## 결정 사항 (운영자 확정)

- **동의 저장소:** 서버 DB. 서버가 동의 여부를 강제한다.
- **연령:** 만 14세 이상 확인. 만 14세 미만은 가입할 수 없다.
- **사진 동의:** 카메라 버튼을 처음 누를 때 별도로 받는다.
- **처리방침 버전 문자열:** `2026-09-27`. 서버와 프론트가 같은 상수를 쓴다. 버전이 바뀌면 다시 동의를 받는다.

## A. DB — Flyway `V3__user_consents.sql`

`search_path`에 의존하지 않도록 스키마 이름을 명시한다.

```sql
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('age_over_14','sensitive_health','photo_analysis')),
  policy_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_user_consents UNIQUE (user_id, consent_type, policy_version)
);
```

- **인덱스:** 조회는 `user_id` 기준이다. 유니크 제약의 선두 컬럼이 `user_id`라서 별도 인덱스는 필요 없다.
- **RLS와 권한:**
  - RLS를 켠다.
  - `authenticated`에는 본인 행만 SELECT·INSERT하는 정책을 둔다. `(select auth.uid()) = user_id`를 쓴다. 롤백용 Supabase 직접 경로에서도 동의를 기록할 수 있게 하려는 것이다.
  - UPDATE·DELETE 정책은 두지 않는다. 동의 기록은 추가만 한다.
  - Supabase 기본 권한 때문에 새 테이블에 `anon`과 `authenticated`의 ALL 권한이 자동으로 붙는다. 그래서 `REVOKE ALL ... FROM anon, authenticated`를 먼저 실행한 뒤 `GRANT SELECT, INSERT ... TO authenticated`를 준다.
  - V1의 패턴을 따른다.
- **pillflow_api 권한:** `pillflow_api` role이 있으면 `GRANT SELECT, INSERT ON public.user_consents`를 준다. `DO $$` 블록에서 role 존재 여부를 확인한다. 테스트 DB에서는 V2가 role을 만들므로 항상 존재한다.
- **운영 적용 방식:**
  - 운영 DB에는 배포 파이프라인의 migrate 단계가 자동으로 적용한다(flyway 계정, 이미 baseline 1 → V2까지 적용됨).
  - 데이터를 바꾸지 않는 추가형 마이그레이션이다.
  - 실제 Supabase에는 이 작업에서 직접 연결하지 않는다.
- **테스트 스텁:** `backend/src/test/resources/db/supabase-stub/V0__supabase_stub.sql`에 필요한 것(`auth.uid`, role 등)은 이미 있다.
- **baseline 픽스처 테스트:** 운영 재현 테스트(baseline 1 → migrate)에서 V2와 V3가 적용되는지 기대값을 갱신한다.

## B. 백엔드 API — 새 패키지 `consent`

기존 구조(Controller → Service → Repository, `BusinessException` + `ErrorCode`, `@CurrentUser`)를 따른다.

| 메서드 | 경로 | 동작 | 성공 |
|---|---|---|---|
| GET | `/api/v1/consents` | 현재 처리방침 버전 기준 동의 상태 | 200 `ConsentStatusResponse` |
| POST | `/api/v1/consents` | 동의 기록(멱등) | 200 `ConsentStatusResponse` |

```jsonc
// ConsentStatusResponse
{ "policyVersion": "2026-09-27", "ageOver14": true, "sensitiveHealth": true, "photoAnalysis": false }

// POST 요청
{ "policyVersion": "2026-09-27", "types": ["age_over_14", "sensitive_health"] }
```

**POST 규칙**
- `policyVersion`이 서버의 현재 버전과 다르면 400 `CONSENT_VERSION_MISMATCH`를 반환한다. 오래된 화면으로 동의하는 것을 막기 위해서다.
- `types`가 비어 있거나, 알 수 없는 값이나 null 원소가 있으면 400을 반환한다.
- `sensitive_health`를 넣으려면 `age_over_14`가 같은 요청에 있거나 이미 기록되어 있어야 한다. 없으면 400을 반환한다.
- 같은 (사용자, 항목, 버전)이 이미 있으면 새로 넣지 않는다. 네이티브 `INSERT ... ON CONFLICT DO NOTHING`을 쓴다.
- 현재 버전 상수는 `consent` 패키지에 둔다. 예: `const val CURRENT_POLICY_VERSION = "2026-09-27"`

**동의 강제**
- `/api/v1/medications/**`와 `/api/v1/stats/**` 요청은 현재 버전의 `age_over_14`와 `sensitive_health`가 둘 다 기록되어 있어야 한다.
- 없으면 **403** `{code:"CONSENT_REQUIRED", message:"복약 정보 처리에 대한 동의가 필요합니다."}`를 반환한다.
- 구현은 컨트롤러마다 흩어 넣지 말고 한 곳에 둔다. `HandlerInterceptor`나 서비스 진입점의 공통 가드 중 하나를 쓴다.
- `/api/v1/me`, `/api/v1/consents`, `/actuator/health`는 제외한다.
- 동의 조회는 요청마다 DB를 한 번 읽는다(`exists` 쿼리). 캐시는 쓰지 않는다(YAGNI).
- 사진 분석 동의(`photo_analysis`)는 서버 API가 강제하지 않는다. 사진 분석은 Supabase Edge Function이 처리하므로, 프론트에서 동의를 확인하고 기록을 남기는 것으로 한다. Edge Function에서 강제하는 것은 제외 범위다.

**오류 코드 추가:** `CONSENT_REQUIRED`(403), `CONSENT_VERSION_MISMATCH`(400), `INVALID_CONSENT`(400)

## C. 프론트엔드

**데이터 소스**
- 기존 medication 데이터 소스와 같은 방식으로 `isApiMode`에 따라 API 구현과 Supabase 구현 중 하나를 고른다.
  - API 모드: `GET`/`POST /api/v1/consents`
  - Supabase 모드(롤백용): `user_consents`를 PostgREST로 조회하고 insert한다. insert할 때 `user_id`는 필수다(RLS).
- 처리방침 버전 상수 `POLICY_VERSION = "2026-09-27"`을 한 곳(`constants.ts` 또는 `lib/consent*.ts`)에 둔다.
- 서버 응답이 403 `CONSENT_REQUIRED`이면 동의 상태를 다시 조회하고 동의 화면으로 보낸다. 기존 `apiClient`의 오류 변환은 message만 넘기므로, 오류 `code`도 알 수 있게 조금 확장한다. 예: Error에 `code` 속성을 추가한다.

**화면 흐름(`App.tsx`)**
1. 로그인 확인
2. 동의 상태 조회. 조회 중에는 기존 로딩 화면을 보여 준다.
3. `ageOver14 && sensitiveHealth`가 아니면 **ConsentView**를 보여 준다. 기존 화면(오늘·추가·통계)은 렌더링하지 않고, `useMedications`도 호출하지 않는다.
4. 동의가 끝나면 기존 앱을 연다.
5. 동의 상태 조회가 실패하면 오류 문구와 "다시 시도"를 보여 준다. 기존 medsError 화면과 같은 패턴이다.

**ConsentView 구성** (기존 디자인 토큰 `--pf-*`과 `DESIGN.md`의 톤을 따른다)
- 제목: "PillFlow를 시작하기 전에 확인해 주세요"
- 필수 체크 1: "만 14세 이상입니다."
- 필수 체크 2: "[필수] 민감정보(건강 정보) 처리에 동의합니다." 아래에 고지 내용을 펼쳐 보여 준다. 고지 항목은 법 제23조가 준용하는 제15조 제2항 각 호다.
  - 목적: 복약 일정 관리, 복용 기록, 통계 제공
  - 항목: 약 이름, 용량, 종류, 복용 시간·요일, 메모, 날짜별 복용 기록
  - 보유기간: 회원 탈퇴 시까지(탈퇴 요청 후 10일 이내 파기)
  - 거부 권리와 불이익: "동의를 거부할 수 있으며, 거부하면 복약 기록 기능을 이용할 수 없습니다."
  - 국외 처리 사실: 일본(AWS·Supabase)에서 저장·처리된다는 사실
- "전체 개인정보 처리방침 보기" 링크: 기존 PrivacyModal을 재사용한다.
- "동의하고 시작하기" 버튼: 두 체크가 모두 켜져야 활성화된다. 누르면 POST하고, 저장 중에는 로딩 상태를 보여 준다. 실패하면 오류 메시지를 보여 준다.
- "동의하지 않고 로그아웃" 버튼: 거부 경로. `signOut`을 호출한다.
- 접근성: 체크박스는 네이티브 `input type=checkbox` + `label`로 만들고, 포커스가 보이게 하고, 최소 터치 영역 44px를 확보한다.

**사진 분석 동의** (AddView의 카메라 버튼)
- `photoAnalysis`가 false인 상태에서 카메라 버튼을 누르면, 촬영하기 전에 **PhotoConsentModal**을 띄운다.
- 고지 내용:
  - 목적: 약 정보 자동 입력
  - 항목: 약 사진(1024px로 축소), 분석 결과
  - 받는 자와 국가: Groq, Inc., 미국(AI 분석)
  - 보관: 저장하지 않음. Groq는 오류·남용 조사 시 최대 30일 보관할 수 있음
  - 거부 권리: 거부해도 직접 입력으로 약을 등록할 수 있음
- 버튼은 "동의하고 촬영"과 "취소" 두 개다. 동의하면 `photo_analysis`를 POST한 뒤 기존 촬영 흐름을 이어서 진행한다.
- 모달은 vaul Drawer 안에 있지 않으므로 04bb38b 문제와는 관계없다. 다만 z-index가 기존 모달과 겹치지 않는지 확인한다.

## D. 테스트

**백엔드** (`./gradlew test`, Testcontainers, skip 금지)
- V3 마이그레이션 적용과 JPA validate(엔티티를 만들 경우)
- 권한
  - anon은 `user_consents`에 권한이 없다.
  - authenticated는 본인 행만 SELECT·INSERT할 수 있고, UPDATE·DELETE는 거부된다.
  - `pillflow_api`는 SELECT·INSERT만 가진다.
- 운영 baseline 재현 테스트에서 V2와 V3가 적용되고 기존 행이 유지된다.
- API
  - 동의 전에 GET을 부르면 전부 false다.
  - 둘 다 POST하면 true가 되고, 같은 요청을 반복해도 행이 늘지 않는다(멱등).
  - 버전이 다르면 400, `types`가 비어 있거나 알 수 없는 값이면 400이다.
  - `age_over_14` 없이 `sensitive_health`만 보내면 400이다.
- 강제
  - 동의 전 `/api/v1/medications`, `/api/v1/stats/weekly`, intake PUT은 403 `CONSENT_REQUIRED`다.
  - 동의 후에는 200이다.
  - `/api/v1/me`, `/api/v1/consents`는 동의 없이도 접근할 수 있다.
  - 사용자 A가 동의해도 사용자 B는 여전히 403이다.
- 기존 약·통계 통합 테스트는 픽스처에서 동의 행을 넣도록 고쳐서 계속 통과해야 한다.

**프론트** (`tests/frontend-regressions.test.cjs`의 기존 하네스)
- 동의 API 데이터 소스의 URL·메서드·본문(버전 포함)
- 403 `CONSENT_REQUIRED` 오류에서 `code`가 보존되는지
- ConsentView의 시작 버튼 활성화 조건(두 체크 모두 필요). 순수 함수로 분리해서 테스트한다.
- 사진 동의가 필요한지 판단하는 로직(순수 함수)

## 제외 범위

- `privacy.html` 수정(운영자가 완료함)
- 앱 내 회원 탈퇴 기능, 동의 철회 전용 UI(초기화·탈퇴로 철회)
- Edge Function에서 사진 동의를 강제하는 것, Groq ZDR 설정
- 실제 Supabase·운영 서버 연결, `git push`, `deploy.yml`·`infra/` 변경

# Kotlin 백엔드 기반 구축 설계

> 작성일: 2026-09-25
> 범위: 하위 프로젝트 1 — DB 스키마 정비 및 Spring Boot 서버 골격

## 배경과 목표

PillFlow는 복약 관리 앱이며 현재 React 앱이 Supabase JS를 통해 Supabase PostgreSQL에 직접 접근한다. 장기 목표는 앱 → Kotlin Spring Boot API → Supabase PostgreSQL 구조로 전환하는 것이며, 로그인은 Supabase Auth에 유지한다.

이 설계는 학습·포트폴리오와 실제 출시를 고려해 구조적 모범 사례와 자동화된 테스트를 요구한다. 2026-09-25 실제 데이터에는 `medications` 약 4행, `medication_logs` 약 8행, 계정 3개가 있었다. 기존 스키마에는 `(medication_id, date)` 고유 제약 부재, `date`의 text 형식, 구버전 `time`/`category` 컬럼 잔존, `medication_logs.user_id` nullable, `updated_at` 미갱신 문제가 있었다. 데이터 보존을 위해 같은 날 기존 스키마에 ALTER 방식으로 V1 결과를 적용했으며, Flyway baseline 절차는 별도 운영 준비 단계다. 이 설계의 실제 DB 적용은 사람이 별도로 검토한다.

## A. 백엔드 프로젝트

저장소 루트 `backend/`에 pnpm workspace와 독립된 Gradle Kotlin DSL 프로젝트 및 Gradle Wrapper를 둔다. Kotlin, 최신 안정 Spring Boot 4.0.x, Spring Data JPA, Flyway, Spring Security OAuth2 Resource Server, Actuator를 사용하며 구현 전 공식 문서/Maven Central에서 고정 버전과 starter 구성을 확인한다. PostgreSQL 17용 Flyway에는 `flyway-database-postgresql` 모듈이 필요하다. Spring Boot 4의 Flyway starter 분리 및 Jackson 3 등 바뀐 구성을 추측하지 않는다.

로컬 실행 JDK는 OpenJDK 25이며 21 설치나 툴체인 자동 다운로드에 의존하지 않는다. Gradle Wrapper는 JDK 25 실행을 지원하는 9.1 이상을 사용한다. 바이트코드는 Java `release=21`, Kotlin `jvmTarget=21`로 만든다. Kotlin 플러그인에는 `plugin.spring`, `plugin.jpa`를 적용한다.

루트 패키지는 `com.pillflow`이며 구조는 기능별로 나눈다.

```text
backend/src/main/kotlin/com/pillflow/
├── PillflowApplication.kt
├── common/      # ErrorCode, 비즈니스 예외, @RestControllerAdvice, 오류 응답 DTO
├── security/    # SecurityFilterChain, JWT 설정, @CurrentUser (JWT sub → UUID)
├── me/          # GET /api/v1/me, 인증 사용자 UUID 반환
├── medication/  # Medication 엔티티 + Spring Data 리포지토리만
└── intake/      # MedicationLog 엔티티 + Spring Data 리포지토리만
```

약·복용 서비스와 그 REST CRUD, 통계 API는 포함하지 않는다. JPA 설정은 `ddl-auto=validate`, `open-in-view=false`다. PostgreSQL `text[]`는 Hibernate 배열 매핑(`@JdbcTypeCode(SqlTypes.ARRAY)`), `med_type`은 PostgreSQL enum JDBC 매핑으로 처리한다.

`local`, `test` 프로파일을 제공한다. `application.yml`은 `${DB_URL}` 등 환경 변수만 참조하며 실제 연결값/비밀번호를 포함하지 않는다. `.env.example`에는 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `FLYWAY_USERNAME`, `FLYWAY_PASSWORD`, `SUPABASE_URL`, `CORS_ALLOWED_ORIGINS`와 설명을 둔다. Flyway는 `spring.flyway.user/password`의 `postgres` 계정을 사용하고 애플리케이션 datasource는 별도 `pillflow_api` 계정을 사용할 수 있게 한다.

## B. 인증과 오류 계약

Supabase 프로젝트 ref는 `igyydnnehdjrwujxqdry`이며 비대칭 ES256(P-256) 서명 키를 사용한다. 공유 시크릿은 사용하지 않는다. JWKS URI는 `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`이다. JWT 검증은 서명, 만료, issuer `${SUPABASE_URL}/auth/v1`, `aud`에 `authenticated` 포함을 확인한다. 사용자 ID는 `sub`다.

보안은 stateless이며 세션/CSRF를 비활성화한다. `/actuator/health`만 인증 없이 허용하고 나머지는 인증이 필요하다. `CORS_ALLOWED_ORIGINS`는 쉼표 구분 환경변수이며 예시에는 웹(Vercel 도메인)과 Capacitor Android 출처 `https://localhost`가 포함된다.

`GET /api/v1/me`는 `{"userId":"<uuid>"}`를 반환한다. 성공 본문에 공통 래퍼를 씌우지 않는다. 모든 오류는 `{"code":"ERROR_CODE","message":"한국어 메시지"}`이며 401/403도 동일한 JSON 형식이다.

## C. Flyway 스키마

마이그레이션은 `backend/src/main/resources/db/migration` 아래 둔다. 모든 테이블, 타입, 함수, role 및 참조는 스키마를 명시해 `search_path`에 의존하지 않는다.

### V1: 초기 스키마

V1은 빈 DB에 초기 스키마를 생성하는 기준 정의다. 데이터를 지우는 `DROP` 문을 포함하지 않는다. 운영 DB에는 2026-09-25 ALTER 방식으로 V1 결과가 이미 적용되어 있으므로 운영에서는 V1을 실행하지 않고 Flyway 버전 1 baseline 후 V2만 적용한다.

`public.med_type` 값: `tablet`, `syrup`, `powder`, `ointment`, `drops`, `inhaler`.

`public.medications`:
- `id uuid` PK, `gen_random_uuid()` 기본값
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `name text NOT NULL`, `dosage text NOT NULL`, `memo text NOT NULL DEFAULT ''`
- `type public.med_type NOT NULL`
- `color text NOT NULL DEFAULT '#6C63FF'`
- `times text[] NOT NULL`: 1~4개, 각 값은 `^([01][0-9]|2[0-3]):[0-5][0-9]$`와 일치
- `days text[] NOT NULL`: 비어 있지 않고 `mon,tue,wed,thu,fri,sat,sun` 부분집합
- `created_at`, `updated_at timestamptz NOT NULL DEFAULT now()`; a database trigger refreshes `updated_at` on every update, including direct PostgREST updates during the transition period.
- `user_id` 인덱스

배열 검사는 CHECK 표현식에서 서브쿼리를 쓰지 않는다. `array_length`, `<@`, 또는 불변(immutable) 헬퍼 함수로 제약을 구현한다. 헬퍼 함수를 만들면 `PUBLIC`, `anon`, `authenticated`에 대한 EXECUTE 권한을 명시적으로 회수한다.

`public.medication_logs`:
- `id uuid` PK, 기본값 `gen_random_uuid()`
- `medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `taken_on date NOT NULL`, `taken_at timestamptz NOT NULL DEFAULT now()`
- `UNIQUE (medication_id, taken_on)` 및 `(user_id, taken_on)` 인덱스

두 테이블 모두 RLS를 활성화한다. 성능 advisor 권고를 반영해 모든 정책에서 `auth.uid()`를 `(select auth.uid())`로 감싼다. `medications` UPDATE는 `USING`과 `WITH CHECK` 양쪽에서 사용자 소유권을 확인해 사용자가 자신의 행을 다른 `user_id`로 이전하지 못하게 한다. `medication_logs` INSERT는 `user_id`가 현재 사용자와 같은 것뿐 아니라 참조한 약 행도 현재 사용자 소유인지 `EXISTS`로 확인한다. 로그 SELECT/DELETE 및 medication SELECT/DELETE도 `(select auth.uid()) = user_id`를 사용한다.

실제 Supabase `public` 스키마에는 기본 권한이 있어서 `postgres`가 생성한 모든 테이블에 `anon`, `authenticated`, `service_role`의 ALL 권한(`arwdDxtm`), 모든 함수 EXECUTE, 시퀀스 `rwU`가 자동 부여된다. 따라서 V1은 생성 뒤 명시적으로 다음을 적용한다.

```sql
REVOKE ALL ON public.medications, public.medication_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications, public.medication_logs TO authenticated;
```

### Flyway 이력 위치

`public`은 기존 앱 테이블이 있고 기본 권한 때문에 이력 테이블은 Data API에 노출될 수 있다. 아래 설정으로 Flyway 전용 `flyway` 스키마를 생성해 히스토리 테이블을 둔다. 운영 DB는 ALTER 방식으로 V1을 이미 적용했지만 `flyway` 이력 스키마는 비어 있다. Flyway는 `flyway`만 관리하므로 `baseline-on-migrate`로 `public`의 기존 테이블을 자동 감지하지 못한다. 운영 서버 연결 전 버전 1로 명시적 baseline을 하고, 그 다음 migrate로 V2를 적용한다. 운영에서 V1을 실행하지 않는다. 실제 애플리케이션 DDL은 `public.`/`auth.`를 명시한다.

```yaml
spring.flyway.schemas: flyway
spring.flyway.default-schema: flyway
spring.flyway.create-schemas: true
```

### V2: 서버 런타임 role

`DO $$ ... $$`로 `pillflow_api` role이 없을 때만 비밀번호 없이 생성한다. `LOGIN`, `BYPASSRLS`를 설정한다. 비밀번호는 마이그레이션에 넣지 않으며 적용 후 사람이 `ALTER ROLE`로 설정한다. `public` 스키마 USAGE와 두 테이블의 SELECT/INSERT/UPDATE/DELETE만 부여하고 DDL 권한은 주지 않는다. Supabase 프로젝트에서 `postgres`가 BYPASSRLS role을 만들 수 있는지는 검증되지 않았으므로 적용 전 확인 사항으로 문서화한다. 2026-09-25 기준 운영 DB에는 V2가 아직 적용되지 않았다. Testcontainers의 PostgreSQL에서는 마이그레이션이 동작해야 한다.

## D. 테스트 전략

`cd backend && ./gradlew test`는 일반 PostgreSQL 17 Testcontainers와 테스트 전용 Supabase 스텁만 사용한다. 실제 Supabase 연결, Supabase CLI/MCP 및 운영 자격 증명 사용은 금지한다. 테스트 스텁 `backend/src/test/resources/db/supabase-stub/V0__supabase_stub.sql`은 test 프로파일 Flyway locations에만 포함하고 운영 locations에서는 제외한다.

V0는 `auth` 스키마와 `auth.users(id uuid PRIMARY KEY)`, `anon`/`authenticated`/`service_role` role(없으면 생성), `auth.uid()` (`nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`)를 만든다. 실제 프로젝트와 같은 `public` 기본 권한(테이블 ALL, 함수 EXECUTE, 시퀀스 권한)을 설정해 V1의 REVOKE가 효과가 있음을 검사한다.

테스트는 JUnit 5와 MockK를 쓰며 다음 계층을 모두 활성화한다(skip/disabled 금지).

1. **마이그레이션·JPA:** 빈 DB에서 V0/V1/V2 적용, 컨텍스트/JPA validate, 중복 `(medication_id, taken_on)` insert 거부, `times` 빈 배열/5개/잘못된 형식 거부, `days` 빈 배열/알 수 없는 값 거부, 엔티티 저장-조회 왕복(배열·enum 포함).
2. **권한:** anon은 두 테이블 권한 없음, authenticated는 SELECT/INSERT/UPDATE/DELETE만 있고 TRUNCATE 등은 없음, `pillflow_api`는 DML만 가지며 `CREATE TABLE public.x`는 거부, Flyway 히스토리는 `flyway`에 있고 `public`에는 없음.
3. **RLS:** `SET ROLE authenticated` 및 `set_config('request.jwt.claim.sub', <uuid>, true)`에서 타 사용자 행의 조회/수정/삭제가 차단되고 타 사용자 `user_id` insert가 거부된다. 자신의 약 `user_id`를 타 사용자로 바꾸는 UPDATE 및 타 사용자 소유 `medication_id`를 자기 `user_id`로 참조하는 로그 INSERT는 SQLSTATE `42501`로 거부된다.
4. **운영 baseline:** 테스트 전용 DB에 구 스키마를 만든 뒤 실제 적용 SQL과 동일한 ALTER 스크립트를 실행해 운영 결과를 재현한다. 이력을 제거한 뒤 Flyway baseline 1, migrate를 실행하면 V2만 적용되고 기존 행이 유지되며 JPA `validate`가 통과한다.
5. **HTTP 인증(MockMvc):** 테스트 EC P-256 키로 서명한 JWT를 사용하고 테스트 키로 `JwtDecoder`만 바꾼다. issuer/audience 검증기는 운영 코드와 동일하게 쓴다. 토큰 없음, 서명 오류, issuer 오류, audience 오류, 만료 토큰은 각각 401; 정상 토큰은 `/api/v1/me` 200 및 정확한 UUID; `/actuator/health` 무인증 200; 401 본문은 `{code,message}`.
6. **공통 오류:** `BusinessException`이 올바른 HTTP status와 `{code,message}`로 변환됨.

## E. Docker

`backend/Dockerfile`은 멀티스테이지 빌드로 Gradle에서 빌드하고 `eclipse-temurin:21-jre` 런타임을 사용한다. 컨테이너는 non-root 사용자로 실행하고 `/actuator/health`를 확인하는 `HEALTHCHECK`를 정의한다. `.dockerignore`도 포함한다.

## F. 프론트엔드 호환성

새 DB 컬럼 `medication_logs.date` → `taken_on`을 반영한다. `artifacts/pillflow/src/lib/medicationRepository.ts`, `artifacts/pillflow/src/hooks/use-stats.ts`와 `medication_logs`를 참조하는 모든 소스(`grep -rn "medication_logs" artifacts/pillflow/src`)를 검색한다. 컬럼/행 속성 참조를 `taken_on`으로 바꾸되 값은 현지 날짜 `YYYY-MM-DD` 문자열로 유지한다. `toggleMedicationLog`의 PostgreSQL 23505 중복 무시 로직은 새 unique 제약과 함께 유지한다. 그 밖의 프론트 동작과 UI는 바꾸지 않는다.

## 제외 범위

- 실제 Supabase에 어떤 변경도 하지 않는다: Flyway 실행, MCP/CLI/대시보드 DDL·DML, role 비밀번호 변경, 권한 회수 실행은 금지한다. 사람이 별도 검토 후 적용한다.
- 약 CRUD, 복용 토글, 통계 REST API 및 앱 fetch 전환은 다음 프로젝트 범위다.
- 사진 분석 Edge Function 변경/이전, 배포/호스팅/CI, `prod` 프로파일, Android 네이티브 코드·Capacitor 설정·UI 스타일은 변경하지 않는다.
- pnpm-workspace.yaml의 `minimumReleaseAge`는 변경하지 않는다.
- unrelated uncommitted `DESIGN.md`, `docs/design-concept/`, `.omc/` 파일은 가져오거나 만들지 않는다.

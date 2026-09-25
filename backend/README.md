# PillFlow Kotlin 백엔드 기반

Spring Boot 4.0.8 + Kotlin 기반 독립 Gradle 프로젝트다. 현재 앱은 Supabase Auth와 PostgREST에 직접 연결하며 이 서버는 전환을 위한 기반 단계다. 제공 API는 인증 확인용 `GET /api/v1/me`와 Actuator health이며, 복약 API와 앱 전환은 포함하지 않는다.

## 요구 환경과 실행

- 로컬 실행 JDK: OpenJDK 25. Java와 Kotlin 바이트코드는 21을 대상으로 한다. Wrapper는 Gradle 9.3.0이다.
- 백엔드 테스트에는 Docker Desktop이 필요하다.
- 필요한 런타임 변수는 `.env.example`에 설명되어 있다. 실제 비밀번호를 입력할 로컬 `.env`는 Git에서 무시되며 커밋하지 않는다.

```bash
cp .env.example .env
# .env의 DB 연결값과 비밀번호를 로컬 개발용으로 설정
set -a && source .env && set +a  # Spring Boot는 .env를 자동으로 읽지 않음
./gradlew bootRun --args='--spring.profiles.active=local'
```

`DB_URL`은 JDBC URL(`jdbc:postgresql://...`)이다. 앱 런타임 datasource 사용자(`DB_USERNAME`, 보통 `pillflow_api`)와 Flyway DDL 사용자(`FLYWAY_USERNAME`, 보통 DB role `postgres`)는 분리한다. JWT는 `SUPABASE_URL`에서 JWKS를 받아 ES256 서명, issuer, `authenticated` audience, 만료를 검증한다. JWT 공유 시크릿은 사용하지 않는다. 허용 출처는 `CORS_ALLOWED_ORIGINS`의 쉼표 구분 목록이다.

## 테스트와 Docker

```bash
./gradlew test
docker build -t pillflow-api:dev .
```

테스트는 PostgreSQL 17 Testcontainers와 `src/test/resources/db/supabase-stub/V0__supabase_stub.sql`만 사용한다. V0는 `test` 프로파일에서만 마이그레이션되며 운영 Flyway locations에는 포함되지 않는다. 테스트는 스키마/제약/JPA 매핑, 역할 권한, RLS, EC P-256 JWT 인증, 오류 응답을 확인한다. 별도 Testcontainers DB에서는 구 스키마에 적용 SQL을 실행한 뒤 baseline(1), migrate(V2만), 기존 행 유지, JPA `validate`도 검증한다. 실제 Supabase에는 연결하지 않는다.

## Flyway 스키마 소유권

Hibernate는 `ddl-auto=validate`만 수행하며 DDL 소유자는 Flyway다. 운영 마이그레이션은 `src/main/resources/db/migration`에 있다. Flyway는 `spring.flyway.schemas=flyway`, `default-schema=flyway`, `create-schemas=true`로 전용 `flyway` 스키마에 이력 테이블을 둔다. 기존 앱 테이블이 있는 Supabase `public`을 Flyway 관리 스키마 목록에서 분리해 이력 테이블을 Data API 노출과 자동 baseline 판단에서 격리한다. 운영 DB의 기존 스키마를 Flyway에 등록하기 위한 명시적 baseline은 아래 절차대로 별도로 필요하다. 마이그레이션 대상은 SQL에서 `public.`/`auth.`를 명시한다. 약의 `updated_at`은 DB 트리거가 갱신하므로 현재 PostgREST 직접 업데이트와 향후 API 쓰기 모두 같은 규칙을 따른다.

`V1__init.sql`은 빈 DB에 초기 스키마를 생성하며 `DROP` 문을 포함하지 않는다. 운영 DB에는 2026-09-25 데이터 보존 `ALTER` 방식으로 V1 결과가 이미 적용되었다. 당시 `medications` 약 4행, `medication_logs` 약 8행, 계정 3개였다. 운영 DB에서 V1을 실행하면 안 된다. V2는 비밀번호 없는 `pillflow_api LOGIN BYPASSRLS` role을 만들며, 2026-09-25 기준 운영 DB에는 아직 적용되지 않았다. Supabase에서 `BYPASSRLS` role 생성이 허용되는지도 실제 적용 전 확인해야 한다.

### 운영 DB 명시적 baseline (한 번만)

운영 DB의 `public` 테이블은 이미 ALTER로 갱신됐지만, Flyway 이력 전용 `flyway` 스키마는 비어 있다. 현재 설정처럼 `schemas=flyway`만 관리하면 `baseline-on-migrate`는 `public`의 기존 객체를 감지하지 못한다. 따라서 운영 서버를 연결하기 전에 `flyway_schema_history`에 버전 1을 명시적으로 baseline해야 한다. baseline은 SQL V1을 실행하지 않으며, 그 뒤 `migrate`를 실행하면 V1을 건너뛰고 V2부터 실행한다. 공식 문서에서 `baselineVersion`은 해당 버전까지의 migration을 제외하고, `schemas`/`defaultSchema`는 Flyway 관리 범위와 이력 테이블 위치를 정한다 ([baseline](https://documentation.red-gate.com/flyway/reference/commands/baseline), [baselineVersion](https://documentation.red-gate.com/fd/flyway-baseline-version-setting-277578975.html), [schemas](https://documentation.red-gate.com/flyway/reference/configuration/environments-namespace/environment-schemas-setting), [defaultSchema](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-default-schema-setting)).

아래는 적용 절차 기록이며 이 작업에서는 실행하지 않는다. 실제 target, 백업, 권한, `BYPASSRLS` 지원을 사람이 검토한 뒤에만 수행한다. 명령은 `backend/`에서 실행하고 비밀번호는 로컬 환경변수에서 읽어 인자로 전달하지 않는다.

```bash
cd backend
export FLYWAY_URL="$DB_URL"
export FLYWAY_USER="$FLYWAY_USERNAME"
# FLYWAY_PASSWORD는 승인된 로컬 환경에서 안전하게 주입되어 있어야 한다.
flyway \
  -locations='filesystem:src/main/resources/db/migration' \
  -schemas=flyway \
  -defaultSchema=flyway \
  -baselineVersion=1 \
  -failOnMissingLocations=true \
  baseline
flyway \
  -locations='filesystem:src/main/resources/db/migration' \
  -schemas=flyway \
  -defaultSchema=flyway \
  -failOnMissingLocations=true \
  migrate
```

`FLYWAY_URL`, `FLYWAY_USER`, `FLYWAY_PASSWORD`는 Flyway CLI의 공식 환경변수다 ([URL](https://documentation.red-gate.com/fd/environment-url-setting-277578933.html), [user](https://documentation.red-gate.com/flyway/reference/configuration/environments-namespace/environment-user-setting), [password](https://documentation.red-gate.com/fd/environment-password-setting-277578929.html)). `-locations`는 실행 디렉터리 기준의 migration 경로이며 위 옵션명과 `-baselineVersion`은 공식 CLI 형식이다 ([locations](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-locations-setting), [baselineVersion](https://documentation.red-gate.com/fd/flyway-baseline-version-setting-277578975.html)). 이 순서는 운영 DB에서 V1을 실행하지 않고 baseline version 1을 기록한 다음 V2만 실행하기 위한 것이다. Flyway 버전/연결 대상이 맞는지, baseline history row가 버전 1인지 먼저 확인한다.

## 실제 Supabase 적용 절차 — 별도 사람 검토 후에만

**이 워크트리의 구현/테스트는 실제 Supabase에 접속하거나 마이그레이션하지 않는다. 이 절차도 지금 실행하지 않는다.** 운영 DB는 이미 ALTER로 V1 결과가 적용되어 있어 V1 직접 실행 대상이 아니다. 별도 검토·승인 후 명시적 baseline(1)과 V2 적용만 수행한다.

1. Supabase 대시보드에서 최신 백업, 연결 target, 현재 데이터·의존 객체와 운영 V1 스키마 상태를 확인한다. 운영 DB는 데이터 보존 ALTER 방식으로 이미 V1 결과가 적용되어 있으므로 V1을 다시 실행하지 않는다.
2. 먼저 Supabase에서 `pillflow_api` 생성과 `BYPASSRLS` 속성이 허용되는지 확인한다. Flyway history의 `flyway` 스키마 설계, `authenticated`의 기존 PostgREST DML 접근 유지, `anon` 권한 회수 범위도 검토한다.
3. Supabase Dashboard의 **Connect**에서 실제 연결 문자열을 복사한다. IPv4 네트워크라면 Supavisor **Session pooler**의 포트 `5432`를 사용할 수 있다. JDBC 형식은 `jdbc:postgresql://<대시보드에서-복사한-pooler-host>:5432/postgres?sslmode=require`이며, pooler host는 대시보드에서 복사한다(지역만으로 조합하지 않는다). 공유 pooler에서 역할명은 프로젝트 ref를 포함하므로 예를 들어 `DB_USERNAME=pillflow_api.<project-ref>`, `FLYWAY_USERNAME=postgres.<project-ref>` 형식이다. 직접 DB 접속을 쓰는 환경이라면 username 형식은 각각 `pillflow_api`, `postgres`다.
4. V2는 런타임 role 비밀번호를 설정하지 않는다. 승인된 수동 절차로 `ALTER ROLE pillflow_api PASSWORD '<비밀값>';`을 실행하고 해당 비밀번호를 런타임 `DB_PASSWORD`로 안전하게 주입한다. Flyway에는 관리자 자격 증명을 `FLYWAY_USERNAME`/`FLYWAY_PASSWORD`로 별도 주입한다. 이 값은 `.env.example`, 소스 코드, 로그에 기록하지 않는다.
5. 최종 접속 대상·권한·백업을 재확인한 뒤 위 baseline을 한 번만 실행하고, 그 다음 CLI 또는 승인된 Spring Boot 실행으로 Flyway V2를 적용한다. 적용 후 Flyway 이력 위치, `pillflow_api`가 DML만 수행할 수 있는지, anon/authenticated 권한 및 RLS를 확인하고 Supabase `get_advisors` 결과를 검토한다.

Supavisor는 database pooler라서 연결 모드별 사용자명 규칙이 다르다. 세션 모드 사용 시에도 대시보드에서 해당 프로젝트의 host/port를 직접 복사하고 위처럼 role에 `.<project-ref>`를 붙인다. [Supabase 연결 문서](https://supabase.com/docs/guides/database/connecting-to-postgres) 참고.

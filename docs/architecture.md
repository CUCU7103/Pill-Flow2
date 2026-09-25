# PillFlow 아키텍처

> 최종 업데이트: 2026-09-25

## 1. 현재 구조와 목표

PillFlow는 React SPA를 웹(Vercel)과 Android(Capacitor)에서 사용한다. 현재 앱은 로그인에 Supabase Auth를 사용하고, 복약 데이터를 Supabase PostgREST로 직접 읽고 쓴다. `backend/`의 Kotlin Spring Boot 서버와 Flyway 스키마는 서버 전환을 위한 기반 단계이며 아직 약·복용 API나 앱의 API 전환을 포함하지 않는다.

```text
현재:  웹 / Android 앱 ── Supabase Auth + PostgREST ── Supabase PostgreSQL
목표:  웹 / Android 앱 ── Kotlin Spring Boot API ───── Supabase PostgreSQL
                         └─ Supabase Auth 로그인은 유지
```

로그인 세션은 Supabase Auth가 계속 담당한다. 향후 앱은 Supabase access token을 Spring API에 전달하고, 서버는 Supabase JWKS의 ES256 공개 키로 JWT의 서명·issuer·audience·만료를 검증한다. 이번 기반 단계에서는 인증 확인용 `GET /api/v1/me`만 제공한다.

## 2. 저장소 구조

```text
Pill-Flow2/
├── artifacts/pillflow/                 # React/Vite 앱 (웹 + Capacitor Android)
├── backend/                             # 독립 Gradle Kotlin DSL 프로젝트
│   └── src/main/kotlin/com/pillflow/
│       ├── common/                      # 공통 에러 응답, 비즈니스 예외
│       ├── security/                    # Supabase JWT 인증, 현재 사용자 바인딩
│       ├── me/                          # GET /api/v1/me
│       ├── medication/                  # Medication 엔티티/리포지토리
│       └── intake/                      # MedicationLog 엔티티/리포지토리
├── docs/                                # 아키텍처 및 설계 문서
├── scripts/                             # 프론트엔드 도구
└── supabase/functions/                 # 사진 분석 Edge Function
```

`backend/`는 pnpm workspace 밖에 있다. 프론트엔드 의존성·빌드와 백엔드 Gradle 빌드는 독립적으로 관리한다.

## 3. 프론트엔드와 현재 데이터 흐름

`artifacts/pillflow`는 React 19, Vite, Tailwind CSS, TanStack Query, Supabase JS, Capacitor(Android)를 사용한다. 앱 로그인은 `useAuth`가 Supabase Auth로 수행한다. 약과 복용 기록은 `medicationRepository.ts`가 Supabase에 직접 요청하며, 매퍼가 DB 행을 앱 도메인 모델로 변환한다. 복용일은 현지 날짜 `YYYY-MM-DD`이며 DB의 `medication_logs.taken_on`과 대응한다. `toLocalDateStr`/`getToday`를 사용하고 UTC 기준 `toISOString()`으로 날짜를 계산하지 않는다.

앱의 OAuth 리다이렉트와 Capacitor 설정은 유지한다. 사진 분석은 앱에서 Supabase Edge Function을 호출하는 현재 흐름을 유지하며, 본 서버 기반 단계에서 이전하지 않는다.

## 4. 백엔드 경계

`backend/`는 Kotlin + Spring Boot 4, Spring Data JPA, Flyway, Spring Security OAuth2 Resource Server, Actuator로 구성하는 독립 API 서비스다. 도메인 패키지는 기능 단위로 분리한다. 이번 단계에서 약·복용 엔티티와 Spring Data 리포지토리는 마련하지만 서비스 계층, CRUD/통계 엔드포인트, 이미지 분석은 구현 범위가 아니다.

인증되지 않은 접근은 거부하고 `/actuator/health`만 공개한다. `/api/v1/me`는 인증된 JWT의 `sub` UUID를 `{"userId":"<uuid>"}`로 반환한다. 오류는 상태 코드와 함께 `{"code":"ERROR_CODE","message":"한국어 메시지"}` 형식을 사용한다. 서버는 stateless이며 세션과 CSRF를 사용하지 않는다. CORS 허용 출처는 `CORS_ALLOWED_ORIGINS`로 주입한다.

JPA는 `ddl-auto=validate`, `open-in-view=false`로 실행하며 DB DDL의 소유자는 Flyway다. `times`/`days`의 PostgreSQL `text[]` 배열과 `med_type` enum은 Hibernate/PostgreSQL 형식에 맞게 명시적으로 매핑한다.

## 5. 데이터베이스와 마이그레이션 소유권

PostgreSQL 17을 사용한다. 목표 스키마는 Flyway SQL(`backend/src/main/resources/db/migration`)로 선언적으로 관리한다. Flyway 실행용 계정과 앱 런타임 계정은 분리한다. Flyway는 `postgres` 자격 증명을 사용하고, 애플리케이션은 DML 권한만 있는 `pillflow_api`를 사용할 수 있도록 구성한다.

Flyway 기록은 전용 `flyway` 스키마에 보관한다. 테이블은 PostgREST에 노출되는 `public`에 명시적으로 만든다. `medications`와 `medication_logs`에는 사용자 소유권 RLS가 설정되고, 현재 프론트엔드 직접 접근을 위해 `authenticated`에 필요한 DML 권한이 유지된다. `anon` 권한은 회수한다. 서버 런타임 role은 RLS를 우회하도록 설계하지만 실제 Supabase에서 role 생성과 `BYPASSRLS` 허용 여부는 적용 전에 별도로 확인해야 한다.

운영 Supabase에는 2026-09-25 기존 데이터를 보존하는 `ALTER` 방식으로 V1 스키마가 이미 적용되었다. 당시 `medications` 약 4행, `medication_logs` 약 8행, 계정 3개였으며 `pillflow_api` role(V2)은 아직 적용되지 않았다. 앱 테이블은 `public`에 있지만 `spring.flyway.schemas=flyway`로 관리되는 이력 스키마는 비어 있으므로, `baseline-on-migrate`에 맡기지 않고 운영 서버 연결 전에 버전 1로 명시적 baseline을 한 번 실행해야 한다. baseline 후 migrate는 V1을 건너뛰고 V2부터 적용한다. 운영 DB에서 V1을 직접 실행하지 않는다.

저장소의 `V1__init.sql`은 빈 DB에서 초기 스키마를 만들며 데이터를 삭제하는 `DROP` 문은 포함하지 않는다. 적용된 운영 스키마는 Testcontainers에서 구 스키마와 ALTER 절차를 재현한 뒤 Flyway baseline(1), migrate(V2), JPA `validate`까지 확인한다. 실제 Supabase 연결이나 변경은 별도 사람 검토 전까지 하지 않는다.

## 6. 개발 및 검증

프론트엔드:

```bash
pnpm install
pnpm typecheck
pnpm build
cd artifacts/pillflow
../../scripts/node_modules/.bin/tsx --tsconfig tsconfig.json src/lib/notificationSchedule.test.ts
```

백엔드(로컬 JDK 25 실행, Java/Kotlin 바이트코드 타깃 21):

```bash
cd backend
cp .env.example .env  # 로컬 전용 값 입력, 커밋하지 않음
set -a && source .env && set +a  # Spring Boot는 .env 파일을 자동 로드하지 않음
./gradlew test         # Testcontainers / Docker 필요
docker build -t pillflow-api:dev .
```

백엔드 테스트는 일반 PostgreSQL 17 Testcontainers와 테스트 전용 Supabase 스텁을 사용한다. 운영 Supabase에 접속하지 않으며 JWT 검증, 스키마/권한/RLS, JPA 매핑과 공통 오류 처리를 테스트한다.

## 7. 이후 전환 단계

1. 기반: DB 스키마 정비, 인증 가능한 Spring Boot 골격, 엔티티와 테스트.
2. 약 및 복용 API 구현 후 앱 저장소를 Spring API로 전환.
3. 통계 API 이전.
4. 사진 분석 기능 이전 여부 결정 및 구현.
5. 배포·CI 구성.

이번 단계는 1번만 다룬다. 향후 단계가 실제 DB 적용, 신규 REST API, 앱 전환 또는 운영 인프라 변경을 포함할 수 있으나 현재 구현에서는 이를 앞당기지 않는다.

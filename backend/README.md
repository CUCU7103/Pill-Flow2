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

실제 적용은 CLI를 직접 두드리지 않고 `infra/scripts/flyway-baseline.sh`로 실행한다. 이 스크립트는 SSM `/pillflow/prod/migration/*`(FLYWAY_URL, FLYWAY_USERNAME, FLYWAY_PASSWORD)에서 접속 정보를 읽어 `flyway/flyway:11.14.1` 컨테이너로 `-baselineVersion=1 baseline`을 실행한 뒤 `info`로 결과를 출력한다. 최초 1회만 실행하며, 실행 전 실제 target·백업·권한·`BYPASSRLS` 지원을 사람이 검토한다. 사용법과 실행 순서는 아래 "운영 배포" 절을 참고한다.

## 실제 Supabase 적용 절차 — 별도 사람 검토 후에만

**이 워크트리의 구현/테스트는 실제 Supabase에 접속하거나 마이그레이션하지 않는다. 이 절차도 지금 실행하지 않는다.** 운영 DB는 이미 ALTER로 V1 결과가 적용되어 있어 V1 직접 실행 대상이 아니다. 별도 검토·승인 후 명시적 baseline(1)과 V2 적용만 수행한다.

1. Supabase 대시보드에서 최신 백업, 연결 target, 현재 데이터·의존 객체와 운영 V1 스키마 상태를 확인한다. 운영 DB는 데이터 보존 ALTER 방식으로 이미 V1 결과가 적용되어 있으므로 V1을 다시 실행하지 않는다.
2. 먼저 Supabase에서 `pillflow_api` 생성과 `BYPASSRLS` 속성이 허용되는지 확인한다. Flyway history의 `flyway` 스키마 설계, `authenticated`의 기존 PostgREST DML 접근 유지, `anon` 권한 회수 범위도 검토한다.
3. Supabase Dashboard의 **Connect**에서 실제 연결 문자열을 복사한다. IPv4 네트워크라면 Supavisor **Session pooler**의 포트 `5432`를 사용할 수 있다. JDBC 형식은 `jdbc:postgresql://<대시보드에서-복사한-pooler-host>:5432/postgres?sslmode=require`이며, pooler host는 대시보드에서 복사한다(지역만으로 조합하지 않는다). 공유 pooler에서 역할명은 프로젝트 ref를 포함하므로 예를 들어 `DB_USERNAME=pillflow_api.<project-ref>`, `FLYWAY_USERNAME=postgres.<project-ref>` 형식이다. 직접 DB 접속을 쓰는 환경이라면 username 형식은 각각 `pillflow_api`, `postgres`다.
4. V2는 런타임 role 비밀번호를 설정하지 않는다. V2 적용(`migrate_only=true` 배포)이 끝난 뒤 `infra/scripts/set-api-role-password.sh`를 실행한다. 이 스크립트가 무작위 비밀번호를 생성해 `pillflow_api`에 `ALTER ROLE`로 설정하고 같은 값을 SSM `/pillflow/prod/app/DB_PASSWORD`에 저장하므로, 비밀번호는 화면·로그·소스 코드 어디에도 남지 않는다.
5. 최종 접속 대상·권한·백업을 재확인한 뒤 `infra/scripts/flyway-baseline.sh`를 한 번만 실행하고, 그 다음 `gh workflow run deploy.yml --ref main -f migrate_only=true`로 Flyway V2를 적용한다. 적용 후 Flyway 이력 위치, `pillflow_api`가 DML만 수행할 수 있는지, anon/authenticated 권한 및 RLS를 확인하고 Supabase `get_advisors` 결과를 검토한다.

Supavisor는 database pooler라서 연결 모드별 사용자명 규칙이 다르다. 세션 모드 사용 시에도 대시보드에서 해당 프로젝트의 host/port를 직접 복사하고 위처럼 role에 `.<project-ref>`를 붙인다. [Supabase 연결 문서](https://supabase.com/docs/guides/database/connecting-to-postgres) 참고.

## 운영 배포

AWS EC2(`api.pillflow.app`) 인프라는 `infra/terraform`(Terraform), 배포 자동화는 `.github/workflows/deploy.yml`(GitHub Actions)이 담당한다. 아래는 **최초 가동을 위해 사람이 순서대로 수행해야 할 절차**이며, 이 문서 자체는 절차를 수행하지 않았다 — 실행은 별도 승인 후 진행한다.

### SSM 파라미터

| 경로 | 타입 | 내용 | 읽는 주체 |
|---|---|---|---|
| `/pillflow/prod/app/DB_URL` | String | 앱 런타임 JDBC URL | EC2 인스턴스 role |
| `/pillflow/prod/app/DB_USERNAME` | String | `pillflow_api.<project-ref>` | EC2 인스턴스 role |
| `/pillflow/prod/app/SUPABASE_URL` | String | JWKS 조회용 Supabase 프로젝트 URL | EC2 인스턴스 role |
| `/pillflow/prod/app/CORS_ALLOWED_ORIGINS` | String | 허용 출처 목록 | EC2 인스턴스 role |
| `/pillflow/prod/app/DB_PASSWORD` | SecureString(write-only) | `pillflow_api` 비밀번호 | EC2 인스턴스 role |
| `/pillflow/prod/migration/FLYWAY_URL` | String | Flyway 접속 JDBC URL | GitHub 배포 role |
| `/pillflow/prod/migration/FLYWAY_USERNAME` | String | `postgres.<project-ref>` | GitHub 배포 role |
| `/pillflow/prod/migration/FLYWAY_PASSWORD` | SecureString(write-only) | Supabase `postgres` 비밀번호 | GitHub 배포 role |

`DB_PASSWORD`·`FLYWAY_PASSWORD`는 Terraform `value_wo`(write-only)로 선언되어 있어 복호화된 값이 Terraform state에 남지 않는다. `terraform apply` 직후에는 자리표시자 `CHANGE_ME`가 들어 있으므로 `put-secret.sh`로 반드시 실값을 덮어써야 한다. EC2 인스턴스 role은 `/pillflow/prod/migration/*`에 대해 `AmazonSSMManagedInstanceCore`가 암묵적으로 허용하는 접근을 명시적 `Deny`로 다시 막아 두었다(`infra/terraform/main/iam_instance.tf`) — DDL 자격 증명은 GitHub 배포 role만 읽는다.

### 스크립트 3개

- `infra/scripts/put-secret.sh <parameter_name>`: 비밀번호를 프롬프트로 입력받아(화면·셸 기록에 남기지 않음) SSM SecureString에 저장한다. 예: `put-secret.sh /pillflow/prod/migration/FLYWAY_PASSWORD`.
- `infra/scripts/flyway-baseline.sh`: 운영 DB를 Flyway 버전 1로 baseline한다(V1 SQL은 실행하지 않음). 최초 1회만 실행한다.
- `infra/scripts/set-api-role-password.sh`: `pillflow_api` 비밀번호를 무작위 생성해 DB에 설정하고 SSM `/pillflow/prod/app/DB_PASSWORD`에 저장한다(V2 적용 후에만 가능).

세 스크립트 모두 로컬 AWS 자격 증명이 필요하며, 실행 전 `chmod +x infra/scripts/*.sh && docker run --rm -v "$PWD/infra/scripts:/mnt" koalaman/shellcheck:stable /mnt/put-secret.sh /mnt/flyway-baseline.sh /mnt/set-api-role-password.sh`로 정적 검사할 수 있다(zsh에서는 글롭이 컨테이너가 아닌 호스트에서 먼저 확장돼 파일을 못 찾을 수 있으므로 파일명을 각각 명시한다).

### 최초 가동 순서 (요약)

1. `infra/terraform/bootstrap` 적용 → state 버킷 생성.
2. `infra/terraform/main` 적용(이 시점부터 과금 시작) → EC2, ECR, SSM 파라미터, IAM role 생성.
3. `put-secret.sh /pillflow/prod/migration/FLYWAY_PASSWORD`로 Supabase `postgres` 비밀번호 저장.
4. Supabase에서 `BYPASSRLS` role 생성 허용 여부를 롤백 트랜잭션으로 검증.
5. `flyway-baseline.sh` 실행 → 운영 DB를 버전 1로 baseline.
6. GitHub repo에 `production` Environment와 배포 변수(`AWS_DEPLOY_ROLE_ARN`, `EC2_INSTANCE_ID`, `ECR_REPOSITORY_URI`, `AUTO_DEPLOY_ENABLED=false`) 설정. **`production` Environment의 배포 브랜치 정책을 `main`으로 제한해야 한다** — IAM 신뢰 정책의 OIDC `sub` 조건이 `repo:<owner>/<repo>:environment:production`으로 Environment 단위이며 브랜치 제한이 없으면 다른 브랜치에서도 같은 role을 assume할 수 있다.
7. `gh workflow run deploy.yml --ref main -f migrate_only=true`로 V2 마이그레이션만 적용(Task 1~6이 main에 merge된 뒤).
8. `set-api-role-password.sh` 실행 → `pillflow_api` 실 비밀번호 설정.
9. DNS(`api.pillflow.app`) 전파 확인 후 `gh workflow run deploy.yml --ref main`으로 첫 전체 배포(build/migrate/deploy/smoke).
10. 완료 기준 검증(헬스체크 200, HTTP→HTTPS 308, 인증 없는 `/api/v1/me` 401, SSH 포트 닫힘, IMDSv2 `required`, CloudWatch 로그 그룹 `/pillflow/api` 존재, 권한 분리·재실행·롤백·재부팅·예산 경보 확인).
11. `gh variable set AUTO_DEPLOY_ENABLED --repo <repo> --body true`로 자동 배포 활성화.

### 롤백 방법

배포 이미지 태그는 커밋 SHA가 아니라 **backend 디렉터리 트리 해시**(`git rev-parse <commit>:backend`)다. `backend/`가 바뀌지 않은 커밋은 같은 태그를 재사용하므로, 롤백 시에도 커밋 SHA가 아니라 이전에 실제 배포됐던 태그를 지정해야 한다.

`/opt/pillflow/current_tag`는 **현재 배포된 태그 하나만** 담고 있으며 이력을 남기지 않는다. 이전 태그는 아래 방법으로 찾는다:
- GitHub Actions의 `deploy` 워크플로 실행 로그(각 run의 `changes` job이 출력한 `tag`, `build`/`migrate`/`deploy` job에 쓰인 `TAG` 값).
- SSM Run Command 이력의 comment 필드 — `send-deploy.sh`가 `--comment "pillflow deploy <tag>"`로 남기므로, AWS 콘솔의 SSM Run Command 히스토리나 `aws ssm list-commands --instance-id <id>`에서 확인할 수 있다.
- `aws ecr describe-images --repository-name pillflow-api`로 ECR에 저장된 이미지 태그 목록(및 push 시각) 확인.

이전 태그를 확인한 뒤:

```bash
gh workflow run deploy.yml --repo <owner>/<repo> --ref main -f image_tag=<이전 태그>
```

`deploy.yml`의 `changes` job이 `image_tag` 입력값 형식(`^[A-Za-z0-9._-]{1,128}$`)을 검증하고, 유효하면 `build`를 건너뛴 채 해당 태그로 바로 `migrate`(적용할 변경이 없으면 무동작) → `deploy` → `smoke`를 수행한다.

### 운영 시 유의사항

- **EC2 인스턴스 교체**: `t4g.small` 인스턴스를 교체(재생성)하면 저장소 변수 `EC2_INSTANCE_ID`를 새 인스턴스 ID로 갱신해야 배포 워크플로가 올바른 인스턴스에 SSM Run Command를 보낸다. 인스턴스 로컬 디스크의 `/opt/pillflow/caddy-data`(Let's Encrypt 인증서)와 `/opt/pillflow/current_tag`는 함께 사라지므로, 교체 후 첫 배포에서 인증서가 재발급된다(Let's Encrypt 발급 한도에 유의).
- **마이그레이션-먼저(migrate-before-deploy) 순서**: `deploy.yml`은 항상 `migrate`가 성공해야 `deploy`로 넘어가며, 마이그레이션은 새 이미지가 EC2에서 기동되기 *전에* DB에 적용된다. 즉 마이그레이션이 적용되는 시점에는 여전히 이전 버전 앱이 서비스 중이므로, 모든 Flyway 마이그레이션은 이전 앱 버전과 호환되어야 한다(expand/contract 패턴 — 컬럼 삭제/이름변경/NOT NULL 강제 같은 파괴적 변경은 이전 코드가 계속 동작하도록 먼저 "확장"만 하고, 이전 버전이 완전히 내려간 뒤 별도 배포에서 "축소"한다).
- **GitHub OIDC 공급자는 참조만 한다**: `token.actions.githubusercontent.com` 공급자는 계정당 하나이며 다른 프로젝트와 공유하므로 Terraform은 `data` 소스로 기존 공급자를 참조만 한다. 새 계정에 처음 배포한다면 apply 전에 공급자를 먼저 만들어 둔다(`aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com`).
- **롤백 검증 절차**: 스펙 문서 `docs/superpowers/specs/2026-09-25-aws-terraform-deploy-design.md` §6 "완료 기준"의 롤백 항목대로, 헬스체크에 실패하는 태그를 수동으로 (`gh workflow run deploy.yml -f image_tag=<실패하는-태그>`) 배포해 파이프라인이 실패하고 이전 버전이 계속 서비스되는 것을 최소 1회 확인해야 한다.
- **main push마다 migrate 실행**: `deploy.yml`은 자동 배포가 켜져 있으면 main에 push될 때마다(백엔드 변경 여부와 무관하게) DDL 자격 증명(`FLYWAY_USERNAME=postgres.<project-ref>`)으로 migrate 단계를 실행한다. 적용할 마이그레이션이 없으면 Flyway는 그냥 무동작(no-op)으로 끝난다.
- **`set-api-role-password.sh`와 서버 로그**: Supabase는 `log_statement=ddl`이라 `ALTER ROLE` 문장이 서버 로그에 남는다(2026-09-26 확인). 그래서 스크립트는 평문 비밀번호 대신 로컬에서 계산한 SCRAM-SHA-256 verifier만 DB로 보낸다(psql `\password`와 같은 방식). 로그에는 해시만 남고, 평문은 SSM `DB_PASSWORD`에만 저장된다.

### 문제 해결

- **EC2 첫 부팅(user_data) 설정 실패**: CloudWatch가 아니라 인스턴스의 `/var/log/cloud-init-output.log`에 로그가 남는다. SSM 세션으로 접속해 확인한다.
- **OIDC `sub` 불일치로 GitHub Actions의 role assume 실패**: IAM 신뢰 조건의 repository 이름 대소문자, `production` Environment 이름 오탈자를 확인한다.
- **`production` Environment 배포 브랜치 제한 누락**: Environment가 `main`으로 제한돼 있지 않으면 다른 브랜치의 workflow_dispatch도 배포 role을 assume할 수 있다 — 반드시 사전에 설정한다(위 "최초 가동 순서" 6번).

# AWS + Terraform 배포 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kotlin Spring Boot 서버를 AWS EC2 1대(도쿄)에 Terraform과 GitHub Actions로 배포해서 `https://api.pillflow.app`에서 서비스한다.

**Architecture:** Terraform이 VPC·EC2·EIP·Route53 레코드·ECR·SSM 파라미터·IAM(인스턴스 역할, GitHub OIDC 배포 역할)·로그·경보·Budget을 만든다. GitHub Actions는 PR에서 CI를 돌리고, main에서는 arm64 이미지 빌드 → ECR → migrate 프로파일로 Flyway 1회 실행 → SSM Run Command로 EC2의 Docker Compose(app + Caddy)를 교체·헬스체크·롤백한다. 운영 서버는 DML 전용 `pillflow_api`만 쓰고, DDL 자격증명은 main 배포 파이프라인만 읽는다.

**Tech Stack:** Terraform 1.14.8 (AWS provider ~> 6.66), AWS(EC2 t4g.small / AL2023 arm64, ECR, SSM, IAM OIDC, CloudWatch, Budgets, Route53), Docker Compose v5.5.1, Caddy 2.11.4, GitHub Actions, Spring Boot 4.0.8 / Kotlin 2.2.21, Flyway 11.14.1, Bash + jq

**Spec:** `docs/superpowers/specs/2026-09-25-aws-terraform-deploy-design.md` (실행자는 이 계획과 스펙을 함께 읽는다)

## Global Constraints

- 리전 `ap-northeast-1`, 가용 영역 `ap-northeast-1a`. AWS 계정 `116981801268`(저장소에는 하드코딩하지 않는다).
- Terraform `required_version = ">= 1.10.0"`(S3 `use_lockfile` 필요), AWS provider `version = "~> 6.66"`.
- 도메인 `pillflow.app`, 호스팅 영역 ID `Z06240551735N8MVX5DNO`(data 소스로 참조, 생성 금지), API 호스트 `api.pillflow.app`.
- 이름: ECR `pillflow-api`, 로그 그룹 `/pillflow/api`, 인스턴스 역할 `pillflow-api-instance`, 배포 역할 `pillflow-github-deploy`, 상태 버킷 `pillflow-tfstate-<account_id>`.
- SSM 경로: 런타임 `/pillflow/prod/app/*`(EC2 역할만 읽음), DDL `/pillflow/prod/migration/*`(배포 역할만 읽음).
- DB 풀러 호스트 **`aws-1-ap-northeast-1.pooler.supabase.com:5432`**(session 모드, 2026-09-25 확인. aws-0은 "tenant not found"). 사용자명 형식 `<role>.igyydnnehdjrwujxqdry`.
- 실제 Vercel 도메인 **`https://pillflow-app.vercel.app`**(2026-09-25 확인. `pill-flow.vercel.app`은 404).
- GitHub 저장소 `CUCU7103/Pill-Flow2`(**공개**). OIDC `sub` = `repo:CUCU7103/Pill-Flow2:environment:production`.
- 액션 버전: `actions/checkout@v7`, `actions/setup-java@v6`, `gradle/actions/setup-gradle@v6`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `hashicorp/setup-terraform@v4`, `aws-actions/configure-aws-credentials@v6`, `aws-actions/amazon-ecr-login@v2`.
- 빌드 JDK 25, 바이트코드 21, pnpm `10.33.0`, Node `24`.
- 시크릿·`*.tfstate`·`terraform.tfvars`·`backend.hcl`은 커밋하지 않는다. 비밀번호가 대화, 로그, Terraform 상태에 남지 않게 한다.
- 문서, 주석, 커밋 메시지는 한국어. 커밋 형식 `[Feat]`/`[Fix]`/`[Refactor]`/`[Test]`/`[Docs]`/`[Chore]` + 요약.
- ★ 표시 단계(과금, 클라우드·운영 DB·GitHub 설정 변경)는 **실행 직전에 사용자 확인**을 받는다.

## Review Focus

1. **특수문자가 든 비밀번호**(`=`, `#`, 공백 포함)가 SSM → `app.env`로 옮겨질 때 잘리거나 바뀌지 않아야 한다. → Task 4 `deploy_test.sh` 케이스 "특수문자 보존"
2. **ECR lifecycle로 이전 이미지가 지워졌는데 롤백해야 하는 경우**, 롤백은 인스턴스에 이미 있는 로컬 이미지로 기동해야 한다(다시 pull하지 않음). → Task 4 케이스 "롤백 시 pull 안 함"
3. **첫 배포에서 헬스체크 실패**(되돌아갈 이전 태그 없음) 시 파이프라인이 실패하고, 망가진 app 컨테이너를 남기지 않아야 한다. → Task 4 케이스 "최초 배포 실패"
4. **같은 커밋을 다시 배포**(워크플로 재실행)하면 불변 태그 ECR push 충돌 없이 빌드를 건너뛰어야 한다. → Task 6 build 작업의 "이미지 존재 확인" 단계 + Task 7 검증 단계 "재실행"
5. **인스턴스 재부팅·자동 복구 후** app과 caddy가 스스로 다시 떠야 한다(`restart: unless-stopped`, docker 서비스 enable, `app.env` 유지). → Task 7 검증 단계 "재부팅"

---

## 파일 구조

```
backend/
├── Dockerfile                                   (수정: wget HEALTHCHECK 제거)
├── .env.example                                 (수정: 운영 값 안내, CORS 실제 도메인)
├── README.md                                    (수정: 운영 배포 절차)
└── src/
    ├── main/kotlin/com/pillflow/security/
    │   ├── SecurityConfig.kt                    (수정: @Profile("!migrate"))
    │   └── WebMvcConfig.kt                      (수정: @Profile("!migrate"))
    ├── main/resources/
    │   ├── application-prod.yml                 (신규)
    │   └── application-migrate.yml              (신규)
    └── test/kotlin/com/pillflow/
        └── DeployProfilesTest.kt                (신규)
infra/
├── terraform/
│   ├── bootstrap/main.tf                        (신규: 상태 버킷)
│   └── main/
│       ├── versions.tf  variables.tf  outputs.tf
│       ├── network.tf  compute.tf  user_data.sh  dns.tf
│       ├── ecr.tf  ssm.tf  observability.tf
│       ├── iam_instance.tf  iam_github.tf
│       ├── backend.hcl.example  terraform.tfvars.example
├── deploy/
│   ├── compose.yml  Caddyfile                   (신규: EC2 런타임 구성)
│   ├── deploy.sh                                (신규: EC2에서 실행, 교체·헬스체크·롤백)
│   ├── send-deploy.sh                           (신규: 러너에서 실행, SSM 명령 전송·대기)
│   └── test/deploy_test.sh  test/send_deploy_test.sh  test/fakes/{aws,docker,curl}
└── scripts/
    ├── put-secret.sh                            (신규: 비밀번호를 화면 노출 없이 SSM에 저장)
    ├── flyway-baseline.sh                       (신규: 운영 DB baseline V1)
    └── set-api-role-password.sh                 (신규: pillflow_api 비밀번호 생성·설정·저장)
.github/workflows/
├── ci.yml                                       (신규)
└── deploy.yml                                   (신규)
.gitignore                                       (수정: terraform 산출물)
CLAUDE.md, docs/architecture.md                  (수정)
```

---

### Task 1: 운영·마이그레이션 Spring 프로파일과 Dockerfile 정리

**Files:**
- Create: `backend/src/main/resources/application-prod.yml`
- Create: `backend/src/main/resources/application-migrate.yml`
- Modify: `backend/src/main/kotlin/com/pillflow/security/SecurityConfig.kt` (클래스 어노테이션)
- Modify: `backend/src/main/kotlin/com/pillflow/security/WebMvcConfig.kt` (클래스 어노테이션)
- Modify: `backend/Dockerfile` (HEALTHCHECK 줄 삭제)
- Modify: `backend/.env.example`
- Test: `backend/src/test/kotlin/com/pillflow/DeployProfilesTest.kt`

**Interfaces:**
- Consumes: 기존 `PillflowApplication`, `application.yml`(`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`/`SUPABASE_URL`/`CORS_ALLOWED_ORIGINS` 참조), 테스트용 스텁 `classpath:db/supabase-stub`
- Produces: 프로파일 `prod`(Flyway 끔), `migrate`(웹 없음, Flyway만 실행, 환경변수 `FLYWAY_URL`/`FLYWAY_USERNAME`/`FLYWAY_PASSWORD`). Task 6이 `SPRING_PROFILES_ACTIVE=migrate`와 이 세 환경변수로 이미지를 실행한다. Task 4의 compose가 `SPRING_PROFILES_ACTIVE=prod`로 실행한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/kotlin/com/pillflow/DeployProfilesTest.kt`:

```kotlin
package com.pillflow

import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.boot.web.server.context.WebServerApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer

/**
 * 배포 파이프라인이 쓰는 두 프로파일을 검증한다.
 * - migrate: 웹 서버 없이 Flyway만 실행하고 정상 종료(exit code 0)해야 한다.
 * - prod: Flyway를 실행하지 않아야 한다(DDL은 파이프라인의 migrate 단계만 수행).
 */
@Testcontainers
class DeployProfilesTest {

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:17-alpine")
    }

    /** 스텁(V0)을 포함한 Flyway 위치. 운영 위치에는 스텁이 없으므로 테스트에서만 추가한다. */
    private val testLocations = "classpath:db/supabase-stub,classpath:db/migration"

    private fun jdbc() = JdbcTemplate(DriverManagerDataSource(postgres.jdbcUrl, postgres.username, postgres.password))

    private fun resetDatabase() {
        jdbc().execute("DROP SCHEMA IF EXISTS flyway CASCADE")
        jdbc().execute("DROP SCHEMA IF EXISTS public CASCADE")
        jdbc().execute("CREATE SCHEMA public")
        jdbc().execute("DROP SCHEMA IF EXISTS auth CASCADE")
    }

    private fun appliedVersions(): List<String> =
        jdbc().queryForList("SELECT version FROM flyway.flyway_schema_history WHERE success ORDER BY installed_rank", String::class.java)
            .filterNotNull()

    @Test
    fun `migrate 프로파일은 웹 서버 없이 마이그레이션을 끝내고 종료 코드 0을 반환한다`() {
        resetDatabase()

        // SUPABASE_URL, CORS_ALLOWED_ORIGINS는 일부러 넘기지 않는다 — migrate 실행에 필요 없어야 한다.
        val context = SpringApplicationBuilder(PillflowApplication::class.java)
            .profiles("migrate")
            .properties(
                "FLYWAY_URL=${postgres.jdbcUrl}",
                "FLYWAY_USERNAME=${postgres.username}",
                "FLYWAY_PASSWORD=${postgres.password}",
                "spring.flyway.locations=$testLocations",
            )
            .run()

        assertFalse(context is WebServerApplicationContext, "migrate 프로파일은 웹 서버를 띄우면 안 된다")
        assertEquals(0, SpringApplication.exit(context))
        assertEquals(listOf("0", "1", "2"), appliedVersions())
    }

    @Test
    fun `prod 프로파일은 Flyway를 실행하지 않는다`() {
        resetDatabase()
        // V1까지만 적용해 둔다. prod가 Flyway를 실행하면 V2가 추가로 적용되어 테스트가 실패한다.
        Flyway.configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .schemas("flyway").defaultSchema("flyway").createSchemas(true)
            .locations(*testLocations.split(",").toTypedArray())
            .target("1")
            .load()
            .migrate()

        val context = SpringApplicationBuilder(PillflowApplication::class.java)
            .profiles("prod")
            .properties(
                "DB_URL=${postgres.jdbcUrl}",
                "DB_USERNAME=${postgres.username}",
                "DB_PASSWORD=${postgres.password}",
                "SUPABASE_URL=https://example.supabase.co",
                "CORS_ALLOWED_ORIGINS=https://localhost",
                "server.port=0",
            )
            .run()
        context.close()

        assertEquals(listOf("0", "1"), appliedVersions())
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && ./gradlew test --tests com.pillflow.DeployProfilesTest`
Expected: FAIL. migrate 테스트는 프로파일 파일이 없어서 `Could not resolve placeholder 'DB_URL'` 또는 `HttpSecurity` 빈 없음 오류로 컨텍스트 시작에 실패한다. prod 테스트는 Flyway가 V2까지 적용해서 `expected: <[0, 1]> but was: <[0, 1, 2]>`로 실패한다.

- [ ] **Step 3: 프로파일 파일 작성**

`backend/src/main/resources/application-prod.yml`:

```yaml
# 운영 서버 프로파일 — DDL은 배포 파이프라인의 migrate 단계만 수행한다.
spring:
  config.activate.on-profile: prod
  flyway:
    enabled: false
  datasource:
    hikari:
      # Supavisor session 모드는 클라이언트 연결 수가 제한되므로 작게 유지한다.
      maximum-pool-size: 5
```

`backend/src/main/resources/application-migrate.yml`:

```yaml
# 배포 파이프라인 1회 실행 프로파일 — 웹 서버 없이 Flyway만 실행하고 종료한다.
spring:
  config.activate.on-profile: migrate
  main:
    web-application-type: none
  datasource:
    url: ${FLYWAY_URL}
    username: ${FLYWAY_USERNAME}
    password: ${FLYWAY_PASSWORD}
    hikari:
      maximum-pool-size: 2
  flyway:
    enabled: true
    url: ${FLYWAY_URL}
    user: ${FLYWAY_USERNAME}
    password: ${FLYWAY_PASSWORD}
  jpa:
    hibernate:
      # 마이그레이션 중에는 엔티티 검증을 하지 않는다(검증은 prod 기동과 CI 테스트가 담당).
      ddl-auto: none
```

- [ ] **Step 4: 웹 전용 설정을 migrate 프로파일에서 제외**

`SecurityConfig.kt`에서 클래스 선언부를 아래처럼 바꾼다(import 추가):

```kotlin
import org.springframework.context.annotation.Profile

// migrate 프로파일은 웹 서버가 없으므로 HttpSecurity 기반 보안 설정을 로드하지 않는다.
@Configuration
@EnableMethodSecurity
@Profile("!migrate")
class SecurityConfig(
```

`WebMvcConfig.kt`를 아래로 교체한다:

```kotlin
package com.pillflow.security
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

// migrate 프로파일은 웹 서버가 없으므로 MVC 설정을 로드하지 않는다.
@Configuration
@Profile("!migrate")
class WebMvcConfig(private val resolver: CurrentUserArgumentResolver) : WebMvcConfigurer { override fun addArgumentResolvers(r: MutableList<HandlerMethodArgumentResolver>) { r.add(resolver) } }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests com.pillflow.DeployProfilesTest`
Expected: PASS (2 tests).
migrate 테스트가 `Could not resolve placeholder 'SUPABASE_URL'`로 실패하면 `application-migrate.yml`의 `spring:` 아래가 아니라 **파일 최상위**에 다음을 추가하고 다시 실행한다:
```yaml
SUPABASE_URL: https://unused.invalid
CORS_ALLOWED_ORIGINS: https://unused.invalid
```

- [ ] **Step 6: Dockerfile HEALTHCHECK 제거와 .env.example 갱신**

`backend/Dockerfile`에서 아래 줄을 삭제한다(런타임 이미지에 wget이 없고, 헬스체크는 Task 4의 `deploy.sh`가 호스트 curl로 수행한다):
```
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/actuator/health || exit 1
```

`backend/.env.example`의 CORS 줄을 바꾸고, 파일 끝에 migrate 변수 안내를 추가한다:
```
CORS_ALLOWED_ORIGINS=https://pillflow-app.vercel.app,https://localhost,https://pillflow.app
# migrate 프로파일(배포 파이프라인) 전용 — 운영에서는 SSM /pillflow/prod/migration/* 에서 주입된다
FLYWAY_URL=jdbc:postgresql://localhost:5432/postgres
```

- [ ] **Step 7: 전체 테스트와 이미지 빌드 확인**

Run (저장소 루트에서): `(cd backend && ./gradlew test) && docker build -t pillflow-api:profiles backend`
Expected: 테스트 전부 PASS(기존 11개 + 신규 2개), 이미지 빌드 성공.

- [ ] **Step 8: migrate 이미지가 실제 프로세스로 종료되는지 확인**

```bash
docker network create pf-migrate-check
docker run -d --rm --name pf-pg --network pf-migrate-check -e POSTGRES_PASSWORD=pw postgres:17-alpine
sleep 5
docker exec pf-pg psql -U postgres -c "create schema if not exists auth; create table if not exists auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role; create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$;"
docker run --rm --network pf-migrate-check -e SPRING_PROFILES_ACTIVE=migrate \
  -e FLYWAY_URL=jdbc:postgresql://pf-pg:5432/postgres -e FLYWAY_USERNAME=postgres -e FLYWAY_PASSWORD=pw \
  pillflow-api:profiles; echo "exit=$?"
docker stop pf-pg; docker network rm pf-migrate-check
```
Expected: 로그에 `Successfully applied 2 migrations`가 나오고 `exit=0`. 프로세스가 스스로 종료되지 않고 멈춰 있으면(30초 이상), `PillflowApplication.kt`에 migrate 전용 종료 러너를 추가하고 이 단계를 반복한다:
```kotlin
// migrate 프로파일: 마이그레이션이 끝나면 남은 스레드와 관계없이 프로세스를 종료한다.
@Component
@Profile("migrate")
class MigrateExitRunner(private val context: ApplicationContext) : ApplicationRunner {
    override fun run(args: ApplicationArguments) { exitProcess(SpringApplication.exit(context)) }
}
```

- [ ] **Step 9: 커밋**

```bash
git add backend/src/main/resources/application-prod.yml backend/src/main/resources/application-migrate.yml \
  backend/src/main/kotlin/com/pillflow/security/SecurityConfig.kt backend/src/main/kotlin/com/pillflow/security/WebMvcConfig.kt \
  backend/src/test/kotlin/com/pillflow/DeployProfilesTest.kt backend/Dockerfile backend/.env.example
git commit -m "[Feat] 운영(prod)·마이그레이션(migrate) 프로파일 추가 및 Dockerfile 헬스체크 정리"
```

---

### Task 2: Terraform 상태 버킷(bootstrap)과 gitignore

**Files:**
- Create: `infra/terraform/bootstrap/main.tf`
- Modify: `.gitignore` (끝에 추가)

**Interfaces:**
- Produces: S3 버킷 `pillflow-tfstate-<account_id>`(출력 `state_bucket`). Task 3의 `backend.hcl`이 이 이름을 쓴다.

- [ ] **Step 1: gitignore 추가**

`.gitignore` 끝에 추가:
```
# Terraform — 상태·변수·백엔드 설정은 공개 저장소에 올리지 않는다
.terraform/
*.tfstate
*.tfstate.*
*.tfplan
terraform.tfvars
backend.hcl
crash.log
```
`.terraform.lock.hcl`은 provider 버전 고정용이므로 **커밋한다**.

- [ ] **Step 2: bootstrap 작성**

`infra/terraform/bootstrap/main.tf`:

```hcl
# Terraform 원격 상태 저장용 S3 버킷 — 최초 1회만 적용하며, 이 디렉토리 자체는 로컬 상태를 쓴다.
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
  }
}

variable "region" {
  type    = string
  default = "ap-northeast-1"
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "pillflow"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "tfstate" {
  bucket = "pillflow-tfstate-${data.aws_caller_identity.current.account_id}"

  # 상태 버킷은 실수로 지워지면 인프라 관리가 불가능해진다.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

output "state_bucket" {
  value = aws_s3_bucket.tfstate.bucket
}
```

- [ ] **Step 3: 형식·유효성 확인**

Run: `cd infra/terraform/bootstrap && terraform init -backend=false && terraform fmt -check && terraform validate`
Expected: `Success! The configuration is valid.` fmt는 출력 없음(차이가 있으면 `terraform fmt`로 고친 뒤 재확인).

- [ ] **Step 4: plan 확인(읽기 전용)**

Run: `cd infra/terraform/bootstrap && terraform plan`
Expected: `Plan: 5 to add, 0 to change, 0 to destroy.` (apply는 Task 7에서 ★ 확인 후)

- [ ] **Step 5: 커밋**

```bash
git add .gitignore infra/terraform/bootstrap/main.tf infra/terraform/bootstrap/.terraform.lock.hcl
git commit -m "[Chore] Terraform 원격 상태용 S3 버킷(bootstrap) 추가"
```

---

### Task 3: Terraform 메인 인프라 (네트워크·서버·DNS·ECR·SSM·IAM·관측)

**Files:**
- Create: `infra/terraform/main/versions.tf`, `variables.tf`, `outputs.tf`, `network.tf`, `compute.tf`, `user_data.sh`, `dns.tf`, `ecr.tf`, `ssm.tf`, `observability.tf`, `iam_instance.tf`, `iam_github.tf`, `backend.hcl.example`, `terraform.tfvars.example`

**Interfaces:**
- Consumes: Task 2의 상태 버킷 이름
- Produces (outputs, Task 6·7이 GitHub 변수로 사용): `instance_id`(string), `api_public_ip`(string), `ecr_repository_url`(string, 예 `116981801268.dkr.ecr.ap-northeast-1.amazonaws.com/pillflow-api`), `deploy_role_arn`(string), `api_fqdn`(`api.pillflow.app`)
- Produces (EC2 상태): Docker·Compose·jq·curl·aws CLI 설치, `/opt/pillflow/{caddy-data,caddy-config}` 존재 → Task 4의 `deploy.sh` 전제

- [ ] **Step 1: versions.tf / variables.tf / 예시 파일**

`infra/terraform/main/versions.tf`:
```hcl
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
  }
  # 버킷 이름(계정 ID 포함)은 공개 저장소에 두지 않고 backend.hcl로 주입한다: terraform init -backend-config=backend.hcl
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "pillflow"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
```

`infra/terraform/main/variables.tf`:
```hcl
variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "availability_zone" {
  type    = string
  default = "ap-northeast-1a"
}

variable "instance_type" {
  type    = string
  default = "t4g.small"
}

variable "root_volume_size_gb" {
  type    = number
  default = 20
}

variable "domain_name" {
  type    = string
  default = "pillflow.app"
}

variable "api_subdomain" {
  type    = string
  default = "api"
}

variable "github_repository" {
  description = "OIDC 신뢰 대상 저장소 (owner/name, 대소문자 정확히)"
  type        = string
  default     = "CUCU7103/Pill-Flow2"
}

variable "supabase_project_ref" {
  type    = string
  default = "igyydnnehdjrwujxqdry"
}

variable "db_pooler_host" {
  description = "Supavisor session 모드 호스트 (IPv4)"
  type        = string
  default     = "aws-1-ap-northeast-1.pooler.supabase.com"
}

variable "cors_allowed_origins" {
  type    = string
  default = "https://pillflow-app.vercel.app,https://localhost,https://pillflow.app"
}

variable "monthly_budget_usd" {
  type    = number
  default = 30
}

variable "alert_email" {
  description = "Budget 알림 수신 이메일 — terraform.tfvars에만 적는다(공개 저장소)"
  type        = string
}
```

`infra/terraform/main/backend.hcl.example`:
```hcl
# 복사해서 backend.hcl로 저장한다(gitignore 대상). bucket은 bootstrap의 state_bucket 출력값.
bucket       = "pillflow-tfstate-<ACCOUNT_ID>"
key          = "main/terraform.tfstate"
region       = "ap-northeast-1"
encrypt      = true
use_lockfile = true
```

`infra/terraform/main/terraform.tfvars.example`:
```hcl
# 복사해서 terraform.tfvars로 저장한다(gitignore 대상).
alert_email = "you@example.com"
```

- [ ] **Step 2: network.tf**

```hcl
# 퍼블릭 서브넷 1개 구성 — NAT Gateway 없이 인스턴스가 IGW로 직접 통신한다.
resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "pillflow-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = var.availability_zone
  # 퍼블릭 IP는 Elastic IP로만 부여한다.
  map_public_ip_on_launch = false
  tags                    = { Name = "pillflow-public-a" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "pillflow-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "pillflow-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# 인바운드는 HTTP(ACME 검증·HTTPS 리다이렉트)와 HTTPS만 허용한다. SSH(22)는 열지 않는다(SSM 사용).
resource "aws_security_group" "api" {
  name        = "pillflow-api"
  description = "pillflow api - http/https only"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.api.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.api.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.api.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
```

- [ ] **Step 3: compute.tf와 user_data.sh**

`infra/terraform/main/user_data.sh`:
```bash
#!/bin/bash
# EC2 최초 부팅 1회 실행 — 런타임(Docker, Compose)만 준비하고 애플리케이션 배포는 하지 않는다.
set -euxo pipefail

dnf install -y docker jq
systemctl enable --now docker

# Docker Compose 플러그인 (AL2023 패키지에 없어 공식 릴리스를 체크섬 검증 후 설치)
COMPOSE_VERSION="v5.5.1"
PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
mkdir -p "$PLUGIN_DIR"
BASE_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}"
curl -fsSL "${BASE_URL}/docker-compose-linux-aarch64" -o /tmp/docker-compose
curl -fsSL "${BASE_URL}/docker-compose-linux-aarch64.sha256" -o /tmp/docker-compose.sha256
echo "$(awk '{print $1}' /tmp/docker-compose.sha256)  /tmp/docker-compose" | sha256sum -c -
install -m 755 /tmp/docker-compose "$PLUGIN_DIR/docker-compose"

install -d -m 755 /opt/pillflow /opt/pillflow/caddy-data /opt/pillflow/caddy-config
```

`infra/terraform/main/compute.tf`:
```hcl
# Amazon Linux 2023 arm64 최신 AMI (AWS 공개 SSM 파라미터)
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "api" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.insecure_value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.api.name
  user_data              = file("${path.module}/user_data.sh")

  # 버스트 크레딧 초과 과금을 막아 비용을 예측 가능하게 유지한다.
  credit_specification {
    cpu_credits = "standard"
  }

  # IMDSv2 강제, hop limit 1 → 컨테이너에서 인스턴스 자격증명에 접근할 수 없다.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size_gb
    encrypted   = true
  }

  tags = { Name = "pillflow-api" }

  # 새 AMI가 나올 때마다 인스턴스가 교체되지 않도록 한다(교체는 의도적으로만).
  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "api" {
  domain   = "vpc"
  instance = aws_instance.api.id
  tags     = { Name = "pillflow-api" }
}

# 하드웨어(시스템 상태 검사) 장애 시 EC2 자동 복구
resource "aws_cloudwatch_metric_alarm" "api_system_recover" {
  alarm_name          = "pillflow-api-system-recover"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions          = { InstanceId = aws_instance.api.id }
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover"]
}
```

- [ ] **Step 4: dns.tf / ecr.tf / observability.tf**

`infra/terraform/main/dns.tf`:
```hcl
# Route53에서 구매할 때 자동 생성된 호스팅 영역 — 새로 만들지 않고 참조만 한다.
data "aws_route53_zone" "main" {
  name = "${var.domain_name}."
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.api.public_ip]
}
```

`infra/terraform/main/ecr.tf`:
```hcl
resource "aws_ecr_repository" "api" {
  name = "pillflow-api"
  # 태그 = git SHA. 같은 태그 덮어쓰기를 금지해 배포 이력을 보존한다.
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "최근 10개 이미지만 유지"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
```

`infra/terraform/main/observability.tf`:
```hcl
resource "aws_cloudwatch_log_group" "api" {
  name              = "/pillflow/api"
  retention_in_days = 14
}

resource "aws_budgets_budget" "monthly" {
  name         = "pillflow-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
```

- [ ] **Step 5: ssm.tf**

비밀이 아닌 값(호스트, 사용자명, URL, CORS)은 Terraform이 실제 값으로 관리한다. 비밀번호 2개만 자리 값으로 만들고 이후 값 변경을 무시한다. 그래서 실제 비밀번호는 상태 파일에 남지 않는다.

```hcl
locals {
  jdbc_url = "jdbc:postgresql://${var.db_pooler_host}:5432/postgres?sslmode=require"

  # 런타임 파라미터 (EC2 역할만 읽는다)
  app_plain_params = {
    DB_URL               = local.jdbc_url
    DB_USERNAME          = "pillflow_api.${var.supabase_project_ref}"
    SUPABASE_URL         = "https://${var.supabase_project_ref}.supabase.co"
    CORS_ALLOWED_ORIGINS = var.cors_allowed_origins
  }

  # DDL 파라미터 (GitHub 배포 역할만 읽는다)
  migration_plain_params = {
    FLYWAY_URL      = local.jdbc_url
    FLYWAY_USERNAME = "postgres.${var.supabase_project_ref}"
  }

  # 값은 infra/scripts/put-secret.sh로 따로 넣는다.
  secret_params = {
    "/pillflow/prod/app/DB_PASSWORD"             = "런타임 pillflow_api 비밀번호"
    "/pillflow/prod/migration/FLYWAY_PASSWORD" = "Supabase postgres 비밀번호"
  }
}

resource "aws_ssm_parameter" "app_plain" {
  for_each = local.app_plain_params
  name     = "/pillflow/prod/app/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "migration_plain" {
  for_each = local.migration_plain_params
  name     = "/pillflow/prod/migration/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "secret" {
  for_each    = local.secret_params
  name        = each.key
  description = each.value
  type        = "SecureString"
  value       = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}
```

- [ ] **Step 6: iam_instance.tf**

```hcl
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "pillflow-api-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# SSM Session Manager 접속과 Run Command 수신
resource "aws_iam_role_policy_attachment" "instance_ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

locals {
  param_arn_prefix = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter"
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "EcrPull"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = [aws_ecr_repository.api.arn]
  }
  # 런타임 파라미터만 읽는다. /pillflow/prod/migration/* 는 읽을 수 없다.
  statement {
    sid       = "AppParams"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["${local.param_arn_prefix}/pillflow/prod/app", "${local.param_arn_prefix}/pillflow/prod/app/*"]
  }
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "pillflow-api-instance"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "api" {
  name = "pillflow-api-instance"
  role = aws_iam_role.instance.name
}
```

- [ ] **Step 7: iam_github.tf**

```hcl
# GitHub Actions OIDC — 장기 액세스 키 없이 배포 역할을 assume한다.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # production Environment에서 실행된 작업만 허용한다(Environment는 main 브랜치로 제한).
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:production"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "pillflow-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPushPull"
    actions = [
      "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
      "ecr:DescribeImages",
    ]
    resources = [aws_ecr_repository.api.arn]
  }
  statement {
    sid     = "RunDeployCommand"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.api.arn,
      "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
    ]
  }
  statement {
    sid       = "ReadCommandResult"
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
    resources = ["*"]
  }
  # DDL 자격증명은 배포 파이프라인만 읽는다.
  statement {
    sid       = "MigrationParams"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["${local.param_arn_prefix}/pillflow/prod/migration", "${local.param_arn_prefix}/pillflow/prod/migration/*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "pillflow-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
```

- [ ] **Step 8: outputs.tf**

```hcl
output "instance_id" {
  value = aws_instance.api.id
}

output "api_public_ip" {
  value = aws_eip.api.public_ip
}

output "api_fqdn" {
  value = aws_route53_record.api.fqdn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
```

- [ ] **Step 9: 형식·유효성 확인**

Run: `cd infra/terraform/main && terraform init -backend=false && terraform fmt -check && terraform validate`
Expected: `Success! The configuration is valid.`
`aws_iam_openid_connect_provider`에서 `thumbprint_list`가 필요하다는 오류가 나면 `thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]`를 추가한다(AWS는 GitHub OIDC의 thumbprint를 실제로 검증하지 않는다).

- [ ] **Step 10: 커밋**

```bash
git add infra/terraform/main
git commit -m "[Feat] Terraform 메인 인프라(EC2·EIP·DNS·ECR·SSM·IAM OIDC·로그·Budget) 정의"
```

---

### Task 4: EC2 런타임 구성과 배포 스크립트 (교체·헬스체크·롤백)

**Files:**
- Create: `infra/deploy/compose.yml`, `infra/deploy/Caddyfile`, `infra/deploy/deploy.sh`, `infra/deploy/send-deploy.sh`
- Test: `infra/deploy/test/fakes/aws`, `infra/deploy/test/fakes/docker`, `infra/deploy/test/fakes/curl`, `infra/deploy/test/deploy_test.sh`, `infra/deploy/test/send_deploy_test.sh`

**Interfaces:**
- Consumes: Task 3의 EC2 상태(`/opt/pillflow`, Docker, jq, aws CLI), SSM `/pillflow/prod/app/*`, 로그 그룹 `/pillflow/api`, Task 1의 `prod` 프로파일
- Produces:
  - `deploy.sh <image_repo_uri> <tag>`: EC2에서 실행. 종료 코드 0 = 새 태그 정상, 1 = 실패(이전 태그로 롤백했거나 이전 태그가 없어 app 중지). 환경변수로 동작 조정: `DEPLOY_DIR`(기본 `/opt/pillflow`), `AWS_REGION`(기본 `ap-northeast-1`), `PARAM_PATH`(기본 `/pillflow/prod/app/`), `HEALTH_URL`(기본 `http://127.0.0.1:8080/actuator/health`), `HEALTH_ATTEMPTS`(기본 24), `HEALTH_INTERVAL`(기본 5)
  - `send-deploy.sh <instance_id> <image_repo_uri> <tag>`: 러너에서 실행. compose.yml·Caddyfile·deploy.sh를 base64로 담아 SSM Run Command로 보내고 완료까지 폴링한다. 종료 코드 0 = 원격 `Success`. 환경변수 `POLL_ATTEMPTS`(기본 180), `POLL_INTERVAL`(기본 5)

- [ ] **Step 1: 가짜 명령(fake) 작성**

테스트는 `PATH` 앞에 `fakes/`를 두어 실제 `aws`/`docker`/`curl` 대신 호출 기록만 남긴다. 모든 호출은 `$CALLS_FILE`에 한 줄씩 기록된다.

`infra/deploy/test/fakes/aws`:
```bash
#!/usr/bin/env bash
# 테스트용 가짜 aws CLI — 호출을 기록하고 필요한 응답만 흉내 낸다.
echo "aws $*" >> "$CALLS_FILE"
case "$*" in
  *"ecr get-login-password"*) echo "fake-token" ;;
  *"ssm get-parameters-by-path"*) cat "$FAKE_PARAMS_JSON" ;;
  *"ssm send-command"*) echo "cmd-123" ;;
  *"ssm get-command-invocation"*"--query Status"*) echo "${FAKE_SSM_STATUS:-Success}" ;;
  *"ssm get-command-invocation"*) echo "원격 출력" ;;
esac
```

`infra/deploy/test/fakes/docker`:
```bash
#!/usr/bin/env bash
# 테스트용 가짜 docker — 호출만 기록한다. login은 표준입력을 소비한다.
echo "docker $*" >> "$CALLS_FILE"
if [[ "$1" == "login" ]]; then cat > /dev/null; fi
exit 0
```

`infra/deploy/test/fakes/curl`:
```bash
#!/usr/bin/env bash
# 테스트용 가짜 curl — 현재 .env의 이미지 태그에 "bad"가 들어 있으면 헬스체크 실패로 응답한다.
echo "curl $*" >> "$CALLS_FILE"
if grep -q ':bad' "$DEPLOY_DIR/.env" 2>/dev/null; then exit 22; fi
exit 0
```

- [ ] **Step 2: 실패하는 테스트 작성 — deploy_test.sh**

`infra/deploy/test/deploy_test.sh`:
```bash
#!/usr/bin/env bash
# deploy.sh 동작 테스트 — 실제 AWS/Docker 없이 가짜 명령으로 성공·롤백·최초 실패·특수문자 보존을 검증한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../deploy.sh"
REPO="123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/pillflow-api"
failures=0

setup() {
  export DEPLOY_DIR; DEPLOY_DIR="$(mktemp -d)"
  export CALLS_FILE="$DEPLOY_DIR/calls.log"; : > "$CALLS_FILE"
  export FAKE_PARAMS_JSON="$DEPLOY_DIR/params.json"
  cat > "$FAKE_PARAMS_JSON" <<'JSON'
{"Parameters":[
 {"Name":"/pillflow/prod/app/DB_URL","Value":"jdbc:postgresql://h:5432/postgres?sslmode=require"},
 {"Name":"/pillflow/prod/app/DB_PASSWORD","Value":"p@ss=wo#rd with space"}
]}
JSON
  export PATH="$HERE/fakes:$PATH"
  export HEALTH_ATTEMPTS=2 HEALTH_INTERVAL=0
}

assert() { # assert <설명> <명령...>
  local desc="$1"; shift
  if "$@"; then echo "  ok   - $desc"; else echo "  FAIL - $desc"; failures=$((failures+1)); fi
}

echo "케이스 1: 정상 배포"
setup
bash "$SCRIPT" "$REPO" good1 > /dev/null 2>&1; rc=$?
assert "종료 코드 0" test "$rc" -eq 0
assert "current_tag = good1" test "$(cat "$DEPLOY_DIR/current_tag")" = "good1"
assert ".env에 새 이미지" grep -qx "APP_IMAGE=$REPO:good1" "$DEPLOY_DIR/.env"
assert "특수문자 보존" grep -qxF 'DB_PASSWORD=p@ss=wo#rd with space' "$DEPLOY_DIR/app.env"
assert "app.env 권한 600" test "$(stat -c %a "$DEPLOY_DIR/app.env" 2>/dev/null || stat -f %Lp "$DEPLOY_DIR/app.env")" = "600"
assert "caddy 기동" grep -q "docker compose up -d caddy" "$CALLS_FILE"

echo "케이스 2: 헬스체크 실패 → 이전 태그로 롤백"
setup
echo "good1" > "$DEPLOY_DIR/current_tag"
set +e; bash "$SCRIPT" "$REPO" bad2 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "current_tag 유지(good1)" test "$(cat "$DEPLOY_DIR/current_tag")" = "good1"
assert ".env가 이전 이미지로 복구" grep -qx "APP_IMAGE=$REPO:good1" "$DEPLOY_DIR/.env"
assert "롤백 시 pull 안 함" bash -c "! grep -q 'docker pull $REPO:good1' '$CALLS_FILE'"

echo "케이스 3: 최초 배포 실패(이전 태그 없음)"
setup
set +e; bash "$SCRIPT" "$REPO" bad1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "current_tag 없음" test ! -f "$DEPLOY_DIR/current_tag"
assert "app 중지" grep -q "docker compose stop app" "$CALLS_FILE"

if [[ $failures -gt 0 ]]; then echo "실패 $failures건"; exit 1; fi
echo "deploy_test 전체 통과"
```

- [ ] **Step 3: 실패 확인**

Run: `chmod +x infra/deploy/test/fakes/* infra/deploy/test/*.sh && infra/deploy/test/deploy_test.sh`
Expected: FAIL (`deploy.sh`가 없어서 모든 케이스가 FAIL)

- [ ] **Step 4: deploy.sh 구현**

`infra/deploy/deploy.sh`:
```bash
#!/usr/bin/env bash
# EC2에서 실행되는 배포 스크립트 — 새 이미지로 app을 교체하고 헬스체크에 실패하면 이전 태그로 롤백한다.
# 사용법: deploy.sh <image_repo_uri> <tag>
set -euo pipefail

REPO_URI="$1"
TAG="$2"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/pillflow}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
PARAM_PATH="${PARAM_PATH:-/pillflow/prod/app/}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/actuator/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-24}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

cd "$DEPLOY_DIR"

# SSM 런타임 파라미터 → app.env (이름의 마지막 경로 조각을 변수명으로, 값은 가공 없이 그대로)
write_app_env() {
  umask 077
  aws ssm get-parameters-by-path --region "$AWS_REGION" --path "$PARAM_PATH" --with-decryption --output json \
    | jq -r '.Parameters[] | "\(.Name | split("/") | last)=\(.Value)"' > app.env.tmp
  chmod 600 app.env.tmp
  mv app.env.tmp app.env
}

# compose가 읽는 .env에 실행할 이미지를 기록하고 app만 재생성한다.
start_app() {
  printf 'APP_IMAGE=%s\n' "$1" > .env
  docker compose up -d app
}

wait_healthy() {
  local i
  for ((i = 1; i <= HEALTH_ATTEMPTS; i++)); do
    if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then return 0; fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

registry="${REPO_URI%%/*}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
write_app_env

previous=""
if [[ -f current_tag ]]; then previous="$(cat current_tag)"; fi

docker pull "$REPO_URI:$TAG"
# caddy는 app과 독립적으로 항상 떠 있어야 한다(없을 때만 생성).
docker compose up -d caddy
start_app "$REPO_URI:$TAG"

if wait_healthy; then
  echo "$TAG" > current_tag
  docker image prune -f > /dev/null
  echo "배포 성공: $TAG"
  exit 0
fi

echo "헬스체크 실패: $TAG" >&2
if [[ -n "$previous" ]]; then
  # 이전 이미지는 인스턴스에 이미 있으므로 pull 없이 기동한다(ECR에서 만료됐어도 롤백 가능).
  start_app "$REPO_URI:$previous"
  if wait_healthy; then echo "이전 태그로 롤백 완료: $previous" >&2; else echo "롤백 후에도 비정상: $previous" >&2; fi
else
  docker compose stop app
  echo "이전 태그가 없어 app을 중지했다" >&2
fi
exit 1
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `infra/deploy/test/deploy_test.sh`
Expected: 모든 줄이 `ok`, 마지막에 `deploy_test 전체 통과`

- [ ] **Step 6: send-deploy.sh 실패 테스트 작성**

`infra/deploy/test/send_deploy_test.sh`:
```bash
#!/usr/bin/env bash
# send-deploy.sh 테스트 — SSM으로 보내는 명령에 세 파일이 손상 없이 담기는지, 원격 실패가 종료 코드로 전달되는지 검증한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../send-deploy.sh"
failures=0
assert() { local d="$1"; shift; if "$@"; then echo "  ok   - $d"; else echo "  FAIL - $d"; failures=$((failures+1)); fi; }

export CALLS_FILE; CALLS_FILE="$(mktemp)"
export PATH="$HERE/fakes:$PATH" POLL_ATTEMPTS=2 POLL_INTERVAL=0

echo "케이스 1: 원격 성공"
: > "$CALLS_FILE"; export FAKE_SSM_STATUS=Success
bash "$SCRIPT" i-0abc repo.example/pillflow-api sha1 > /dev/null; rc=$?
assert "종료 코드 0" test "$rc" -eq 0
params="$(grep 'aws ssm send-command' "$CALLS_FILE" | sed -E 's/.*--parameters (\{.*\})( --|$).*/\1/')"
assert "deploy.sh 실행 명령 포함" bash -c "echo '$params' | jq -e '.commands | any(. == \"/opt/pillflow/deploy.sh repo.example/pillflow-api sha1\")' > /dev/null"
for f in compose.yml Caddyfile deploy.sh; do
  b64="$(echo "$params" | jq -r --arg f "$f" '.commands[] | select(endswith("> /opt/pillflow/" + $f)) | capture("^echo (?<b>[A-Za-z0-9+/=]+) ").b')"
  assert "$f 내용 일치" bash -c "diff <(echo '$b64' | base64 --decode) '$HERE/../$f' > /dev/null"
done

echo "케이스 2: 원격 실패"
: > "$CALLS_FILE"; export FAKE_SSM_STATUS=Failed
set +e; bash "$SCRIPT" i-0abc repo.example/pillflow-api sha1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1

if [[ $failures -gt 0 ]]; then echo "실패 $failures건"; exit 1; fi
echo "send_deploy_test 전체 통과"
```

- [ ] **Step 7: 실패 확인**

Run: `chmod +x infra/deploy/test/send_deploy_test.sh && infra/deploy/test/send_deploy_test.sh`
Expected: FAIL (`send-deploy.sh`와 compose.yml/Caddyfile 없음)

- [ ] **Step 8: compose.yml, Caddyfile, send-deploy.sh 구현**

`infra/deploy/compose.yml`:
```yaml
# EC2 런타임 구성 — app(Spring Boot)과 caddy(HTTPS 종단). APP_IMAGE는 deploy.sh가 .env에 기록한다.
name: pillflow
services:
  app:
    image: ${APP_IMAGE:?APP_IMAGE가 필요하다}
    env_file: app.env
    environment:
      SPRING_PROFILES_ACTIVE: prod
      JAVA_TOOL_OPTIONS: -XX:MaxRAMPercentage=70
    # 외부에는 노출하지 않고 호스트 헬스체크용으로만 루프백에 바인딩한다.
    ports:
      - "127.0.0.1:8080:8080"
    mem_limit: 1200m
    restart: unless-stopped
    logging:
      driver: awslogs
      options:
        awslogs-region: ap-northeast-1
        awslogs-group: /pillflow/api
        awslogs-stream: app
  caddy:
    image: caddy:2.11.4
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      # 인증서를 디스크에 보존해 재시작 시 재발급(Let's Encrypt 한도)을 피한다.
      - ./caddy-data:/data
      - ./caddy-config:/config
    restart: unless-stopped
    logging:
      driver: awslogs
      options:
        awslogs-region: ap-northeast-1
        awslogs-group: /pillflow/api
        awslogs-stream: caddy
```

`infra/deploy/Caddyfile`:
```
# api.pillflow.app — Let's Encrypt 인증서 자동 발급·갱신, HTTP는 HTTPS로 자동 리다이렉트
api.pillflow.app {
	encode gzip
	reverse_proxy app:8080
}
```

`infra/deploy/send-deploy.sh`:
```bash
#!/usr/bin/env bash
# GitHub 러너에서 실행 — 배포 파일을 SSM Run Command로 EC2에 전달하고 deploy.sh 결과를 기다린다.
# 사용법: send-deploy.sh <instance_id> <image_repo_uri> <tag>
set -euo pipefail

INSTANCE_ID="$1"
REPO_URI="$2"
TAG="$3"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-180}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
DIR="$(cd "$(dirname "$0")" && pwd)"

b64() { base64 < "$1" | tr -d '\n'; }

# 원격에서 실행할 명령 목록(JSON 배열). 파일은 base64로 전달해 따옴표·개행 문제를 없앤다.
commands="$(jq -n \
  --arg compose "$(b64 "$DIR/compose.yml")" \
  --arg caddy "$(b64 "$DIR/Caddyfile")" \
  --arg deploy "$(b64 "$DIR/deploy.sh")" \
  --arg run "/opt/pillflow/deploy.sh $REPO_URI $TAG" \
  '[
    "set -eu",
    "install -d -m 755 /opt/pillflow /opt/pillflow/caddy-data /opt/pillflow/caddy-config",
    "echo \($compose) | base64 -d > /opt/pillflow/compose.yml",
    "echo \($caddy) | base64 -d > /opt/pillflow/Caddyfile",
    "echo \($deploy) | base64 -d > /opt/pillflow/deploy.sh",
    "chmod 755 /opt/pillflow/deploy.sh",
    $run
  ]')"
parameters="$(jq -cn --argjson c "$commands" '{commands: $c, executionTimeout: ["900"]}')"

command_id="$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "pillflow deploy $TAG" \
  --parameters "$parameters" \
  --query Command.CommandId --output text)"

# aws ssm wait는 최대 대기 시간이 짧아 직접 폴링한다.
status="Pending"
for ((i = 1; i <= POLL_ATTEMPTS; i++)); do
  status="$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" --query Status --output text 2>/dev/null || echo Pending)"
  case "$status" in
    Pending | InProgress | Delayed) sleep "$POLL_INTERVAL" ;;
    *) break ;;
  esac
done

echo "원격 상태: $status"
aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text || true

if [[ "$status" != "Success" ]]; then exit 1; fi
```

- [ ] **Step 9: 테스트 통과와 정적 검사**

Run:
```bash
infra/deploy/test/deploy_test.sh && infra/deploy/test/send_deploy_test.sh
docker run --rm -v "$PWD/infra/deploy:/mnt" koalaman/shellcheck:stable /mnt/deploy.sh /mnt/send-deploy.sh /mnt/test/deploy_test.sh /mnt/test/send_deploy_test.sh
docker run --rm -v "$PWD/infra/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.11.4 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
(cd infra/deploy && touch app.env && APP_IMAGE=x docker compose -f compose.yml config -q; rm -f app.env)
```
Expected: 두 테스트 모두 전체 통과. shellcheck 경고 없음(경고가 있으면 고친 뒤 재실행). `Valid configuration`, compose config는 출력 없이 종료 코드 0.

- [ ] **Step 10: 커밋**

```bash
git add infra/deploy
git commit -m "[Feat] EC2 Compose 구성과 배포·롤백 스크립트(SSM 전송 포함) 추가"
```

---

### Task 5: CI 워크플로

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: 워크플로 이름 **`ci`**(Task 6의 `workflow_run.workflows: [ci]`가 이 이름에 의존)

- [ ] **Step 1: ci.yml 작성**

```yaml
# PR과 main push마다 백엔드 테스트, 프론트 빌드, Terraform 정적 검사, 배포 스크립트 테스트를 실행한다.
name: ci

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: "25"
      - uses: gradle/actions/setup-gradle@v6
      - name: 백엔드 테스트 (Testcontainers)
        working-directory: backend
        run: ./gradlew test --no-daemon

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with:
          version: 10.33.0
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - name: 알림 스케줄 테스트
        working-directory: artifacts/pillflow
        run: ../../scripts/node_modules/.bin/tsx --tsconfig tsconfig.json src/lib/notificationSchedule.test.ts

  infra:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.14.8
      - name: terraform fmt
        run: terraform fmt -check -recursive infra/terraform
      - name: terraform validate
        run: |
          for dir in infra/terraform/bootstrap infra/terraform/main; do
            terraform -chdir="$dir" init -backend=false -input=false
            terraform -chdir="$dir" validate
          done
      - name: 배포 스크립트 테스트
        run: |
          chmod +x infra/deploy/test/fakes/* infra/deploy/test/*.sh
          infra/deploy/test/deploy_test.sh
          infra/deploy/test/send_deploy_test.sh
```

- [ ] **Step 2: actionlint 검사**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color .github/workflows/ci.yml`
Expected: 출력 없음(종료 코드 0)

- [ ] **Step 3: 커밋 후 PR에서 확인**

```bash
git add .github/workflows/ci.yml
git commit -m "[Chore] CI 워크플로(백엔드·프론트·Terraform·배포 스크립트 검사) 추가"
```
브랜치를 push하고 PR을 연다(★ push·PR 생성 전 사용자 확인). Expected: `backend`, `frontend`, `infra` 작업 3개가 모두 녹색.
`frontend`의 `pnpm build`가 `VITE_SUPABASE_URL` 누락으로 실패하면, 빌드 단계에 공개 값인 env(`VITE_SUPABASE_URL: https://igyydnnehdjrwujxqdry.supabase.co`, `VITE_SUPABASE_ANON_KEY: ci-placeholder`)를 추가한다.

---

### Task 6: 배포 워크플로

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes:
  - Task 5의 워크플로 이름 `ci`
  - Task 3 출력(GitHub 저장소 **변수**로 등록): `AWS_DEPLOY_ROLE_ARN` ← `deploy_role_arn`, `EC2_INSTANCE_ID` ← `instance_id`, `ECR_REPOSITORY_URI` ← `ecr_repository_url`
  - 저장소 변수 `AUTO_DEPLOY_ENABLED`(`true`일 때만 workflow_run으로 자동 배포)
  - Task 1의 migrate 프로파일 환경변수 `FLYWAY_URL`/`FLYWAY_USERNAME`/`FLYWAY_PASSWORD`
  - Task 4의 `infra/deploy/send-deploy.sh <instance_id> <repo_uri> <tag>`

- [ ] **Step 1: deploy.yml 작성**

```yaml
# main 배포: 변경 감지 → arm64 이미지 빌드 → Flyway 마이그레이션 → EC2 교체(SSM) → 스모크 테스트
name: deploy

on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      image_tag:
        description: "배포할 기존 이미지 태그(비우면 현재 커밋을 빌드)"
        required: false
        default: ""
      migrate_only:
        description: "마이그레이션만 실행(배포 생략)"
        type: boolean
        default: false

permissions:
  contents: read

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  AWS_REGION: ap-northeast-1

jobs:
  changes:
    # 수동 실행이거나, 자동 배포가 켜져 있고 main push의 CI가 성공한 경우에만 진행한다.
    if: >-
      github.event_name == 'workflow_dispatch' ||
      (vars.AUTO_DEPLOY_ENABLED == 'true' &&
       github.event.workflow_run.conclusion == 'success' &&
       github.event.workflow_run.event == 'push')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: read
    outputs:
      deploy: ${{ steps.detect.outputs.deploy }}
      sha: ${{ steps.detect.outputs.sha }}
      tag: ${{ steps.detect.outputs.tag }}
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
          fetch-depth: 0
      - id: detect
        env:
          GH_TOKEN: ${{ github.token }}
          EVENT: ${{ github.event_name }}
          HEAD_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}
          INPUT_TAG: ${{ inputs.image_tag }}
        run: |
          echo "sha=$HEAD_SHA" >> "$GITHUB_OUTPUT"
          echo "tag=${INPUT_TAG:-$HEAD_SHA}" >> "$GITHUB_OUTPUT"
          if [[ "$EVENT" == "workflow_dispatch" ]]; then
            echo "deploy=true" >> "$GITHUB_OUTPUT"; exit 0
          fi
          # 마지막으로 성공한 배포 커밋 이후 변경을 본다(없으면 직전 커밋 기준).
          base="$(gh run list --workflow deploy.yml --branch main --status success --limit 1 --json headSha --jq '.[0].headSha // empty')"
          if [[ -z "$base" ]] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then base="$HEAD_SHA^"; fi
          if git diff --name-only "$base" "$HEAD_SHA" | grep -qE '^(backend/|infra/deploy/|\.github/workflows/deploy\.yml$)'; then
            echo "deploy=true" >> "$GITHUB_OUTPUT"
          else
            echo "deploy=false" >> "$GITHUB_OUTPUT"
          fi

  build:
    needs: changes
    if: needs.changes.outputs.deploy == 'true' && inputs.image_tag == ''
    runs-on: ubuntu-24.04-arm
    environment: production
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ needs.changes.outputs.sha }}
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: 이미지 빌드·push (이미 있으면 건너뜀 — 불변 태그 재실행 대비)
        env:
          REPO_URI: ${{ vars.ECR_REPOSITORY_URI }}
          TAG: ${{ needs.changes.outputs.tag }}
        run: |
          if aws ecr describe-images --repository-name "${REPO_URI##*/}" --image-ids imageTag="$TAG" > /dev/null 2>&1; then
            echo "이미지가 이미 존재함: $TAG — 빌드 생략"; exit 0
          fi
          docker build -t "$REPO_URI:$TAG" backend
          docker push "$REPO_URI:$TAG"

  migrate:
    needs: [changes, build]
    if: always() && needs.changes.outputs.deploy == 'true' && (needs.build.result == 'success' || needs.build.result == 'skipped')
    runs-on: ubuntu-24.04-arm
    environment: production
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Flyway 마이그레이션 (migrate 프로파일)
        env:
          REPO_URI: ${{ vars.ECR_REPOSITORY_URI }}
          TAG: ${{ needs.changes.outputs.tag }}
        run: |
          env_file="$(mktemp)"; chmod 600 "$env_file"
          trap 'rm -f "$env_file"' EXIT
          aws ssm get-parameters-by-path --path /pillflow/prod/migration/ --with-decryption --output json \
            | jq -r '.Parameters[] | "\(.Name | split("/") | last)=\(.Value)"' > "$env_file"
          # 로그에 비밀번호가 찍히지 않도록 마스킹한다.
          while IFS='=' read -r _ value; do echo "::add-mask::$value"; done < <(grep '^FLYWAY_PASSWORD=' "$env_file")
          docker run --rm --env-file "$env_file" -e SPRING_PROFILES_ACTIVE=migrate "$REPO_URI:$TAG"

  deploy:
    needs: [changes, migrate]
    if: always() && needs.migrate.result == 'success' && inputs.migrate_only != true
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ needs.changes.outputs.sha }}
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - name: EC2 배포 (SSM Run Command)
        run: infra/deploy/send-deploy.sh "${{ vars.EC2_INSTANCE_ID }}" "${{ vars.ECR_REPOSITORY_URI }}" "${{ needs.changes.outputs.tag }}"

  smoke:
    needs: deploy
    if: always() && needs.deploy.result == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: 헬스체크
        run: |
          for i in $(seq 1 12); do
            if curl -fsS https://api.pillflow.app/actuator/health | grep -q '"status":"UP"'; then echo "UP"; exit 0; fi
            sleep 5
          done
          echo "스모크 테스트 실패"; exit 1
```

- [ ] **Step 2: actionlint 검사**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color .github/workflows/deploy.yml`
Expected: 출력 없음. shellcheck 경고(SC 코드)가 나오면 고친 뒤 재실행한다.

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/deploy.yml
git commit -m "[Feat] main 배포 워크플로(빌드·마이그레이션·SSM 배포·스모크) 추가"
```

---

### Task 7: 최초 가동 (운영 적용과 완료 기준 검증)

★ 단계마다 **실행 직전에 사용자에게 명령과 영향(과금·변경 대상)을 보여 주고 확인을 받는다.** 비밀번호는 사용자가 직접 입력하며, 대화나 로그에 남기지 않는다.

**Files:**
- Create: `infra/scripts/put-secret.sh`, `infra/scripts/flyway-baseline.sh`, `infra/scripts/set-api-role-password.sh`
- Modify: `backend/README.md`, `CLAUDE.md`, `docs/architecture.md`

**Interfaces:**
- Consumes: Task 1~6 전부, Task 3 outputs

- [ ] **Step 1: 운영 스크립트 작성**

`infra/scripts/put-secret.sh`:
```bash
#!/usr/bin/env bash
# 비밀번호를 화면·셸 기록에 남기지 않고 SSM SecureString으로 저장한다.
# 사용법: put-secret.sh <parameter_name>
set -euo pipefail
name="$1"
read -rsp "값 입력 ($name): " value; echo
[[ -n "$value" ]] || { echo "빈 값은 저장하지 않는다" >&2; exit 1; }
aws ssm put-parameter --region ap-northeast-1 --name "$name" --type SecureString --overwrite --value "$value" > /dev/null
echo "저장 완료: $name"
```

`infra/scripts/flyway-baseline.sh`:
```bash
#!/usr/bin/env bash
# 운영 DB를 Flyway 버전 1로 baseline한다(V1 SQL은 실행하지 않음). 최초 1회만 실행한다.
# 접속 정보는 SSM /pillflow/prod/migration/* 에서 읽는다(로컬 AWS 자격증명 필요).
set -euo pipefail
get() { aws ssm get-parameter --region ap-northeast-1 --name "/pillflow/prod/migration/$1" --with-decryption --query Parameter.Value --output text; }
env_file="$(mktemp)"; chmod 600 "$env_file"; trap 'rm -f "$env_file"' EXIT
{
  echo "FLYWAY_URL=$(get FLYWAY_URL)"
  echo "FLYWAY_USER=$(get FLYWAY_USERNAME)"
  echo "FLYWAY_PASSWORD=$(get FLYWAY_PASSWORD)"
} > "$env_file"
docker run --rm --env-file "$env_file" flyway/flyway:11.14.1 \
  -schemas=flyway -defaultSchema=flyway -createSchemas=true -baselineVersion=1 \
  -baselineDescription="2026-09-25 ALTER 방식 적용분" baseline
docker run --rm --env-file "$env_file" flyway/flyway:11.14.1 -schemas=flyway -defaultSchema=flyway info
```

`infra/scripts/set-api-role-password.sh`:
```bash
#!/usr/bin/env bash
# pillflow_api 비밀번호를 무작위 생성해 DB에 설정하고 SSM에 저장한다. 비밀번호는 화면에 출력하지 않는다.
# 전제: V2 마이그레이션으로 pillflow_api role이 이미 존재한다.
set -euo pipefail
get() { aws ssm get-parameter --region ap-northeast-1 --name "/pillflow/prod/migration/$1" --with-decryption --query Parameter.Value --output text; }
url="$(get FLYWAY_URL)"          # jdbc:postgresql://host:5432/postgres?sslmode=require
hostport="${url#jdbc:postgresql://}"; hostport="${hostport%%/*}"
admin_user="$(get FLYWAY_USERNAME)"
admin_pw="$(get FLYWAY_PASSWORD)"
new_pw="$(openssl rand -hex 24)"   # 16진수만 사용 → SQL·env 인용 문제 없음
printf '\\set pw %s\nALTER ROLE pillflow_api PASSWORD :'"'"'pw'"'"';\n' "$new_pw" \
  | docker run --rm -i -e PGPASSWORD="$admin_pw" postgres:17-alpine \
      psql "host=${hostport%%:*} port=${hostport##*:} dbname=postgres user=$admin_user sslmode=require" -v ON_ERROR_STOP=1 -q
aws ssm put-parameter --region ap-northeast-1 --name /pillflow/prod/app/DB_PASSWORD --type SecureString --overwrite --value "$new_pw" > /dev/null
echo "pillflow_api 비밀번호 설정 및 SSM 저장 완료"
```

Run: `chmod +x infra/scripts/*.sh && docker run --rm -v "$PWD/infra/scripts:/mnt" koalaman/shellcheck:stable /mnt/*.sh`
Expected: 경고 없음

- [ ] **Step 2: ★ bootstrap 적용**

Run: `cd infra/terraform/bootstrap && terraform init && terraform apply`
Expected: `Apply complete! Resources: 5 added`. `state_bucket` 출력값을 기록한다.

- [ ] **Step 3: ★ 메인 인프라 적용 (이 시점부터 과금)**

```bash
cd infra/terraform/main
cp backend.hcl.example backend.hcl        # bucket을 state_bucket 값으로 수정
cp terraform.tfvars.example terraform.tfvars   # alert_email을 사용자 이메일로 수정
terraform init -backend-config=backend.hcl
terraform plan -out=main.tfplan           # 사용자에게 요약(추가 리소스 수) 보여 주고 확인
terraform apply main.tfplan
terraform output
terraform plan -detailed-exitcode; echo "exit=$?"
```
Expected: apply 성공, 마지막 plan은 `No changes.`와 `exit=0`.

- [ ] **Step 4: ★ postgres 비밀번호 저장**

Run: `infra/scripts/put-secret.sh /pillflow/prod/migration/FLYWAY_PASSWORD` (사용자가 Supabase 대시보드의 DB 비밀번호를 직접 입력)
Expected: `저장 완료`

- [ ] **Step 5: ★ BYPASSRLS 허용 여부 검증 (롤백 트랜잭션)**

Supabase MCP `execute_sql`로 실행한다(변경 없음 — 예외로 롤백):
```sql
do $$
begin
  create role pillflow_bypass_probe login bypassrls;
  raise exception 'PROBE_OK';
end $$;
```
Expected: 오류 메시지가 `PROBE_OK`이면 허용이다(→ Step 6 진행). `permission denied` 등이면 **중단**하고 스펙 5장의 대안(RLS `set_config` 방식)으로 전환할지 사용자에게 확인한다.

- [ ] **Step 6: ★ 운영 DB baseline V1**

Run: `infra/scripts/flyway-baseline.sh`
Expected: `info` 출력에 버전 `1`이 `Baseline`, 버전 `2`가 `Pending`으로 표시된다.

- [ ] **Step 7: ★ GitHub 설정 (Environment·변수)**

```bash
REPO=CUCU7103/Pill-Flow2
cd infra/terraform/main
gh api -X PUT "repos/$REPO/environments/production" --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api -X POST "repos/$REPO/environments/production/deployment-branch-policies" -f name=main -f type=branch
gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --body "$(terraform output -raw deploy_role_arn)"
gh variable set EC2_INSTANCE_ID --repo "$REPO" --body "$(terraform output -raw instance_id)"
gh variable set ECR_REPOSITORY_URI --repo "$REPO" --body "$(terraform output -raw ecr_repository_url)"
gh variable set AUTO_DEPLOY_ENABLED --repo "$REPO" --body false
gh variable list --repo "$REPO"
```
Expected: 변수 4개가 목록에 나온다.

- [ ] **Step 8: ★ V2 적용 (migrate_only)**

Task 1~6이 main에 merge된 뒤 실행한다(★ merge·push 전 확인).
Run: `gh workflow run deploy.yml --repo CUCU7103/Pill-Flow2 --ref main -f migrate_only=true && sleep 10 && gh run watch --repo CUCU7103/Pill-Flow2 "$(gh run list --repo CUCU7103/Pill-Flow2 --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"`
Expected: `build`, `migrate` 성공, `deploy`와 `smoke`는 skipped. migrate 로그에 `Successfully applied 1 migration ... v2`.
실패 시 확인할 것: OIDC `sub` 불일치(assume 실패) → IAM 신뢰 조건의 저장소 이름 대소문자, Environment 이름.

- [ ] **Step 9: ★ pillflow_api 비밀번호 설정**

Run: `infra/scripts/set-api-role-password.sh`
Expected: `pillflow_api 비밀번호 설정 및 SSM 저장 완료`

- [ ] **Step 10: DNS 확인 후 ★ 첫 전체 배포**

```bash
dig +short api.pillflow.app @8.8.8.8     # terraform output api_public_ip와 같아야 한다(다르면 전파 대기)
gh workflow run deploy.yml --repo CUCU7103/Pill-Flow2 --ref main
```
Expected: `build`(이미지 존재로 생략), `migrate`(적용할 것 없음), `deploy`, `smoke` 모두 성공.

- [ ] **Step 11: 완료 기준 검증**

```bash
curl -sS -o /dev/null -w '%{http_code} %{ssl_verify_result}\n' https://api.pillflow.app/actuator/health   # 200 0
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://api.pillflow.app/actuator/health        # 308 https://api.pillflow.app/...
curl -sS -o /dev/null -w '%{http_code}\n' https://api.pillflow.app/api/v1/me                              # 401
nc -z -w 5 "$(cd infra/terraform/main && terraform output -raw api_public_ip)" 22; echo "ssh_exit=$?"      # ssh_exit=1 (닫힘)
aws ec2 describe-instances --instance-ids "$(cd infra/terraform/main && terraform output -raw instance_id)" \
  --query 'Reservations[0].Instances[0].MetadataOptions.HttpTokens' --output text                          # required
aws logs describe-log-streams --log-group-name /pillflow/api --query 'logStreams[].logStreamName' --output text  # app caddy
```
추가 확인:
- **인증 200**: 사용자가 앱에 로그인한 브라우저 개발자 도구에서 Supabase access token을 복사해 `curl -H "Authorization: Bearer <token>" https://api.pillflow.app/api/v1/me`를 실행한다 → 200과 본인 `userId`. 토큰은 대화에 붙여 넣지 않는다.
- **권한 분리**: `aws ssm start-session --target <instance_id>` 접속 후 `aws ssm get-parameter --name /pillflow/prod/migration/FLYWAY_PASSWORD --with-decryption --region ap-northeast-1` → `AccessDeniedException`
- **재실행(Review Focus 4)**: 같은 커밋으로 `gh workflow run deploy.yml --ref main`을 한 번 더 실행 → build 로그에 `이미지가 이미 존재함`, 전체 성공
- **실패 처리(운영 확인)**: SSM 세션에서 `sudo HEALTH_URL=http://127.0.0.1:9/ HEALTH_ATTEMPTS=2 HEALTH_INTERVAL=1 /opt/pillflow/deploy.sh <ECR_URI> <현재태그>` 실행(헬스체크 주소를 일부러 틀리게 줌) → 종료 코드 1, `current_tag` 변경 없음, 같은 이미지가 계속 실행되므로 이후 `curl https://api.pillflow.app/actuator/health` 200. 롤백 로직(이전 태그 복귀, pull 안 함, 최초 실패 시 중지)은 Task 4 단위 테스트가 검증한다.
- **롤백 운영 확인(Review Focus 2)**: 두 번째 커밋이 배포된 뒤 `gh workflow run deploy.yml --ref main -f image_tag=<첫 배포 SHA>`로 이전 버전을 재배포 → 성공, `/opt/pillflow/current_tag`가 첫 배포 SHA
- **재부팅(Review Focus 5)**: `aws ec2 reboot-instances --instance-ids <id>` → 3분 뒤 헬스체크 200
- **Budget·경보**: `aws budgets describe-budgets --account-id <id> --query 'Budgets[].BudgetName'`에 `pillflow-monthly`, `aws cloudwatch describe-alarms --alarm-names pillflow-api-system-recover`

- [ ] **Step 12: ★ 자동 배포 활성화**

Run: `gh variable set AUTO_DEPLOY_ENABLED --repo CUCU7103/Pill-Flow2 --body true`

- [ ] **Step 13: 문서 갱신과 커밋**

- `backend/README.md`: "운영 배포" 절을 추가한다. SSM 파라미터 표(경로·내용·읽는 주체), 최초 가동 순서(Step 2~12 요약), 스크립트 3개 사용법, 롤백 방법(`gh workflow run deploy.yml -f image_tag=<이전 SHA>`)을 적는다. 기존 "Flyway CLI baseline" 절은 `infra/scripts/flyway-baseline.sh`를 가리키도록 고친다.
- `CLAUDE.md`: 배포 섹션을 "Vercel(웹) + AWS EC2(`api.pillflow.app`, Terraform `infra/terraform`, GitHub Actions `deploy.yml`)"로 갱신하고, 운영 DB의 baseline·V2 적용 완료 사실을 반영한다.
- `docs/architecture.md`: 배포 구조도에 EC2(Caddy + Spring Boot), ECR, SSM, GitHub Actions를 추가한다.

```bash
git add infra/scripts backend/README.md CLAUDE.md docs/architecture.md
git commit -m "[Docs] AWS 배포 운영 스크립트와 최초 가동 절차 문서화"
```

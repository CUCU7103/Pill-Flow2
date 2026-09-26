# AWS + Terraform 배포 설계 (하위 프로젝트 5)

- 작성일: 2026-09-25
- 상태: 설계 확정, 사용자 검토 대기
- 선행: [Kotlin 백엔드 기반 설계](2026-09-25-kotlin-backend-foundation-design.md) (하위 프로젝트 1, main 반영 완료 `2f8ccd3`)

## 1. 배경과 목표

PillFlow는 "앱 → Kotlin Spring Boot API → Supabase PostgreSQL" 구조로 전환하고 있다. DB와 인증(Supabase Auth)은 Supabase가 맡고, Kotlin 서버는 Supabase 밖에 따로 띄워야 한다. Supabase에서 서버 코드를 실행할 수 있는 곳은 Deno 전용인 Edge Function뿐이기 때문이다.

이 문서는 Kotlin 서버 하나를 AWS에 **최소 구성**으로 배포하는 인프라(Terraform)와 CI/CD를 정의한다.

**목표**
- 학습·포트폴리오와 실제 출시를 함께 만족한다. 국내 백엔드 표준 조합인 "Spring Boot + Docker + AWS + GitHub Actions + Terraform"을 쓴다.
- 서버가 하나뿐이므로 월 약 $21 수준의 최소 비용으로 운영한다.
- 운영 서버는 최소 권한만 가진다. DB DDL 권한은 main 브랜치의 배포 파이프라인만 가진다.

**확정된 결정**
| 항목 | 결정 | 근거 |
|---|---|---|
| 클라우드 | AWS | 국내 채용 시장 가치. Cloud Run은 Spring 콜드 스타트가 복약 앱의 간헐적 사용 패턴에 불리 |
| 리전 | 도쿄 `ap-northeast-1` | Supabase DB(`igyydnnehdjrwujxqdry`)와 같은 리전이라 DB 왕복 지연이 최소 |
| 컴퓨트 | EC2 `t4g.small` 1대 (arm64, 2GB) | Spring Boot에 2GB가 안전. ALB·ECS·NAT를 쓰지 않아 비용 절감 |
| HTTPS | 인스턴스 안의 Caddy가 Let's Encrypt 인증서를 자동 발급 | ALB+ACM(월 약 $16~20) 절감. 웹·Capacitor(`https://localhost`)에서 호출하려면 HTTPS 필수 |
| 도메인 | `pillflow.app` (Route53 구매 완료, 호스팅 영역 `Z06240551735N8MVX5DNO`) | API 주소는 `api.pillflow.app` |
| CI/CD | GitHub Actions: CI(PR) + main 자동 배포 | |
| 마이그레이션 | 배포 파이프라인의 별도 단계에서 실행 | 운영 서버에 postgres 관리자 비밀번호를 두지 않기 위함 |

**전제 사실**
- GitHub 저장소 `CUCU7103/Pill-Flow2`는 **공개 저장소**다. 시크릿, Terraform 상태 파일, 개인 정보(알림 이메일)는 저장소에 넣지 않는다.
- Supabase의 DB 직접 연결 주소는 IPv6 전용이다. EC2에서는 **Supavisor 풀러(session 모드, IPv4)**로 접속하고, 사용자명은 `<role>.igyydnnehdjrwujxqdry` 형식이다.
- 운영 DB는 2026-09-25에 ALTER 방식으로 V1 스키마가 적용되어 있다. 운영 Flyway는 **baseline(V1)**이 필요하고, V2(`pillflow_api` role)는 아직 적용되지 않았다(`backend/README.md` 참조).
- 로컬 도구: Terraform v1.14.8, AWS CLI v2, AWS 계정 `116981801268`.

## 2. Terraform 인프라

### 2.1 디렉토리와 상태 관리

```
infra/terraform/
├── bootstrap/   ← 상태 저장용 S3 버킷 (최초 1회 실행, 로컬 상태 — *.tfstate는 gitignore)
└── main/        ← 실제 인프라 (S3 백엔드, use_lockfile = true로 잠금)
    ├── versions.tf    ← terraform·provider 버전 고정, backend 설정
    ├── network.tf     ← VPC, 서브넷, IGW, 라우트 테이블, 보안그룹
    ├── compute.tf     ← EC2, EIP, user_data, 자동 복구 경보
    ├── dns.tf         ← api.pillflow.app 레코드 (호스팅 영역은 data 소스)
    ├── ecr.tf
    ├── iam.tf         ← 인스턴스 역할, GitHub OIDC 공급자·배포 역할
    ├── ssm.tf         ← 파라미터 자리 생성 (값은 ignore_changes)
    ├── observability.tf ← CloudWatch 로그 그룹, Budget
    ├── variables.tf / outputs.tf
    └── terraform.tfvars.example   ← 실제 terraform.tfvars는 gitignore
```

- 상태 버킷: 버전 관리, 서버 측 암호화, 퍼블릭 접근 전면 차단. Terraform 1.10 이상은 S3 네이티브 잠금(`use_lockfile`)을 지원하므로 DynamoDB를 쓰지 않는다.
- AWS provider 버전은 구현 시점의 최신 안정판으로 고정한다(추측 금지, 공식 레지스트리에서 확인).
- 모든 리소스에 `default_tags { Project = "pillflow", ManagedBy = "terraform" }`를 붙인다.

### 2.2 리소스

| 영역 | 리소스 | 핵심 설정 |
|---|---|---|
| 네트워크 | VPC 1개, 퍼블릭 서브넷 1개(`ap-northeast-1a`), IGW, 라우트 테이블 | NAT 없음, IPv4만 |
| 보안그룹 | 인바운드 TCP 80·443 (0.0.0.0/0), 아웃바운드 전체 | **22번 포트 없음**. 80은 ACME HTTP 검증과 HTTPS 리다이렉트용 |
| 서버 | EC2 `t4g.small`, Amazon Linux 2023 arm64 | AMI는 SSM 공개 파라미터로 최신 조회. 루트 볼륨 gp3 20GB 암호화. **IMDSv2 강제**(`http_tokens = required`). user_data로 Docker, Compose 플러그인 설치 및 `/opt/pillflow` 생성 |
| 고정 IP | Elastic IP | 인스턴스를 교체해도 DNS 유지 |
| DNS | `api.pillflow.app` A 레코드 → EIP | 호스팅 영역은 `data "aws_route53_zone"`으로 참조, 새로 만들지 않음 |
| 이미지 | ECR `pillflow-api` | 태그 = git SHA, **불변 태그**, push 시 스캔, 최근 10개만 유지(lifecycle) |
| 시크릿 | SSM Parameter Store SecureString | `/pillflow/prod/app/*`(런타임), `/pillflow/prod/migration/*`(DDL). Terraform은 자리 값만 만들고 `lifecycle { ignore_changes = [value] }`. 실제 값은 CLI로 입력하므로 상태 파일에 비밀번호가 남지 않음 |
| 로그 | CloudWatch 로그 그룹 `/pillflow/api` | 보존 14일, Docker `awslogs` 드라이버로 전송 |
| 복구 | CloudWatch 경보 `StatusCheckFailed_System` → EC2 recover 액션 | 하드웨어 장애 자동 복구 |
| 비용 | AWS Budgets 월 $30 | 실제 비용 80%, 100% 도달 시 이메일. 이메일은 `terraform.tfvars` 변수 |

**SSM 파라미터 목록**
| 경로 | 내용 | 읽을 수 있는 주체 |
|---|---|---|
| `/pillflow/prod/app/DB_URL` | 풀러 JDBC URL | EC2 역할 |
| `/pillflow/prod/app/DB_USERNAME` | `pillflow_api.igyydnnehdjrwujxqdry` | EC2 역할 |
| `/pillflow/prod/app/DB_PASSWORD` | `pillflow_api` 비밀번호 | EC2 역할 |
| `/pillflow/prod/app/SUPABASE_URL` | `https://igyydnnehdjrwujxqdry.supabase.co` | EC2 역할 |
| `/pillflow/prod/app/CORS_ALLOWED_ORIGINS` | 실제 Vercel 도메인, `https://localhost`, `https://pillflow.app` | EC2 역할 |
| `/pillflow/prod/migration/FLYWAY_URL` | 풀러 JDBC URL | GitHub 배포 역할 |
| `/pillflow/prod/migration/FLYWAY_USERNAME` | `postgres.igyydnnehdjrwujxqdry` | GitHub 배포 역할 |
| `/pillflow/prod/migration/FLYWAY_PASSWORD` | postgres 비밀번호 | GitHub 배포 역할 |

### 2.3 IAM

**EC2 인스턴스 역할**
- `AmazonSSMManagedInstanceCore` (Session Manager, Run Command)
- `pillflow-api` ECR 저장소 pull, `ecr:GetAuthorizationToken`
- `ssm:GetParameter(s)`, `GetParametersByPath`: `/pillflow/prod/app/*`만 허용. SecureString 복호화용 KMS(`aws/ssm`) decrypt
- 로그 그룹 `/pillflow/api`에 쓰기

**GitHub 배포 역할 (OIDC)**
- OIDC 공급자 `token.actions.githubusercontent.com`
- 신뢰 조건: `aud = sts.amazonaws.com`, `sub = repo:CUCU7103/Pill-Flow2:environment:production`
  - 배포 작업은 `production` Environment에서 실행한다. Environment의 배포 브랜치 규칙을 `main`으로 제한해서 **main 브랜치에서만** 이 역할을 쓸 수 있게 한다.
- 권한
  - `pillflow-api` ECR push
  - 해당 인스턴스(태그 조건)에 대한 `ssm:SendCommand`(`AWS-RunShellScript` 문서), `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations`
  - `/pillflow/prod/migration/*` 읽기와 KMS decrypt

**결과**: postgres 관리자 비밀번호는 운영 서버가 읽을 수 없고, main 브랜치의 배포 파이프라인만 읽을 수 있다.

### 2.4 예상 비용 (월, 온디맨드, 구현 시 요금 계산기로 재확인)

| 항목 | 금액 |
|---|---|
| EC2 `t4g.small` | 약 $16 |
| EBS gp3 20GB | 약 $2 |
| 퍼블릭 IPv4 (EIP) | 약 $3.6 |
| Route53 호스팅 영역 | $0.5 |
| ECR, CloudWatch, SSM Standard, S3 상태 | 거의 0 |
| **합계** | **약 $21** (도메인 연 $20 별도) |

## 3. CI/CD

### 3.1 `.github/workflows/ci.yml`: PR과 main push마다 실행

| 작업 | 러너 | 단계 |
|---|---|---|
| backend | `ubuntu-latest` | JDK 25 설정 → `cd backend && ./gradlew test` (Testcontainers는 러너의 Docker 사용) |
| frontend | `ubuntu-latest` | pnpm 설정 → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm build` → `cd artifacts/pillflow && ../../scripts/node_modules/.bin/tsx --tsconfig tsconfig.json src/lib/notificationSchedule.test.ts` |
| terraform | `ubuntu-latest` | `terraform fmt -check -recursive infra/terraform`, 각 디렉토리 `terraform init -backend=false && terraform validate` |

### 3.2 `.github/workflows/deploy.yml`: main 배포

- **트리거**
  - `ci.yml`이 main의 push에서 성공했을 때(`workflow_run`, `conclusion == success`). 단, 변경 경로가 `backend/**`, `infra/deploy/**`, `.github/workflows/deploy.yml` 중 하나일 때만 배포한다. `workflow_run`은 `paths` 필터를 지원하지 않으므로, 첫 작업(`changes`)에서 `git diff --name-only <이전 성공 배포 SHA 또는 HEAD^>..<workflow_run.head_sha>`로 판별하고, 해당 경로가 없으면 이후 작업을 건너뛴다.
  - 수동 실행(`workflow_dispatch`). 입력: `image_tag`(선택, 지정하면 빌드를 건너뛰고 그 태그를 배포), `migrate_only`(불리언).
  - 최초 가동(5장) 전에는 `workflow_run` 트리거를 저장소 변수 `AUTO_DEPLOY_ENABLED`로 꺼 둔다.
- **공통**: `environment: production`, `concurrency: deploy-production`(동시 배포 금지, 진행 중 작업 취소 안 함), `permissions: id-token: write, contents: read`

| 단계 | 러너 | 내용 |
|---|---|---|
| ① build | `ubuntu-24.04-arm` | 네이티브 arm64로 `docker build backend` → ECR push (태그 = `github.sha`). 이미 있는 태그면 건너뜀 |
| ② migrate | `ubuntu-24.04-arm` | 배포 역할로 `/pillflow/prod/migration/*` 조회 → 같은 이미지를 `SPRING_PROFILES_ACTIVE=migrate`로 실행 → Flyway 적용 후 종료. 종료 코드가 0이 아니면 중단 |
| ③ deploy | `ubuntu-latest` | SSM `SendCommand`로 인스턴스에서 배포 스크립트 실행(3.4). 완료까지 대기하고 결과 확인 |
| ④ smoke | `ubuntu-latest` | `https://api.pillflow.app/actuator/health`가 200이고 `status=UP`인지 확인(재시도 포함) |

`migrate_only=true`이면 ①·②만 실행한다.

- 공개 저장소는 GitHub의 arm64 러너(`ubuntu-24.04-arm`)를 무료로 쓸 수 있어서, QEMU 에뮬레이션 없이 빌드한다. 구현 시 러너 라벨과 가용성을 공식 문서로 확인한다.
- AWS 자격증명은 `aws-actions/configure-aws-credentials`의 OIDC만 쓰고, 장기 액세스 키를 쓰지 않는다. 역할 ARN, 리전, 인스턴스 ID는 저장소 **변수**(시크릿 아님)로 둔다.

### 3.3 마이그레이션과 Spring 프로파일

| 프로파일 | 용도 | 설정 |
|---|---|---|
| `prod` | 운영 서버 | `spring.flyway.enabled=false`, datasource = `pillflow_api` (SSM app 파라미터) |
| `migrate` | 파이프라인 1회 실행 | `spring.main.web-application-type=none`, Flyway 활성화, Flyway 접속 = postgres (SSM migration 파라미터). 컨텍스트가 뜨면서 마이그레이션이 끝나면 바로 종료 |

- 테스트와 **같은 이미지, 같은 마이그레이션 파일, 같은 Flyway 버전**을 쓴다.
- `migrate` 프로파일은 datasource를 Flyway 접속 정보(postgres)와 같게 두고, `spring.jpa.hibernate.ddl-auto=none`으로 JPA 검증을 끈다. 웹 서버가 없으므로 애플리케이션 컨텍스트가 뜨면서 Flyway가 실행되고 나면 프로세스가 스스로 종료된다. 구현 시 "마이그레이션 후 종료 코드 0으로 끝나는지, 실패하면 0이 아닌지"를 테스트로 확인한다. 종료되지 않는 스레드가 남는다면 migrate 프로파일에서만 동작하는 `ApplicationRunner`로 `SpringApplication.exit`을 호출한다.

### 3.4 EC2 서버 구성 (Docker Compose)

```
/opt/pillflow/
├── compose.yml     ← app + caddy (저장소 infra/deploy/compose.yml)
├── Caddyfile       ← 저장소 infra/deploy/Caddyfile
├── caddy-data/     ← 인증서·ACME 계정 저장 (재시작해도 재발급하지 않음 → Let's Encrypt 발급 한도 보호)
├── caddy-config/
├── app.env         ← SSM app 파라미터로 생성, 권한 600, 배포 때마다 갱신
└── current_tag     ← 현재 운영 이미지 태그 (롤백 기준)
```

- **app 컨테이너**
  - 이미지 `<ECR>/pillflow-api:<tag>`, `SPRING_PROFILES_ACTIVE=prod`, `env_file: app.env`
  - 호스트에는 `127.0.0.1:8080`만 바인딩한다(헬스체크용, 외부 비노출). Caddy와는 Compose 내부 네트워크로 통신한다.
  - `restart: unless-stopped`, 메모리 제한 1200MB, `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=70`
- **caddy 컨테이너**
  - 공식 `caddy:2` 이미지, 80·443 바인딩
  - Caddyfile은 `api.pillflow.app { reverse_proxy app:8080 }`이며, HTTP→HTTPS 리다이렉트는 Caddy 기본 동작이다.
- **로그**: 두 컨테이너 모두 `awslogs` 드라이버(`awslogs-group=/pillflow/api`, `awslogs-region=ap-northeast-1`)
- **배포 스크립트** (③ 단계에서 SSM으로 실행, 내용은 저장소 `infra/deploy/deploy.sh`에서 관리)
  1. 저장소의 `compose.yml`, `Caddyfile` 최신본을 `/opt/pillflow`에 반영한다. SSM 명령 파라미터로 전달하므로 설정을 바꿔도 인스턴스를 다시 만들 필요가 없다.
  2. SSM에서 `/pillflow/prod/app/*`를 읽어 `app.env`를 다시 만든다.
  3. ECR 로그인 → 새 태그 pull → `docker compose up -d app`(caddy는 없을 때만 기동)
  4. `curl -fsS http://127.0.0.1:8080/actuator/health`를 최대 120초 동안 재시도한다.
  5. 성공하면 `current_tag`를 갱신한다. 실패하면 **이전 태그로 되돌려 다시 기동**하고 실패 종료해서 파이프라인을 실패시킨다.
- **user_data**는 최초 1회만 실행한다: Docker와 Compose 플러그인 설치, `/opt/pillflow` 디렉토리 생성, Docker 서비스 활성화. 애플리케이션 배포는 하지 않는다.

### 3.5 기존 코드 수정 (이 하위 프로젝트 범위)

- `backend/src/main/resources/application-prod.yml`, `application-migrate.yml` 추가 (3.3)
- `backend/Dockerfile`: `wget` 기반 `HEALTHCHECK` 제거. `eclipse-temurin:21-jre` 런타임 이미지에 `wget`이 없을 가능성이 크고, 헬스체크는 배포 스크립트가 호스트의 `curl`로 수행한다.
- `backend/.env.example`, `backend/README.md`: 운영 파라미터 경로와 최초 가동 절차를 반영한다. `CORS_ALLOWED_ORIGINS`의 `pill-flow.vercel.app`은 추정값이므로 실제 Vercel 도메인을 확인해서 고친다.
- 루트 `.gitignore`: `*.tfstate*`, `.terraform/`, `terraform.tfvars` 추가
- `CLAUDE.md`, `docs/architecture.md`: 배포 구조 반영

## 4. 보안 요약

- SSH를 쓰지 않는다. 접속은 SSM Session Manager만 허용하고 보안그룹에 22번 포트가 없다.
- IMDSv2를 강제한다(SSRF로 인스턴스 자격증명이 탈취되는 것을 완화).
- 권한 분리: 서버는 DML 전용 `pillflow_api`만 가진다. DDL 자격증명은 main 브랜치 배포 파이프라인만 가진다.
- 장기 액세스 키가 없다(GitHub OIDC).
- 공개 저장소 대비: 상태 파일, tfvars, 시크릿을 저장소에 두지 않는다. SSM 파라미터 값은 Terraform 상태에도 남지 않는다.
- ECR push 시 이미지 취약점 스캔.

## 5. 최초 가동 절차 (1회)

★ 표시는 비용이 발생하거나 운영 DB·클라우드를 변경하는 단계다. **실행 직전에 사용자 확인을 받는다.**

| # | 단계 | 비고 |
|---|---|---|
| 1 | 코드 merge: 3.5 수정, 워크플로, `infra/` | `AUTO_DEPLOY_ENABLED` 변수는 꺼 둔 상태 |
| 2 | ★ `terraform apply` (bootstrap → main) | 이 시점부터 과금 |
| 3 | ★ SSM 파라미터 값 입력 | `DB_PASSWORD`(pillflow_api)를 뺀 나머지 전부 |
| 4 | ★ 운영 DB 준비 ① | (a) Supabase에서 `postgres`가 `BYPASSRLS` role을 만들 수 있는지 **롤백 트랜잭션**으로 검증 → (b) `backend/README.md` 절차대로 Flyway **baseline V1** |
| 5 | ★ 운영 DB 준비 ② | 워크플로 수동 실행(`migrate_only=true`)으로 V2 적용 → `ALTER ROLE pillflow_api PASSWORD ...` → SSM `DB_PASSWORD` 입력 |
| 6 | 첫 전체 배포 (수동 실행) → 스모크 테스트 → 6장의 완료 기준 확인 | |
| 7 | GitHub 설정 확인 후 `AUTO_DEPLOY_ENABLED=true` | `production` Environment(배포 브랜치 main 제한), 저장소 변수 |

**4(a)가 실패할 때의 대안**: `BYPASSRLS`를 줄 수 없으면, 서버가 트랜잭션마다 `set_config('request.jwt.claim.sub', <userId>, true)`를 설정해서 서버 요청에도 RLS를 적용하는 방식으로 바꾼다. 이 경우 V2와 서버 코드가 바뀌므로 진행하기 전에 사용자 확인을 받는다.

## 6. 완료 기준

- **IaC**: `terraform fmt -check`, `validate` 통과. apply 직후 `terraform plan`을 다시 돌리면 **변경 없음**
- **CI**: PR에서 backend, frontend, terraform 작업이 모두 통과
- **배포**
  - `deploy.yml`의 ①~④가 모두 성공
  - `https://api.pillflow.app/actuator/health` → 200, 유효한 Let's Encrypt 인증서
  - `http://api.pillflow.app` → `https://`로 리다이렉트
- **인증**: `GET https://api.pillflow.app/api/v1/me`에 토큰 없이 호출하면 401, 실제 Supabase 로그인 토큰으로 호출하면 200과 올바른 사용자 ID
- **보안 점검**
  - 외부에서 22번 포트 접속 불가
  - 인스턴스 메타데이터 옵션 `http_tokens=required`
  - SSM 세션 안에서 `/pillflow/prod/migration/*`를 조회하면 AccessDenied
  - `production` Environment가 아닌 곳(예: PR 브랜치)에서 배포 역할 assume 실패
- **롤백**: 헬스체크에 실패하는 태그를 수동 배포하면 파이프라인이 실패하고 이전 버전이 계속 서비스되는 것을 1회 확인
- **운영**: CloudWatch `/pillflow/api`에 app·caddy 로그가 쌓임. Budget과 자동 복구 경보 존재
- **비용**: 첫 주 Cost Explorer 기준으로 예상(월 약 $21)과 크게 다르지 않음

## 7. 범위 밖

- 스테이징 등 다중 환경, ALB, 오토스케일링, ECS/Fargate, WAF, IPv6
- 앱의 Kotlin API 전환(하위 프로젝트 2). 서버는 배포되지만 앱은 여전히 Supabase에 직접 접근한다.
- `pillflow.app` 루트 도메인을 Vercel 웹에 연결하는 작업
- 외부 가용성 모니터링(업타임 체커), 알림 채널(Slack 등)
- 사진 분석 Edge Function 이전(하위 프로젝트 4)
- DB 백업 정책 (Supabase가 관리)

## 부록: 구현 중 변경된 결정 (2026-09-26)

구현과 리뷰 과정에서 원래 스펙에 없던 아래 결정들이 추가됐다. 원본 섹션은 고치지 않고 이 부록에 따로 기록한다.

- **이미지 태그 = backend/ 디렉터리 트리 해시**: 커밋 SHA 대신 `git rev-parse <commit>:backend`로 태그를 계산한다. `backend/`가 바뀌지 않은 커밋은 같은 트리 해시를 그대로 재사용하므로, 빠른 연속 push에서 workflow_run의 headSha가 실제 배포 대상 커밋과 어긋나는 경합 없이 build/migrate 단계가 자연스럽게 무동작(이미지 이미 존재 → 빌드 생략, 적용할 마이그레이션 없음)이 된다.
- **경로 기반 변경 감지 제거**: git diff로 backend 경로 변경 여부를 따로 판단하지 않는다. 자동 배포가 켜져 있으면 main에 성공한 CI push마다 파이프라인을 실행하되, 백엔드가 안 바뀐 경우는 위 트리 해시 재사용으로 build/migrate가 사실상 스킵된다.
- **SecureString 파라미터는 write-only(`value_wo`) + `ignore_changes = all`**: `DB_PASSWORD`/`FLYWAY_PASSWORD`는 Terraform state에 복호화된 값이 남지 않도록 `value_wo`로 선언하고, `terraform apply`가 이 리소스를 다시 만지면 `value_wo`가 자리표시자 `CHANGE_ME`로 재적용되어 `put-secret.sh`로 넣어 둔 실값을 지워버리므로 `lifecycle { ignore_changes = all }`을 추가했다.
- **EC2 역할에 마이그레이션 파라미터 명시적 Deny**: `AmazonSSMManagedInstanceCore`가 암묵적으로 허용하는 `/pillflow/prod/migration/*` 접근을, EC2 인스턴스 role의 IAM 정책에서 명시적 `Deny`로 다시 막는다. DDL 자격 증명(Flyway용 `postgres.<project-ref>`)은 GitHub 배포 role만 읽을 수 있어야 하기 때문이다.
- **최초 부팅 네트워크 대기**: EC2 user_data가 부팅 직후 네트워크·DNS가 아직 준비되지 않은 상태에서 docker pull 등을 시도해 실패하는 경우를 막기 위해, 첫 부팅 스크립트에 네트워크 준비를 기다리는 대기 로직을 추가했다.
- **deploy.sh 순서/따옴표 처리/롤백 env 동작**: `.env`(APP_IMAGE)를 먼저 쓴 뒤에만 app을 caddy보다 먼저 기동하고(.env 없이 compose를 부르면 실패), SSM에서 가져온 파라미터 값은 작은따옴표로 감싸 dotenv 파서가 `$`/`#`/공백을 리터럴로 보존하게 하며(작은따옴표·개행·후행 백슬래시가 든 값은 안전하게 표현할 수 없어 아무 것도 바꾸지 않고 중단), 배포 성공 시의 env를 `app.env.good`으로 별도 보관해 롤백은 이를 우선 복원한다(`app.env.prev`는 그 하위 호환 fallback).
- **워크플로 job 타임아웃**: `changes`(5분)/`build`(30분)/`migrate`(15분)/`deploy`(20분)/`smoke`(5분) — 각 job에 `timeout-minutes`를 지정해 SSM 폴링이나 빌드가 무한정 걸리는 경우 전체 파이프라인이 막히지 않게 했다.
- **workflow_dispatch는 main 한정**: 수동 실행도 `github.ref == 'refs/heads/main'`일 때만 진행되도록 `changes` job의 조건에 명시했다 — 다른 브랜치에서 운영 배포 role을 assume하는 경로를 원천 차단한다.

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

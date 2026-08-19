#!/usr/bin/env bash
# 服务器发版：从 GitHub 拉最新代码，再构建启动。
# 用法（无参数）：bash deploy.sh
# 会保留本机 .env.local；没有 git 时改为下载 zip。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
exec bash "$ROOT/start.sh" --deploy

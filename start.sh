#!/usr/bin/env bash
# 服务器一键启动：在项目根目录执行  bash start.sh
# 每台机器必须先有自己的 .env.local（DATABASE_URL 以宝塔「数据库」面板为准）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
REPO_URL="${REPO_URL:-https://github.com/jinyangyu/Orbis-GEO}"
REPO_BRANCH="${REPO_BRANCH:-main}"

log() { printf '\n[orbis] %s\n' "$*"; }
fail() { printf '\n[orbis] 启动失败：%s\n' "$*" >&2; exit 1; }

pids_listening_on() {
  local port="$1"
  local pids=""
  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -lntp 2>/dev/null | awk -v port="$port" '
      $0 ~ (":" port "[^0-9]") || $0 ~ (":" port "$") {
        s = $0
        while (match(s, /pid=[0-9]+/)) {
          print substr(s, RSTART + 4, RLENGTH - 4)
          s = substr(s, RSTART + RLENGTH)
        }
      }')"
  fi
  if [[ -z "$pids" ]] && command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  fi
  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "${port}/tcp" 2>/dev/null | grep -Eo '[0-9]+' || true)"
  fi
  printf '%s\n' "$pids" | awk 'NF && !seen[$1]++ { print $1 }'
}

vinext_orphan_pids() {
  local pid cwd cmd
  for pid in $(ps -eo pid=); do
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
    [[ "$cwd" == "$ROOT" ]] || continue
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    if [[ "$cmd" == *vinext* || "$cmd" == *wrangler* || "$cmd" == *miniflare* ]]; then
      printf '%s\n' "$pid"
    fi
  done
}

stop_pid() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 0
  [[ "$pid" == "$$" || "$pid" == "$PPID" ]] && return 0
  kill "$pid" 2>/dev/null || true
}

wait_port_free() {
  local i
  for i in 1 2 3 4 5 6 7 8; do
    [[ -z "$(pids_listening_on "$PORT")" ]] && return 0
    sleep 0.5
  done
  return 1
}

stop_old_server() {
  log "停掉旧进程（PM2 orbis、本目录 vinext、端口 ${PORT}）"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete orbis >/dev/null 2>&1 || true
  fi

  local pid
  for pid in $(vinext_orphan_pids) $(pids_listening_on "$PORT"); do
    log "结束 pid=$pid"
    stop_pid "$pid"
  done

  if ! wait_port_free; then
    for pid in $(vinext_orphan_pids) $(pids_listening_on "$PORT"); do
      log "强制结束 pid=$pid"
      kill -9 "$pid" 2>/dev/null || true
    done
    sleep 0.5
  fi

  local leftover
  leftover="$(pids_listening_on "$PORT")"
  if [[ -n "$leftover" ]]; then
    fail "端口 ${PORT} 仍被占用：pid ${leftover}。请手动 kill 后再启动。"
  fi
}

download_file() {
  local url="$1" dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 20 -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$dest" "$url"
  else
    fail "需要 curl 或 wget 才能从 GitHub 拉代码"
  fi
}

pull_latest_code() {
  local env_bak
  env_bak="$(mktemp)"
  if [[ -f .env.local ]]; then
    cp -a .env.local "$env_bak"
  else
    env_bak=""
  fi

  if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
    log "git pull ${REPO_BRANCH}"
    git fetch origin "$REPO_BRANCH"
    git reset --hard "origin/${REPO_BRANCH}"
  else
    log "本机无 git 仓库，改为下载 GitHub zip（${REPO_BRANCH}）"
    command -v unzip >/dev/null 2>&1 || fail "未找到 unzip，请先 yum/apt 安装 unzip，或安装 git 后用 git clone。"
    local tmp zip src
    tmp="$(mktemp -d)"
    zip="${tmp}/src.zip"
    download_file "${REPO_URL}/archive/refs/heads/${REPO_BRANCH}.zip" "$zip"
    unzip -q -o "$zip" -d "$tmp"
    src="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)"
    [[ -n "$src" && -d "$src" ]] || fail "GitHub zip 解压后没有目录"
    (cd "$src" && tar cf - --exclude .env.local .) | tar xf - -C "$ROOT"
    rm -rf "$tmp"
  fi

  if [[ -n "$env_bak" && -f "$env_bak" ]]; then
    cp -a "$env_bak" .env.local
    rm -f "$env_bak"
  fi
  log "代码已更新"
}

check_database() {
  log "检查数据库连接"
  if [[ -f scripts/prepare-runtime-env.mjs ]]; then
    node scripts/prepare-runtime-env.mjs
    return
  fi
  node --input-type=module <<'EOF'
import fs from "node:fs";
import mysql from "mysql2/promise";

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const raw of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = value;
  }
  return env;
}

const fileEnv = loadEnv(".env.local");
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}
const raw = (process.env.DATABASE_URL ?? "").trim();
if (!raw) {
  console.error("[orbis] .env.local 缺少 DATABASE_URL");
  process.exit(1);
}
const parsed = new URL(raw);
if (parsed.hostname === "localhost" || parsed.hostname === "::1") {
  parsed.hostname = "127.0.0.1";
}
const databaseUrl = parsed.toString().replace(/\/$/, "");
const runtime = { ...fileEnv, DATABASE_URL: databaseUrl };
fs.writeFileSync(
  ".dev.vars",
  Object.entries(runtime)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
);
const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
});
const [rows] = await connection.query("SELECT USER() AS user, DATABASE() AS db");
await connection.end();
const row = Array.isArray(rows) ? rows[0] : {};
console.log(
  `[orbis] db ok user=${row.user} database=${row.db} host=${parsed.hostname}`,
);
EOF
}

export PATH="/usr/local/bin:/usr/bin:$PATH"
if [[ -d /www/server/nodejs ]]; then
  for bin in /www/server/nodejs/*/bin; do
    [[ -x "$bin/node" ]] && export PATH="$bin:$PATH"
  done
fi
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi

command -v node >/dev/null || fail "未找到 node。请在宝塔安装 Node.js >= 22.13，或把 node 加入 PATH。"
command -v npm >/dev/null || fail "未找到 npm。"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 22 )); then
  fail "需要 Node.js >= 22.13，当前是 $(node -v)"
fi

FORCE_BUILD=0
SKIP_INSTALL=0
STOP_ONLY=0
DEPLOY=0
for arg in "$@"; do
  case "$arg" in
    --build) FORCE_BUILD=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --stop) STOP_ONLY=1 ;;
    --deploy|--pull|--update)
      DEPLOY=1
      FORCE_BUILD=1
      ;;
    -h|--help)
      cat <<'EOF'
用法: bash start.sh [--deploy] [--build] [--skip-install] [--stop]

  --deploy        从 GitHub 拉最新 main，再构建启动（无 git 时下 zip）
  --build         强制重新 npm run build
  --skip-install  跳过 npm install
  --stop          只停掉旧进程（PM2 / vinext / 端口），不启动

首次部署前请编辑 .env.local 里的 DATABASE_URL。
服务器日常发版请用：bash deploy.sh
EOF
      exit 0
      ;;
    *) fail "未知参数：$arg（可用 --help）" ;;
  esac
done

if [[ "$STOP_ONLY" -eq 1 ]]; then
  stop_old_server
  log "已停止"
  exit 0
fi

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  fail "已生成 .env.local。请改 DATABASE_URL 为这台 MySQL 的用户/密码（主机 127.0.0.1），保存后再执行 bash start.sh"
fi

if ! grep -qE '^DATABASE_URL=.+' .env.local; then
  fail ".env.local 里没有 DATABASE_URL。格式：mysql://用户:密码@127.0.0.1:3306/库名"
fi

if grep -qE '^DATABASE_URL=mysql://orbis:orbis@' .env.local; then
  log "警告：DATABASE_URL 还是示例账号 orbis:orbis。若本机 MySQL 不是这个用户，启动会失败。"
fi

log "node $(node -v)  npm $(npm -v)  目录 $ROOT"
stop_old_server
if [[ "$DEPLOY" -eq 1 ]]; then
  pull_latest_code
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "安装依赖"
  npm install
fi

check_database

if [[ "$FORCE_BUILD" -eq 1 || ! -d dist ]]; then
  log "构建"
  npm run build
fi

command -v pm2 >/dev/null || npm install -g pm2
command -v pm2 >/dev/null || fail "未找到 pm2，请执行 npm install -g pm2 后再跑本脚本。"

log "用 PM2 启动"
stop_old_server
pm2 start ecosystem.config.cjs
pm2 save

log "等待进程起来"
sleep 2
pm2 list
log "健康检查"
curl -sS -m 5 "http://127.0.0.1:${PORT}/api/health?ready=0" || true
printf '\n'
log "完成。看日志：pm2 logs orbis --lines 50"
log "健康检查：curl -s http://127.0.0.1:${PORT}/api/health"

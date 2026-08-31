#!/usr/bin/env bash
#
# 로컬 개발 서버 둘을 한 번에 띄웁니다.
#
#   [api]  FastAPI  http://localhost:8000    backend.main:app --reload
#   [web]  Vite     https://localhost:5188   /api → 8000 프록시
#
# 둘은 따로 도는데 늘 같이 필요합니다 — 화면이 로그인부터 막혀서 백엔드가 없으면
# 아무 페이지도 못 엽니다. 창을 두 개 띄우는 대신 여기서 같이 세우고 Ctrl+C 한 번에
# 같이 내립니다.
#
# ⚠️ 포트를 바꾸지 마세요. 5188 은 구글 OAuth 의 허용 origin·리디렉션 URI 에 등록된
#    주소라, 바꾸면 학번 확인(구글 로그인)이 막힙니다.
#
# 사용법:  ./dev-start.sh

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || exit 1

API_PORT=8000
WEB_PORT=5188

if [ -t 1 ]; then
    C_API=$'\033[36m'; C_WEB=$'\033[35m'; C_WARN=$'\033[33m'
    C_ERR=$'\033[31m'; C_OK=$'\033[32m';  C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
    C_API=""; C_WEB=""; C_WARN=""; C_ERR=""; C_OK=""; C_DIM=""; C_OFF=""
fi

die() { printf '%s\n' "${C_ERR}✗ $*${C_OFF}" >&2; exit 1; }

# ── 준비물 ───────────────────────────────────────────────────────────────────
[ -x .venv/bin/uvicorn ] ||
    die $'.venv 에 uvicorn 이 없습니다.\n  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'
[ -d frontend/node_modules ] ||
    die $'frontend/node_modules 가 없습니다.\n  (cd frontend && npm install)'

# ── 포트 ─────────────────────────────────────────────────────────────────────
# 이미 떠 있는 걸 죽이지 않습니다 — 내 것이 아닐 수 있어서, 무엇이 물고 있는지만
# 알려 주고 물러납니다.
busy=""
for port in "$API_PORT" "$WEB_PORT"; do
    pid=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        busy="yes"
        # 숫자 뒤 조사는 읽는 법에 따라 갈리므로(8000=팔천, 5173=오천백칠십삼) 붙이지
        # 않습니다. `comm` 은 파이썬이면 프레임워크 전체 경로라 이름만 남깁니다.
        name=$(basename "$(ps -p "$pid" -o comm= 2>/dev/null)")
        printf '%s\n' "${C_ERR}✗ 포트 ${port} — 이미 쓰고 있는 프로세스가 있습니다${C_OFF} (PID ${pid} · ${name})"
        printf '%s\n' "${C_DIM}  내리려면:  kill ${pid}${C_OFF}"
    fi
done
[ -n "$busy" ] && exit 1

# ── 띄우기 ───────────────────────────────────────────────────────────────────
# ⚠️ `set -m` 이 있어야 백그라운드 작업마다 프로세스 그룹이 따로 생깁니다.
#    uvicorn --reload 는 자식을 하나 더 띄우고 이름표를 붙이는 파이프도 별도
#    프로세스라, 그룹째로 내리지 않으면 찌꺼기가 포트를 물고 남습니다.
#    덕분에 Ctrl+C 도 이 스크립트에만 오고, 종료 순서를 우리가 정합니다.
set -m

# 두 로그가 한 화면에 섞이므로 줄마다 이름표를 답니다.
# `read` 가 한 줄씩 끊어 주므로 따로 버퍼를 풀 필요가 없습니다.
prefix() {
    local tag=$1 line
    while IFS= read -r line; do printf '%s %s\n' "$tag" "$line"; done
}

# ⚠️ stdin 을 끊습니다. 백그라운드 프로세스 그룹이 터미널을 읽으면 SIGTTIN 으로
#    멈춰 서는데, Vite 는 키보드 단축키를 받으려고 stdin 을 붙잡습니다.
.venv/bin/uvicorn backend.main:app --reload --port "$API_PORT" \
    </dev/null 2>&1 | prefix "${C_API}[api]${C_OFF}" &
API_PID=$!
API_PGID=$(ps -o pgid= -p "$API_PID" 2>/dev/null | tr -d ' ')

(cd frontend && npm run dev) \
    </dev/null 2>&1 | prefix "${C_WEB}[web]${C_OFF}" &
WEB_PID=$!
WEB_PGID=$(ps -o pgid= -p "$WEB_PID" 2>/dev/null | tr -d ' ')

# ⚠️ 끝에 `exit` 이 있어야 합니다. Ctrl+C 는 아래 대기 루프 **한가운데**서 트랩을
#    부르고, 트랩이 그냥 돌아오면 스크립트가 멈췄던 자리에서 이어집니다 — 루프를
#    빠져나가며 "멎었습니다" 를 찍어서, 직접 내린 사람에게 죽었다고 말합니다.
STATUS=0
cleanup() {
    trap - INT TERM EXIT
    printf '\n%s\n' "${C_WARN}내리는 중…${C_OFF}"
    for pgid in "$API_PGID" "$WEB_PGID"; do
        [ -n "$pgid" ] && kill -TERM -- -"$pgid" 2>/dev/null
    done
    wait 2>/dev/null
    printf '%s\n' "${C_OK}✓ 둘 다 내렸습니다${C_OFF}"
    exit "$STATUS"
}
trap cleanup INT TERM EXIT

# ── 다 뜰 때까지 ─────────────────────────────────────────────────────────────
# `/terms` 는 인증이 걸려 있어 401 을 돌려주는데, 그거면 떴다는 증거로 충분합니다
# (`curl` 은 `-f` 없이는 HTTP 오류를 실패로 치지 않습니다). `-k` 는 Vite 의 자체
# 서명 인증서 때문입니다.
up=""
for _ in $(seq 1 60); do
    kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null || break
    if curl -sk -o /dev/null --max-time 2 "http://127.0.0.1:${API_PORT}/terms" 2>/dev/null &&
       curl -sk -o /dev/null --max-time 2 "https://127.0.0.1:${WEB_PORT}/" 2>/dev/null; then
        up="yes"; break
    fi
    sleep 0.5
done

if [ -n "$up" ]; then
    printf '\n%s\n' "${C_OK}✓ 둘 다 떴습니다${C_OFF}"
    printf '  %s\n' "${C_WEB}web${C_OFF}  https://localhost:${WEB_PORT}   ${C_DIM}자체 서명 인증서라 브라우저 경고는 통과시키세요${C_OFF}"
    printf '  %s\n' "${C_API}api${C_OFF}  http://localhost:${API_PORT}"
    printf '  %s\n\n' "${C_DIM}인벤토리(개발 전용): https://localhost:${WEB_PORT}/inventory · Ctrl+C 로 둘 다 종료${C_OFF}"
else
    printf '\n%s\n\n' "${C_WARN}⚠ 30초 안에 응답이 없습니다 — 위 로그를 보세요${C_OFF}"
fi

# ── 한쪽이 죽으면 나머지도 내립니다 ──────────────────────────────────────────
# 반쪽만 살아 있는 상태가 제일 헷갈립니다 — 화면은 뜨는데 아무것도 안 나옵니다.
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
    sleep 1
done
# 여기까지 왔다는 건 한쪽이 스스로 죽었다는 뜻입니다 (Ctrl+C 는 위 트랩에서 끝납니다).
STATUS=1
kill -0 "$API_PID" 2>/dev/null || printf '%s\n' "${C_ERR}✗ [api] 가 멎었습니다${C_OFF}"
kill -0 "$WEB_PID" 2>/dev/null || printf '%s\n' "${C_ERR}✗ [web] 이 멎었습니다${C_OFF}"

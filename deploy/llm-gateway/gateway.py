"""데스크탑 Ollama 게이트웨이 — 요청이 올 때 Ollama 를 켜고, 한동안 조용하면 끕니다.

서버(10.8.0.1)는 WireGuard 로 이 게이트웨이(10.8.10.1:11434)만 부릅니다. Ollama 자체는
127.0.0.1:11435 에만 열어 두고, `/api/*`·`/v1/*` 요청이 오면 켠 뒤 그대로 중계합니다.
마지막 요청이 끝나고 IDLE_SECONDS 가 지나면 직접 띄운 Ollama 프로세스 트리를 종료합니다.

Ollama 를 깨우지 않는 경로:
  GET  /gateway/status   켜져 있는지, 유휴 시간, 처리 중인 요청 수
  GET  /gateway/models   설치된 모델 목록 (manifests 폴더를 읽습니다)
  POST /gateway/start    미리 켜 두기 (첫 응답 지연을 줄일 때)
  POST /gateway/stop     바로 끄기

표준 라이브러리만 씁니다. Windows 의 pythonw 로 로그인 시 예약 작업에서 띄웁니다.
"""
from __future__ import annotations

import http.client
import json
import logging
import logging.handlers
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LISTEN_HOST = os.environ.get("GATEWAY_HOST", "10.8.10.1")
LISTEN_PORT = int(os.environ.get("GATEWAY_PORT", "11434"))
UPSTREAM_HOST = "127.0.0.1"
UPSTREAM_PORT = int(os.environ.get("GATEWAY_OLLAMA_PORT", "11435"))
IDLE_SECONDS = int(os.environ.get("GATEWAY_IDLE_SECONDS", "3600"))
KEEP_ALIVE = os.environ.get("GATEWAY_KEEP_ALIVE", "15m")
# ⚠️ Ollama 기본 컨텍스트는 4096 토큰이고, 넘치면 프롬프트 **앞부분을 조용히 잘라** 시스템
# 지시문이 사라집니다. 도구 명세 + 검색 결과만으로 4천을 넘어서 답이 중간에 끊겼습니다
CONTEXT_LENGTH = os.environ.get("GATEWAY_CONTEXT_LENGTH", "16384")
# 밀린 ksain 분석이 도는 동안 질문창 요청이 그 뒤에 줄을 서서 답이 1분 가까이 걸렸습니다.
# 둘을 나란히 받습니다 (컨텍스트 캐시가 두 배 — 12B + 16k×2 가 16GB 에 들어갑니다)
NUM_PARALLEL = os.environ.get("GATEWAY_NUM_PARALLEL", "2")
OLLAMA_EXE = os.environ.get(
    "GATEWAY_OLLAMA_EXE",
    str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe"),
)
MODELS_DIR = Path(os.environ.get("OLLAMA_MODELS", str(Path.home() / ".ollama" / "models")))
START_TIMEOUT = 90
HOP_BY_HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
              "trailers", "transfer-encoding", "upgrade", "host", "content-length"}

log = logging.getLogger("gateway")


class Ollama:
    """직접 띄운 Ollama 프로세스와 유휴 시간을 관리합니다."""

    def __init__(self) -> None:
        self.proc: subprocess.Popen | None = None
        self.lock = threading.Lock()
        self.inflight = 0
        self.last_activity = time.monotonic()
        self.started_at: float | None = None

    def healthy(self) -> bool:
        try:
            conn = http.client.HTTPConnection(UPSTREAM_HOST, UPSTREAM_PORT, timeout=2)
            conn.request("GET", "/api/version")
            ok = conn.getresponse().status == 200
            conn.close()
            return ok
        except OSError:
            return False

    def ensure(self) -> None:
        with self.lock:
            if self.healthy():
                return
            if self.proc is None or self.proc.poll() is not None:
                env = dict(os.environ)
                env["OLLAMA_HOST"] = f"{UPSTREAM_HOST}:{UPSTREAM_PORT}"
                env["OLLAMA_KEEP_ALIVE"] = KEEP_ALIVE
                env["OLLAMA_CONTEXT_LENGTH"] = CONTEXT_LENGTH
                env["OLLAMA_NUM_PARALLEL"] = NUM_PARALLEL
                log.info("starting ollama: %s", OLLAMA_EXE)
                self.proc = subprocess.Popen(
                    [OLLAMA_EXE, "serve"], env=env,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                self.started_at = time.monotonic()
            deadline = time.monotonic() + START_TIMEOUT
            while time.monotonic() < deadline:
                if self.healthy():
                    log.info("ollama ready in %.1fs", time.monotonic() - (self.started_at or time.monotonic()))
                    return
                if self.proc.poll() is not None:
                    raise RuntimeError(f"ollama exited with code {self.proc.returncode}")
                time.sleep(0.5)
            raise RuntimeError("ollama did not become ready")

    def stop(self, reason: str) -> bool:
        with self.lock:
            if self.proc is None or self.proc.poll() is not None:
                self.proc = None
                return False
            log.info("stopping ollama (%s)", reason)
            # ollama serve 가 모델마다 runner 자식을 띄우므로 트리째 내립니다
            subprocess.run(["taskkill", "/PID", str(self.proc.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            self.proc = None
            self.started_at = None
            return True

    def touch(self, delta: int) -> None:
        with self.lock:
            self.inflight += delta
            self.last_activity = time.monotonic()

    def owned(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def idle_for(self) -> float:
        return time.monotonic() - self.last_activity

    def watch(self) -> None:
        while True:
            time.sleep(30)
            if self.owned() and self.inflight == 0 and self.idle_for() >= IDLE_SECONDS:
                self.stop(f"idle {int(self.idle_for())}s")


OLLAMA = Ollama()


def installed_models() -> list[dict]:
    root = MODELS_DIR / "manifests"
    models = []
    if not root.exists():
        return models
    for manifest in root.glob("*/*/*/*"):
        if not manifest.is_file():
            continue
        registry, namespace, name, tag = manifest.relative_to(root).parts
        try:
            layers = json.loads(manifest.read_text(encoding="utf-8")).get("layers", [])
            size = sum(layer.get("size", 0) for layer in layers)
        except (OSError, ValueError):
            size = None
        full = f"{name}:{tag}" if namespace == "library" else f"{namespace}/{name}:{tag}"
        models.append({"name": full, "size": size})
    return sorted(models, key=lambda m: m["name"])


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "llm-gateway/1"

    def log_message(self, fmt: str, *args) -> None:  # http.server 기본 stderr 로그 대신
        log.info("%s %s", self.address_string(), fmt % args)

    def _json(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _control(self) -> bool:
        if self.path == "/gateway/status" and self.command == "GET":
            self._json(200, {
                "running": OLLAMA.healthy(), "owned": OLLAMA.owned(), "inflight": OLLAMA.inflight,
                "idle_seconds": int(OLLAMA.idle_for()), "idle_limit": IDLE_SECONDS,
            })
        elif self.path == "/gateway/models" and self.command == "GET":
            self._json(200, {"models": installed_models()})
        elif self.path == "/gateway/start" and self.command == "POST":
            try:
                OLLAMA.touch(0)
                OLLAMA.ensure()
                self._json(200, {"running": True})
            except RuntimeError as error:
                self._json(503, {"error": str(error)})
        elif self.path == "/gateway/stop" and self.command == "POST":
            self._json(200, {"stopped": OLLAMA.stop("requested")})
        else:
            return False
        return True

    def _proxy(self) -> None:
        if not (self.path.startswith("/api/") or self.path.startswith("/v1/")):
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        OLLAMA.touch(+1)
        try:
            try:
                OLLAMA.ensure()
            except RuntimeError as error:
                self._json(503, {"error": f"ollama unavailable: {error}"})
                return
            headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_BY_HOP}
            upstream = http.client.HTTPConnection(UPSTREAM_HOST, UPSTREAM_PORT, timeout=600)
            upstream.request(self.command, self.path, body=body, headers=headers)
            resp = upstream.getresponse()
            self.send_response(resp.status, resp.reason)
            for key, value in resp.getheaders():
                if key.lower() not in HOP_BY_HOP:
                    self.send_header(key, value)
            length_header = resp.getheader("Content-Length")
            if length_header is not None:
                self.send_header("Content-Length", length_header)
                self.end_headers()
                self.wfile.write(resp.read())
            else:
                self.send_header("Transfer-Encoding", "chunked")
                self.end_headers()
                while True:
                    chunk = resp.read1(65536)
                    if not chunk:
                        break
                    self.wfile.write(b"%X\r\n%s\r\n" % (len(chunk), chunk))
                    self.wfile.flush()
                    OLLAMA.touch(0)
                self.wfile.write(b"0\r\n\r\n")
            upstream.close()
        except (BrokenPipeError, ConnectionResetError):
            log.info("client went away: %s", self.path)
        finally:
            OLLAMA.touch(-1)

    def _handle(self) -> None:
        if not self._control():
            self._proxy()

    do_GET = do_POST = do_DELETE = do_HEAD = _handle


def main() -> None:
    log_path = Path(os.environ.get("GATEWAY_LOG", str(Path(__file__).with_name("gateway.log"))))
    handler = logging.handlers.RotatingFileHandler(log_path, maxBytes=2_000_000, backupCount=2, encoding="utf-8")
    logging.basicConfig(level=logging.INFO, handlers=[handler] + ([logging.StreamHandler()] if sys.stderr else []),
                        format="%(asctime)s %(levelname)s %(message)s")
    threading.Thread(target=OLLAMA.watch, daemon=True).start()
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    server.daemon_threads = True
    log.info("listening on %s:%s (ollama on %s, idle limit %ss)", LISTEN_HOST, LISTEN_PORT, UPSTREAM_PORT, IDLE_SECONDS)
    try:
        server.serve_forever()
    finally:
        OLLAMA.stop("gateway exit")


if __name__ == "__main__":
    main()

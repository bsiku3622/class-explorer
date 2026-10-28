# 배포 가이드

| | |
|---|---|
| **프론트** | **Netlify** — `main`에 푸시하면 자동 빌드·배포 (`https://classes.bsiku.dev`) |

⚠️ **한동안 이 표에 "Vercel" 이라고 적혀 있었습니다.** 실제로 서빙하는 건 Netlify 입니다
(`frontend/netlify.toml` 이 빌드 설정이고, 응답에 `x-nf-request-id` 가 붙습니다). Vercel
계정에는 이 프로젝트가 아예 없습니다. 이 착각 때문에 **환경변수를 없는 곳에 넣고 반영을
기다리는 일**이 생깁니다 — 아래 `VITE_GOOGLE_CLIENT_ID` 사고가 그렇게 났습니다.

**배포하는 프론트는 `frontend/`(class-explorer) 하나뿐입니다.** `bench-frontend/`(ksa-bench)는
동결 상태라 어디에도 올리지 않습니다 — 리포에만 있습니다.
| **백엔드** | N100 Mini PC (Ubuntu) + nginx + systemd (`https://classesapi.bsiku.dev`) |
| **HTTPS** | Cloudflare가 앞단에서 처리 — nginx는 80으로만 받습니다 |

도메인에 밑줄(`_`)은 못 씁니다. `classes_api`가 아니라 **`classesapi`**입니다.

---

## 평소 배포 (이것만 하면 됩니다)

```bash
# 1. 프론트 — 푸시하면 Netlify 가 알아서 빌드합니다 (class-explorer 만)
git push origin main

# 2. 백엔드
ssh server
cd /srv/class-explorer
cp backend/ksa_timetable.db backend/ksa_timetable.db.bak-$(date +%Y%m%d)   # DB는 서버에만 있습니다
git pull --ff-only
sudo cp deploy/class-explorer-materials-backup.service deploy/class-explorer-materials-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now class-explorer-materials-backup.timer
sudo systemctl restart class-explorer.service
systemctl is-active class-explorer.service
```

의존성이 바뀌었으면 재시작 전에 `pip install -r requirements.txt`를 한 번 돌립니다.

⚠️ **`curriculum_seed.json`이 바뀐 배포에서는 재시작만으로 부족합니다** — 적재를 한 번
돌려야 새 필드(과목 분류·트랙 등)가 DB에 들어갑니다.

```bash
python3.14 -m backend.import_curriculum
sudo systemctl restart class-explorer.service   # 새 값을 물고 다시 뜨게
```

이 스크립트는 과목 행을 통째로 갈아끼우지만 **이수 기록(`CourseGrade`)은 과목 이름으로
다시 이어 붙입니다.** 그래도 돌리기 전에 DB 복사본은 떠 두세요.

### 확인

```bash
curl -s https://classesapi.bsiku.dev/openapi.json | python3 -c "
import json,sys; print(sorted(json.load(sys.stdin)['paths']))"
```

---

## 서버 구성

### systemd — `/etc/systemd/system/class-explorer.service`

```ini
[Unit]
Description=KSA FastAPI Server
After=network.target

[Service]
User=baeks
Group=baeks
WorkingDirectory=/srv/class-explorer
ExecStart=/home/baeks/.local/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
Environment="GOOGLE_CLIENT_ID=<클라이언트 ID>"

[Install]
WantedBy=multi-user.target
```

`GOOGLE_CLIENT_ID`가 없으면 학번 확인(`/auth/link-google`)이 503을 돌려주고, 계정에
학번을 붙일 수 없습니다.

**`KSAIN_API_KEY`** 를 같이 넣으면 홈에 급식이 뜹니다(`api.ksain.net`). 없으면 급식 칸만
비고 나머지는 그대로 돕니다 — 홈 전체가 죽지는 않습니다.

로그는 `journalctl -u class-explorer -f`로 봅니다.

### nginx — `/etc/nginx/sites-available/class-explorer.conf`

```nginx
server {
    listen 443 ssl;
    server_name classesapi.bsiku.dev;

    # 인증서·TLS·보안 설정은 기존 include를 그대로 사용합니다.
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        include snippets/proxy-common.conf;
        proxy_read_timeout 180s;
    }

    # /docs 는 CDN에서 스크립트를 받아 와서 CSP를 따로 풀어 줍니다
    location /docs {
        proxy_pass http://127.0.0.1:8000;
        add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
        style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
        img-src 'self' data: https://fastapi.tiangolo.com;
        " always;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

자료 업로드의 DOCX/PPTX/XLSX preview와 악성 파일 검사는 서버 패키지를 사용합니다. 처음 한 번
설치한 뒤 ClamAV signature가 갱신되는지 확인해주세요.

```bash
sudo apt update
sudo apt install -y libreoffice-writer libreoffice-impress libreoffice-calc clamav clamav-freshclam
sudo freshclam
```

자료 원본은 DB 파일 옆의 `materials/`에 저장합니다. 위 timer는 변경 사항이 있을 때만
DB snapshot과 자료 파일을 같이 `material-backups/`에 압축하고 최근 30개를 남깁니다.

### 프론트 환경변수 (Netlify → Site configuration → Environment variables)

| 변수 | 값 |
|------|-----|
| `VITE_API_BASE_URL` | `https://classesapi.bsiku.dev` |
| `VITE_GOOGLE_CLIENT_ID` | 구글 OAuth 클라이언트 ID (공개 값) |

⚠️ **`VITE_*` 는 빌드 시점에 번들에 박힙니다.** 값을 넣거나 고친 뒤에는 **다시 배포해야**
반영됩니다 — 환경변수만 저장하고 두면 이미 빌드된 번들은 그대로입니다.

⚠️ **`VITE_GOOGLE_CLIENT_ID` 가 없으면 학교 계정 연결 버튼이 코드째 빠집니다.** 안 그려
지는 정도가 아니라 rollup 이 죽은 가지로 보고 잘라냅니다. `GoogleLinkModal` 은 닫을 수
없는 창이라, 그 상태로 나가면 새로 들어온 사람은 **로그아웃 말고 할 수 있는 게 없습니다**
(실제로 한동안 그렇게 배포돼 있었습니다). 지금은 그때 안내 문구가 뜨지만, 문구가 뜬다는
건 이 변수가 빠졌다는 뜻입니다.

반영됐는지 확인하는 가장 빠른 방법 — 배포된 번들에 구글 문자열이 있는지 봅니다:

```bash
JS=$(curl -s https://classes.bsiku.dev/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://classes.bsiku.dev$JS" | grep -c 'gsi/client'   # 0 이면 빠진 것입니다
```

### 구글 클라우드 콘솔

**둘 다** 등록돼 있어야 합니다.

| 항목 | 값 |
|------|-----|
| 승인된 JavaScript 원본 | `https://classes.bsiku.dev` · `https://localhost:5188` |
| **승인된 리디렉션 URI** | `https://classes.bsiku.dev/auth/google` · `https://localhost:5188/auth/google` |

⚠️ **한동안 "리디렉션 URI 가 아닙니다" 라고 적혀 있었습니다.** 그때는 구글이 그린
버튼(GSI)이 팝업으로 처리했지만, **iOS Safari 와 인앱 브라우저가 그 팝업을 막아**
모바일에서 버튼이 안 눌렸습니다. 지금은 페이지를 통째로 넘기는 리다이렉트 방식이라
리디렉션 URI 가 **반드시** 필요합니다.

⚠️ **리디렉션 URI 를 등록하기 전에 배포하면 데스크톱까지 같이 막힙니다** — 구글이
`redirect_uri_mismatch` 화면을 띄우고 돌아오지 못합니다. 콘솔 먼저, 배포는 그 다음입니다.

경로를 바꾸려면 `frontend/src/lib/googleAuth.ts` 의 `REDIRECT_PATH` 와 콘솔을 **같이**
고쳐야 합니다. 글자 하나만 달라도 거절당합니다.

---

## 데이터·계정 (서버에서)

서버의 `python3`는 3.10이라 의존성이 없습니다. **`python3.14`로 실행하세요** —
systemd 가 쓰는 uvicorn(`/home/baeks/.local/bin/uvicorn`)도 그 인터프리터입니다.

```bash
cd /srv/class-explorer
python3.14 -m backend.parser_run                    # 오늘 기준 학기 수집
python3.14 -m backend.parser_run -y 2026 -s 2       # 학기 지정
python3.14 -m backend.import_curriculum             # 교육과정 적재
python3.14 -m backend.import_calendar               # 학사일정 적재 (source='pdf' 만 교체)
python3.14 -m backend.create_user <username> <password> [--manager|--admin]
```

**DB는 서버에만 있습니다.** `backend/ksa_timetable.db`는 git에 올라가지 않으니, 스키마를
건드리는 배포 전에는 반드시 복사본을 떠 두세요. 마이그레이션은 앱이 뜰 때 자동으로
돕니다(`database.init_schema()`).

**수집은 반영 직전에 스냅샷을 남깁니다** — `backend/backups/` 에 한 번에 약 3MB 씩,
**자동으로 지우지 않습니다**. Admin 화면의 `Backups` 에 총 용량이 뜨니 가끔 보고 서버에서
직접 지우세요. 스냅샷 없이 돌리려면 `--no-backup` 을 붙입니다.

---

## AI · ksain (데스크탑 게이트웨이 + 수집 타이머)

질문창(Agent)과 ksain 자동 분석이 쓰는 LLM 은 **데스크탑(RTX 5060 Ti)의 Ollama** 입니다.
서버는 WireGuard 로 데스크탑 게이트웨이(`10.8.10.1:11434`)만 부르고, 게이트웨이가 요청이 올 때
Ollama 를 켜고 1시간 조용하면 끕니다 — 데스크탑에 상시 부담을 주지 않으려는 것입니다.

```
server(10.8.0.1) ──WireGuard──► desktop 10.8.10.1:11434  gateway.py (예약 작업 "LLM Gateway")
                                     └──► 127.0.0.1:11435  ollama serve (필요할 때만)
```

### 데스크탑 — 게이트웨이 설치·갱신

```bash
scp deploy/llm-gateway/gateway.py deploy/llm-gateway/install.ps1 "desktop:D:/Projects/Scripts/llm-gateway/"
ssh desktop 'powershell -NoProfile -ExecutionPolicy Bypass -File D:\Projects\Scripts\llm-gateway\install.ps1'
ssh server 'curl -s http://10.8.10.1:11434/gateway/status'   # {"running": false, ...} 면 정상 (Ollama 는 꺼진 채 대기)
```

- 예약 작업 `LLM Gateway` 가 로그인 시 `pythonw gateway.py` 를 띄웁니다. 로그는
  `D:\Projects\Scripts\llm-gateway\gateway.log`
- 방화벽은 graph-study 때 만든 `GraphStudy Ollama (WireGuard)` 규칙(TCP 11434, 서버만)을 그대로
  씁니다 — 게이트웨이가 같은 포트에 서므로 새 규칙이 필요 없습니다
- ⚠️ 사용자 환경변수 `OLLAMA_HOST` 를 `127.0.0.1:11435` 로 바꿉니다. 예전 값
  `0.0.0.0:11434` 그대로면 데스크탑에서 Ollama 앱을 직접 열었을 때 게이트웨이 포트와 겹치고,
  `ollama.exe` 방화벽 규칙(모든 주소 허용) 때문에 LAN 에 열립니다
- ⚠️ 예전 예약 작업 `GraphStudy Gemma OCR`(Ollama 상시 실행)은 꺼 둔 채로 둡니다. graph-study 의
  `OLLAMA_URL=http://10.8.10.1:11434` 는 이제 게이트웨이를 거쳐 그대로 동작합니다
- 첫 요청은 Ollama 기동 + 모델 적재로 **80초 안팎** 걸립니다
- ⚠️ 게이트웨이가 Ollama 를 **컨텍스트 16k**(`OLLAMA_CONTEXT_LENGTH`)로 띄웁니다. 기본 4k 면 긴
  프롬프트의 앞부분(시스템 지시문)이 잘립니다. 게이트웨이를 고쳐 올릴 때는 **먼저
  `POST /gateway/stop`** 으로 Ollama 를 내리세요 — 작업을 멈추면 게이트웨이만 죽고 옛 설정의
  Ollama 가 남아, 새 게이트웨이가 그걸 그대로 씁니다
- 동시 처리는 2개(`OLLAMA_NUM_PARALLEL`)입니다. 1개면 밀린 ksain 분석이 도는 동안 질문창 답이
  그 뒤에 줄을 서서 40~60초씩 걸렸습니다(2개로 4~20초, VRAM 9.1GB)

### 서버 — 처음 한 번

```bash
cd /srv/class-explorer
python3.14 -m pip install --user -r requirements.txt        # pypdf · olefile
sudo mkdir -p /etc/class-explorer
sudo cp deploy/ai.env.example /etc/class-explorer/ai.env     # KSAIN_API_KEY 등을 채웁니다
sudo chown baeks:baeks /etc/class-explorer/ai.env && sudo chmod 600 /etc/class-explorer/ai.env
sudo mkdir -p /etc/systemd/system/class-explorer.service.d
sudo cp deploy/class-explorer-ai.conf /etc/systemd/system/class-explorer.service.d/ai.conf
sudo cp deploy/class-explorer-ksain.service deploy/class-explorer-ksain.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now class-explorer-ksain.timer
sudo systemctl restart class-explorer.service
```

`ai.env` 는 API 서비스(drop-in)와 수집 타이머가 같이 읽습니다. OpenAI 키가 생기면
`OPENAI_API_KEY`·`OPENAI_MODELS` 를 채우고 `class-explorer.service` 만 재시작하면 질문창 모델
목록에 붙습니다.

### ksain 데이터

```bash
python3.14 -m backend.ksain.sync --backfill      # 처음 한 번 (수십 분, 0.4초 간격)
python3.14 -m backend.ksain.sync --attachments-only  # 백필이 첨부 단계에서 멈췄을 때
python3.14 -m backend.ksain.analyze --limit 5000 # 밀린 분석 — 데스크탑 GPU 로 몇 시간
python3.14 -m backend.ksain.analyze --reapply --fresh  # 스테이징에서 돌린 분석을 운영 학사일정에 처음 반영
python3.14 -m backend.ksain.analyze --reapply    # apply 규칙을 바꾼 뒤 다시 맞춤 (사람이 지운 일정은 유지)
journalctl -u class-explorer-ksain -n 50         # 주기 실행 로그
```

⚠️ **`backend/ksain.db` 는 git 에 없고 언제든 다시 만들 수 있습니다.** 지워도 사용자 데이터는
그대로입니다 — 자동 일정은 본 DB 에 있으니 `--reapply` 를 다시 돌리세요.

---

## 처음 세팅할 때만

```bash
sudo apt update && sudo apt install -y python3 python3-pip nginx
git clone <repo> /srv/class-explorer
cd /srv/class-explorer && pip install -r requirements.txt
# 위 systemd·nginx 파일을 만들고
sudo systemctl enable --now class-explorer
sudo ln -s /etc/nginx/sites-available/ksa-fastapi.conf /etc/nginx/sites-enabled/
```

DNS(A 레코드)와 인증서는 Cloudflare에서 관리합니다. 라우터는 80/443을 N100으로
포워딩합니다.

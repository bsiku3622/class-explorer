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
git pull --ff-only
python3.14 -m backend.cli.snapshot deploy   # DB는 서버에만 있습니다 → data/backups/
sudo cp deploy/class-explorer-materials-backup.service deploy/class-explorer-materials-backup.timer \
        deploy/class-explorer-ksain.service deploy/class-explorer-ksain.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now class-explorer-materials-backup.timer class-explorer-ksain.timer
sudo systemctl restart class-explorer.service
systemctl is-active class-explorer.service
```

의존성이 바뀌었으면 재시작 전에 `pip install -r requirements.txt`를 한 번 돌립니다.

⚠️ **본 DB 를 `cp` 로 떠 두지 않습니다.** 예전엔 여기서 `cp backend/ksa_timetable.db …bak-날짜` 를 했는데,
그러면 ksain 글로 만든 기억·자동 일정이 백업에 그대로 들어갑니다 — 원문이 지워지면 같이 지운다고
개인정보처리방침에 약속한 것들이고, 이 백업은 1년을 둡니다. `backend.cli.snapshot` 은 그 둘과 로그인 세션을
빼고 뜹니다(`services/backup.py` 의 `scrub_backup`). **당긴 직후, 재시작 전에** 뜨는 건 이 명령이 새 코드에 있어서입니다.
그 몇 초 사이에 수집 타이머가 새 코드로 돌면 마이그레이션이 먼저 붙을 수 있지만, 마이그레이션은 칼럼·표를
더하기만 해서 옛 코드로 되돌리는 데 지장이 없습니다.

⚠️ **타이머 유닛은 배포 때마다 다시 복사합니다.** 유닛 파일이 `python3.14 -m backend.cli.material_backup`
처럼 모듈 경로를 들고 있어서, 코드만 당기고 유닛을 안 바꾸면 그날 밤 타이머가 `No module named` 로
실패합니다(2026-10 백엔드 재배치 때 `backend.material_backup` → `backend.cli.material_backup`).

⚠️ **`curriculum_seed.json`이 바뀐 배포에서는 재시작만으로 부족합니다** — 적재를 한 번
돌려야 새 필드(과목 분류·트랙 등)가 DB에 들어갑니다.

```bash
python3.14 -m backend.cli.import_curriculum
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
User=ksaclass
Group=ksaclass
WorkingDirectory=/srv/class-explorer
ExecStart=/srv/class-explorer/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --no-access-log
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
LogNamespace=class-explorer
UMask=0007

[Install]
WantedBy=multi-user.target
```

**로그는 class-explorer 전용 저장소에 둡니다**(`LogNamespace=class-explorer` — API·수집·자료 백업 유닛 셋 다).
보관 기간은 `/etc/systemd/journald@class-explorer.conf` 의 `MaxRetentionSec=90day` 가 이 저장소에만 겁니다.
⚠️ 서버 전체 journald(`/etc/systemd/journald.conf.d/`)에 기간을 걸지 마세요 — 같은 서버의 다른 서비스 로그까지
지워집니다(2026-10-29 에 한 번 그렇게 걸었다가 다른 서비스의 08-10 이전 로그가 지워졌고, 되돌렸습니다).

`UMask=0007` 은 ksain.db(`data/`)의 `-wal`·`-shm` 을 수집 타이머와 같이 쓰려는 것입니다(`backend/core/db.guide.md`).

환경변수와 권한은 drop-in(`class-explorer.service.d/`)이 나눠 맡습니다 — `20-hardening-app.conf`(`ProtectSystem=strict`
등), `30-env-google.conf`(`GOOGLE_CLIENT_ID`), `30-env-ksain.conf`, `40-paths-data.conf`(`ReadWritePaths=` 데이터
폴더), `ai.conf`(`/etc/class-explorer/ai.env`). API 는 `127.0.0.1` 에만 뜨고 nginx 가 앞에 섭니다.

⚠️ **`--no-access-log` 를 붙입니다.** uvicorn 의 접속 로그는 요청 주소를 쿼리째 남겨서(`/curriculum/progress/학번`)
누가 누구의 이수 현황을 봤는지가 journald 에 쌓였고, journald 는 기간 제한이 없었습니다. 접속 기록은 nginx 로그
(14일)로 충분합니다 — 개인정보처리방침 4·11절이 "웹 서버 로그 14일, 서비스 기록 90일" 을 약속합니다.

`GOOGLE_CLIENT_ID`가 없으면 학번 확인(`/auth/link-google`)이 503을 돌려주고, 계정에
학번을 붙일 수 없습니다.

**`KSAIN_API_KEY`** 를 같이 넣으면 홈에 급식이 뜹니다(`api.ksain.net`). 없으면 급식 칸만
비고 나머지는 그대로 돕니다 — 홈 전체가 죽지는 않습니다.

로그는 `journalctl --namespace=class-explorer -u class-explorer -f` 로 봅니다 — `--namespace` 를 빼면
2026-10-29 이후 로그가 안 보입니다.

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
python3.14 -m backend.cli.parser_run                    # 오늘 기준 학기 수집
python3.14 -m backend.cli.parser_run -y 2026 -s 2       # 학기 지정
python3.14 -m backend.cli.import_curriculum             # 교육과정 적재
python3.14 -m backend.cli.import_calendar               # 학사일정 적재 (source='pdf' 만 교체)
python3.14 -m backend.cli.create_user <username> <password> [--manager|--admin]
```

**DB는 서버에만 있습니다.** `backend/ksa_timetable.db`는 git에 올라가지 않으니, 스키마를
건드리는 배포 전에는 반드시 복사본을 떠 두세요. 마이그레이션은 앱이 뜰 때 자동으로
돕니다(`core/db.py` 의 `init_schema()`).

**수집은 반영 직전에 스냅샷을 남깁니다** — `data/backups/` 에 한 번에 약 3MB 씩. **1년이 지나면 매일 새벽
자료 백업 타이머가 지웁니다**(개인정보처리방침 11절). Admin 화면의 `Backups` 에 총 용량이 뜹니다. 스냅샷
없이 돌리려면 `--no-backup` 을 붙입니다.

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
python3.14 -m backend.ksain.analyze --reapply    # apply 규칙을 바꾼 뒤 다시 맞춤 (사람이 지운 일정·고친 기억은 유지)
python3.14 -m backend.knowledge.index --rebuild  # 검색 색인 처음부터 (5초 남짓 — 보통은 수집이 알아서 갱신)
journalctl --namespace=class-explorer -u class-explorer-ksain -n 50   # 주기 실행 로그
```

⚠️ **서버의 ksain.db 는 `data/ksain.db` 이고 `backend/ksain.db` 는 그리로 가는 symlink 입니다**(660 `baeks:ksaclass`,
`data/` 는 setgid). 다시 만들 때도 `data/` 에 두세요 — `backend/` 에 두면 API 가 못 엽니다(`backend/core/db.guide.md`).

⚠️ **`backend/ksain.db` 는 git 에 없고 언제든 다시 만들 수 있습니다.** 지워도 사용자 데이터는
그대로입니다 — 자동 일정과 기억은 본 DB 에 있으니 `--reapply` 를 다시 돌리세요. 검색 색인은 다음
수집이 다시 만듭니다.

⚠️ **ksain.db 를 고치는 건 `baeks` 로 도는 쪽(수집 타이머·CLI)뿐입니다.** API(`ksaclass`)는 읽기만
합니다. 그래서 ksain 쪽 스키마가 바뀐 배포에서는 새 표·칼럼이 **다음 수집 때** 생기고, 그 전까지
API 는 옛 모양으로 돕니다(검색은 색인 없이 LIKE 로). 바로 맞추려면 당긴 뒤 아래를 한 번 돌리세요.

```bash
python3.14 -m backend.knowledge.index           # ksain.db 스키마 맞추기 + 색인 만들기
```

### 2026-10 백엔드 재배치 + 기억 배포 (한 번만)

위 평소 배포(유닛 두 벌 다시 복사 포함)에 더해 아래를 확인합니다.

1. `git pull` 뒤 `python3.14 -m backend.knowledge.index` 로 색인을 만듭니다 — 안 해도 다음 수집이
   만들지만, 그 전까지 검색이 LIKE 로 돕니다
2. API 를 재시작하면 본 DB 에 `facts`·`facts_fts` 가 생기고, 계정의 전공(`users.major`)과 일정·제안·
   기억의 대상 전공(`target_majors`) 칼럼이 붙습니다(`init_schema()`)
3. 분석기가 v3 에서 v5 로 올라가서, 다음 주기부터 **최근 1년의 글 약 710건을 게시판·중요도와 상관없이
   다시 분석**합니다. 글 하나에 15~30초라 데스크탑 GPU 로 네다섯 시간 걸리고(낮 시간 타이머가 40분씩
   이어 돕니다), 그동안 기억과 자동 일정이 최신 글부터 바뀝니다 — 자동 일정에는 대상 전공과 세부 메모가
   붙습니다. 진행은 `GET /agent/status` 의 `facts.active` 나 Admin 의 기억 패널로 봅니다
4. 학번을 확인한 학생에게는 다음 접속 때 전공 팝업이 뜹니다. 응답 현황은 Admin 의 전공 조사 칸
   (`GET /majors/stats`)에서 인원 수로만 봅니다

### 2026-10 개인정보 감사 반영 (한 번만)

개인정보처리방침을 고쳐 싣는 날 바로 시행합니다(13절). 아래가 방침에 적은 것과 서버를 맞추는 단계입니다 —
빠뜨리면 방침이 거짓말이 됩니다. **2026-10-29 운영 서버에 1~5(3-1 포함)를 적용했습니다**(바로 위 「백엔드 재배치」 절과
함께). 6 은 아직입니다.

1. **강의계획서를 서버에 올립니다.** git 에서 뺐습니다(교사 연락처) — 맥북의 `backend/syllabi/` 를 그대로 보냅니다.
   ```bash
   rsync -a "backend/syllabi/" server:/srv/class-explorer/data/syllabi/
   # API(ksaclass)가 읽게 — 폴더 750, 파일 640, 그룹 ksaclass
   ssh server 'D=/srv/class-explorer/data/syllabi; sudo chgrp -R ksaclass "$D"; sudo find "$D" -type d -exec chmod 750 {} +; sudo find "$D" -type f -exec chmod 640 {} +'
   ```
   ⚠️ 권한은 서버에서 맞춥니다. 맥의 `rsync` 는 openrsync 라 `--chmod=D750,F640` 을 못 받습니다(`invalid argument`).
   옮기는 사이에는 맥의 권한(644)대로 앉지만, `data/` 가 `770 baeks:ksaclass` 라 다른 계정은 들어오지 못합니다
   `SYLLABI_DIR` 는 비워 둡니다(기본값이 `data/syllabi`). 파일이 없으면 강의계획서만 안 보이고 화면은 그대로입니다.
   Ask 의 `syllabus` 도구도 이 파일을 읽어서, 없으면 "강의계획서 파일이 없습니다" 로 답합니다(`backend/agent.guide.md`)
2. **API 접속 로그를 끕니다** — 위 「systemd」 의 `--no-access-log`. 유닛을 고친 뒤 `sudo systemctl daemon-reload`
3. **class-explorer 로그만 90일 둡니다** — 전용 저장소(namespace)를 만들고 유닛 셋이 그리로 쓰게 합니다
   ```bash
   printf '[Journal]\nStorage=persistent\nMaxRetentionSec=90day\n' | sudo tee /etc/systemd/journald@class-explorer.conf
   # API 유닛에 LogNamespace=class-explorer · UMask=0007 (위 「systemd」), 수집·자료 백업 유닛은 repo 파일에 들어 있습니다
   sudo systemctl daemon-reload && sudo systemctl restart class-explorer.service
   journalctl --namespace=class-explorer -u class-explorer -n 5   # 여기에 찍히면 된 것
   ```
   ⚠️ 처음엔 서버 전체 journald 에 `MaxRetentionSec=90day` 를 걸었다가 같은 서버의 다른 서비스 로그까지 08-10
   이전 것이 지워졌습니다(4.0GB → 424MB, 되살릴 수 없음). 그 설정은 지웠고, 공용 저장소는 기본값(용량 한도 4GB)으로
   돌아갔습니다. 그 바람에 **2026-10-29 전의 class-explorer 기록(08-10~)은 공용 저장소에 섞여 남아** 있다가 용량
   한도로 밀려날 때 지워집니다 — 개인정보처리방침 4절이 그렇게 적고 있습니다
3-1. **ksain.db 를 `data/` 로 옮깁니다** — API 가 수집 사이에도 ksain.db 를 열 수 있게(`backend/core/db.guide.md`)
   ```bash
   sudo usermod -aG ksaclass baeks && sudo chmod g+s data
   sudo systemctl stop class-explorer-ksain.timer class-explorer.service
   mv backend/ksain.db data/ksain.db && sudo chgrp ksaclass data/ksain.db && chmod 660 data/ksain.db
   ln -s ../data/ksain.db backend/ksain.db
   sudo systemctl start class-explorer.service class-explorer-ksain.timer
   ```
4. **이미 있는 백업을 정리합니다** — 1년 지난 것 삭제 + 남은 것에서 세션·게시글 파생물 걷어내기. 백업 폴더에
   `ksaclass`·`baeks` 파일이 섞여 있어서 `sudo` 로 돌립니다
   ```bash
   cd /srv/class-explorer && sudo ./venv/bin/python -m backend.cli.snapshot --scrub-existing
   sudo chown baeks:baeks data/material-backups/*.tar.gz   # 압축 파일은 새로 써서 root 소유가 됩니다
   ```
   이 규칙 뒤로는 매일 새벽 자료 백업 타이머가 1년 지난 백업을 지웁니다(`services/backup.py` 의 `KEEP_DAYS`).
   ⚠️ DB 백업은 제자리에서 고쳐 소유자가 그대로지만, 자료 백업 압축 파일은 새로 써서 `root:root` 가 됩니다 — 타이머
   (`baeks`)가 나중에 지울 수는 있어도 다른 압축 파일과 소유가 갈리니 돌려 둡니다
5. API 를 재시작합니다 — 마이그레이션이 지운 계정의 남은 기록을 지우고(`_purge_orphans`), 두 DB 가 `secure_delete`
   로 열립니다. 이미 지운 행이 남은 빈 페이지는 한 번 VACUUM 해야 사라집니다
   ```bash
   sudo systemctl stop class-explorer class-explorer-ksain.timer
   python3.14 -c "import sqlite3; [sqlite3.connect(p).execute('VACUUM') for p in ('data/ksa_timetable.db', 'backend/ksain.db')]"
   sudo systemctl start class-explorer class-explorer-ksain.timer
   ```
   서버에는 `sqlite3` 명령이 없어서 파이썬으로 합니다(`baeks` 로 — 두 파일 다 `baeks` 가 쓸 수 있습니다)
6. **공개 레포의 기록에서 개인정보 파일을 지웁니다** — 이 브랜치를 main 에 합쳐 배포한 **뒤에**. 학생 명단·옛 DB·
   강의계획서가 2026-03 이후 기록에 남아 있습니다. 맥북에서 `~/Bufs/Claude Files/2026-10-29/history-rewrite/rewrite-history.sh`
   를 먼저 그냥 돌려 확인하고, `--push` 로 덮어쓴 뒤 출력대로 모든 clone(맥북·서버·데스크탑)을 맞춥니다. PR #1·#2 의
   화면은 GitHub 지원팀에 요청해야 지워지는데, 운영자가 그대로 두기로 했습니다. **2026-10-29 에 덮어썼습니다**(main `9e97e77`)
   ⚠️ **옛 clone 에서는 `git pull` 하지 마세요.** git 이 옛 기록과 새 기록을 합쳐 버리고, 그대로 푸시하면 지운 명단이 든
   커밋이 공개 레포로 다시 올라갑니다. 커밋 안 한 변경이 없는지 보고 `git fetch origin --prune && git reset --hard
   origin/main` 으로 맞춥니다. 맥북 저장소에는 `pull.ff=only` 를 걸어 두어 합치려 하면 멈춥니다
7. **명단 파일을 막습니다** — `backend/students.txt`(학번·이름)가 644 라 서버의 다른 계정도 읽었습니다. 관리 화면의
   재수집(`/admin/sync`)이 API 계정으로 읽으니 그룹만 넘깁니다
   ```bash
   sudo chgrp ksaclass backend/students.txt && chmod 640 backend/students.txt
   ```

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

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

### nginx — `/etc/nginx/sites-available/ksa-fastapi.conf`

```nginx
server {
    listen 80;
    server_name classesapi.bsiku.dev;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;          # Rate Limiter가 이 값을 봅니다
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

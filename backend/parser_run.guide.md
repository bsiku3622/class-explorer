# backend/parser_run.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
학생 목록(`students.txt`)을 기반으로 KEIS API에서 **학기 단위**로 시간표를 수집해 DB에 반영.

## 실행
```bash
python -m backend.parser_run                       # 오늘 날짜 기준 학기
python -m backend.parser_run --year 2026 --semester 2
python -m backend.parser_run -y 2026 -s 2 --prune  # 데이터 없는 학생 students.txt에서 제거
```

| 인자 | 기본값 | 설명 |
|------|--------|------|
| `-y, --year` | `SYNC_YEAR` 환경변수 → `current_term()` | 학년도 |
| `-s, --semester` | `SYNC_SEMESTER` 환경변수 → `current_term()` | 학기 (1 \| 2) |
| `--prune` | off | 해당 학기 시간표가 없는 학생을 `students.txt`에서 제거 |

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
[전원 수집 완료 후] replace_term_data() — 학기 단위 원자적 교체
  - 해당 학기 Class / ClassTime / Enrollment 전량 삭제 후 재삽입
  - Student: 다른 학기가 참조하므로 삭제하지 않음 (신규 추가 + 이름 갱신만)
  - 다른 학기 데이터는 건드리지 않음
```

## 안전장치
DB 반영은 **모든 요청이 끝난 뒤 한 번에** 일어나므로, 수집 도중 실패해도 기존 데이터가 깨지지 않습니다.

| 조건 | 동작 |
|------|------|
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
SYNC_RESULT synced=342 skipped=15 errors=0 elapsed=15.9s
```
- `synced` — 시간표를 받아 DB에 반영한 학생 수
- `skipped` — 응답은 왔으나 해당 학기 시간표가 비어 있는 학생 (휴학·졸업 등)
- `errors` — 요청 실패 (재시도 후에도 실패)

`/admin/sync`가 이 줄을 파싱해 통계로 반환합니다.

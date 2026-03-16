# backend/parser_run.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
학생 목록(`students.txt`)을 기반으로 KSAIN API에서 시간표 데이터를 수집하여 DB에 저장.

## 실행
```bash
python -m backend.parser_run
```

## 동작 흐름
```
students.txt 읽기 (학번 + 이름)
      ↓
asyncio + httpx (동시 요청, 세마포어 최대 20)
      ↓
https://api.ksain.net/ksain/timetable.php
(학번별 POST 요청)
      ↓
parse_ksain_data() → 수업 목록
      ↓
DB UPSERT
  - Student: stuId + name 저장
  - Class: subject/section/teacher UniqueConstraint로 중복 방지
  - ClassTime: cascade delete-orphan으로 기존 시간 삭제 후 재삽입
  - Enrollment: UniqueConstraint로 중복 방지
```

## 설정값
| 변수 | 값 | 설명 |
|------|-----|------|
| `MAX_CONCURRENT_REQUESTS` | `20` | 동시 API 요청 수 |
| Timeout | `30s` | 요청 타임아웃 |

## students.txt 형식
```
25-001 홍길동
25-002 김철수
24-100 이영희
```

## 오류 처리
- 응답 실패 / 타임아웃: 해당 학생 건너뜀 (로그 출력)
- 유효하지 않은 학번: `students.txt`에서 제거
- 파싱 오류: `parse_ksain_data()`에서 빈 리스트 반환 → 해당 학생 건너뜀

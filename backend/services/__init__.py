"""도메인 계산 — 라우터·Agent·CLI 가 같이 쓰는 것. HTTP 를 모릅니다(예외: 권한 확인용 `HTTPException`).

| 모듈 | 하는 일 |
| --- | --- |
| `periods.py` | 교시 시각표 **원본** |
| `schoolday.py` | 그날 판정 — 방학·주말·휴업일·대체 시간표 |
| `timetable.py` | 과목 표기(EC)·분반 번호·학생/학기 단위 수업 행 |
| `calendar.py` | 학사일정 직렬화와 공개 범위(`visible_to`) |
| `meals.py` | 급식 (ksain.net) |
| `exams.py` | 시험 회차·본인 시험 시간표 |
| `curriculum.py` | 졸업 요건·누적 이수 이력 |
| `materials.py` | 자료 원본의 자리 |
| `terms.py` | 학기 해석 |
| `versioning.py` | 수집 회차 (`at_version`) |
| `features.py` | 한시적 기능의 기간 (`settings` 표) |
| `subject_names.py` | 과목명 분해·정규화 |
| `zamong_import.py` | 자몽 워크북 → 이수 기록 |
| `backup.py` | 본 DB 스냅샷 |
"""

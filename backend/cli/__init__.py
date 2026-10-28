"""손으로(또는 타이머가) 돌리는 명령 — `python -m backend.cli.<이름>`.

| 명령 | 하는 일 |
| --- | --- |
| `parser_run` | KEIS 시간표 수집 (학기 단위, 반영 직전 스냅샷) — `parser.py` 가 응답을 풉니다 |
| `import_calendar` | `calendar_seed.json` → 학사일정 (`source='pdf'` 만 교체) |
| `parse_calendar_pdf` | 연간 학사일정 PDF → `calendar_seed.json` (로컬) |
| `import_curriculum` | `curriculum_seed.json` → 교육과정 |
| `build_curriculum_seed` | Zamong 워크북 → `curriculum_seed.json` (로컬) |
| `import_exams` | 시험 seed + 응시 명단 → 시험 시간표 |
| `create_user` | 계정 만들기 |
| `material_backup` | 자료 원본 + 본 DB 압축 백업 (systemd 타이머) |

ksain 수집·분석은 `backend.ksain.sync` · `backend.ksain.analyze` 입니다 (ksain 타이머가 부릅니다).
"""

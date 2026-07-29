# backend/parser.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
KEIS 시간표 API 응답 JSON을 파싱해 수업 목록으로 변환.

## 함수

### `parse_schedule(raw_data: str) -> list[ParsedClass]`
**입력**: KEIS API 응답 (이중 JSON 인코딩)
```json
{ "data": "[{\"kyosi\": \"1\", \"value1\": \"수학<br>1분반<br>홍길동<br>형3202\", ...}]" }
```

**파싱 과정**:
1. 외부 JSON 파싱 → `data` 필드 추출 (문자열)
2. 내부 JSON 파싱 → 시간표 행 목록
3. 각 행의 `kyosi` = 교시 번호 (배열 인덱스가 아닌 **명시된 값** 사용)
4. 각 셀: `<br>` 분리 → `[subject, section, teacher, room]`
5. `(subject, section, teacher)` 키로 그룹핑 → times 배열 누적
6. 대표 강의실은 `_pick_room()` — 실제 배정된 방이 `"배정중"`보다 우선

**출력**:
```python
[
  {
    "subject": "수학",
    "section": "1분반",
    "teacher": "홍길동",
    "room": "형3202",
    "times": [
      { "day": "MON", "period": 2, "room": "형3202" }
    ]
  },
  ...
]
```
`times`는 요일·교시 순으로 정렬되며 중복 슬롯은 제거됩니다.

## 보조 함수
| 함수 | 역할 |
|------|------|
| `_parse_cell(cell)` | 셀 문자열 → `(subject, section, teacher, room)`. 필드 3개 미만이면 `None` |
| `_pick_room(rooms)` | 시간대별 강의실 중 대표 선정. 배정된 방 우선, 그중 최빈값 |

## 데이터 레이아웃
KEIS 시간표 응답: `rows[i] = {"kyosi": "<교시>", "value1"~"value5": <셀 또는 null>}`
- `kyosi` = 교시 번호 (1~12)
- `value1`~`value5` = MON~FRI

## 강의실 `"배정중"`
학기 시작 전에는 모든 셀의 강의실이 `"배정중"`으로 옵니다.
배정 완료 후 재수집하면 실제 강의실로 채워집니다 — 파서 수정 불필요.

## 오류 처리
JSON 파싱 실패·형식 불일치·빈 응답은 모두 빈 리스트를 반환합니다 (예외 전파 없음).

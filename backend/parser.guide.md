# backend/parser.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
KSAIN API 응답 JSON을 파싱해 수업 목록으로 변환.

## 함수

### `parse_ksain_data(raw_data: str) -> list`
**입력**: KSAIN API 응답 (이중 JSON 인코딩)
```json
{ "data": "[{\"value1\": \"수학<br>제1분반<br>홍길동<br>형설202\", ...}]" }
```

**파싱 과정**:
1. 외부 JSON 파싱 → `data` 필드 추출 (문자열)
2. 내부 JSON 파싱 → 시간표 행 목록 (11행 × 5열)
3. 각 셀: `<br>` 분리 → `[subject, section, teacher, room]`
4. `(subject, section, teacher)` 키로 그룹핑 → times 배열 누적

**출력**:
```python
[
  {
    "subject": "수학",
    "section": "제1분반",
    "teacher": "홍길동",
    "room": "형설202",
    "times": [
      { "day": "MON", "period": 2, "room": "형설202" }
    ]
  },
  ...
]
```

## 데이터 레이아웃
KSAIN 시간표 응답: `timetable_list[period_idx]["value{1~5}"]`
- 인덱스 0 = 1교시, ..., 인덱스 10 = 11교시
- `value1`~`value5` = MON~FRI

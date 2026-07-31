# lib/utils.ts Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
전체 앱에서 공유하는 상수와 순수 유틸리티 함수 모음.

## 상수

| 상수 | 값 | 사용처 |
|------|----|--------|
| `DAY_MAP` | `{ MON:"월", TUE:"화", ... }` | SectionCard, searchEngine, formatSectionTimes |
| `DAYS_ORDER` | `["MON","TUE","WED","THU","FRI"]` | TimetableGrid, RoomsPage, formatSectionTimes |
| `PERIODS` | `[1,2,...,11]` | TimetableGrid, RoomsPage |

## 함수

### `extractSearchTerms(searchTerm): string[]`
prefix(`:`) 및 논리 연산자 제거 후 순수 검색어 배열 반환.
```ts
extractSearchTerms("teacher:홍길동 & 수학")
// → ["홍길동", "수학"]
```
사용처: SectionCard, SubjectAccordionItem 하이라이팅

### `getStudentColor(studentId): string`
학번 앞 두 자리로 색상 매핑.
```ts
getStudentColor("25-001") // → "#00B327" (Green)
```
| 학번 | 색상 | Hex |
|------|------|-----|
| 23 | Purple | `#7828C8` |
| 24 | Orange | `#FC8200` |
| 25 | Green | `#00B327` |
| 26 | Cyan | `#00B5E7` |

### `getKoreanName(subject): string`
과목명에서 괄호 앞 한글명만 추출.
```ts
getKoreanName("수학(Math I)") // → "수학"
```

### `getSectionNumber(section): string`
분반 문자열에서 숫자만 추출.
```ts
getSectionNumber("제1분반") // → "1"
```

### `formatSubjectWithSection(subject, sections, extra?, extraPosition?): string`
과목명 + 분반 + 추가 정보 포맷팅.
```ts
formatSubjectWithSection("수학(Math)", ["제1분반"], "홍T", "prefix")
// → "홍T - 수학(1)"

formatSubjectWithSection("수학(Math)", ["제1분반"], "형설202", "suffix")
// → "수학(1) - 형설202"
```

### `formatSectionTimes(times): string`
시간표를 `"화2, 수3,4"` 형식으로 변환.
```ts
formatSectionTimes([{day:"TUE",period:2}, {day:"WED",period:3}])
// → "화2, 수3"
```

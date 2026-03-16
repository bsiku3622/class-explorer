# lib/searchEngine.ts Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
클라이언트 사이드 검색 엔진. 한국어 초성 검색 + 논리 연산자 지원.

## 진입점

### `searchInClient(allData, searchTerm, selectedYears): SearchResult`
```
searchTerm → parseQuery() → filterMatchingClasses() → extractEntities()
                                                      → grouped finalData
```
반환값: `{ data, entities, mode, warning, stats }`

---

## 내부 함수

### `parseQuery(searchTerm, allData)`
검색어를 파싱해 모드, 쿼리, 플래그를 반환.

| prefix | 단축키 | mode |
|--------|--------|------|
| `student:` | `s:`, `st:` | `"student"` |
| `teacher:` | `t:`, `te:` | `"teacher"` |
| `room:` | `r:`, `ro:` | `"room"` |
| (없음) | — | `"general"` |

특수 패턴:
- `수학/1` → `isDividerSearch=true` (과목명/분반번호 매칭)
- `&&` 또는 `mode=room` → `isStrictMode=true`

### `filterMatchingClasses(allData, queryParams, selectedYears)`
각 분반의 `sectionPool`(과목, 교사, 학번, 이름, 강의실, 시간 등)에 대해 논리식 평가.

- `mode=student`: 학번 + 이름 풀에서만 검색
- `mode=teacher`: 교사명만 검색
- `mode=room`: 강의실명만 검색 (시간별 room 포함)
- `isDividerSearch`: 과목명 + 분반번호 정확 매칭

### `extractEntities(matchingClasses, flatTerms, mode, effectiveQuery)`
매칭된 분반에서 학생/교사/강의실 엔티티 추출.
- 정렬: `teacher(1) → student(2) → room(3)`, 동일 타입은 이름순

---

## 논리 연산자

### `evaluateBoolExpression(expression, pool, strictIDMatch): boolean`
재귀 하강 파서:
```
expression = andTerm ('+' andTerm)*
andTerm    = unary (('&' | '&&') unary)*
unary      = '!' factor | factor
factor     = '(' expression ')' | term
term       = pool.some(item => matchesItem(item, term))
```

### `getChosung(str): string`
한글 문자열에서 초성만 추출.
```ts
getChosung("수학") // → "ㅅㅎ"
```

### `matchesItem(item, term, strictIDMatch): boolean`
1. 학번 strict 매칭 (`strictIDMatch=true` + `-` 포함 시)
2. 일반 포함 검색 (`toLowerCase`)
3. 초성 전용 검색 (`/^[ㄱ-ㅎ]+$/` 패턴)

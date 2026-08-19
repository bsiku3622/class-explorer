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
- `체육4/2,3` → 분반 여러 개를 콤마로 나열 (공백 허용)
- `&&` 또는 `mode=room` → `isStrictMode=true`

### `filterMatchingClasses(allData, queryParams, selectedYears)`
각 분반의 `sectionPool`(과목, 교사, 학번, 이름, 강의실, 시간 등)에 대해 논리식 평가.

- `mode=student`: 학번 + 이름 풀에서만 검색
- `mode=teacher`: 교사명만 검색
- `mode=room`: 강의실명만 검색 (시간별 room 포함)
- `isDividerSearch`: 과목명(유사도 허용) + 분반번호 집합 매칭 — `체4/2,3`도 통합니다

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
4. 유사도 검색 (`fuzzyMatch`)

### `fuzzyMatch(item, term): boolean`
띄엄띄엄 입력한 검색어를 받아냅니다. 별칭을 등록하지 않아도 줄여 쓴 검색이 통합니다.
```ts
fuzzyMatch("정보과학3(Computer Science3)", "정3")   // → true
fuzzyMatch("일반물리학실험1(...)", "일물실1")        // → true
fuzzyMatch("그림,음악,영화로보는세계사", "그세")      // → false
```

**동작**:
1. `normalize()` — 로마숫자 치환 → 소문자 → 공백·구두점 제거
   (치환이 `toLowerCase`보다 **먼저**여야 합니다. `Ⅲ`가 `ⅲ`가 되면 매핑이 깨집니다)
2. 연속 포함이면 즉시 통과
3. 문자가 순서대로 나타나는 **가장 짧은 구간**을 찾아, 길이가 `검색어길이 × 3 + 2` 이하일 때만 통과
4. 실패하면 대상의 초성으로 같은 판정 — `"ㅈㅂ3"` → `"정보과학3"`

3번의 구간 제약이 오탐 방지 장치입니다. 이게 없으면 문자만 순서대로 있으면 다 걸려서
`"그세"`가 `"그림,음악,영화로보는세계사"`에 매칭됩니다.

> 검색 pool에는 교사명·학생명·강의실도 들어갑니다. 구간 제약 덕분에 이들에 대한
> 오탐은 억제되지만, 검색 결과가 넓어졌다고 느껴지면 이 계수부터 조정하세요.

---

## 화면에서 검색으로 (`toSearchTerm` · `subjectQuery` · `sectionQuery` · `teacherQuery`)

홈의 주간 격자 칩과 오늘 목록에서 **과목명·분반·교사를 누르면 검색**됩니다. 그때 쓰는
검색어를 만드는 함수들입니다.

| 함수 | 결과 |
|------|------|
| `subjectQuery("미적분학2(EC)")` | `미적분학2 EC` — 그 과목의 모든 분반 |
| `sectionQuery("세계사의이해", "제5분반")` | `세계사의이해/5` — 구분자 검색, 그 분반만 |
| `teacherQuery("박인숙")` | `teacher:박인숙` — 사람만 |
| `searchHref(q)` | `/search?q=…` (`App` 이 `?q=` 를 읽어 검색어로 넣습니다) |

⚠️ **이름을 그대로 검색어로 넘기면 안 됩니다.** `( ) + & / ! :` 가 전부 질의 문법의
글자입니다 — `미적분학2(EC)` 는 `(EC)` 가 **논리식 괄호 그룹**으로 파싱되고,
`Cognitive Neuroscience: The Biology…` 는 `:` 앞이 **prefix** 로 잘립니다.

⚠️ **괄호는 지우되 안의 글자는 남깁니다.** `fuzzyMatch` 의 `normalize()` 가 검색 대상
에서도 구두점을 떼기 때문에 `미적분학2 EC` 는 `미적분학2(EC)` 에만 붙고 한국어반
`미적분학2` 에는 안 붙습니다. 괄호를 통째로 잘라 내면 그 구분이 사라집니다.

`융합특강(AI시대의인간기술)` 처럼 **꼬리 괄호가 곧 과목의 정체**인 이름도 같은 이유로
`융합특강 AI시대의인간기술` 이 되어 정확히 그 과목만 찾습니다.

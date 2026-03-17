# SearchResultDisplay Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
검색 결과 전체를 렌더링. 뷰 모드에 따라 통합 뷰 또는 그리드 뷰로 전환.

## Props (주요)
| prop | 설명 |
|------|------|
| `searchResult` | 검색 결과 메타 (entities, keyword, stats 등) |
| `displayData` | 표시할 과목 데이터 |
| `searchMode` | 현재 검색 모드 |
| `isConsolidatedView` | 통합 뷰 여부 |
| `isLogicalSearch` | 논리 연산자 포함 여부 |
| `isModifierPressed` | Cmd/Ctrl 상태 |
| `hoveredEntityId` / `setHoveredEntityId` | 엔티티 호버 상태 |
| `handleSearchToggle` / `handleSearchSelect` | 검색 핸들러 |

## 뷰 모드

### 통합 뷰 (`isConsolidatedView=true`)
- 단일 엔티티 검색 또는 논리 검색일 때
- `EntityCard` → `TimetableGrid` → `SubjectAccordionItem` 순서
- 상단에 검색 요약 + 경고 메시지

### 그리드 뷰 (`isConsolidatedView=false`)
- 일반 검색으로 복수 엔티티 발견 시
- `EntityCard` 격자 배열 (2~3열)
- 각 카드 클릭 → 해당 엔티티로 검색 전환

## QueryHighlighter (내부 컴포넌트)
검색어를 시각적으로 파싱해서 표시하는 인라인 컴포넌트.
```
"teacher:홍길동 & 수학"
→ [teacher:] [홍길동] [&] [수학]  (색상별 토큰)
```

## 경고 메시지
- `searchResult.warning`이 있으면 상단 경고 박스 표시 (prefix 모드에서 논리 연산자 혼용 시)
- 논리 검색에서 학생 2명 이상 비교 시 `conflictData` useMemo로 시간 충돌 감지
  - 충돌 발견 시 주황색 경고 블록 표시: "X time conflict(s) detected"
  - 충돌 = 모든 학생이 동시에 수업 중이지만 서로 다른 과목

# pages/SearchPage.tsx Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
메인 검색 페이지. 검색 입력, 필터, 결과 표시를 담당합니다.

## Props (App.tsx에서 전달)
| prop | 타입 | 설명 |
|------|------|------|
| `searchInput` / `setSearchInput` | `string` | 입력 필드 값 |
| `searchTerm` | `string` | 실제 검색 실행 값 |
| `studentCounts` | `Record<string, number>` | 학년별 학생 수 |
| `selectedYears` / `setSelectedYears` | `string[]` | 선택된 학년 |
| `searchResult` | `SearchResultStats \| null` | 검색 결과 메타 |
| `searchMode` | 검색 모드 문자열 | 현재 모드 |
| `isLogicalSearch` | `boolean` | 논리 연산자 포함 여부 |
| `isConsolidatedView` | `boolean` | 통합 뷰 여부 |
| `isModifierPressed` | `boolean` | Cmd/Ctrl 누름 상태 |
| `displayData` | `SubjectData[]` | 표시할 과목 데이터 |
| `stats` | `Stats \| null` | 전체 통계 (검색 없을 때) |
| `loading` | `boolean` | 로딩 상태 |
| `studentSubjectMap` | 맵 | 학번→과목 매핑 |
| `teacherSubjectMap` | 맵 | 교사→과목→분반 매핑 |
| `hasStudentInSearch` | `boolean` | 결과에 학생 있음 |
| `handleSearchToggle` / `handleSearchSelect` | 함수 | 검색 핸들러 |
| `expandedSubjects` / `toggleSubject` | 상태/함수 | 아코디언 토글 |
| `hoveredEntityId` / `setHoveredEntityId` | 상태/함수 | 엔티티 호버 |

## 레이아웃 구조
```
PageHeader (Feature: Search Engine)
  ↓
검색 입력창 + 클리어 버튼
  ↓
FilterSection (학년 선택)
  ↓
[검색 결과 있음] → SearchResultDisplay
[검색 결과 없음] → StatsCards + SubjectAccordionItem 목록
```

## 검색 입력 처리
- `e.nativeEvent.isComposing` 체크로 한글 IME Enter 중복 방지
- `onKeyDown Enter` → `setSearchInput(searchInput)` (즉시 반영)
- 클리어 버튼 → `setSearchInput("")`

## 도움말 툴팁
검색창 우측 `?` 버튼 → 검색 문법 가이드 표시
(prefix, 논리 연산자, 초성, 분반 검색 예시 포함)

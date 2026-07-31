# StatsCards Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
전체 데이터 통계를 3열 카드로 표시. 검색 없을 때 SearchPage 상단에 표시.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `stats` | `Stats` | 통계 데이터 |

## 표시 항목
```
[전체 과목 수]  [전체 분반 수]  [재학생 수]
```

## 스타일
```
grid grid-cols-3 gap-4

각 카드:
RetroCard + bg-white + p-6
RetroStatItem (label, value, size="lg")
```

## 언제 렌더링되는가
`App.tsx`에서 `searchTerm`이 비어있을 때 `stats`가 설정됨.
`searchResult`가 있으면 `SearchResultDisplay`가 대신 표시됨.

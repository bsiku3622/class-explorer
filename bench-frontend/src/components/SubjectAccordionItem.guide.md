# SubjectAccordionItem Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
과목 단위 아코디언 아이템. 헤더 클릭 시 해당 과목의 모든 분반 카드를 펼칩니다.

## Props
| prop | 설명 |
|------|------|
| `subject` | `SubjectData` (과목 전체 데이터) |
| `isExpanded` | 현재 펼침 상태 |
| `onToggle` | 토글 핸들러 |
| `searchTerms` | 하이라이팅 검색어 배열 |
| `isModifierPressed` | Cmd/Ctrl 상태 |
| `handleSearchToggle` | 검색 핸들러 |
| `studentSubjectMap` | 학번→과목 맵 |

## 헤더 레이아웃
```
[과목명]  [분반 수]개 분반  [학생 수]명   [교사 요약 바]   [▼/▲]
```

## 교사 요약 바
교사별로 색상 구분된 미니 바 차트. 각 교사가 담당하는 분반 비율 시각화.

## 펼침 컨텐츠
- 각 분반마다 `SectionCard` 렌더링
- `isExpanded=false`일 때 `hidden`으로 숨김

## 하이라이팅
헤더의 과목명에도 `searchTerms`와 매칭되면 강조 표시.

## 사용처
`SearchPage`에서 `displayData` 배열을 순회하며 렌더링:
```tsx
{displayData.map((subject) => (
  <SubjectAccordionItem
    key={subject.subject}
    subject={subject}
    isExpanded={expandedSubjects.includes(subject.subject)}
    onToggle={() => toggleSubject(subject.subject)}
    ...
  />
))}
```

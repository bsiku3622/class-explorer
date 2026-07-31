# SectionCard Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
개별 분반의 모든 정보를 표시하는 카드.

## Props
| prop | 설명 |
|------|------|
| `section` | `Section` 데이터 (분반 전체 정보) |
| `subject` | 과목명 |
| `searchTerms` | 하이라이팅할 검색어 배열 |
| `isModifierPressed` | Cmd/Ctrl 누름 상태 |
| `handleSearchToggle` | 교사/강의실/학생 클릭 시 검색 토글 |
| `studentSubjectMap` | 학번→과목 목록 (Tooltip용) |

## 레이아웃
```
┌──────────────────────────────────────────────────┐
│  [제1분반]  [홍길동 선생님]  [형설202]  [화2, 수3,4] │
│  ─────────────────────────────────────────────── │
│  [25 김철수] [24 이영희] [26 박민준] ...            │
└──────────────────────────────────────────────────┘
```

## 인터랙션
- **교사 클릭**: `handleSearchToggle(teacher, true)` → `teacher:이름` 검색
- **강의실 클릭**: `handleSearchToggle(room, false, true)` → `room:이름` 검색
- **학생 배지 호버 + Cmd/Ctrl**: 해당 학생의 전체 시간표 Tooltip 표시
- **검색어 하이라이트**: `extractSearchTerms`로 추출한 키워드 강조

## Tooltip (학생 시간표)
```tsx
<Tooltip
  isDisabled={!isModifierPressed}
  content={/* 학생의 전체 수업 목록 */}
>
  <StudentBadge />
</Tooltip>
```
- `isModifierPressed=false`일 때 비활성화 (기본 UI 깔끔 유지)

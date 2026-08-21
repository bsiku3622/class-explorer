# EntityCard Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
검색으로 발견된 엔티티(학생/교사/강의실) 정보 카드.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `entity` | `SearchEntity` | 엔티티 데이터 |
| `isActive` | `boolean` | 현재 선택된 카드 여부 |
| `onClick` | `() => void` | 카드 클릭 핸들러 |
| `isModifierPressed` | `boolean` | Tooltip 활성화 조건 |

## 레이아웃
```
┌──────────────────────────────────────┐
│  [타입]       │  과목1               │
│  이름         │  과목2               │
│  ID/역할      │  과목3 ...           │
│               │  [+n more]           │
└──────────────────────────────────────┘
```

**과목 목록은 좁은 화면에서 한 줄씩 놓입니다** (`grid-cols-1` → `sm:grid-cols-2`).
왼쪽 이름 칸이 `min-w-44` 라 390px 에서 오른쪽에 190px 밖에 안 남고, 그걸 둘로 나누면
한 칸이 78px — 과목명이 세 글자에서 잘립니다. 결과가 하나일 때(`isSingleEntity`)만
넓은 화면에서 두 칸으로 갑니다.

## 엔티티 타입별 표시
| type | 이름 | ID | 색상 |
|------|------|-----|------|
| `student` | 학생 이름 | 학번 | 학번 색상 |
| `teacher` | 교사 이름 | "Teacher" | 검정 |
| `room` | 강의실명 | "Classroom" | 검정 |

## 과목 목록 형식
```ts
// formatSubjectWithSection으로 생성
"홍T - 수학(1)"        // student 엔티티: prefix=교사명
"형설202 - 수학(1)"   // room 엔티티: prefix=강의실
"수학(1) - 홍T"       // teacher 엔티티: suffix=교사명
```

## 인터랙션
- 카드 클릭 → `handleSearchSelect(entity.id 또는 entity.name)` → 해당 엔티티로 검색
- `isActive`: 현재 선택된 카드 강조 (`scale-105 shadow-retro-lg`)
- 호버: `-translate-y-1.5` (살짝 위로 이동)

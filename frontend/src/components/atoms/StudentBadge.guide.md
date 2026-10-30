# StudentBadge Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
학번을 기수와 색으로 풀어 funky-ui 의 `StudentBadge` 에 넘깁니다.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `studentId` | `string` | 필수 | 학번 (예: `"25-001"`) |
| `studentName` | `string` | 필수 | 학생 이름 |
| `size` | `"xs" \| "sm" \| "md"` | `"xs"` | 배지 크기 |
| `fullId` | `boolean` | `false` | 기수(`25`) 대신 학번 전체(`25-059`)를 적습니다. 동명이인을 가려야 하는 자리에 씁니다 (Trade 학생 고르기) |
| `buzz` | `boolean` | `false` | 검색어와 맞는 사람 — 진한 면 + 그림자 + 잠깐 떨림 |
| `onClick` | `() => void` | - | 클릭 핸들러 (있으면 cursor-pointer) |

## 표시 형식
```
"25 홍길동"  (연도 앞 두 자리 + 공백 + 이름)
```

## 색상 매핑 (getStudentColor)
| 학번 | 색상 | Hex |
|------|------|-----|
| 23 | Purple | `#7828C8` |
| 24 | Orange | `#FC8200` |
| 25 | Green | `#00B327` |
| 26 | Cyan | `#00B5E7` |
| 기타 | Black | `#000000` |

## 적용 스타일
칠은 funky-ui 가 맡습니다. `color` 하나를 받아 테두리·옅은 면·글자가 함께 그 색이 됩니다.

## 사용 예시
```tsx
// 기본 배지
<StudentBadge studentId="25-001" studentName="홍길동" />

// 클릭으로 제거 (AnalysisPage compare)
<StudentBadge
  studentId={id}
  studentName={name}
  onClick={() => removeStudent(id)}
/>
```

## 호버 효과는 없습니다

⚠️ 배지는 **늘어놓고 읽는 물건**이라, 마우스가 지나가는 자리마다 커지면 정작 움직여야
할 것(검색어와 맞는 배지의 진동 — `SectionCard`)이 그 소음에 묻힙니다.

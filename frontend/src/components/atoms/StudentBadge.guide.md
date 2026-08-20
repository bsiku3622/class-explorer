# StudentBadge Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
학번에 따라 자동으로 색상이 적용되는 학생 배지.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `studentId` | `string` | 필수 | 학번 (예: `"25-001"`) |
| `studentName` | `string` | 필수 | 학생 이름 |
| `size` | `"xs" \| "sm" \| "md"` | `"sm"` | 배지 크기 |
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
```
border-2 border-[color]
bg-[color]/15
text-[color]
font-black text-[10px]  (xs)
font-black text-xs      (sm)
font-black text-sm      (md)
px-2 py-0.5
```

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
할 것(검색어와 맞는 배지의 진동 — `SectionCard`)이 그 소음에 묻힙니다. 누를 때 눌리는
느낌(`active:scale-95`)만 남깁니다.

# hooks/useModifierKey.ts Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
Cmd(Mac) 또는 Ctrl(Windows/Linux) 키 누름 상태를 실시간 감지하는 훅.

## 시그니처
```ts
const isModifierPressed: boolean = useModifierKey()
```

## 동작
- `keydown` 이벤트에서 `e.metaKey` 또는 `e.ctrlKey` 감지 → `true`
- `keyup` 이벤트에서 두 키 모두 떼면 → `false`
- 언마운트 시 이벤트 리스너 자동 정리

## 사용처
| 위치 | 용도 |
|------|------|
| `App.tsx` | `isModifierPressed`를 `SearchPage`로 전달 |
| `SectionCard.tsx` | 학생 배지 Tooltip 노출 조건 |
| `TimetableGrid.tsx` (Compare) | 셀 Tooltip 노출 조건 |

## 설계 의도
Modifier 키를 누를 때만 Tooltip을 노출해 기본 UI를 깔끔하게 유지합니다.
```tsx
// SectionCard 예시
<Tooltip isDisabled={!isModifierPressed} content={...}>
```

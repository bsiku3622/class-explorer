# RetroStatItem Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
label + 큰 숫자 + unit 형태의 통계 표시 컴포넌트.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | `string` | 필수 | 상단 레이블 |
| `value` | `number \| string` | 필수 | 표시 숫자 |
| `unit` | `string` | `""` | 숫자 뒤 단위 |
| `size` | `"sm" \| "lg"` | `"lg"` | 숫자 크기 |

## 스타일
```
label:  text-xs font-bold text-black/40 uppercase
value (lg):  text-4xl font-black
value (sm):  text-2xl font-black
unit:   text-sm font-bold text-black/40
```

## 사용 예시
```tsx
// StatsCards에서
<RetroStatItem label="SUBJECTS" value={42} size="lg" />
<RetroStatItem label="SECTIONS" value={126} unit="개" size="sm" />
```

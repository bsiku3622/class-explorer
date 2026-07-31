# RetroCard Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
테두리 + 하드 쉐도우가 있는 컨테이너. 레이아웃 카드의 기본 단위.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `shadow` | `"sm" \| "md" \| "lg"` | `"md"` | 쉐도우 크기 |
| `className` | `string` | - | 추가 클래스 (배경색 등) |
| `children` | `ReactNode` | - | 내용 |

## 쉐도우 크기
```
sm: shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]
md: shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]
lg: shadow-[8px_8px_0_0_rgba(0,0,0,0.2)]
```

## 기본 스타일
- `border-2 border-black` 항상 적용
- 배경색 없음 → `className`으로 직접 지정 필요

## 사용 예시
```tsx
// 흰 배경 카드
<RetroCard className="bg-white p-4">내용</RetroCard>

// 작은 쉐도우
<RetroCard shadow="sm" className="bg-retro-accent-light p-3">내용</RetroCard>

// StatsCards에서
<RetroCard className="bg-retro-primary/10 p-6 flex flex-col gap-2">
  <RetroStatItem label="Subjects" value={42} />
</RetroCard>
```

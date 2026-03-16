# constants/motion.ts Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
Framer Motion 애니메이션 설정 상수 모음.

## `tooltipMotionProps`
HeroUI `<Tooltip>`의 `motionProps`에 전달하는 설정.
```ts
tooltipMotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.1 }
}
```
- opacity 전환만 사용 (위치 이동 없음)
- 즉각적인 반응: 100ms 전환

## 사용처
```tsx
// TimetableGrid, AnalysisPage 내 <Tooltip>
<Tooltip motionProps={tooltipMotionProps} ...>
```

# index.css Guide

> [← Frontend Guide](../CLAUDE.md) | 디자인 규칙: [design-guide.md](../../design-guide.md)

## 역할
Tailwind v4 테마 정의 + 전역 스타일 + HeroUI 오버라이드.

## 섹션별 설명

### 폰트 임포트
```css
@import url('Pretendard Variable CDN');
font-family: 'Pretendard Variable', Pretendard, system-ui, sans-serif;
```

### @theme (Tailwind v4 커스텀 토큰)
```css
@theme {
  --color-retro-bg: #f8f5f0;
  --color-retro-fg: #000000;
  --color-retro-primary: #ff3e3e;
  --color-retro-secondary: #1a1a1a;
  --color-retro-accent-light: #fdf6e3;
  --color-retro-green: #22c55e;
}
```
→ `bg-retro-bg`, `text-retro-primary` 등으로 사용 가능

### 커스텀 쉐도우 유틸리티
```css
.shadow-retro    { box-shadow: 4px 4px 0 0 rgba(0,0,0,0.2); }
.shadow-retro-lg { box-shadow: 6px 6px 0 0 rgba(0,0,0,0.2); }
```

### HeroUI 전역 오버라이드
```css
[data-slot="base"] { border-radius: 0 !important; }
```
모든 HeroUI 컴포넌트 모서리를 직각으로 강제 변환 (레트로 스타일 유지)

### 학생 배지 스타일
```css
.student-badge-{year} {
  border-color: var(--color-year);
  background-color: color-mix(in srgb, var(--color-year) 15%, transparent);
  color: var(--color-year);
}
```

## 주의사항
- `@custom-variant`, `@theme`, `@apply` 구문은 Tailwind v4 전용 → LSP에서 경고 발생하나 정상 동작
- `index.css`에 직접 컴포넌트 스타일 추가 금지 (원자 컴포넌트 사용)

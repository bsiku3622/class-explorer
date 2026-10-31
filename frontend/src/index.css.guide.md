# index.css Guide

> [← Frontend Guide](../CLAUDE.md) | 디자인 규칙: [design-guide.md](../design-guide.md)

CSS 레이어 순서 + 폰트 + Tailwind. **색과 그림자는 여기 없습니다** — funky-ui 의 토큰이 원본입니다.

## 무엇이 들어 있나

| 블록 | 내용 |
|---|---|
| `@layer theme, base, fk, components, utilities;` | 레이어 순서. preflight < funky-ui < Tailwind 유틸리티 |
| `@import` | Pretendard Variable (CDN) + `tailwindcss` |
| `@custom-variant dark` | `.dark` 하위에서 켜지는 변형 (아직 쓰는 곳 없음) |
| `@theme` | `--font-sans` 하나 |
| `::view-transition-group(ask-composer)` | 모바일 Ask 창 → `/ai` 전환에서 입력창이 내려앉는 시간 (`lib/askMotion.ts`) |

## 손대면 안 되는 것

⚠️ **맨 위의 `@layer` 선언.** `fk` 가 `base` 앞에 서면 preflight 의 `padding: 0`·`border: 0` 이 funky 의 여백·테두리를
전부 지우고, `utilities` 뒤에 서면 `className="mt-4"` 가 funky 에 집니다. 레이어 순서는 처음 선언된 대로 굳으므로
`main.tsx` 도 이 파일을 funky 의 `styles.css` 보다 **먼저** import 합니다.

## 주의사항

- `@theme`·`@custom-variant`·`@apply` 는 Tailwind v4 구문이라 **LSP 경고가 정상**입니다.
  고치려 들지 마세요
- **컴포넌트 스타일을 여기 추가하지 않습니다.** 전역 클래스는 어디서 쓰이는지 추적이 안 됩니다.
  빠진 모양은 funky-ui 에 더하세요. 예외는 **부품으로 표현할 수 없는 것**(뷰 전환, 서드파티 오버라이드)뿐입니다

# index.css Guide

> [← Frontend Guide](../CLAUDE.md) | 디자인 규칙: [design-guide.md](../design-guide.md)

Tailwind v4 테마 정의 + 전역 스타일 + HeroUI 오버라이드.

⚠️ **값은 여기 베껴 적지 않습니다.** 한동안 색 토큰이 `index.css`·`design-guide.md`·
이 파일 세 군데에 각각 적혀 있었고, 셋이 전부 다른 값을 말하고 있었습니다. 실제 값은
`index.css` 를 열어 보고, 뜻과 쓰임은 [design-guide.md](../design-guide.md) 의 색상
토큰 표를 보세요.

## 무엇이 들어 있나

| 블록 | 내용 |
|---|---|
| `@import` | Pretendard Variable (CDN) + `tailwindcss` |
| `@custom-variant dark` | `.dark` 하위에서 켜지는 변형 (아직 쓰는 곳 없음) |
| `@theme` | `--color-retro-*` 색 토큰과 `--font-sans`. 여기가 **색의 원본**입니다 |
| `body` | `bg-retro-bg text-retro-fg` |
| `.shadow-retro` / `-lg` | 하드 그림자 유틸 (`#000`, blur 0) |
| `[data-slot=…]` | HeroUI 모서리를 직각으로 누르는 오버라이드 |
| `.student-badge` | 학번 배지 공통 스타일 |
| `@keyframes marquee-swing` | 넘치는 한 줄을 좌우로 훑는 애니메이션 (`MarqueeText`) |
| `@keyframes badge-buzz` | 검색어와 맞는 학생 배지가 **짧게 진동**(좌우 ±1.5px, 앞 20%만 떨고 나머지는 쉽니다 — 계속 떨면 옆을 못 읽습니다) (`SectionCard`). ⚠️ `transform` 이 아니라 **`translate` 속성**을 씁니다 — 배지의 `hover:scale-105` 가 `scale` 을 쓰므로 같은 `transform` 에 얹으면 하나가 지워집니다 |

## 손대면 안 되는 것

**HeroUI 오버라이드** — `base`·`trigger`·`content`·`input-wrapper` 네 slot 을 한꺼번에
`rounded-none! border!` 로 누릅니다. 빼면 앱 곳곳의 드롭다운·인풋만 둥글어집니다.

**`@keyframes marquee-swing` 의 `--marquee-shift`/`--marquee-duration`** — 값은
`MarqueeText` 가 요소마다 인라인으로 넣습니다. 여기서 기본값을 주면 넘치지 않는
문장까지 움직입니다.

## 주의사항

- `@theme`·`@custom-variant`·`@apply` 는 Tailwind v4 구문이라 **LSP 경고가 정상**입니다.
  고치려 들지 마세요
- **컴포넌트 스타일을 여기 추가하지 않습니다.** 원자 컴포넌트(`components/atoms/`)를
  쓰거나 만드세요 — 전역 클래스는 어디서 쓰이는지 추적이 안 됩니다.
  예외는 위 표의 것들처럼 **Tailwind 로 표현할 수 없는 것**(키프레임, 서드파티
  오버라이드)뿐입니다

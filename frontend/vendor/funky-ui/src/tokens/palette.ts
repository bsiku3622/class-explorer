/**
 * Palette — funky-ui 의 hex 가 사는 **유일한** 파일입니다.
 *
 * 다른 파일은 여기서 고르기만 합니다. 색을 바꾸려면 이 파일을 고치고, 바꾼 값이 아래
 * 대비 주석과 맞는지 다시 잽니다 (`docs/foundations/color.md` 의 사다리 규칙).
 *
 * 값은 **빌드 전에 손으로 확정한 hex** 입니다. 런타임에 색을 계산하지 않습니다 — 사다리는
 * OKLCH 명도만 내려 대비 목표를 맞추는 규칙으로 뽑았고, 결과를 그대로 적었습니다.
 */

/** 흑백과 크림 — 면 · 글자 · 선이 여기서 나옵니다 */
export const NEUTRALS = {
  white: "#ffffff",
  /** 페이지 바탕. 순백이 아니라 크림이 첫 번째 인장입니다 */
  cream: "#fff5d1",
  /** 크림 위의 오목한 자리 */
  creamDeep: "#fff0b8",
  /** 본문 글자. 테두리는 이게 아니라 `black` 입니다 */
  ink: "#222222",
  /** 보조 글자 (크림 위 8.3:1) */
  inkSecondary: "#4d4d4d",
  /** 약한 글자 — 크림 위 4.60 · 흰 면 5.02, AA 를 지키는 가장 옅은 회색 */
  gray: "#6f6f6f",
  /** 약한 선 · 옅은 면 — 흰 면 대비 1.35 */
  grayLight: "#cccccc",
  /** 선 · 반전 면. 굵은 선은 완전한 검정일 때만 섭니다 */
  black: "#000000",
} as const;

/** 네온 여덟 — 크림 위 고채도가 두 번째 인장입니다 */
export const NEONS = {
  pink: "#ff4eba",
  purple: "#7828c8",
  cyan: "#3decfd",
  yellow: "#ffd500",
  orange: "#ff9100",
  sky: "#00c8ff",
  green: "#00c22a",
  red: "#ff3b3b",
} as const;

/**
 * Accent 사다리 — accent 하나가 다섯 칸을 갖습니다.
 *
 * | 칸 | 쓰는 곳 | 규칙 |
 * | --- | --- | --- |
 * | `ink` | Solid 면 위 글자 | 검정(#222)과 흰색 중 대비가 높은 쪽 (WCAG) |
 * | `solidInk` | 진한 글자 | 크림 위 7:1 이상, 그리고 `softInk` 대비의 1.5배 이상 |
 * | `solid` | 진한 면 · 테두리 | 네온 원색 그대로 |
 * | `soft` | 연한 면 · 테두리 | 흰 면 대비 1.35 가 되도록 원색을 흰색에 섞음 |
 * | `softInk` | 연한 글자 | 크림 위 AA(4.5:1)를 넘는 가장 밝은 단계 |
 *
 * 괄호 안은 크림(#fff5d1) 위 대비입니다.
 */
export const LADDER = {
  black: {
    ink: NEUTRALS.white, //  21.00 (검정 위)
    solidInk: NEUTRALS.ink, // 14.57
    solid: NEUTRALS.black,
    soft: NEUTRALS.grayLight,
    softInk: NEUTRALS.gray, // 4.60
  },
  pink: {
    ink: NEUTRALS.ink, // 5.34 (핑크 위)
    solidInk: "#a0006e", // 7.07
    solid: NEONS.pink,
    soft: "#ffcfec",
    softInk: "#d01091", // 4.62
  },
  purple: {
    ink: NEUTRALS.white, // 7.15 (보라 위) — 검정 글자는 2.2:1 이라 흰색
    solidInk: "#5b009f", // 9.89 — 원색이 이미 AA 라 softInk 와 갈라지도록 한 단 더 내렸습니다
    solid: NEONS.purple,
    soft: "#e4d4f4",
    softInk: NEONS.purple, // 6.55
  },
  cyan: {
    ink: NEUTRALS.ink, // 11.07
    solidInk: "#055c63", // 7.08
    solid: NEONS.cyan,
    soft: "#77f2fe",
    softInk: "#037b85", // 4.61
  },
  yellow: {
    ink: NEUTRALS.ink, // 11.19
    solidInk: "#635204", // 7.02
    solid: NEONS.yellow,
    soft: "#ffe24d",
    softInk: "#836d06", // 4.63
  },
  orange: {
    ink: NEUTRALS.ink, // 7.05
    solidInk: "#7e4501", // 7.02
    solid: NEONS.orange,
    soft: "#ffd7a3",
    softInk: "#a55c03", // 4.65
  },
  sky: {
    ink: NEUTRALS.ink, // 8.11
    solidInk: "#025a75", // 7.07
    solid: NEONS.sky,
    soft: "#99e9ff",
    softInk: "#06789a", // 4.62
  },
  green: {
    ink: NEUTRALS.ink, // 6.63
    solidInk: "#006110", // 7.08
    solid: NEONS.green,
    soft: "#adebbb",
    softInk: "#03811a", // 4.62
  },
  red: {
    ink: NEUTRALS.ink, // 4.50
    solidInk: "#aa0113", // 7.06
    solid: NEONS.red,
    soft: "#ffd2d2",
    softInk: "#df041d", // 4.61
  },
} as const;

/** `#rrggbb` → `rgba(r, g, b, a)` — 오버레이를 같은 hex 에서 꺼내기 위한 빌드타임 도구 */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

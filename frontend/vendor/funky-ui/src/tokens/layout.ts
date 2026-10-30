/**
 * Layout — 요소 **사이**의 관계: 간격 · 깊이(그림자 + z) · breakpoint · 폭.
 */
import type { Shadow, Space } from "./vocabulary";

/** 간격 사다리 (px) — 안쪽 여백(padding)과 형제 사이(gap)가 같은 사다리를 씁니다 */
export const SPACE = {
  "0": 0,
  "2xs": 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  "4xl": 32,
  "5xl": 48,
  "6xl": 64,
} as const satisfies Record<Space, number>;

/**
 * 그림자 — **두 단뿐입니다.** 떠 있는 물건은 4px, 모달만 6px. blur 는 언제나 0.
 * 계측에서 서로 다른 그림자 값이 33개였습니다. 깊이가 33단계인 화면은 없습니다.
 */
export const ELEVATION = {
  none: { offset: 0 },
  raised: { offset: 4 },
  floating: { offset: 6 },
} as const satisfies Record<Shadow, { offset: number }>;

/** 쌓는 순서 — 모달은 native `<dialog>` 의 top layer 가 맡으므로 여기 없습니다 */
export const Z = {
  base: 0,
  raised: 1,
  sticky: 100,
  dropdown: 200,
  overlay: 300,
  toast: 400,
  tooltip: 500,
} as const;

/** breakpoint (px) — Tailwind 기본과 같아 class-explorer 의 `md:` 와 어긋나지 않습니다 */
export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** 폭 (px) */
export const CONTAINER = {
  /** 읽는 글 한 단 */
  prose: 720,
  /** 모달 */
  dialog: { sm: 400, md: 512, lg: 768, xl: 1024, full: 1280 },
  /** 앱 셸 — 상단 바 높이 · 사이드바 폭 · 하단 바 높이 */
  shell: { bar: 80, sidebar: 256, bottomBar: 64 },
} as const;

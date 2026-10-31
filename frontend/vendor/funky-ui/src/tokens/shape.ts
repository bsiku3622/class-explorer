/**
 * Shape — 요소 **하나**의 형태: 선 굵기 · 모서리 · 컨트롤 크기 · 안쪽 여백 · 포커스 링.
 * 빈 캔버스에 그 요소 하나만 놓아도 남는 것은 여기, 요소 **사이**의 관계는 Layout 입니다.
 *
 * 단위는 전부 px 입니다(CSS 변수로 구울 때 rem 으로 바꿉니다 — 선과 링은 px 그대로).
 */
import type { BadgeSize, ControlSize, IconSize } from "./vocabulary";

/**
 * 선 굵기 — 모든 면의 테두리는 2px 하나입니다. `rail` 은 앱 목록의 굵은 왼쪽 띠(검색 결과의 과목 줄 ·
 * 오늘 목록의 학과 띠)에 씁니다. 사람 카드 안의 작은 띠는 테두리와 같은 2px 입니다.
 */
export const STROKE = {
  /** 표 · 격자의 안쪽 선. 바깥 틀은 `base` 입니다 */
  hair: 1,
  base: 2,
  rail: 4,
} as const;

/** 모서리 — funky 는 직각입니다. `full` 은 원이어야 뜻이 서는 것(스피너 · 점)에만 */
export const RADIUS = {
  none: 0,
  full: 9999,
} as const;

/** 분류 점 (Swatch) · 범례 칸 (ToneSwatch) — 띠의 굵기는 `STROKE.rail` 입니다 */
export const SWATCH = {
  dot: 8,
  legend: 16,
} as const;

/** 컨트롤 사다리 — 높이가 원본이고, 나머지는 그 높이에 맞춘 값입니다 */
export const CONTROL = {
  height: { xs: 28, sm: 32, md: 40, lg: 48, xl: 64 },
  /** 좌우 여백 */
  inset: { xs: 8, sm: 12, md: 16, lg: 24, xl: 40 },
  /** 아이콘과 글자 사이 */
  gap: { xs: 4, sm: 6, md: 8, lg: 8, xl: 8 },
  /** 컨트롤 안 아이콘 */
  icon: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24 },
} as const satisfies Record<string, Record<ControlSize, number>>;

/** `xl` 입력 칸의 좁은 화면 높이 */
export const FIELD_XL_NARROW = 56;

/** 배지 — 읽는 라벨이라 컨트롤보다 낮습니다 */
export const BADGE = {
  height: { sm: 18, md: 22, lg: 26, xl: 36 },
  inset: { sm: 4, md: 6, lg: 8, xl: 12 },
  font: { sm: 10, md: 11, lg: 12, xl: 14 },
  icon: { sm: 10, md: 12, lg: 14, xl: 16 },
} as const satisfies Record<string, Record<BadgeSize, number>>;

/** 배지 그림자 (px) — 컨트롤의 4px 보다 낮습니다 */
export const BADGE_SHADOW = 3;

/** 낱개 아이콘 크기 (Icon primitive) */
export const ICON = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const satisfies Record<IconSize, number>;

/** 아이콘 선 굵기 — lucide 기준. class-explorer 의 2.5 를 그대로 씁니다 */
export const ICON_STROKE = 2.5;

/** 포커스 링 — 2px 를 2px 띄웁니다. 색은 Color 의 `FOCUS` */
export const FOCUS_RING = {
  width: 2,
  offset: 2,
} as const;

/** 선택 표식 — Checkbox · Radio 상자, Switch 트랙 */
export const TOGGLE = {
  box: 18,
  track: { width: 36, height: 20 },
  thumb: 12,
} as const;

/**
 * Color — 의미 역할. 값은 전부 `palette.ts` 에서 고릅니다 (hex 를 새로 적지 않습니다).
 *
 * 흐름: palette(hex) → 이 파일(역할) → variables(CSS 변수) → styles(class)
 */
import { LADDER, NEONS, NEUTRALS, alpha } from "./palette";
import type { AccentName } from "./vocabulary";

/** 면 — 흑백 면에 이름을 붙였습니다. "회색" 이 아니라 자리의 이름입니다 */
export const SURFACE = {
  /** 페이지 바탕 (크림) */
  canvas: NEUTRALS.cream,
  /** 떠 있는 면 — 카드 · 컨트롤 (흰색) */
  raised: NEUTRALS.white,
  /** 크림 위의 오목한 자리 */
  sunken: NEUTRALS.creamDeep,
  /** 흰 면 안의 오목한 자리 — 표 머리 · 막대 홈. 반투명이라 어느 면 위에서도 한 단 내려앉습니다 */
  well: alpha(NEUTRALS.black, 0.05),
  /** 반전 면 — 선택 · 시간표 머리 */
  inverse: NEUTRALS.black,
  /**
   * 구조 면 — 상단 바 · 하단 바의 보라. 색을 고르는 요소(Paint)가 아니라 앱의 뼈대라서 accent 가 아닌 자리 이름입니다.
   * 글자는 흰색(7.15:1)이고, 그 위의 버튼은 흰 유리(Glass)입니다
   */
  brand: NEONS.purple,
} as const;

/** 글자 */
export const INK = {
  primary: NEUTRALS.ink,
  secondary: NEUTRALS.inkSecondary,
  /** AA 를 지키는 가장 옅은 글자 */
  muted: NEUTRALS.gray,
  /** 장식 · placeholder · 꺼진 자리 전용 — 필수 정보에 쓰지 않습니다 (AA 미달) */
  faint: alpha(NEUTRALS.black, 0.3),
  inverse: NEUTRALS.white,
  /** 어두운 면 위의 보조 글자 */
  inverseMuted: alpha(NEUTRALS.white, 0.6),
} as const;

/** 선 — 굵기는 Shape 가, 색은 여기가 정합니다 */
export const LINE = {
  /** 모든 카드 · 버튼의 2px 검정 */
  base: NEUTRALS.black,
  /** 약한 테두리 — Muted · Hairline 의 쉬는 상태 */
  soft: NEUTRALS.grayLight,
  /** 카드 안의 구분선 */
  subtle: alpha(NEUTRALS.black, 0.1),
  /** 어두운 면 위의 선 */
  inverse: alpha(NEUTRALS.white, 0.3),
} as const;

/**
 * Interaction — hover · press 때 면 위에 얹는 층. 면을 바꾸지 않고 **덮습니다**.
 * 그래서 밑이 크림이든 흰색이든 색면이든 같은 규칙으로 한 단 바뀝니다.
 * accent 오버레이(`tint`)는 accent 마다 따로 있어 `ACCENT_COLORS` 에 들어 있습니다.
 */
export const OVERLAY = {
  /** Filled · Solid 의 hover — 반투명 흰색 */
  hoverWhite: alpha(NEUTRALS.white, 0.3),
  /** Plain · SolidMuted 의 hover — 반투명 회색 */
  hoverGray: alpha(NEUTRALS.black, 0.07),
  pressWhite: alpha(NEUTRALS.white, 0.45),
  pressGray: alpha(NEUTRALS.black, 0.12),
  /** 모달 뒤를 덮는 막 */
  scrim: alpha(NEUTRALS.black, 0.5),
} as const;

/**
 * Glass — 색 바(상단 · 하단 바) 위의 유리 (`Glass` primitive · NavButton). 어느 바 위에서도 흰 유리입니다 —
 * 반투명 흰 면 · 흰 테두리이고, 글자색은 바에서 물려받습니다(보라 바 위 흰 글자 · 노랑 바 위 검정 글자).
 */
const currentOf = (pct: number) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;
export const GLASS = {
  bg: alpha(NEUTRALS.white, 0.1),
  bgHover: alpha(NEUTRALS.white, 0.2),
  bgSelected: alpha(NEUTRALS.white, 0.25),
  border: alpha(NEUTRALS.white, 0.3),
  borderHover: NEUTRALS.white,
} as const;

/**
 * 흑백 면의 상태 층 — Surface 의 `hoverable`. 면의 글자색을 묽혀 만들므로 밝은 면에서는 회색 층
 * (`OVERLAY.hoverGray` · `pressGray` 와 같은 세기), 검정 면(inverse) 위에서는 흰 층이 됩니다.
 */
export const STATE_LAYER = {
  hover: currentOf(7),
  press: currentOf(12),
} as const;

/** 포커스 링 — 2px 띄운 핑크 고리 하나. 기하는 Shape 의 `focus` 입니다 */
export const FOCUS = NEONS.pink;

/** 하드 그림자의 색. 거리는 Layout 의 elevation 이 정합니다 */
export const SHADOW_COLOR = alpha(NEUTRALS.black, 0.2);

/** 글자를 끌어 고를 때 */
export const SELECTION = LADDER.pink.soft;

export interface AccentColors {
  /** Solid 면 위 글자 (검정 또는 흰색) */
  ink: string;
  /** 진한 글자 */
  solidInk: string;
  /** 진한 면 · 테두리 */
  solid: string;
  /** 연한 면 · 테두리 */
  soft: string;
  /** 연한 글자 */
  softInk: string;
  /** Accent 오버레이 — Outline · Frameline 의 hover */
  tint: string;
  tintStrong: string;
}

/** accent 마다 사다리 다섯 칸 + 오버레이 두 칸. 검정은 오버레이를 회색 층과 같게 둡니다 */
export const ACCENT_COLORS = Object.fromEntries(
  Object.entries(LADDER).map(([name, rung]) => [
    name,
    {
      ...rung,
      tint: name === "black" ? OVERLAY.hoverGray : alpha(rung.solid, 0.15),
      tintStrong: name === "black" ? OVERLAY.pressGray : alpha(rung.solid, 0.26),
    },
  ]),
) as Record<AccentName, AccentColors>;

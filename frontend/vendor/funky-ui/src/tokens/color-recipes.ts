/**
 * Variant 레시피 — 15 variant 가 accent 사다리의 어느 칸을 글자 · 면 · 테두리에 쓰고,
 * hover 때 무엇이 바뀌는지. 숫자도 hex 도 없고 **칸 이름만** 있습니다.
 *
 * 그래서 accent 를 바꾸면 variant 규칙은 그대로 둔 채 색만 바뀝니다 (accent × variant).
 */
import type { Variant } from "./vocabulary";

/**
 * 칸 이름.
 * - accent 사다리: `ink` · `solidInk` · `solid` · `soft` · `softInk`
 * - accent 와 무관한 시스템 값: `black`(본문 잉크 #222) · `gray`(약한 글자) · `line`(2px 검정) · `white`(떠 있는 흰 면) · `none`(투명)
 */
export type Rung = "ink" | "solidInk" | "solid" | "soft" | "softInk" | "black" | "gray" | "line" | "white" | "none";

/** hover 때 면 위에 얹는 층 */
export type Layer = "white" | "gray" | "tint" | "none";

export interface VariantRecipe {
  fg: Rung;
  bg: Rung;
  border: Rung;
  /** hover — 적지 않은 칸은 쉬는 상태 그대로입니다 */
  hover: { layer?: Layer; fg?: Rung; border?: Rung };
}

/**
 * 표의 출처는 재원님의 Accent × Variant 스케치(2026-10-29)입니다. 이름은 2026-10-30 에 바꿨습니다 —
 * 스케치의 Solid(면과 같은 색 테두리)는 `filled`, Tonal(면 + 검정 테두리)은 `solid`, TonalMuted 는 `solidMuted`
 * 입니다. 한 군데만 해석을 더했습니다:
 *
 * - **solid 의 글자는 `ink`** 입니다. 표에는 Black 이라 적혀 있는데, 밝은 accent 에서는 ink 가
 *   곧 검정이라 같은 값이고, 보라처럼 ink 가 흰색인 accent 에서는 검정 글자가 2.2:1 로 읽히지
 *   않아 흰색으로 둡니다. 테두리 Ink 는 선이므로 `line`(#000)입니다.
 *   → solid = filled 면 + 검정 테두리.
 *
 * `paper` 만 스케치 밖에서 더했습니다(2026-10-30, 재원님 결정). 스케치의 `outline` 은 면이 투명해서 class-explorer 에서 가장
 * 많이 쓰는 흰 버튼을 크림 위에서 그릴 수 없습니다 — 흰 면 + 검정 테두리이고, 글자는 `solidInk` 입니다. 검정 accent 의 solidInk 가
 * 본문 잉크(#222)라 기본은 검정 글자이고, accent 를 주면 그 색의 글자가 됩니다(Ask 플로팅 버튼의 흰 면 + 보라 아이콘).
 *
 * `tinted` · `wash` · `ghostTint` 도 스케치 밖입니다(class-explorer 대조 2026-10-31). `tinted` 는 연한 면 + 색 테두리 + 검정 글자(교육과정 노드 ·
 * 분반 칸), `wash` 는 테두리 없는 연한 면(달력 칩 · 하이라이트), `ghostTint` 는 쉴 때 투명하다가 hover 때 accent 층이 깔리는 무테 칸(목록 줄)입니다.
 */
export const VARIANT_RECIPES = {
  filled: { fg: "ink", bg: "solid", border: "solid", hover: { layer: "white" } },
  outline: { fg: "solidInk", bg: "none", border: "solid", hover: { layer: "tint" } },
  hairline: { fg: "solidInk", bg: "none", border: "soft", hover: { border: "solid" } },
  frameline: { fg: "black", bg: "none", border: "solid", hover: { layer: "tint" } },
  framelineMuted: { fg: "gray", bg: "none", border: "solid", hover: { layer: "tint" } },
  plain: { fg: "solidInk", bg: "soft", border: "solid", hover: { layer: "gray" } },
  solid: { fg: "ink", bg: "solid", border: "line", hover: { layer: "white" } },
  solidMuted: { fg: "black", bg: "soft", border: "line", hover: { layer: "gray" } },
  muted: { fg: "softInk", bg: "none", border: "soft", hover: { border: "solid", fg: "solidInk" } },
  ghost: { fg: "solidInk", bg: "none", border: "none", hover: { fg: "softInk" } },
  ghostMuted: { fg: "softInk", bg: "none", border: "none", hover: { fg: "solidInk" } },
  paper: { fg: "solidInk", bg: "white", border: "line", hover: { layer: "tint" } },
  tinted: { fg: "black", bg: "soft", border: "solid", hover: { layer: "gray" } },
  wash: { fg: "solidInk", bg: "soft", border: "none", hover: { layer: "gray" } },
  ghostTint: { fg: "solidInk", bg: "none", border: "none", hover: { layer: "tint" } },
} as const satisfies Record<Variant, VariantRecipe>;

/** 선택된 컨트롤은 같은 accent 의 이 variant 로 바뀝니다 — 색이 "골랐다" 를 말합니다 */
export const SELECTED_VARIANT: Variant = "filled";

/** 테두리가 없는 variant — 그림자를 받지 않습니다 (가라앉을 상자가 없습니다) */
export const BORDERLESS_VARIANTS: readonly Variant[] = ["ghost", "ghostMuted", "wash", "ghostTint"];

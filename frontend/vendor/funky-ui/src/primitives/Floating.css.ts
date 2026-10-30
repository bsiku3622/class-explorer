/** 떠 있는 판의 층 (fk.primitives) — 쌓는 순서만 정합니다. 면 · 테두리 · 그림자는 Surface, 등장은 styles/enter */
import { style, styleVariants } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { Z } from "../tokens/layout";
import { vars } from "../tokens/variables";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });

/** 판 뒤의 막 — 뒤 화면을 어둡게 하고 누름을 받아 줍니다. 판과 같은 층이고 DOM 이 앞이라 판 뒤에 섭니다 */
export const floatingScrim = style(p({ position: "fixed", inset: 0, zIndex: Z.dropdown, backgroundColor: vars.overlay.scrim }));

export const floatingLayer = styleVariants({
  dropdown: p({ zIndex: Z.dropdown }),
  tooltip: p({ zIndex: Z.tooltip }),
});

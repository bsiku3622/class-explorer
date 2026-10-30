import { styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { RADIUS, SWATCH } from "../tokens/shape";
import { px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import type { SwatchRung, SwatchShape } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });
const dot = { display: "inline-block", flexShrink: 0, width: px(SWATCH.dot), height: px(SWATCH.dot) };

export const swatchShape = styleVariants({
  dot: c(dot),
  round: c({ ...dot, borderRadius: RADIUS.full }),
  rail: c({ flexShrink: 0, alignSelf: "stretch", width: vars.stroke.rail }),
} satisfies Record<SwatchShape, object>);

export const swatchRung = styleVariants({
  solid: c({ backgroundColor: vars.accent.solid }),
  softInk: c({ backgroundColor: vars.accent.softInk }),
  soft: c({ backgroundColor: vars.accent.soft }),
} satisfies Record<SwatchRung, object>);

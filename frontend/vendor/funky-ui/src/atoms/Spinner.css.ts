import { style, styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { RADIUS } from "../tokens/shape";
import { px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

/** 원이어야 뜻이 서는 몇 안 되는 자리라 radius full 을 씁니다 */
export const spinner = style(
  c({
    position: "relative",
    display: "inline-block",
    flexShrink: 0,
    borderRadius: RADIUS.full,
    border: `${vars.stroke.base} solid transparent`,
    borderTopColor: "currentColor",
    animation: "fk-spin 900ms linear infinite",
    "::before": {
      content: '""',
      position: "absolute",
      inset: `calc(-1 * ${vars.stroke.base})`,
      borderRadius: "inherit",
      border: `${vars.stroke.base} solid currentColor`,
      opacity: 0.2,
    },
  }),
);

export const spinnerSize = styleVariants({ sm: 14, md: 18, lg: 24 }, (n) => c({ width: px(n), height: px(n) }));

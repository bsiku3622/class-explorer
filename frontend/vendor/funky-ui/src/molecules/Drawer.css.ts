import { style, styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { Z } from "../tokens/layout";
import { vars } from "../tokens/variables";
import type { DrawerSide } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const drawer = style(
  c({
    position: "fixed",
    zIndex: Z.overlay,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    boxShadow: vars.shadow.raised,
    transitionProperty: "transform",
    transitionDuration: vars.duration.base,
    transitionTimingFunction: vars.easing.standard,
  }),
);

export const drawerSide = styleVariants({
  right: c({ top: 0, right: 0, bottom: 0 }),
  left: c({ top: 0, left: 0, bottom: 0 }),
  bottom: c({ left: 0, right: 0, bottom: 0 }),
} satisfies Record<DrawerSide, object>);

/** 닫힌 자리 — 판이 가장자리 밖으로 나갑니다. 손잡이는 판 바깥에 붙어 있어 화면에 남습니다 */
export const drawerClosed = styleVariants({
  right: c({ transform: "translateX(100%)", boxShadow: "none" }),
  left: c({ transform: "translateX(-100%)", boxShadow: "none" }),
  bottom: c({ transform: "translateY(100%)", boxShadow: "none" }),
} satisfies Record<DrawerSide, object>);

export const drawerBody = style(c({ flex: 1, minHeight: 0, overflowY: "auto" }));

export const drawerHandle = styleVariants({
  right: c({ position: "absolute", top: "50%", right: "100%", transform: "translateY(-50%)" }),
  left: c({ position: "absolute", top: "50%", left: "100%", transform: "translateY(-50%)" }),
  bottom: c({ position: "absolute", left: "50%", bottom: "100%", transform: "translateX(-50%)" }),
} satisfies Record<DrawerSide, object>);

import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { BREAKPOINT, CONTAINER, SPACE, Z } from "../tokens/layout";
import { TEXT_ROLES, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });
const md = `(min-width: ${BREAKPOINT.md}px)`;

/* ── AppBar ─────────────────────────────────────────────────────────── */

export const appBar = style(
  c({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: px(SPACE.xl),
    height: px(CONTAINER.shell.bar),
    paddingInline: px(SPACE["3xl"]),
    // 면은 Surface(brand)가 칠하고, 테두리는 아래 한 줄 · 그림자는 아래로만 둡니다
    borderBottom: `${vars.stroke.base} solid ${vars.line.base}`,
    boxShadow: `0 ${vars.press.sink} 0 0 ${vars.shadowColor}`,
  }),
);
export const appBarFixed = style(c({ position: "fixed", top: 0, left: 0, right: 0, zIndex: Z.sticky }));
/**
 * 오른쪽 끝 자리 — 폭이 모자라면 로고를 덮지 않고 이 자리만 가로로 스크롤됩니다. 바 쪽이 space-between
 * 으로 오른쪽에 밀어 두므로 안쪽은 start 정렬입니다 (end 정렬이면 넘친 앞부분에 닿을 수 없습니다).
 */
export const appBarActions = style(
  c({
    display: "flex",
    alignItems: "center",
    gap: px(SPACE.lg),
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
    paddingBlock: px(SPACE.xs),
  }),
);

/* ── SideNav ────────────────────────────────────────────────────────── */

export const sideNav = style(
  c({
    display: "flex",
    flexDirection: "column",
    width: px(CONTAINER.shell.sidebar),
    borderRight: `${vars.stroke.base} solid ${vars.line.base}`,
  }),
);
export const sideNavFixed = style(
  c({
    position: "fixed",
    top: px(CONTAINER.shell.bar),
    bottom: 0,
    left: 0,
    zIndex: Z.sticky - 1,
    display: "none",
    "@media": { [md]: { display: "flex" } },
  }),
);
export const sideNavBody = style(c({ flex: 1, minHeight: 0, overflowY: "auto", padding: px(SPACE["3xl"]) }));
/** 위쪽 틈 — 메뉴는 이 위에서 스크롤로 잘립니다. 틈이 없으면 잘린 검은 줄이 상태 카드의 테두리처럼 붙어 보입니다 */
export const sideNavFooter = style(c({ padding: px(SPACE["3xl"]), paddingTop: px(SPACE.lg) }));
export const sideSection = style(c({ display: "flex", flexDirection: "column", gap: px(SPACE.xs), marginBottom: px(SPACE["3xl"]) }));
export const sideSectionLabel = style(
  c({
    margin: 0,
    marginBottom: px(SPACE.xs),
    paddingInline: px(SPACE.xs),
    fontSize: px(TEXT_ROLES.overline.size),
    lineHeight: px(15),
    fontWeight: WEIGHT.black,
    letterSpacing: em(0.2),
    textTransform: "uppercase",
    color: vars.ink.muted,
  }),
);

export const sideItem = style(
  c({
    display: "flex",
    alignItems: "center",
    gap: px(SPACE.lg),
    width: "100%",
    paddingInline: px(SPACE.xl),
    paddingBlock: px(SPACE.lg),
    fontSize: px(TEXT_ROLES.body.size),
    fontWeight: WEIGHT.black,
    letterSpacing: em(-0.025),
    textTransform: "uppercase",
    textAlign: "start",
    selectors: { "&:not([aria-current])": { color: vars.ink.secondary } },
  }),
);

/* ── BottomNav ──────────────────────────────────────────────────────── */

export const bottomNav = style(
  c({
    display: "flex",
    alignItems: "stretch",
    height: px(CONTAINER.shell.bottomBar),
    // 면은 Surface(brand)가 칠하고, 테두리는 위 한 줄 · 그림자는 위로만 둡니다
    borderTop: `${vars.stroke.base} solid ${vars.line.base}`,
    boxShadow: `0 calc(-1 * ${vars.press.sink}) 0 0 ${vars.shadowColor}`,
  }),
);
export const bottomNavFixed = style(
  c({ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z.sticky, "@media": { [md]: { display: "none" } } }),
);

export const bottomItem = style(
  c({
    flex: "1 1 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: px(SPACE.xs),
    padding: 0,
    border: 0,
    borderTop: `${vars.stroke.base} solid transparent`,
    background: "none",
    // 글자는 바(brand 면의 흰 글자)에서 물려받고, 안 골린 칸은 묽힙니다
    color: "inherit",
    opacity: 0.6,
    selectors: { "&:hover": { opacity: 0.85 } },
  }),
);
export const bottomItemActive = style(c({ opacity: 1, borderTopColor: "currentColor", selectors: { "&:hover": { opacity: 1 } } }));
export const bottomItemLabel = style(
  c({ fontSize: px(9), lineHeight: 1, fontWeight: WEIGHT.black, letterSpacing: em(-0.025), textTransform: "uppercase" }),
);

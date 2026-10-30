import { style, styleVariants } from "@vanilla-extract/css";

import { ACCENT_COLORS } from "../tokens/color";
import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { TEXT_ROLES, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import { TONE_VAR } from "./tone";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });
const tone = `var(${TONE_VAR}, ${vars.ink.primary})`;

export const tile = style(
  c({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: px(SPACE["2xs"]),
    minWidth: 0,
    height: "100%",
    paddingInline: px(SPACE.md),
    paddingBlock: px(SPACE.xs),
    border: `${vars.stroke.base} solid ${tone}`,
    backgroundColor: `color-mix(in srgb, ${tone} 12%, ${vars.surface.raised})`,
    color: tone,
    overflow: "hidden",
  }),
);

export const tileState = styleVariants({
  upcoming: c({}),
  /** 지금 — 핑크 사다리의 Plain 문법 (soft 면 · solid 테두리 · solidInk 글자) */
  now: c({ backgroundColor: ACCENT_COLORS.pink.soft, color: ACCENT_COLORS.pink.solidInk }),
  past: c({ opacity: 0.4 }),
  free: c({ borderStyle: "dashed", borderColor: vars.line.soft, backgroundColor: "transparent", color: vars.ink.faint }),
  /** 밖에서 지목한 칸 — 면을 진하게 하고 테두리를 안쪽으로 한 겹 더 두릅니다 (Trade 의 고른 분반) */
  focus: c({ backgroundColor: `color-mix(in srgb, ${tone} 35%, ${vars.surface.raised})`, boxShadow: `inset 0 0 0 ${vars.stroke.base} ${tone}` }),
  /** 지목한 칸 말고 나머지 */
  dim: c({ opacity: 0.2 }),
});

/** 누르는 칸 — 버튼으로 그려도 칸처럼 섭니다. hover 때 테두리가 안쪽으로 번집니다 */
export const tilePress = style(
  c({
    width: "100%",
    textAlign: "start",
    transitionProperty: "box-shadow, opacity, background-color",
    transitionDuration: vars.duration.fast,
    selectors: { "&:hover:not(:disabled)": { boxShadow: `inset 0 0 0 ${vars.stroke.base} ${tone}` } },
  }),
);

/** 과목명을 두 줄까지 — 넘치면 자릅니다 */
export const tileTitleClamp = style(
  c({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    whiteSpace: "normal",
  }),
);
/** 아래 줄 정보를 줄바꿈합니다 — 교사 · 교실이 여러 줄인 칸 */
export const tileMetaWrap = style(c({ whiteSpace: "normal" }));

export const tileTitle = style(
  c({
    fontSize: px(TEXT_ROLES.small.size),
    lineHeight: 1.2,
    fontWeight: WEIGHT.black,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
);
export const tileMeta = style(
  c({
    fontSize: px(TEXT_ROLES.micro.size),
    lineHeight: px(TEXT_ROLES.micro.leading),
    fontWeight: WEIGHT.bold,
    color: vars.ink.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
);

/* ── TimetableGrid ──────────────────────────────────────────────────── */

const head = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingBlock: px(SPACE.md),
  fontSize: px(TEXT_ROLES.micro.size),
  fontWeight: WEIGHT.black,
  letterSpacing: em(0.1),
  textTransform: "uppercase" as const,
};

export const grid = style(
  c({
    display: "grid",
    minWidth: 0,
  }),
);
export const gridCorner = style(c({ ...head, backgroundColor: vars.surface.inverse, color: vars.ink.inverseMuted }));
export const gridDay = style(
  c({ ...head, backgroundColor: vars.surface.inverse, color: vars.ink.inverse, borderLeft: `${vars.stroke.base} solid ${vars.line.inverse}` }),
);
export const gridDayToday = style(c({ backgroundColor: vars.surface.raised, color: vars.ink.primary }));
export const gridPeriod = style(
  c({ ...head, backgroundColor: vars.surface.well, color: vars.ink.primary, borderTop: `${vars.stroke.base} solid ${vars.line.subtle}` }),
);
export const gridCell = style(
  c({
    minWidth: 0,
    minHeight: px(48),
    padding: px(SPACE.xs),
    borderTop: `${vars.stroke.base} solid ${vars.line.subtle}`,
    borderLeft: `${vars.stroke.base} solid ${vars.line.subtle}`,
  }),
);
/** 칸을 가장자리까지 채웁니다 — 상태 면으로 칠하는 격자(`SlotCell`) */
export const gridCellFlush = style(c({ padding: 0 }));
/** 교시 사이의 띠 행 — 요일 열 전체를 잇습니다 */
export const gridBand = style(c({ gridColumn: "2 / -1", minWidth: 0, borderTop: `${vars.stroke.base} solid ${vars.line.subtle}`, borderLeft: `${vars.stroke.base} solid ${vars.line.subtle}` }));

/* ── BreakBand ──────────────────────────────────────────────────────── */

const HATCH = `repeating-linear-gradient(45deg, ${vars.line.subtle} 0 ${vars.stroke.base}, transparent ${vars.stroke.base} ${px(SPACE.md)})`;

/** 수업이 없는 시간 — 빗금 면에 이름 라벨. 높이는 쓰는 쪽이 분에 비례해 줍니다 */
export const breakBand = style(
  c({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    height: "100%",
    minHeight: px(SPACE.xl),
    backgroundImage: HATCH,
    backgroundColor: vars.surface.well,
    color: vars.ink.muted,
    fontSize: px(TEXT_ROLES.micro.size),
    lineHeight: px(TEXT_ROLES.micro.leading),
    fontWeight: WEIGHT.black,
    letterSpacing: em(0.1),
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
  }),
);

/* ── TimeCaret ──────────────────────────────────────────────────────── */

/** 지금을 짚는 선 — 시간이 흐르면 천천히 옮겨 갑니다(`crawl`). 부모가 `position: relative` 입니다 */
export const timeCaret = style(
  c({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 0,
    borderLeft: `${vars.stroke.base} solid ${vars.line.base}`,
    zIndex: 1,
    pointerEvents: "none",
    transitionProperty: "left",
    transitionDuration: vars.duration.crawl,
    transitionTimingFunction: vars.easing.linear,
  }),
);
export const timeCaretMark = style(
  c({
    position: "absolute",
    top: `calc(-1 * ${px(SPACE.xs)})`,
    left: `calc(-1 * ${vars.stroke.base} / 2)`,
    width: px(SPACE.md),
    height: px(SPACE.md),
    backgroundColor: vars.line.base,
    transform: "translateX(-50%) rotate(45deg)",
  }),
);
export const timeCaretLabel = style(
  c({
    position: "absolute",
    bottom: "100%",
    left: `calc(-1 * ${vars.stroke.base} / 2)`,
    transform: "translateX(-50%)",
    paddingInline: px(SPACE.xs),
    backgroundColor: vars.surface.inverse,
    color: vars.ink.inverse,
    fontSize: px(TEXT_ROLES.micro.size),
    lineHeight: px(TEXT_ROLES.micro.leading),
    fontWeight: WEIGHT.black,
    whiteSpace: "nowrap",
  }),
);

/* ── SlotCell ───────────────────────────────────────────────────────── */

/** 칸 전체가 상태 면 — 빈 강의실 · 분석 비교의 시간 칸 */
export const slotCell = style(
  c({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    minHeight: px(48),
    padding: px(SPACE.xs),
    border: 0,
    borderRadius: 0,
    fontSize: px(TEXT_ROLES.micro.size),
    lineHeight: px(TEXT_ROLES.micro.leading),
    fontWeight: WEIGHT.black,
    selectors: {
      "button&:hover:not(:disabled)": { backgroundImage: `linear-gradient(${vars.state.hover}, ${vars.state.hover})` },
      "&:focus-visible": { outlineOffset: `calc(-1 * ${vars.focusRing.offset} - ${vars.focusRing.width})` },
    },
  }),
);
export const slotState = styleVariants({
  free: c({ backgroundColor: ACCENT_COLORS.green.soft, color: ACCENT_COLORS.green.solidInk }),
  busy: c({ backgroundColor: vars.surface.well, color: vars.ink.muted }),
  selected: c({ backgroundColor: vars.surface.inverse, color: vars.ink.inverse }),
  conflict: c({ backgroundColor: ACCENT_COLORS.orange.soft, color: ACCENT_COLORS.orange.solidInk }),
  common: c({ backgroundColor: ACCENT_COLORS.pink.soft, color: ACCENT_COLORS.pink.solidInk }),
  empty: c({ backgroundColor: "transparent", color: vars.ink.muted }),
});

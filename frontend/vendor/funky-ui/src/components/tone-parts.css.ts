import { style } from "@vanilla-extract/css";

import { SLOT } from "../styles/slots";
import { components } from "../tokens/layers.css";
import { BREAKPOINT, SPACE } from "../tokens/layout";
import { SWATCH } from "../tokens/shape";
import { TEXT_ROLES, WEIGHT, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import { TONE_INK_VAR, TONE_VAR } from "./tone";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });
const md = `(min-width: ${BREAKPOINT.md}px)`;
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";
const tone = `var(${TONE_VAR}, ${vars.ink.primary})`;
const ink = `var(${TONE_INK_VAR}, ${vars.ink.inverse})`;
const tint = (pct: number) => `color-mix(in srgb, ${tone} ${pct}%, ${vars.surface.raised})`;

/**
 * 골라진 칸의 칠 — Paint 의 슬롯을 덮습니다. Paint 는 어떤 값이 들어오는지 모르므로 hex 를 받지 않은 채로 있고,
 * 이 층(fk.components)이 primitives 의 variant 를 이깁니다. ⚠️ variant 처럼 슬롯 일곱을 전부 씁니다.
 */
export const toneButtonSelected = style(
  c({
    vars: {
      [SLOT.fg]: ink,
      [SLOT.bg]: tone,
      [SLOT.border]: vars.line.base,
      [SLOT.hoverLayer]: vars.overlay.hoverWhite,
      [SLOT.hoverFg]: ink,
      [SLOT.hoverBorder]: vars.line.base,
      [SLOT.pressLayer]: vars.overlay.pressWhite,
    },
  }),
);

export const toneChip = style(
  c({
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    gap: px(SPACE.md),
    paddingInline: px(SPACE.lg),
    paddingBlock: px(SPACE.sm),
    border: `${vars.stroke.base} solid ${vars.line.base}`,
    color: vars.ink.primary,
    fontSize: px(TEXT_ROLES.caption.size),
    lineHeight: px(TEXT_ROLES.caption.leading),
    fontWeight: WEIGHT.black,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    "@media": {
      [md]: {
        gap: px(SPACE.lg),
        paddingInline: px(SPACE.xl),
        paddingBlock: px(SPACE.md),
        fontSize: px(TEXT_ROLES.body.size),
        lineHeight: px(TEXT_ROLES.body.leading),
      },
    },
  }),
);

export const toneChipOn = style(c({ backgroundColor: tint(12) }));

/** 꺼진 칩 — 흐린 회색으로 물러나 있다가 hover 때 흐림이 걷힙니다. 안쪽 칸은 켜야 칠해집니다 */
export const toneChipOff = style(
  c({
    borderColor: vars.line.soft,
    backgroundColor: vars.surface.raised,
    filter: "grayscale(1)",
    opacity: 0.4,
    selectors: {
      [`&${ENABLED}:hover`]: { filter: "none", opacity: 1 },
    },
  }),
);

export const toneBox = style(c({ backgroundColor: tint(8) }));
export const toneBoxFramed = style(c({ border: `${vars.stroke.base} solid ${tone}` }));

export const toneSwatch = style(
  c({
    display: "inline-block",
    flexShrink: 0,
    width: px(SWATCH.legend),
    height: px(SWATCH.legend),
    border: `${vars.stroke.base} solid ${vars.line.base}`,
    backgroundColor: tone,
  }),
);

/** 칩이 꺼졌을 때 칸의 면을 비웁니다 */
export const toneSwatchEmpty = style(c({ backgroundColor: "transparent" }));

/** 왼쪽 띠 — flex 줄의 높이를 채웁니다. 색이 없는 줄도 자리를 지켜 글자 열이 흔들리지 않습니다 */
export const toneRail = style(c({ flexShrink: 0, alignSelf: "stretch", width: vars.stroke.rail, backgroundColor: tone }));
export const toneRailEmpty = style(c({ backgroundColor: "transparent" }));

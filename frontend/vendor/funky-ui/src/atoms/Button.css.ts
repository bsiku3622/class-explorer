import { style, styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { CONTROL } from "../tokens/shape";
import { CONTROL_TEXT, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import type { ControlSize } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const buttonBase = style(
  c({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    margin: 0,
    fontWeight: WEIGHT.black,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    textDecoration: "none",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    lineHeight: 1,
    borderRadius: 0,
  }),
);

export const buttonSize = styleVariants(
  CONTROL.height,
  (height, size) =>
    c({
      height: px(height),
      paddingInline: px(CONTROL.inset[size as ControlSize]),
      gap: px(CONTROL.gap[size as ControlSize]),
      fontSize: px(CONTROL_TEXT[size as ControlSize].size),
      letterSpacing: em(CONTROL_TEXT[size as ControlSize].tracking),
    }),
);

/** 아이콘만 있는 버튼 — 정사각형 */
export const squareSize = styleVariants(CONTROL.height, (height) => c({ width: px(height), paddingInline: 0 }));

export const fullWidth = style(c({ width: "100%" }));

/** 대소문자를 그대로 — 소문자가 뜻인 라벨(이메일 도메인 · 브랜드 이름) */
export const plainCase = style(c({ textTransform: "none", letterSpacing: 0 }));

/** 긴 문장 라벨 — 줄바꿈되고 높이가 글자를 따라 늘어납니다 */
export const buttonWrap = style(c({ height: "auto", whiteSpace: "normal", textAlign: "center", lineHeight: 1.25, paddingBlock: px(8) }));

/** 뒤 아이콘 — 버튼이 판을 열어 둔 동안(`aria-expanded`) 뒤집힙니다 (학기 선택의 ▾) */
export const iconEndTurn = style(
  c({
    transitionProperty: "transform",
    transitionDuration: vars.duration.fast,
    selectors: { '[aria-expanded="true"] > &': { transform: "rotate(180deg)" } },
  }),
);

/** 불러오는 동안 글자 자리를 지킨 채 가운데에 스피너를 둡니다 — 폭이 흔들리지 않습니다 */
export const loading = style(c({ color: "transparent !important", pointerEvents: "none" }));
export const loadingSpinner = style(
  c({
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--fk-fg)",
  }),
);

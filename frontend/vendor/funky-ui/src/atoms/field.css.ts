/**
 * 입력 칸 — Input · Textarea · Select 가 같은 면과 상태를 씁니다 (`useField`).
 *
 * 면 · 테두리(흰 면 · 2px 검정)는 Surface 에서 빌리고, 여기서는 글자와 상태만 그립니다. 글자는 700 —
 * 값은 읽는 내용이라 버튼처럼 900 대문자가 아닙니다. Select 만 900 입니다 — 고른 값이 곧 컨트롤의 이름이라
 * 버튼처럼 읽힙니다. 포커스는 전역 핑크 링이 맡고, 틀린 값은 빨간 테두리로 표시합니다.
 */
import { style, styleVariants } from "@vanilla-extract/css";

import { ACCENT_COLORS } from "../tokens/color";
import { components } from "../tokens/layers.css";
import { CONTROL } from "../tokens/shape";
import { INPUT_TEXT, WEIGHT, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import type { ControlSize } from "../tokens/vocabulary";
import { FLAT_SHADOW } from "../primitives/Pressable.css";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const field = style(
  c({
    display: "block",
    width: "100%",
    minWidth: 0,
    margin: 0,
    // 면은 늘 흰색이라 글자도 늘 본문 잉크입니다 — 보라 바 · 검정 면 안에 놓여도 바깥 글자색을 물려받지 않습니다
    color: vars.ink.primary,
    borderRadius: 0,
    fontFamily: vars.font.sans,
    fontWeight: WEIGHT.bold,
    transitionProperty: "border-color, box-shadow",
    transitionDuration: vars.duration.fast,
    "::placeholder": { color: vars.ink.faint, opacity: 1 },
    selectors: {
      "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
      // 막지 않는 경고 — 값은 받되 한 번 더 보라는 뜻입니다. 틀림이 뒤에 와서 둘이 겹치면 빨강이 이깁니다
      "&[data-warning]": { borderColor: ACCENT_COLORS.orange.solid },
      "&[aria-invalid='true']": { borderColor: ACCENT_COLORS.red.solid },
      // 비어 있거나 해당 없는 칸 — 옅게 물러나 있다가 hover 때 테두리가 진해집니다
      "&[data-quiet]": { borderColor: vars.line.soft, color: vars.ink.muted },
      "&[data-quiet]:hover:not(:disabled)": { borderColor: vars.ink.muted },
      // ⚠️ `:read-only` 가 아니라 속성으로 겁니다 — `<select>` 는 명세상 늘 `:read-only` 라 항상 회색이 됩니다
      "&[readonly]": { backgroundColor: vars.surface.well },
    },
  }),
);

export const fieldSize = styleVariants(CONTROL.height, (h, size) =>
  c({ height: px(h), paddingInline: px(CONTROL.inset[size as ControlSize] - 2), fontSize: px(INPUT_TEXT[size as ControlSize]) }),
);

/**
 * 폼의 주인공 칸 — 4px 그림자 위에 떠 있다가 포커스를 받으면 그림자를 거둡니다(그 자리는 핑크 링이 맡습니다).
 * 링과 같은 `:focus-visible` 에 겁니다 — `:focus` 에 걸면 마우스로 연 select 는 링 없이 그림자만 사라집니다
 * (글자 칸은 마우스로 눌러도 `:focus-visible` 이라 둘이 같습니다).
 * ⚠️ 규칙은 이것 하나입니다. class-explorer 에는 반대 규칙(평평하다가 포커스 때 그림자)도 있었는데, 그 앱의
 * InventoryPage 가 "focus 규칙이 서로 반대" 를 시스템의 빈칸으로 짚었고 이쪽이 다수(10 : 2 — 반대는 Trade 둘)였습니다
 */
export const fieldShadow = style(c({ boxShadow: vars.shadow.raised, selectors: { "&:focus-visible": { boxShadow: FLAT_SHADOW } } }));

/**
 * 줄 안에서 치는 칸 — 면 · 테두리 · 높이가 없고 글자는 바깥 것을 씁니다 (표 칸의 숫자 · 글자 입력). 숫자 칸의 위아래 단추도 숨깁니다
 */
export const fieldBare = style(
  c({
    display: "block",
    width: "100%",
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: 0,
    borderRadius: 0,
    background: "none",
    color: "inherit",
    font: "inherit",
    letterSpacing: "inherit",
    appearance: "textfield",
    "::placeholder": { color: vars.ink.faint, opacity: 1 },
    selectors: {
      "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
      "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
    },
  }),
);

export const textarea = style(c({ height: "auto", resize: "vertical", lineHeight: px(20) }));
export const textareaSize = styleVariants(CONTROL.height, (_, size) =>
  c({ paddingBlock: px(CONTROL.gap[size as ControlSize]), paddingInline: px(CONTROL.inset[size as ControlSize] - 2), fontSize: px(INPUT_TEXT[size as ControlSize]) }),
);

/** Select — native select 를 감싼 상자. 화살표는 장식이라 누름을 select 로 흘려보냅니다 */
export const selectWrap = style(c({ position: "relative", display: "block", width: "100%", minWidth: 0 }));
export const select = style(c({ appearance: "none", cursor: "pointer", fontWeight: WEIGHT.black }));
export const selectPad = styleVariants(CONTROL.height, (_, size) => c({ paddingRight: px(CONTROL.inset[size as ControlSize] + CONTROL.icon[size as ControlSize]) }));
export const selectArrow = style(
  c({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: vars.ink.primary,
  }),
);
export const selectArrowPos = styleVariants(CONTROL.height, (_, size) => c({ right: px(CONTROL.inset[size as ControlSize] - 4) }));

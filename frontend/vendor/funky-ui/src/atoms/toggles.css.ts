/**
 * 고르는 표식 — Checkbox · Radio · Switch.
 *
 * native input 을 투명하게 표식 위에 겹쳐 두고, 보이는 상자는 형제 span 이 그립니다. 그래서
 * 폼 · 키보드 · 스크린 리더는 native 가 맡고, 생김새만 funky 입니다.
 * 켜진 색은 지금 accent(바깥 Paint 의 색, 없으면 검정)의 원색이고, 그 위 표식은 그 accent 의 ink 입니다.
 * 토글은 accent 를 고르지 않습니다.
 *
 * vanilla-extract 는 selector 가 자기 자신(`&`)을 겨눠야 하므로, 상태 규칙은 **보이는 표식 쪽**에
 * `${native}:checked + &` 로 겁니다.
 */
import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { TOGGLE } from "../tokens/shape";
import { px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const toggleRoot = style(
  c({
    display: "inline-flex",
    alignItems: "center",
    gap: px(8),
    cursor: "pointer",
    userSelect: "none",
    selectors: { "&:has(input:disabled)": { opacity: 0.4, cursor: "not-allowed" } },
  }),
);

export const control = style(c({ position: "relative", display: "inline-flex", flexShrink: 0 }));

export const native = style(
  c({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
    cursor: "inherit",
    zIndex: 1,
  }),
);

export const checkNative = style({});
export const radioNative = style({});
export const switchNative = style({});

const box = {
  width: px(TOGGLE.box),
  height: px(TOGGLE.box),
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: vars.surface.raised,
  border: `${vars.stroke.base} solid ${vars.line.base}`,
  transitionProperty: "background-color, border-color",
  transitionDuration: vars.duration.fast,
};

const focused = { outline: `${vars.focusRing.width} solid ${vars.focus}`, outlineOffset: vars.focusRing.offset };
const hovered = { backgroundImage: `linear-gradient(${vars.accent.tint}, ${vars.accent.tint})` };

/** Checkbox — 켜지면 accent 로 꽉 차고 체크가 섭니다 */
export const checkBox = style(
  c({
    ...box,
    color: "transparent",
    selectors: {
      [`${checkNative}:checked + &`]: { backgroundColor: vars.accent.solid, color: vars.accent.ink },
      [`${checkNative}:focus-visible + &`]: focused,
      [`${checkNative}:hover:not(:disabled):not(:checked) + &`]: hovered,
    },
  }),
);

/** Radio — 모서리는 그대로 각지고, 켜지면 안에 accent 정사각형이 찍힙니다 (Checkbox 와 모양으로 갈립니다) */
export const radioBox = style(
  c({
    ...box,
    selectors: {
      [`${radioNative}:focus-visible + &`]: focused,
      [`${radioNative}:hover:not(:disabled):not(:checked) + &`]: hovered,
    },
  }),
);
export const radioDot = style(
  c({
    width: px(TOGGLE.box / 2 - 1),
    height: px(TOGGLE.box / 2 - 1),
    backgroundColor: vars.accent.solid,
    transform: "scale(0)",
    transitionProperty: "transform",
    transitionDuration: vars.duration.fast,
    selectors: { [`${radioNative}:checked + ${radioBox} > &`]: { transform: "scale(1)" } },
  }),
);

/** Switch — 각진 트랙 위를 각진 손잡이가 건너갑니다 */
export const track = style(
  c({
    width: px(TOGGLE.track.width),
    height: px(TOGGLE.track.height),
    display: "inline-flex",
    alignItems: "center",
    padding: px(2),
    backgroundColor: vars.surface.raised,
    border: `${vars.stroke.base} solid ${vars.line.base}`,
    transitionProperty: "background-color",
    transitionDuration: vars.duration.fast,
    selectors: {
      [`${switchNative}:checked + &`]: { backgroundColor: vars.accent.solid },
      [`${switchNative}:focus-visible + &`]: focused,
    },
  }),
);
export const thumb = style(
  c({
    width: px(TOGGLE.thumb),
    height: px(TOGGLE.thumb),
    backgroundColor: vars.line.base,
    transitionProperty: "transform, background-color",
    transitionDuration: vars.duration.fast,
    transitionTimingFunction: vars.easing.standard,
    selectors: {
      [`${switchNative}:checked + ${track} > &`]: {
        // 트랙 안쪽 폭(테두리 · 여백 제외)에서 손잡이 폭을 뺀 만큼 건너갑니다
        transform: `translateX(${px(TOGGLE.track.width - TOGGLE.thumb - 8)})`,
        backgroundColor: vars.accent.ink,
      },
    },
  }),
);

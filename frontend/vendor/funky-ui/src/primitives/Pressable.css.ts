/**
 * 누름 (fk.primitives) — 색은 하나도 없습니다(hover 색까지 칠의 hoverable). 커서 · 꺼진 모양 · 움직임만 다룹니다.
 *
 * - `none`  — 움직이지 않습니다. 누르는 물건의 의미 · 커서 · 꺼진 모양만 남습니다 (목록 줄 · 아코디언 머리 · 메뉴 항목).
 * - `sink`  — 4px 그림자 위에 떠 있다가 hover 때 그림자 자리로 가라앉고, 누르는 순간 한 번 더 작아집니다.
 *   가라앉는 거리 = 그림자 거리(`PRESS.sink`)라 그림자가 본체 뒤로 비져 나오지 않습니다.
 * - `raise` — 평평하다가 hover 때 제자리에서 4px 그림자가 올라오고, 누르는 순간 다시 내려앉으며 작아집니다
 *   (평평한 칩 — sink 를 거꾸로 돌린 몸짓).
 * - `lift`  — hover 때 4px 떠오르고, 그림자는 화면에 그대로 남아 길어집니다 (탐색 카드).
 * - `tap`   — 그림자 없이 누르는 순간만 작아집니다 (그림자를 끈 버튼).
 * - `shrink` — 그림자를 그대로 둔 채 hover 때 95%, 누르면 92% 로 작아집니다 (Ask 플로팅 버튼 · 창 머리 단추 — class-explorer
 *   가이드가 사용자 요청의 예외로 적어 둔 자리입니다. 다른 자리에 쓰지 않습니다).
 *
 * 골라진 칸의 모양(커지기)은 여기가 아니라 Selectable 입니다 — 누름은 순간의 반응, 골라짐은 남아 있는 상태입니다.
 * 누르는 순간의 크기는 `--fk-press-scale`(기본 0.96)입니다. 큰 면은 자기 class 에서 0.98 로 덮습니다.
 */
import { style, styleVariants } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { LIFT, STATE_TRANSITION } from "../tokens/motion";
import { vars } from "../tokens/variables";
import type { PressMotion } from "../tokens/vocabulary";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";
/** 그림자 자리로 내려앉은 위치 */
const sunk = `translate(${vars.press.sink}, ${vars.press.sink})`;
/** 그림자가 없는 상태 — `none` 이 아니라 0 거리라서 그림자가 자라고 줄어드는 사이가 이어집니다. Selectable 도 씁니다 */
export const FLAT_SHADOW = `0 0 0 0 ${vars.shadowColor}`;

export const pressBase = style(
  p({
    cursor: "pointer",
    textDecoration: "none",
    // 터치 브라우저가 누를 때 덮는 회색 번쩍임을 끕니다 — 누름의 반응은 몸짓(여기)과 press 층(Paint)이 맡습니다
    WebkitTapHighlightColor: "transparent",
    transitionProperty: STATE_TRANSITION,
    transitionDuration: vars.duration.fast,
    transitionTimingFunction: vars.easing.standard,
    selectors: {
      "&:disabled, &[aria-disabled='true']": { opacity: 0.4, cursor: "not-allowed" },
    },
  }),
);

export const motionClass = styleVariants({
  none: p({}),
  sink: p({
    boxShadow: vars.shadow.raised,
    selectors: {
      [`&${ENABLED}:hover`]: { transform: sunk, boxShadow: FLAT_SHADOW },
      [`&${ENABLED}:active`]: { transform: `${sunk} scale(${vars.press.scale})`, boxShadow: FLAT_SHADOW },
    },
  }),
  raise: p({
    boxShadow: FLAT_SHADOW,
    selectors: {
      [`&${ENABLED}:hover`]: { boxShadow: vars.shadow.raised },
      [`&${ENABLED}:active`]: { transform: `scale(${vars.press.scale})`, boxShadow: FLAT_SHADOW },
    },
  }),
  lift: p({
    boxShadow: vars.shadow.raised,
    selectors: {
      [`&${ENABLED}:hover`]: {
        transform: `translateY(-${LIFT.rise}px)`,
        boxShadow: `${vars.press.sink} calc(${vars.press.sink} + ${LIFT.rise}px) 0 0 ${vars.shadowColor}`,
      },
      [`&${ENABLED}:active`]: { transform: "translateY(0)", boxShadow: vars.shadow.raised },
    },
  }),
  tap: p({
    selectors: { [`&${ENABLED}:active`]: { transform: `scale(${vars.press.scale})` } },
  }),
  shrink: p({
    boxShadow: vars.shadow.raised,
    selectors: {
      [`&${ENABLED}:hover`]: { transform: `scale(${vars.press.shrink})` },
      [`&${ENABLED}:active`]: { transform: `scale(${vars.press.shrinkActive})` },
    },
  }),
  // 밖에서 켠 상태 — 고른 칸 · 풀어 둔 노드처럼 hover 와 상관없이 그림자가 남고, 꺼져도 그림자를 둡니다
  still: p({ boxShadow: vars.shadow.raised }),
} satisfies Record<PressMotion, object>);

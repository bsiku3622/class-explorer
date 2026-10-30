/**
 * 골라진 모양 (fk.primitives) — class-explorer 의 골라진 버튼 · 칩입니다. 105% 로 커져 이웃 위에 서고(z) 4px 그림자를
 * 둡니다 — 쉴 때 평평하던 칩도 골라지면 그림자가 생깁니다(SectionCard 의 교사 · 교실 칩). hover 때는 제자리에서
 * 그림자만 숨기고, 누르는 순간 100% 로 돌아옵니다. 색은 여기 없습니다 — 골라진 색은 칠(Paint · Glass · Surface)의 몫입니다.
 *
 * 골라진 모양은 그 자체로 몸짓이라, 같은 요소에 Pressable 의 몸짓(sink · raise · lift · tap)이 있어도 **이겨야** 합니다.
 * 그래서 class 를 두 번 겹친 선택자(`.grow.grow`)로 특이도를 한 단 올립니다 — 쓰는 쪽이 골라질 때마다 motion 을
 * 바꿔 줄 필요가 없고, CSS 가 실리는 순서에도 기대지 않습니다.
 */
import { globalStyle, style } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { Z } from "../tokens/layout";
import { STATE_TRANSITION } from "../tokens/motion";
import { vars } from "../tokens/variables";
import { FLAT_SHADOW } from "./Pressable.css";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";
const grown = `scale(${vars.press.grow})`;

/** 골라진 모양의 표식 — 규칙은 아래 겹친 선택자에 있습니다 */
export const grow = style({});
const twice = `${grow}${grow}`;

globalStyle(
  twice,
  p({
    position: "relative",
    zIndex: Z.raised,
    transform: grown,
    boxShadow: vars.shadow.raised,
    transitionProperty: STATE_TRANSITION,
    transitionDuration: vars.duration.fast,
    transitionTimingFunction: vars.easing.standard,
  }),
);
globalStyle(`${twice}${ENABLED}:hover`, p({ transform: grown, boxShadow: FLAT_SHADOW }));
globalStyle(`${twice}${ENABLED}:active`, p({ transform: "scale(1)", boxShadow: FLAT_SHADOW }));

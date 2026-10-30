/**
 * Accent class — 요소에 accent 사다리 일곱 칸을 다시 씁니다.
 *
 * 변수라서 **아래로 흐릅니다** (contextual accent). `<Paint accent="green">` 안의 Button 은
 * accent 를 따로 주지 않아도 초록입니다 — "드랍한 카드 안에서는 버튼도 카드 색을 따릅니다".
 * 이 class 를 직접 읽는 곳은 Paint 모듈 하나입니다 — Paint 가 칠할 때, 그리고 Variant 없이 자기 색을 칠하는
 * 위 층(Link · Swatch · Stat · Meter)이 `useAccent()` 로 빌려 갈 때. 칠하지 않는 박스(Box · Surface · Card)는 accent 를 갖지 않습니다.
 */
import { styleVariants } from "@vanilla-extract/css";

import { ACCENT_COLORS } from "../tokens/color";
import { primitives } from "../tokens/layers.css";
import { ACCENT_VAR_NAMES } from "../tokens/variables";

export const accentClass = styleVariants(ACCENT_COLORS, (c) => ({
  "@layer": {
    [primitives]: {
      vars: {
        [ACCENT_VAR_NAMES.ink]: c.ink,
        [ACCENT_VAR_NAMES.solidInk]: c.solidInk,
        [ACCENT_VAR_NAMES.solid]: c.solid,
        [ACCENT_VAR_NAMES.soft]: c.soft,
        [ACCENT_VAR_NAMES.softInk]: c.softInk,
        [ACCENT_VAR_NAMES.tint]: c.tint,
        [ACCENT_VAR_NAMES.tintStrong]: c.tintStrong,
      },
    },
  },
}));

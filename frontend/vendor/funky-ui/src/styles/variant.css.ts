/**
 * Variant class — 레시피(칸 이름)를 슬롯 변수로 옮깁니다 (규칙은 `slots.ts`).
 *
 * 슬롯은 일곱입니다: 글자 · 면 · 테두리 + hover 의 층 · 글자 · 테두리 + press 의 층.
 * Paint(`primitives/Paint.css.ts`)는 슬롯만 읽고, 어떤 variant 인지 모릅니다.
 */
import { styleVariants } from "@vanilla-extract/css";

import { VARIANT_RECIPES } from "../tokens/color-recipes";
import { primitives } from "../tokens/layers.css";
import { slotValues } from "./slots";

export const variantClass = styleVariants(VARIANT_RECIPES, (r) => ({
  "@layer": { [primitives]: { vars: slotValues(r) } },
}));

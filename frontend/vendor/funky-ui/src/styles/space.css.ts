/** 간격 지도 — padding 과 gap 이 같은 사다리에서 고릅니다 (fk.utilities) */
import { styleVariants } from "@vanilla-extract/css";

import { utilities } from "../tokens/layers.css";
import { vars } from "../tokens/variables";

const map = (prop: (v: string) => Record<string, string>) =>
  styleVariants(vars.space, (v) => ({ "@layer": { [utilities]: prop(v) } }));

export const paddingClass = map((v) => ({ padding: v }));
export const paddingXClass = map((v) => ({ paddingLeft: v, paddingRight: v }));
export const paddingYClass = map((v) => ({ paddingTop: v, paddingBottom: v }));
export const gapClass = map((v) => ({ gap: v }));
export const rowGapClass = map((v) => ({ rowGap: v }));
export const columnGapClass = map((v) => ({ columnGap: v }));

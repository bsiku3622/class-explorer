import { keyframes, style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

/** 왕복 한 번 — 양 끝에서 잠깐 멈춰야 읽을 틈이 생깁니다 */
const swing = keyframes({
  "0%, 10%": { translate: "0 0" },
  "45%, 55%": { translate: "var(--fk-marquee-shift) 0" },
  "90%, 100%": { translate: "0 0" },
});

export const marqueeBox = style(c({ display: "block", overflow: "hidden", whiteSpace: "nowrap", minWidth: 0 }));
export const marqueeTrack = style(c({ display: "inline-block" }));
export const marqueeMoving = style(c({ animation: `${swing} var(--fk-marquee-duration) ease-in-out infinite` }));

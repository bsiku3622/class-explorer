/**
 * 실행 중에 정해지는 색(학과 · 학번) — hex 하나를 `--fk-tone` 변수로 넘깁니다.
 *
 * 칠하는 문법은 자리마다 같습니다: **면 = tone 8~15%, 테두리 = tone, 글자 = tone.**
 * 이 문법을 지키면 새 자리를 만들어도 색이 따로 놀지 않습니다 (class-explorer design-guide).
 * 면을 tone 으로 꽉 채우는 자리(ToneButton)만 글자를 `--fk-tone-ink` 로 칠합니다.
 */
import type { CSSProperties } from "react";

import { vars } from "../tokens/variables";

export const TONE_VAR = "--fk-tone";
export const TONE_INK_VAR = "--fk-tone-ink";

export function toneStyle(color: string | undefined, style?: CSSProperties): CSSProperties | undefined {
  if (!color) return style;
  return { [TONE_VAR]: color, ...style } as CSSProperties;
}

/** 검정 글자와 흰 글자의 대비가 같아지는 휘도 — 이 값을 경계로 고르면 어떤 면에서든 4.58:1 이상입니다 */
const INK_CROSSOVER = 0.179;

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/**
 * hex 면 위에서 읽히는 글자 — 검정 또는 흰색의 변수 참조를 돌려줍니다. 시스템에서 실행 중에 색을 계산하는 유일한 자리입니다.
 * ⚠️ class-explorer 의 `readableInk` 는 경계가 0.35 라서 휘도 0.18~0.35 인 면에 흰 글자를 올립니다(AA 미달). 그쪽으로 맞추지 않습니다.
 */
export function toneInk(color: string): string {
  const raw = color.replace("#", "");
  const n = parseInt(raw.length === 3 ? [...raw].map((d) => d + d).join("") : raw.slice(0, 6), 16);
  const luminance = 0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
  return luminance > INK_CROSSOVER ? vars.line.base : vars.ink.inverse;
}

/** `toneStyle` + 그 면에서 읽히는 글자 */
export function toneFaceStyle(color: string, style?: CSSProperties): CSSProperties {
  return { [TONE_VAR]: color, [TONE_INK_VAR]: toneInk(color), ...style } as CSSProperties;
}

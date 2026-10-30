/**
 * 글자 역할을 CSS 선언으로 — 컴포넌트는 `Text`, 앱 stylesheet 는 이 함수로 같은 글자를 가져옵니다.
 * (`.css.ts` 는 함수를 내보낼 수 없어 여기 둡니다)
 */
import { ACCENT_COLORS } from "./color";
import { WEIGHT, em, px, type TextRole } from "./typography";
import { vars } from "./variables";
import type { Tone } from "./vocabulary";

export const TONE_VALUE: Record<Tone, string> = {
  primary: vars.ink.primary,
  secondary: vars.ink.secondary,
  muted: vars.ink.muted,
  faint: vars.ink.faint,
  inverse: vars.ink.inverse,
  inverseMuted: vars.ink.inverseMuted,
  accent: vars.accent.solidInk,
  accentSoft: vars.accent.softInk,
  inherit: "inherit",
  pink: ACCENT_COLORS.pink.solidInk,
  purple: ACCENT_COLORS.purple.solidInk,
  cyan: ACCENT_COLORS.cyan.solidInk,
  yellow: ACCENT_COLORS.yellow.solidInk,
  orange: ACCENT_COLORS.orange.solidInk,
  sky: ACCENT_COLORS.sky.solidInk,
  green: ACCENT_COLORS.green.solidInk,
  red: ACCENT_COLORS.red.solidInk,
};

export function textRule(role: TextRole) {
  return {
    fontSize: px(role.size),
    lineHeight: px(role.leading),
    fontWeight: WEIGHT[role.weight],
    letterSpacing: em(role.tracking),
    textTransform: role.uppercase ? ("uppercase" as const) : ("none" as const),
    ...(role.tone ? { color: TONE_VALUE[role.tone] } : {}),
  };
}

import type { ComponentType } from "react";

import { cx } from "../internal/cx";
import { toneClass } from "../styles/typography.css";
import { ICON, ICON_STROKE } from "../tokens/shape";
import type { IconMotion, IconSize, Tone } from "../tokens/vocabulary";
import { iconBase, iconMotion, iconSpin } from "./Icon.css";

/** lucide-react 와 같은 모양의 아이콘 컴포넌트 */
export interface IconComponentProps {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
  role?: string;
}
export type IconComponent = ComponentType<IconComponentProps>;

export interface IconProps {
  icon: IconComponent;
  size?: IconSize | number;
  /** 기본 2.5 — class-explorer 의 굵은 선 */
  strokeWidth?: number;
  tone?: Tone;
  /** 뜻이 있는 아이콘이면 이름을 줍니다. 없으면 장식으로 숨깁니다 */
  label?: string;
  /** 불러오는 동안 제자리에서 돕니다 */
  spin?: boolean;
  /** 바깥 버튼 · 링크에 마우스를 올리면 아이콘만 움직입니다 — `turn`(-45°) · `nudge`(2px 옆으로) */
  motion?: IconMotion;
  className?: string;
}

/** 아이콘 — 크기와 선 굵기를 시스템 사다리에서 고릅니다 */
export function Icon({ icon: Comp, size = "md", strokeWidth = ICON_STROKE, tone, label, spin, motion, className }: IconProps) {
  const px = typeof size === "number" ? size : ICON[size];
  return (
    <Comp
      size={px}
      strokeWidth={strokeWidth}
      className={cx(iconBase, tone && toneClass[tone], spin && iconSpin, motion && iconMotion[motion], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

import type { ElementType, ReactNode } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { Icon, type IconComponent } from "../primitives/Icon";
import { Paint } from "../primitives/Paint";
import { BADGE } from "../tokens/shape";
import type { Accent, BadgeSize, Variant } from "../tokens/vocabulary";
import { badgeBase, badgeSize, badgeWrap } from "./Badge.css";

export interface BadgeOwnProps {
  accent?: Accent;
  /** 기본 `outline`. Button 과 같은 15 가지 레시피이고, 읽는 물건이라 hover 에 반응하지 않습니다 */
  variant?: Variant;
  size?: BadgeSize;
  icon?: IconComponent;
  /** 길이가 정해지지 않은 글자(거절 사유) — 잘리는 대신 줄바꿈됩니다 */
  wrap?: boolean;
  className?: string;
  children?: ReactNode;
}

export type BadgeProps<E extends ElementType = "span"> = PolyProps<E, BadgeOwnProps>;

const PaintRoot = Paint as ElementType;

/** 상태 · 개수 · 분류를 적는 작은 라벨 — `Paint`(누르지 않는) 위에 배지 크기를 얹은 것입니다 */
export function Badge<E extends ElementType = "span">({ as, accent, variant = "outline", size = "md", icon, wrap = false, className, children, ...rest }: BadgeProps<E>) {
  return (
    <PaintRoot as={as ?? "span"} accent={accent} variant={variant} className={cx(badgeBase, badgeSize[size], wrap && badgeWrap, className)} {...rest}>
      {icon && <Icon icon={icon} size={BADGE.icon[size]} />}
      {children}
    </PaintRoot>
  );
}

import type { ElementType } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { paddingClass, paddingXClass, paddingYClass } from "../styles/space.css";
import type { Space } from "../tokens/vocabulary";

export interface BoxOwnProps {
  padding?: Space;
  paddingX?: Space;
  paddingY?: Space;
  className?: string;
}

export type BoxProps<E extends ElementType = "div"> = PolyProps<E, BoxOwnProps>;

/** Box 의 prop 을 class 로 — 2차 primitive(Surface · Paint · Glass · Pressable · Selectable · Floating · Stack · Inline · Grid)가 같은 지도를 씁니다 */
export function boxClass({ padding, paddingX, paddingY, className }: BoxOwnProps): string {
  return cx(padding && paddingClass[padding], paddingX && paddingXClass[paddingX], paddingY && paddingYClass[paddingY], className);
}

/**
 * 요소 — 1차 primitive. 태그(`as`) · ref · 여백만 다룹니다. 칠하지 않고 색도 모릅니다.
 * 2차 primitive 는 모두 이 위에 능력 하나를 얹습니다: 칠(Surface · Paint · Glass) · 누름(Pressable) · 골라짐(Selectable) ·
 * 띄우기(Floating) · 배치(Stack · Inline · Grid).
 */
export function Box<E extends ElementType = "div">({ as, padding, paddingX, paddingY, className, ...rest }: BoxProps<E>) {
  const Comp: ElementType = as ?? "div";
  return <Comp className={boxClass({ padding, paddingX, paddingY, className }) || undefined} {...rest} />;
}

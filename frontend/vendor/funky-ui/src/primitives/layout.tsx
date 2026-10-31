/**
 * 늘어놓는 primitive 셋 — Stack(세로) · Inline(가로) · Grid(격자).
 * 2차 primitive (Box + 배치). Box 의 여백을 받고, 자식 사이의 간격과 정렬을 더합니다. 칠은 하지 않습니다 —
 * 칠한 판 위에 늘어놓으려면 `<Surface as={Stack} gap="md">` 처럼 Surface 의 `as` 로 넘깁니다.
 */
import type { CSSProperties, ElementType } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { columnGapClass, gapClass, rowGapClass } from "../styles/space.css";
import type { Align, Justify, Space } from "../tokens/vocabulary";
import { boxClass, type BoxOwnProps } from "./Box";
import { alignClass, grid, inline, justifyClass, justifyItemsClass, stack, wrapClass } from "./flex.css";

interface FlexOwnProps extends BoxOwnProps {
  gap?: Space;
  align?: Align;
  justify?: Justify;
}

export type StackProps<E extends ElementType = "div"> = PolyProps<E, FlexOwnProps>;

/** 세로로 쌓습니다 */
export function Stack<E extends ElementType = "div">({ as, gap, align, justify, padding, paddingX, paddingY, className, ...rest }: StackProps<E>) {
  const Comp: ElementType = as ?? "div";
  return (
    <Comp
      className={cx(
        stack,
        gap && gapClass[gap],
        align && alignClass[align],
        justify && justifyClass[justify],
        boxClass({ padding, paddingX, paddingY, className }),
      )}
      {...rest}
    />
  );
}

export type InlineProps<E extends ElementType = "div"> = PolyProps<E, FlexOwnProps & { wrap?: boolean }>;

/** 가로로 늘어놓습니다 — 기본은 세로 가운데 정렬 */
export function Inline<E extends ElementType = "div">({ as, gap, align, justify, wrap, padding, paddingX, paddingY, className, ...rest }: InlineProps<E>) {
  const Comp: ElementType = as ?? "div";
  return (
    <Comp
      className={cx(
        inline,
        gap && gapClass[gap],
        align && alignClass[align],
        justify && justifyClass[justify],
        wrap && wrapClass,
        boxClass({ padding, paddingX, paddingY, className }),
      )}
      {...rest}
    />
  );
}

interface GridOwnProps extends BoxOwnProps {
  /** 숫자면 같은 폭 n 칸, 문자열이면 grid-template-columns 그대로 */
  columns?: number | string;
  gap?: Space;
  rowGap?: Space;
  columnGap?: Space;
  align?: Align;
  justifyItems?: Align;
  style?: CSSProperties;
}

export type GridProps<E extends ElementType = "div"> = PolyProps<E, GridOwnProps>;

/** 격자 — 칸 폭은 실행 중에 정해지는 값이라 inline style 로 넣습니다 */
export function Grid<E extends ElementType = "div">({
  as,
  columns,
  gap,
  rowGap,
  columnGap,
  align,
  justifyItems,
  style,
  padding,
  paddingX,
  paddingY,
  className,
  ...rest
}: GridProps<E>) {
  const Comp: ElementType = as ?? "div";
  const template = typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns;
  return (
    <Comp
      className={cx(
        grid,
        gap && gapClass[gap],
        rowGap && rowGapClass[rowGap],
        columnGap && columnGapClass[columnGap],
        align && alignClass[align],
        justifyItems && justifyItemsClass[justifyItems],
        boxClass({ padding, paddingX, paddingY, className }),
      )}
      style={template ? { gridTemplateColumns: template, ...style } : style}
      {...rest}
    />
  );
}

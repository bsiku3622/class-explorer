import type { ElementType } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { borderSideClass, borderStyleClass } from "../styles/border.css";
import type { Border, BorderSide, BorderStyle, Shadow, SurfaceFill } from "../tokens/vocabulary";
import { boxClass, type BoxOwnProps } from "./Box";
import { borderClass, fillClass, hoverable as hoverableClass, shadowClass } from "./Surface.css";

export interface SurfaceOwnProps extends BoxOwnProps {
  /**
   * 면 (기본 `raised` — 흰 면). `none` 은 면 없이 바깥 면을 그대로 보입니다 — 목록 줄처럼 면 위의 한 칸.
   * `brand` 는 앱의 뼈대(상단 바 · 하단 바)에만 쓰는 보라 면입니다
   */
  fill?: SurfaceFill;
  /** 2px 테두리의 색 (기본 없음) */
  border?: Border;
  /** 테두리를 긋는 변 (기본 `all`) — 칸을 나누는 왼쪽 선 · 위아래 선 */
  borderSide?: BorderSide;
  /** 테두리의 선 (기본 `solid`) — `dashed` 는 비어 있는 자리 */
  borderStyle?: BorderStyle;
  /** 깊이 — 떠 있는 물건은 `raised`(4px), 모달만 `floating`(6px) */
  shadow?: Shadow;
  /**
   * hover · 누르는 중에 흑백 상태 층(글자색의 7% · 12%)을 덮습니다 — 면 · 글자 · 테두리는 그대로입니다.
   * Pressable 없이 혼자 동작합니다. 색 요소의 hover 는 Paint 의 `hoverable` 입니다
   */
  hoverable?: boolean;
}

export type SurfaceProps<E extends ElementType = "div"> = PolyProps<E, SurfaceOwnProps>;

/** Surface 의 prop 을 class 로 — 누르는 카드처럼 다른 primitive 위에 면만 빌려 올 때 씁니다 */
export function surfaceClass({ fill = "raised", border = "none", borderSide = "all", borderStyle = "solid", shadow = "none", hoverable = false, ...box }: SurfaceOwnProps): string {
  return cx(
    fillClass[fill],
    border !== "none" && borderClass[border],
    border !== "none" && borderSideClass[borderSide],
    border !== "none" && borderStyleClass[borderStyle],
    shadow !== "none" && shadowClass[shadow],
    hoverable && hoverableClass,
    boxClass(box),
  );
}

/**
 * 박스의 면 — 2차 primitive (Box + 칠). 면 · 테두리 · 그림자를 고르고, 카드 · 패널 · 모달 · 판 · 바처럼
 * **무언가를 담는 박스**에 씁니다. `hoverable` 이면 hover · 누르는 중의 흑백 상태 층도 칠합니다(면 위의
 * 목록 줄은 `fill="none"`). 면은 자리의 색(흑백과 뼈대의 보라)뿐이고 accent 를 모릅니다 — 색이 있는 요소는 `Paint` 입니다.
 *
 * ```tsx
 * <Surface border="line" shadow="raised" padding="3xl">…</Surface>
 * <Surface fill="well" padding="lg">…</Surface>
 * ```
 */
export function Surface<E extends ElementType = "div">({
  as,
  fill,
  border,
  borderSide,
  borderStyle,
  shadow,
  hoverable,
  padding,
  paddingX,
  paddingY,
  className,
  ...rest
}: SurfaceProps<E>) {
  const Comp: ElementType = as ?? "div";
  return <Comp className={surfaceClass({ fill, border, borderSide, borderStyle, shadow, hoverable, padding, paddingX, paddingY, className })} {...rest} />;
}

import type { ElementType } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import type { PressMotion } from "../tokens/vocabulary";
import { boxClass, type BoxOwnProps } from "./Box";
import { motionClass, pressBase } from "./Pressable.css";

export interface PressableOwnProps extends BoxOwnProps {
  /**
   * 몸짓 (기본 `none` — 누르지만 움직이지 않음). `sink` 는 그림자 위에서 가라앉고, `raise` 는 평평하다가 hover 때
   * 그림자가 올라오고, `lift` 는 떠오르고, `tap` 은 누르는 순간만 작아지고, `shrink` 는 그림자를 둔 채 hover 때부터 작아지고, `still` 은 그림자를 둔 채 움직이지 않습니다.
   * sink · raise · lift · shrink · still 은 그림자를 같이 가집니다
   */
  motion?: PressMotion;
  disabled?: boolean;
}

export type PressableProps<E extends ElementType = "button"> = PolyProps<E, PressableOwnProps>;

/** Pressable 의 몸짓을 class 로 — 의미(`type` · `disabled`)는 빠지므로, 누르는 물건을 직접 그리는 쪽은 `usePressable` 을 씁니다 */
export function pressClass({ motion = "none", ...box }: Omit<PressableOwnProps, "disabled">): string {
  return cx(pressBase, motionClass[motion], boxClass(box));
}

export interface UsePressableOptions extends PressableOwnProps {
  /** 그릴 요소 (기본 `button`) */
  as?: ElementType;
}

/**
 * 누르는 물건의 속 — `<Pressable>` 과 Button · 메뉴 칸이 같이 씁니다. 그릴 요소(`Comp`)와, 그 위에 펼칠 의미 ·
 * 몸짓(`pressProps`)을 돌려줍니다. `<button>` 이면 `type="button"` 과 native `disabled` 를, 링크처럼 다른
 * 요소면 `aria-disabled` 를 붙입니다 — 꺼진 모양은 둘 다 같은 class 가 그립니다.
 */
export function usePressable({ as, motion, disabled, ...box }: UsePressableOptions) {
  const Comp: ElementType = as ?? "button";
  const isButton = Comp === "button";
  return {
    Comp,
    pressProps: {
      type: isButton ? ("button" as const) : undefined,
      disabled: isButton ? disabled : undefined,
      "aria-disabled": !isButton && disabled ? (true as const) : undefined,
      className: pressClass({ motion, ...box }),
    },
  };
}

/**
 * 누르는 물건 — 2차 primitive (Box + 누름). '눌린다' 는 사실과 그 몸짓을 맡습니다: 버튼의 의미(`type` ·
 * `disabled` · `aria-disabled`) · 커서 · 꺼진 모양 · 움직임. 색은 하나도 없습니다 — hover 색까지 칠의
 * `hoverable` 이고, Pressable 이 그걸 켜 주지 않습니다. 골라진 상태도 없습니다 — 그건 `Selectable` 입니다.
 * 칠은 `paintClass()` · `surfaceClass()` · `glassClass()` 로 얹거나, 칠에 `as={Pressable}` 을 줍니다 —
 * Button 은 Pressable + Selectable + Paint, 누르는 카드는 Pressable + Surface 입니다.
 * 기본은 `<button type="button">`, 링크면 `as="a"` 나 라우터 링크.
 *
 * ```tsx
 * <Paint as={Pressable} motion="sink" accent="cyan" variant="solid" hoverable>Preview</Paint>
 * ```
 */
export function Pressable<E extends ElementType = "button">({
  as,
  motion,
  disabled,
  padding,
  paddingX,
  paddingY,
  className,
  ...rest
}: PressableProps<E>) {
  const { Comp, pressProps } = usePressable({ as, motion, disabled, padding, paddingX, paddingY, className });
  return <Comp {...pressProps} {...rest} />;
}

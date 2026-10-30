import type { AriaRole, ElementType, ReactNode } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { glassClass } from "../primitives/Glass";
import { Icon, type IconComponent } from "../primitives/Icon";
import { usePressable } from "../primitives/Pressable";
import { useSelectable } from "../primitives/Selectable";
import { CONTROL } from "../tokens/shape";
import { buttonBase, buttonSize, iconEndTurn, squareSize } from "./Button.css";

export interface NavButtonOwnProps {
  icon?: IconComponent;
  iconEnd?: IconComponent;
  /** 아이콘만 있을 때 스크린 리더가 읽을 이름 */
  label?: string;
  /** 골라진 상태 — 더 짙은 유리로 칠하고 aria 하나로 알립니다(Button 과 같이 `role` 이 정합니다) */
  selected?: boolean;
  role?: AriaRole;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export type NavButtonProps<E extends ElementType = "button"> = PolyProps<E, NavButtonOwnProps>;

/**
 * 색 바 위의 버튼 — Pressable(tap)에 Glass(유리 칠)를 얹은 것: 반투명 유리 면 · 진한 글자 · 반투명 테두리, hover 때 테두리가 진해집니다.
 * 유리는 어느 바 위에서도 흰색이고, 글자는 바의 글자색을 물려받습니다. 상단 바 · 하단 바 · 학기 선택에만 씁니다 — 흰 면 · 크림
 * 위에서는 Button.
 */
export function NavButton<E extends ElementType = "button">({
  as,
  icon,
  iconEnd,
  label,
  selected,
  role,
  size = "sm",
  disabled,
  className,
  children,
  ...rest
}: NavButtonProps<E>) {
  const iconOnly = !children && !!icon;
  const { Comp, pressProps } = usePressable({ as, motion: "tap", disabled });
  const { selectProps } = useSelectable({ selected, role });
  return (
    <Comp
      {...pressProps}
      {...selectProps}
      aria-label={iconOnly ? label : undefined}
      className={cx(
        pressProps.className,
        selectProps.className,
        buttonBase,
        buttonSize[size],
        iconOnly && squareSize[size],
        glassClass({ selected: Boolean(selected), hoverable: true }),
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size={CONTROL.icon[size]} />}
      {children}
      {iconEnd && <Icon icon={iconEnd} size={CONTROL.icon[size]} className={iconEndTurn} />}
    </Comp>
  );
}

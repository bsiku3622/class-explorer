import type { AriaRole, ElementType } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { Icon, type IconComponent } from "../primitives/Icon";
import { paintClass } from "../primitives/Paint";
import { usePressable } from "../primitives/Pressable";
import { useSelectable } from "../primitives/Selectable";
import { CONTROL } from "../tokens/shape";
import type { Accent, ControlSize, IconMotion, Variant } from "../tokens/vocabulary";
import { buttonBase, buttonSize, squareSize } from "./Button.css";
import { pressOf, type ButtonShadow } from "./Button";

export interface IconButtonOwnProps {
  icon: IconComponent;
  /** 스크린 리더가 읽을 이름 — 글자가 없는 버튼이라 반드시 줍니다 */
  label: string;
  accent?: Accent;
  /** 기본 `ghostMuted` — 닫기 · 새로고침처럼 옆 내용을 방해하지 않는 자리가 가장 많습니다 */
  variant?: Variant;
  size?: ControlSize;
  /** Button 과 같습니다 — `true` 면 sink, `"hover"` 면 raise, `"shrink"` 면 그림자를 둔 채 작아짐 */
  shadow?: ButtonShadow;
  /** Button 과 같습니다 — 골라진 색 · aria 하나 · 커지기 */
  selected?: boolean;
  role?: AriaRole;
  /** 아이콘이 제자리에서 돕니다 — 불러오는 동안의 새로고침 */
  iconSpin?: boolean;
  /** 마우스를 올리면 아이콘만 움직입니다 */
  iconMotion?: IconMotion;
  disabled?: boolean;
  className?: string;
}

export type IconButtonProps<E extends ElementType = "button"> = PolyProps<E, IconButtonOwnProps>;

/** 아이콘 하나짜리 정사각 버튼 — Button 과 같이 Pressable + Selectable + Paint 입니다 */
export function IconButton<E extends ElementType = "button">({
  as,
  icon,
  label,
  accent,
  variant = "ghostMuted",
  size = "md",
  shadow = false,
  selected,
  role,
  iconSpin = false,
  iconMotion,
  disabled,
  className,
  ...rest
}: IconButtonProps<E>) {
  const { motion, grow } = pressOf(variant, shadow, selected);
  const { Comp, pressProps } = usePressable({ as, motion, disabled });
  const { selectProps } = useSelectable({ selected, role, grow });
  return (
    <Comp
      {...pressProps}
      {...selectProps}
      aria-label={label}
      title={label}
      className={cx(
        pressProps.className,
        selectProps.className,
        paintClass({ accent, variant, selected, hoverable: true }),
        buttonBase,
        buttonSize[size],
        squareSize[size],
        className,
      )}
      {...rest}
    >
      <Icon icon={icon} size={CONTROL.icon[size]} spin={iconSpin} motion={iconMotion} />
    </Comp>
  );
}

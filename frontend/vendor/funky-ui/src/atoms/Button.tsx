import type { AriaRole, ElementType, ReactNode, SyntheticEvent } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { Icon, type IconComponent } from "../primitives/Icon";
import { paintClass } from "../primitives/Paint";
import { usePressable } from "../primitives/Pressable";
import { useSelectable } from "../primitives/Selectable";
import { BORDERLESS_VARIANTS } from "../tokens/color-recipes";
import { CONTROL } from "../tokens/shape";
import type { Accent, ControlSize, IconMotion, PressMotion, Variant } from "../tokens/vocabulary";
import { buttonBase, buttonSize, buttonWrap, fullWidth as fullWidthClass, iconEndTurn, loading as loadingClass, loadingSpinner, plainCase } from "./Button.css";
import { Spinner } from "./Spinner";

export type ButtonShadow = boolean | "hover" | "shrink" | "static";

export interface ButtonOwnProps {
  /** 색 — 주지 않으면 바깥 Paint 의 색을 따르고, 바깥에도 없으면 검정(시스템)입니다 */
  accent?: Accent;
  /** 칠하는 방식 (기본 `outline`) — 15 가지 레시피는 docs/foundations/color.md */
  variant?: Variant;
  size?: ControlSize;
  /**
   * 4px 그림자. `true` 면 그림자 위에 떠 있다가 hover 때 가라앉고(sink), `"hover"` 면 평평하다가 hover 때
   * 그림자가 올라오고(raise), `"shrink"` 면 그림자를 둔 채 hover 때 작아지고(Ask 단추 전용), `"static"` 이면 그림자를 둔 채
   * 움직이지 않습니다(밖에서 켠 상태 · 꺼진 칸). 테두리가 없는 variant(ghost)는 그림자를 받지 않습니다
   */
  shadow?: ButtonShadow;
  /**
   * 골라진 상태 — 같은 accent 의 filled 로 칠하고, 그 사실을 aria 하나로 알립니다(그냥 버튼은 `aria-pressed`,
   * `role="radio"` 는 `aria-checked`, `role="tab"` 은 `aria-selected`). 골라진 버튼은 105% 로 커져 4px 그림자 위에
   * 섭니다 — 쉴 때 그림자가 없던 버튼(muted 칩)도 같습니다. hover 때 그림자만 숨고, 누르면 100% 로 돌아옵니다
   */
  selected?: boolean;
  /** 요소의 role — 골라짐을 알리는 aria 가 이걸로 정해집니다. 고르는 무리의 칸이면 `radio` · `tab` */
  role?: AriaRole;
  loading?: boolean;
  /** 앞 아이콘 — 크기와 굵기는 버튼 크기가 정합니다 */
  icon?: IconComponent;
  /** 뒤 아이콘 — 판을 열어 둔 동안(`aria-expanded`) 뒤집힙니다 */
  iconEnd?: IconComponent;
  /** 앞 아이콘이 제자리에서 돕니다 — 라벨을 지운 `loading` 과 달리 글자가 그대로 있는 새로고침 */
  iconSpin?: boolean;
  /** 마우스를 올리면 아이콘만 움직입니다. 앞 아이콘에, 없으면 뒤 아이콘에 겁니다 */
  iconMotion?: IconMotion;
  /** 대문자로 그립니다 (기본 true). 소문자가 뜻인 라벨이면 끕니다 */
  uppercase?: boolean;
  /** 긴 문장 라벨 — 줄바꿈되고 높이가 글자를 따라 늘어납니다 */
  wrap?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps<E extends ElementType = "button"> = PolyProps<E, ButtonOwnProps>;

const swallow = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * 그림자 · 골라짐에서 몸짓을 고릅니다 — 그림자를 켜면 sink(가라앉음), `"hover"` 면 raise(올라옴), `"shrink"` 면 shrink(작아짐), `"static"` 이면 still(그대로), 끄면 tap.
 * 골라진 버튼은 그림자와 상관없이 커집니다(Selectable 의 grow) — class-explorer 에서 쉴 때 평평한 칩도 골라지면
 * 커지며 그림자가 생깁니다. grow 가 몸짓을 덮으므로 motion 은 쉴 때의 것을 그대로 둡니다.
 * 테두리가 없는 variant(ghost)는 가라앉을 상자가 없어 그림자를 받지 않습니다. IconButton · SideNav.Item 이 같은 규칙을 씁니다.
 */
export function pressOf(variant: Variant, shadow: ButtonShadow, selected: boolean | undefined): { motion: PressMotion; grow: boolean } {
  const grow = Boolean(selected);
  if (!shadow || BORDERLESS_VARIANTS.includes(variant)) return { motion: "tap", grow };
  if (shadow === "hover") return { motion: "raise", grow };
  if (shadow === "shrink") return { motion: "shrink", grow };
  if (shadow === "static") return { motion: "still", grow };
  return { motion: "sink", grow };
}

/**
 * 버튼 — Pressable(누름) + Selectable(골라짐) + Paint(칠)에 크기 · 아이콘 · 불러오기를 얹은 것입니다.
 *
 * ```tsx
 * <Button accent="green" variant="outline">유지</Button>
 * <Button variant="muted" selected={on}>전체</Button>
 * <Button as={Link} to="/trade" accent="cyan" variant="solid" shadow iconEnd={ArrowRight}>Trade</Button>
 * ```
 */
export function Button<E extends ElementType = "button">({
  as,
  accent,
  variant = "outline",
  size = "md",
  shadow = false,
  selected,
  role,
  loading = false,
  icon,
  iconEnd,
  iconSpin = false,
  iconMotion,
  uppercase = true,
  wrap = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps<E>) {
  const { motion, grow } = pressOf(variant, shadow, selected);
  const { Comp, pressProps } = usePressable({ as, motion, disabled });
  const { selectProps } = useSelectable({ selected, role, grow });
  const iconSize = CONTROL.icon[size];
  return (
    <Comp
      {...pressProps}
      {...selectProps}
      aria-disabled={loading || pressProps["aria-disabled"] ? true : undefined}
      aria-busy={loading || undefined}
      // 불러오는 동안은 누름을 삼킵니다 — 포인터만 막으면 Enter · Space 가 onClick 에 닿습니다.
      // disabled 를 쓰지 않는 이유는 꺼진 모양(opacity)이 아니라 스피너를 보여야 해서입니다.
      onClickCapture={loading ? swallow : undefined}
      className={cx(
        pressProps.className,
        selectProps.className,
        paintClass({ accent, variant, selected, hoverable: true }),
        buttonBase,
        buttonSize[size],
        !uppercase && plainCase,
        wrap && buttonWrap,
        fullWidth && fullWidthClass,
        loading && loadingClass,
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size={iconSize} spin={iconSpin} motion={iconMotion} />}
      {children}
      {iconEnd && <Icon icon={iconEnd} size={iconSize} motion={icon ? undefined : iconMotion} className={iconEndTurn} />}
      {loading && (
        <span className={loadingSpinner}>
          <Spinner size={size === "lg" ? "md" : "sm"} label="불러오는 중" />
        </span>
      )}
    </Comp>
  );
}

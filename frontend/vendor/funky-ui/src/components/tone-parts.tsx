/**
 * 실행 중의 색으로 칠하는 부품 — ToneButton · ToneChip · ToneBox · ToneSwatch · ToneText.
 * 색은 앱이 학과 · 학번으로 정해 `tone`(hex)으로 넘깁니다. Button · Paint 는 hex 를 받지 않고, 그 길은 이 층에만 있습니다.
 */
import type { ComponentPropsWithRef, CSSProperties, ElementType } from "react";

import { Button, type ButtonOwnProps } from "../atoms/Button";
import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { boxClass, type BoxOwnProps } from "../primitives/Box";
import { usePressable } from "../primitives/Pressable";
import { useSelectable } from "../primitives/Selectable";
import { Text, type TextOwnProps } from "../primitives/Text";
import { toneFaceStyle, toneStyle } from "./tone";
import { toneBox, toneBoxFramed, toneButtonSelected, toneChip, toneChipOff, toneChipOn, toneRail, toneRailEmpty, toneSwatch, toneSwatchEmpty } from "./tone-parts.css";

const ButtonRoot = Button as ElementType;
const TextRoot = Text as ElementType;

export type ToneButtonProps<E extends ElementType = "button"> = PolyProps<
  E,
  Omit<ButtonOwnProps, "accent" | "variant"> & {
    /** 칠할 색 (hex) — 골라졌을 때 면이 되고, 글자는 그 면에서 읽히는 검정 · 흰색이 됩니다 */
    tone: string;
    style?: CSSProperties;
  }
>;

/**
 * 색 버튼 — 안 골린 칸은 흰 면(`paper`)이고, 골라지면 그 색의 면이 됩니다. 셋을 다 칠하면 어느 것을 보고 있는지 색으로
 * 가릴 수 없어서입니다. 그림자 · 커짐은 Button 과 같습니다 (기본 `shadow`)
 */
export function ToneButton<E extends ElementType = "button">({ tone, shadow = true, selected, className, style, ...rest }: ToneButtonProps<E>) {
  return (
    <ButtonRoot
      variant="paper"
      shadow={shadow}
      selected={selected}
      className={cx(selected && toneButtonSelected, className)}
      style={toneFaceStyle(tone, style)}
      {...rest}
    />
  );
}

export type ToneChipProps = ComponentPropsWithRef<"button"> & {
  /** 칠할 색 (hex) */
  tone: string;
  /** 켜짐 — 안 주면 꺼진 칩입니다 */
  selected?: boolean;
};

/**
 * 여러 개를 함께 켜는 색 칩 (기수 거르개) — 켜면 tone 12% 면에 그림자 위에 서고, 끄면 흐린 회색으로 물러납니다.
 * 기본으로 전부 켜 두는 줄이라 Button 과 달리 커지지 않습니다 — 다 같이 커지면 뜻이 없습니다
 */
export function ToneChip({ tone, selected = false, disabled, className, style, children, ...rest }: ToneChipProps) {
  const { Comp, pressProps } = usePressable({ motion: selected ? "sink" : "none", disabled });
  const { selectProps } = useSelectable({ selected });
  return (
    <Comp {...pressProps} {...selectProps} className={cx(pressProps.className, selectProps.className, toneChip, selected ? toneChipOn : toneChipOff, className)} style={toneStyle(tone, style)} {...rest}>
      <span aria-hidden="true" className={cx(toneSwatch, !selected && toneSwatchEmpty)} />
      {children}
    </Comp>
  );
}

export type ToneBoxProps<E extends ElementType = "div"> = PolyProps<
  E,
  BoxOwnProps & {
    /** 칠할 색 (hex) */
    tone: string;
    /** 그 색의 2px 테두리 (기본 true). 카드 안의 칸처럼 이미 틀이 있으면 끕니다 */
    framed?: boolean;
    style?: CSSProperties;
  }
>;

/** 색을 깐 상자 — tone 8% 면과 그 색의 테두리입니다. 글자는 바깥 글자색 그대로이고, 칠하지 않습니다 */
export function ToneBox<E extends ElementType = "div">({ as, tone, framed = true, padding, paddingX, paddingY, className, style, ...rest }: ToneBoxProps<E>) {
  const Comp: ElementType = as ?? "div";
  return <Comp className={cx(toneBox, framed && toneBoxFramed, boxClass({ padding, paddingX, paddingY, className }))} style={toneStyle(tone, style)} {...rest} />;
}

export type ToneSwatchProps = ComponentPropsWithRef<"span"> & {
  /** 칠할 색 (hex). 없으면 자리만 지킵니다 — 수업이 없는 줄의 띠 */
  tone?: string;
  /** `box` 는 16px 범례 칸, `rail` 은 줄 높이를 채우는 4px 왼쪽 띠입니다 (기본 `box`) */
  shape?: "box" | "rail";
};

/** 범례 칸 · 왼쪽 띠 — 뜻은 옆 글자가 말하므로 스크린 리더에게 읽히지 않습니다. accent 로 칠하는 점 · 띠는 `Swatch` 입니다 */
export function ToneSwatch({ tone, shape = "box", className, style, ...rest }: ToneSwatchProps) {
  const rail = shape === "rail";
  return <span aria-hidden="true" className={cx(rail ? toneRail : toneSwatch, !tone && (rail ? toneRailEmpty : toneSwatchEmpty), className)} style={toneStyle(tone, style)} {...rest} />;
}

export type ToneTextProps<E extends ElementType = "span"> = PolyProps<
  E,
  Omit<TextOwnProps, "tone"> & {
    /** 글자색 (hex) */
    tone: string;
    style?: CSSProperties;
  }
>;

/** 실행 중의 색으로 칠하는 글자 — Text 의 글자 역할을 그대로 받습니다. ⚠️ 흰 면 위의 대비는 그 색에 달렸으니 큰 글자 · 이름에만 씁니다 */
export function ToneText<E extends ElementType = "span">({ tone, style, ...rest }: ToneTextProps<E>) {
  return <TextRoot style={{ color: tone, ...style }} {...rest} />;
}

import type { ElementType } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { pulseClass } from "../styles/enter.css";
import { alignClass, decorationClass, familyClass, leadingClass, numericClass, textRoleClass, toneClass, truncateClass, uppercaseClass, weightClass } from "../styles/typography.css";
import type { Family, Leading, TextDecoration, TextVariant, Tone, Weight } from "../tokens/vocabulary";

export interface TextOwnProps {
  /** 글자 역할 — 크기 · 줄 높이 · 굵기 · 자간 · 대소문자를 한 번에 고릅니다 */
  variant?: TextVariant;
  /** 역할의 기본 굵기를 바꿀 때만 */
  weight?: Weight;
  /** 줄 높이 — 여러 줄 문단이면 `relaxed` (기본은 역할이 정한 고정값) */
  leading?: Leading;
  /**
   * 글자색 — `accent` 는 지금 accent 의 진한 글자, `accentSoft` 는 연한 글자. 색 이름(`pink` · `error` …)은 그 색의
   * 원색이고, 이 글자만 칠합니다 — 안쪽의 accent 를 바꾸지 않습니다
   */
  tone?: Tone;
  family?: Family;
  align?: "start" | "center" | "end";
  /** 한 줄에서 자르고 … 을 붙입니다 */
  truncate?: boolean;
  /** 숫자 글리프만 같은 폭으로 (표 · 시각) */
  numeric?: boolean;
  /** 역할이 정한 것과 상관없이 대문자로 그립니다 */
  uppercase?: boolean;
  /** 글자에 긋는 선 — 취소선 · 굵은 밑줄 */
  decoration?: TextDecoration;
  /** 불러오는 동안 깜빡입니다 — 글자 자리를 지키는 "Loading…" */
  pulse?: boolean;
  className?: string;
}

export type TextProps<E extends ElementType = "span"> = PolyProps<E, TextOwnProps>;

/** 글자 — 태그(`as`)와 생김새(`variant`)는 따로 고릅니다 */
export function Text<E extends ElementType = "span">({
  as,
  variant = "body",
  weight,
  leading,
  tone,
  family,
  align,
  truncate,
  numeric,
  uppercase,
  decoration,
  pulse,
  className,
  ...rest
}: TextProps<E>) {
  const Comp: ElementType = as ?? "span";
  return (
    <Comp
      className={cx(
        textRoleClass[variant],
        leading && leadingClass[leading],
        weight && weightClass[weight],
        tone && toneClass[tone],
        family && familyClass[family],
        align && alignClass[align],
        truncate && truncateClass,
        numeric && numericClass,
        uppercase && uppercaseClass,
        decoration && decorationClass[decoration],
        pulse && pulseClass,
        className,
      )}
      {...rest}
    />
  );
}

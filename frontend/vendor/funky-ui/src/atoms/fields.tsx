/** 입력 아톰 셋 — Input · Textarea · Select. native 요소에 ref 와 폼 속성이 그대로 갑니다 */
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "../internal/cx";
import { ChevronDownGlyph } from "../internal/glyphs";
import { surfaceClass } from "../primitives/Surface";
import { CONTROL } from "../tokens/shape";
import type { ControlSize } from "../tokens/vocabulary";
import { field, fieldBare, fieldShadow, fieldShadowXl, fieldSize, select, selectArrow, selectArrowPos, selectPad, selectWrap, textarea, textareaSize } from "./field.css";

export interface FieldStateProps {
  /** 틀린 값 — 빨간 테두리 + `aria-invalid` */
  invalid?: boolean;
  /** 막지 않는 경고 — 주황 테두리. 값은 받되 한 번 더 보라는 뜻입니다 */
  warning?: boolean;
  /** 비어 있거나 해당 없는 칸 — 옅은 테두리 · 약한 글자. hover 때 테두리가 진해집니다 */
  quiet?: boolean;
  /** 4px 그림자 위에 띄웁니다 (폼의 주인공 칸). 포커스를 받으면 그림자를 거둡니다 — 그 자리는 핑크 포커스 링이 맡습니다 */
  shadow?: boolean;
}

interface FieldOwnProps extends FieldStateProps {
  /** 높이 사다리 — Button 과 같은 크기면 같은 높이입니다 (기본 `md`) */
  size?: ControlSize;
}

/**
 * 입력 칸의 속 — Input · Textarea · Select 가 같이 씁니다. 면 · 테두리는 Surface(흰 면 · 2px 검정)에서 빌리고,
 * 상태는 한 규칙으로 그립니다: 틀림(빨간 테두리 + `aria-invalid`) · 경고(주황 테두리) · 물러남(옅은 테두리) · 꺼짐(옅게) ·
 * 읽기 전용(오목한 면) · 그림자(포커스 때 거둠). 칸의 크기(높이 · 안쪽 여백)는 쓰는 쪽이 붙입니다.
 */
export function useField({ invalid, warning, quiet, shadow }: FieldStateProps) {
  return {
    fieldProps: {
      "aria-invalid": invalid || undefined,
      "data-warning": warning || undefined,
      "data-quiet": quiet || undefined,
      className: cx(surfaceClass({ fill: "raised", border: "line" }), field, shadow && fieldShadow),
    },
  };
}

export type InputProps = Omit<ComponentPropsWithRef<"input">, "size"> &
  FieldOwnProps & {
    /** 줄 안에서 치는 칸 — 면 · 테두리 · 높이 없이 글자는 바깥 것을 씁니다 (표 칸의 숫자 · 글자 입력) */
    bare?: boolean;
  };

export function Input({ size = "md", invalid, warning, quiet, shadow, bare = false, className, ...rest }: InputProps) {
  const { fieldProps } = useField({ invalid, warning, quiet, shadow: shadow && size !== "xl" });
  if (bare) return <input aria-invalid={invalid || undefined} className={cx(fieldBare, className)} {...rest} />;
  return <input {...fieldProps} className={cx(fieldProps.className, fieldSize[size], shadow && size === "xl" && fieldShadowXl, className)} {...rest} />;
}

export type TextareaProps = ComponentPropsWithRef<"textarea"> & FieldOwnProps;

export function Textarea({ size = "md", invalid, warning, quiet, shadow, className, rows = 4, ...rest }: TextareaProps) {
  const { fieldProps } = useField({ invalid, warning, quiet, shadow });
  return <textarea rows={rows} {...fieldProps} className={cx(fieldProps.className, textarea, textareaSize[size], className)} {...rest} />;
}

export type SelectProps = Omit<ComponentPropsWithRef<"select">, "size"> & FieldOwnProps & { children?: ReactNode };

/** native select — 목록은 운영체제가 그립니다 (폰에서 가장 잘 고르는 방법입니다) */
export function Select({ size = "md", invalid, warning, quiet, shadow, className, children, ...rest }: SelectProps) {
  const { fieldProps } = useField({ invalid, warning, quiet, shadow });
  return (
    <span className={cx(selectWrap, className)}>
      <select {...fieldProps} className={cx(fieldProps.className, fieldSize[size], select, selectPad[size])} {...rest}>
        {children}
      </select>
      <ChevronDownGlyph size={CONTROL.icon[size]} strokeWidth={3} className={cx(selectArrow, selectArrowPos[size])} />
    </span>
  );
}

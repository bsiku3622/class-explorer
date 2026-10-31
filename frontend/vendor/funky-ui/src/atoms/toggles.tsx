/** 고르는 아톰 셋 — Checkbox · Radio · Switch. ref 와 폼 속성은 native input 으로 갑니다 */
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "../internal/cx";
import { CheckGlyph } from "../internal/glyphs";
import { checkBox, checkNative, control, native, radioBox, radioDot, radioNative, switchNative, thumb, toggleRoot, track } from "./toggles.css";

/**
 * accent 를 고르지 않습니다 — 켜진 색은 검정이고, 색이 있는 Paint 안에서는 다른 요소처럼 그 색을 따릅니다.
 * class-explorer 에 색을 고르는 토글이 없었습니다(학번 색 필터 칩은 런타임 색이라 Components 몫입니다).
 */
interface ToggleOwnProps {
  /** 옆에 붙는 글자 — 누르는 자리가 글자까지 넓어집니다 */
  children?: ReactNode;
}

type ToggleProps = Omit<ComponentPropsWithRef<"input">, "type" | "children"> & ToggleOwnProps;

function rootClass(className: string | undefined) {
  return cx(toggleRoot, className);
}

export type CheckboxProps = ToggleProps;

export function Checkbox({ children, className, ...rest }: CheckboxProps) {
  return (
    <label className={rootClass(className)}>
      <span className={control}>
        <input type="checkbox" className={cx(native, checkNative)} {...rest} />
        <span className={checkBox} aria-hidden="true">
          <CheckGlyph size={12} strokeWidth={4} />
        </span>
      </span>
      {children}
    </label>
  );
}

export type RadioProps = ToggleProps;

export function Radio({ children, className, ...rest }: RadioProps) {
  return (
    <label className={rootClass(className)}>
      <span className={control}>
        <input type="radio" className={cx(native, radioNative)} {...rest} />
        <span className={radioBox} aria-hidden="true">
          <span className={radioDot} />
        </span>
      </span>
      {children}
    </label>
  );
}

export type SwitchProps = ToggleProps;

/** 켜고 끄는 스위치 — native checkbox 에 `role="switch"` 를 붙입니다 */
export function Switch({ children, className, ...rest }: SwitchProps) {
  return (
    <label className={rootClass(className)}>
      <span className={control}>
        <input type="checkbox" role="switch" className={cx(native, switchNative)} {...rest} />
        <span className={track} aria-hidden="true">
          <span className={thumb} />
        </span>
      </span>
      {children}
    </label>
  );
}

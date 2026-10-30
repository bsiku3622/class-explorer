import type { ComponentPropsWithRef } from "react";

import { cx } from "../internal/cx";
import { useAccent } from "../primitives/Paint";
import { pulseClass } from "../styles/enter.css";
import type { Accent, SwatchRung, SwatchShape } from "../tokens/vocabulary";
import { swatchRung, swatchShape } from "./Swatch.css";

export type SwatchProps = ComponentPropsWithRef<"span"> & {
  /** 색 — 주지 않으면 바깥 Paint 의 색을 따르고, 바깥에도 없으면 검정(시스템)입니다 */
  accent?: Accent;
  /** `dot` 은 8px 네모 점(분류), `round` 는 8px 둥근 점(상태), `rail` 은 4px 왼쪽 띠 — 줄의 높이를 채웁니다 */
  shape?: SwatchShape;
  /** 사다리의 어느 칸으로 칠할지 (기본 `solid`). 회색 분류는 검정의 `softInk` · `soft` 입니다 */
  rung?: SwatchRung;
  /** 깜빡입니다 — 살아 있는 상태 점 */
  pulse?: boolean;
};

/**
 * 분류 표시 — 색 하나로 묶음을 알리는 점과 띠입니다. 글자가 없고 뜻은 옆 글자가 말하므로 스크린 리더에게 읽히지 않습니다.
 * Link · Stat · Meter 처럼 Variant 없이 자기 색을 칠합니다
 */
export function Swatch({ accent, shape = "dot", rung = "solid", pulse = false, className, ...rest }: SwatchProps) {
  return <span aria-hidden="true" className={cx(swatchShape[shape], swatchRung[rung], useAccent(accent), pulse && pulseClass, className)} {...rest} />;
}

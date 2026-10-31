/** 접근성 primitive — 보이지 않는 이름표와 문서 끝으로 옮겨 그리는 Portal */
import type { ElementType, ReactNode } from "react";
import { createPortal } from "react-dom";

import type { PolyProps } from "../internal/polymorphic";
import { visuallyHidden } from "./a11y.css";

export type VisuallyHiddenProps<E extends ElementType = "span"> = PolyProps<E, { className?: string }>;

/** 화면에는 없고 스크린 리더만 읽는 글자 */
export function VisuallyHidden<E extends ElementType = "span">({ as, className, ...rest }: VisuallyHiddenProps<E>) {
  const Comp: ElementType = as ?? "span";
  return <Comp className={className ? `${visuallyHidden} ${className}` : visuallyHidden} {...rest} />;
}

/**
 * body 끝(또는 `container`)에 그립니다 — Tooltip · Menu 가 카드의 overflow 에 잘리지 않게.
 * ⚠️ 마운트 뒤 effect 에서 그리지 않습니다. 그러면 여는 순간의 layout effect 가 판을 못 찾아
 * 위치를 못 잽니다 (판이 화면 밖에 남습니다). 이 패키지는 브라우저 전용이라 곧바로 그립니다.
 */
export function Portal({ children, container }: { children: ReactNode; container?: Element | null }) {
  return typeof document === "undefined" ? null : createPortal(children, container ?? document.body);
}

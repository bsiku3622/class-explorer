import type { ComponentPropsWithRef, ElementType } from "react";

/**
 * `as` 로 렌더할 요소를 바꾸는 컴포넌트의 props — 자기 prop 이 같은 이름의 HTML 속성을 가립니다.
 * React 19 라 `ref` 는 일반 prop 으로 그대로 흘러갑니다.
 */
export type PolyProps<E extends ElementType, Own> = Own & { as?: E } & Omit<ComponentPropsWithRef<E>, keyof Own | "as">;

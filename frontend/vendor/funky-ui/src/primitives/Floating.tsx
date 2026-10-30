import { useEffect, useRef, type CSSProperties, type ElementType, type RefObject } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { useAnchor, type AnchorAlign, type Placement } from "../internal/useAnchor";
import { enterClass } from "../styles/enter.css";
import type { EnterMotion } from "../tokens/vocabulary";
import { Portal } from "./a11y";
import { boxClass, type BoxOwnProps } from "./Box";
import { floatingLayer, floatingScrim } from "./Floating.css";

/** 판이 닫히자고 하는 까닭 — 바깥을 눌렀다 · Esc 를 눌렀다 */
export type DismissReason = "outside" | "escape";

export interface FloatingOwnProps extends BoxOwnProps {
  /** 기준 요소 — 판이 이 요소 옆에 붙고, 이 요소를 누르는 것은 '바깥' 이 아닙니다 */
  anchor: RefObject<HTMLElement | null>;
  /** 위 · 아래 (기본 `bottom`). 화면 밖으로 나가면 반대쪽으로 뒤집습니다 */
  placement?: Placement;
  /** 판을 기준 요소의 어느 끝에 맞출지 (기본 `start`). `center` 가 아니면 기준 요소보다 좁아지지 않습니다 */
  align?: AnchorAlign;
  /** 쌓는 층 (기본 `dropdown`) — 설명 풍선은 `tooltip` */
  layer?: "dropdown" | "tooltip";
  /** 등장 몸짓 (기본 `rise`) */
  enter?: EnterMotion;
  /**
   * 바깥을 누르거나 Esc 를 누르면 부릅니다. 주지 않으면 스스로 닫히지 않는 판입니다 — 여는 쪽이 닫습니다.
   * Esc 는 여기서 멈춥니다: 모달 안에서 열린 판이면 첫 Esc 는 판만, 다음 Esc 가 모달을 닫습니다
   */
  onDismiss?: (reason: DismissReason) => void;
  /** 열릴 때 포커스를 줄 요소를 판 안에서 고릅니다 — 메뉴는 골라진 칸, 없으면 첫 칸 */
  initialFocus?: (panel: HTMLElement) => HTMLElement | null | undefined;
  /** 뒤 화면을 어둡게 하고 누름을 막습니다 — 바깥을 눌러 닫을 때 뒤의 버튼이 같이 눌리지 않습니다 (하단 바 More 판) */
  scrim?: boolean;
  style?: CSSProperties;
}

export type FloatingProps<E extends ElementType = "div"> = PolyProps<E, FloatingOwnProps>;

/**
 * 떠 있는 판 — 2차 primitive (Box + 띄우기). 판이 **어디에 · 언제** 있는지를 맡습니다: 문서 끝에 그리기(Portal),
 * 기준 요소 옆에 붙이기 · 뒤집기, 쌓는 층, 바깥 누름 · Esc 로 닫자고 알리기, 열릴 때 포커스, 등장 몸짓.
 * 그려져 있는 동안이 열려 있는 동안입니다 — `{open && <Floating …>}`. 면은 `surfaceClass()` 로 얹습니다.
 * 모달(`<dialog>`) 안에서 열리면 그 안에 그립니다 — body 에 그리면 모달 바깥이라 inert 가 되어 누를 수 없습니다.
 *
 * ```tsx
 * {open && (
 *   <Floating anchor={anchorRef} role="menu" onDismiss={() => setOpen(false)} className={surfaceClass({ border: "line", shadow: "raised" })}>
 *     …
 *   </Floating>
 * )}
 * ```
 */
export function Floating<E extends ElementType = "div">({
  as,
  anchor,
  placement = "bottom",
  align = "start",
  layer = "dropdown",
  enter = "rise",
  onDismiss,
  initialFocus,
  scrim = false,
  padding,
  paddingX,
  paddingY,
  className,
  style,
  ...rest
}: FloatingProps<E>) {
  const Comp: ElementType = as ?? "div";
  const panel = useRef<HTMLElement>(null);
  const position = useAnchor(anchor, panel, placement, align);

  // 지난 렌더의 onDismiss 를 들고 있습니다 — 매번 새 함수가 와도 문서 리스너를 다시 달지 않습니다
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  const dismissible = onDismiss !== undefined;

  useEffect(() => {
    if (!dismissible) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !panel.current?.contains(t)) dismiss.current?.("outside");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      dismiss.current?.("escape");
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissible, anchor]);

  // 여는 순간 한 번만 — 판 안을 돌아다니는 동안 다시 끌어오지 않습니다
  const focusOnOpen = useRef(initialFocus);
  useEffect(() => {
    if (panel.current) focusOnOpen.current?.(panel.current)?.focus();
  }, []);

  // 기준 요소가 이미 화면에 있을 때 열리므로(누르거나 올려야 열립니다) 렌더 중에 읽어도 비어 있지 않습니다
  const container = anchor.current?.closest("dialog[open]");

  return (
    <Portal container={container}>
      {scrim && <div className={floatingScrim} />}
      <Comp
        ref={panel}
        className={cx(floatingLayer[layer], enterClass[enter], boxClass({ padding, paddingX, paddingY, className }))}
        style={{ ...style, ...position }}
        {...rest}
      />
    </Portal>
  );
}

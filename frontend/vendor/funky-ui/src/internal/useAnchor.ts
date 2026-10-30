/**
 * 떠 있는 판(Floating)을 기준 요소 옆에 붙입니다 — position: fixed 좌표를 계산해 돌려줍니다.
 * 판이 그려져 있는 동안(= 열려 있는 동안) 스크롤 · 크기 변화 때 다시 잽니다. 화면 밖으로 나가면 반대쪽으로
 * 뒤집고, 좌우는 화면 안에 묶습니다.
 */
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export type Placement = "top" | "bottom";
export type AnchorAlign = "start" | "center" | "end";

const GAP = 8;
const EDGE = 8;

export function useAnchor(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  placement: Placement = "bottom",
  align: AnchorAlign = "start",
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const measure = () => {
      const a = anchor.current?.getBoundingClientRect();
      const f = floating.current;
      if (!a || !f) return;
      const fw = f.offsetWidth;
      const fh = f.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      let side = placement;
      if (side === "bottom" && a.bottom + GAP + fh > vh && a.top - GAP - fh > 0) side = "top";
      if (side === "top" && a.top - GAP - fh < 0) side = "bottom";
      const top = side === "bottom" ? a.bottom + GAP : a.top - GAP - fh;
      let left = align === "start" ? a.left : align === "end" ? a.right - fw : a.left + a.width / 2 - fw / 2;
      left = Math.max(EDGE, Math.min(left, vw - fw - EDGE));
      // 가운데 맞춤이면 폭을 건드리지 않습니다 — 키를 undefined 로라도 두면 쓰는 쪽이 준 minWidth 를 덮어씁니다
      setStyle(align === "center" ? { position: "fixed", top, left } : { position: "fixed", top, left, minWidth: a.width });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor, floating, placement, align]);

  return style;
}

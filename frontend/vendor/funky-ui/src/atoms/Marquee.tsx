import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cx } from "../internal/cx";
import { marqueeBox, marqueeMoving, marqueeTrack } from "./Marquee.css";

/** 픽셀/초 — 눈으로 따라 읽을 수 있는 속도. 거리와 무관하게 일정합니다 */
const SPEED = 45;
/** 왕복 중 실제로 움직이는 시간의 비율. 나머지는 양 끝에서 멈춰 있습니다 */
const TRAVEL_RATIO = 0.7;
/** 몇 px 차이는 반올림 오차라 움직일 이유가 안 됩니다 */
const MIN_OVERFLOW = 4;
/** 아주 조금 넘칠 때 왕복이 너무 빠르지 않게 잡는 최소 시간(초) */
const MIN_DURATION = 6;

export interface MarqueeProps {
  className?: string;
  children?: ReactNode;
}

/**
 * 한 줄인데 자리가 모자랄 때 `…` 로 자르는 대신 좌우로 훑고 돌아옵니다 — 문장 전체가 곧 내용인 자리(배너)에 씁니다.
 * 넘칠 때만 움직이고, 폭이 바뀌면 다시 재고, 움직임을 줄인 사람에게는 움직이지 않습니다.
 */
export function Marquee({ className, children }: MarqueeProps) {
  const box = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const over = el.scrollWidth - el.clientWidth;
      setShift(!reduce && over > MIN_OVERFLOW ? over : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  const moving: CSSProperties | undefined = shift
    ? ({ "--fk-marquee-shift": `-${shift}px`, "--fk-marquee-duration": `${Math.max(MIN_DURATION, (shift * 2) / SPEED / TRAVEL_RATIO).toFixed(1)}s` } as CSSProperties)
    : undefined;

  return (
    <span ref={box} className={cx(marqueeBox, className)}>
      <span className={cx(marqueeTrack, shift > 0 && marqueeMoving)} style={moving}>
        {children}
      </span>
    </span>
  );
}

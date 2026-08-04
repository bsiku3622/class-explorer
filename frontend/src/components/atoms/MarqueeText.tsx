/**
 * 한 줄인데 자리가 모자랄 때 **`…` 로 자르는 대신 좌우로 훑고 돌아옵니다.**
 *
 * 잘린 문장은 뒷말을 영영 못 읽습니다 — 배너처럼 문장 전체가 곧 내용인 자리에서는
 * 자르는 게 정보를 지우는 것과 같습니다.
 *
 * **넘칠 때만 움직입니다.** 넉넉히 들어가는 화면에서까지 흔들면 읽는 데 방해만 되고,
 * 이 앱에서 움직이는 것은 "지금" 하나뿐이어야 합니다. 폭이 바뀌면 다시 재고
 * (`ResizeObserver`), 시스템이 모션을 줄이라고 하면 움직이지 않습니다.
 *
 * 속도는 거리와 무관하게 일정합니다 — 긴 문장일수록 오래 걸릴 뿐, 더 빨라지지
 * 않습니다. 양 끝에서는 잠깐 멈춰야 읽을 틈이 생깁니다.
 */

import React, { useLayoutEffect, useRef, useState } from "react";

/** 픽셀/초. 눈으로 따라 읽을 수 있는 속도 */
const SPEED = 45;
/** 왕복 중 실제로 움직이는 시간의 비율 (나머지는 양 끝에서 멈춰 있습니다) */
const TRAVEL_RATIO = 0.7;

interface MarqueeTextProps {
    children: React.ReactNode;
    className?: string;
}

const MarqueeText: React.FC<MarqueeTextProps> = ({ children, className = "" }) => {
    const boxRef = useRef<HTMLSpanElement>(null);
    const [shift, setShift] = useState(0);

    useLayoutEffect(() => {
        const box = boxRef.current;
        if (!box) return;

        const measure = () => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            // 몇 px 차이는 반올림 오차라 움직일 이유가 안 됩니다
            const over = box.scrollWidth - box.clientWidth;
            setShift(!reduce && over > 4 ? over : 0);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(box);
        return () => observer.disconnect();
    }, [children]);

    return (
        <span
            ref={boxRef}
            className={`block overflow-hidden whitespace-nowrap ${className}`}
        >
            <span
                className={`inline-block ${shift ? "animate-marquee-swing" : ""}`}
                style={
                    shift
                        ? ({
                              "--marquee-shift": `-${shift}px`,
                              "--marquee-duration": `${Math.max(
                                  6,
                                  (shift * 2) / SPEED / TRAVEL_RATIO,
                              ).toFixed(1)}s`,
                          } as React.CSSProperties)
                        : undefined
                }
            >
                {children}
            </span>
        </span>
    );
};

export default MarqueeText;

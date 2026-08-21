import React, { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface RetroTooltipProps {
    /** 열림 여부는 **전적으로 부모가 정합니다** — 이 컴포넌트는 호버를 듣지 않습니다 */
    isOpen: boolean;
    content: React.ReactNode;
    /** 트리거와의 간격(px) */
    offset?: number;
    children: React.ReactNode;
}

const EDGE = 8;   // 화면 가장자리에서 최소한 띄우는 간격

/**
 * 위쪽에 뜨는 툴팁.
 *
 * HeroUI 를 걷어내면서 대신 들어왔습니다. `@heroui/react` 는 툴팁·칩·구분선·내비 뼈대
 * 여섯 개를 쓰자고 **403KB(gzip 103KB)** 를 모든 페이지에 얹고 있었는데, 그중 로직이
 * 있는 건 툴팁 하나뿐이었습니다. 게다가 이 앱은 HeroUI 의 생김새를 쓰지 않습니다 —
 * 모서리를 전역으로 0 으로 덮고 버튼·카드는 `Retro*` 로 따로 만들어 씁니다.
 *
 * 요구가 좁아서 짧게 끝납니다. **열림 상태를 부모가 쥐고 있어서**(Cmd/Ctrl 을 누른 채
 * 호버할 때만 뜹니다) 여기서 호버·포커스·지연을 다룰 필요가 없고, 자리도 위 한 곳입니다.
 *
 * 위치는 state 가 아니라 DOM 에 직접 씁니다. 렌더를 한 번 더 돌리지 않으려는 것이고,
 * 그래서 열려 있는 동안 매 렌더마다 다시 재도 루프가 생기지 않습니다.
 */
const RetroTooltip: React.FC<RetroTooltipProps> = ({
    isOpen,
    content,
    offset = 15,
    children,
}) => {
    // `display: contents` 라 이 span 은 레이아웃에 없습니다 — 부모가 flex 든 grid 든
    // 자식이 그대로 참여합니다. 대신 span 자신은 크기가 없어서 **첫 자식을 잽니다**
    const anchorRef = useRef<HTMLSpanElement | null>(null);
    const tipRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (!isOpen) return;

        const place = () => {
            const trigger = anchorRef.current?.firstElementChild;
            const tip = tipRef.current;
            if (!trigger || !tip) return;

            const t = trigger.getBoundingClientRect();
            const box = tip.getBoundingClientRect();

            // 위가 좁으면 아래로 넘깁니다 — 잘려서 안 보이는 것보다 낫습니다
            let top = t.top - box.height - offset;
            if (top < EDGE) top = t.bottom + offset;

            const half = t.left + t.width / 2 - box.width / 2;
            const left = Math.min(
                Math.max(EDGE, half),
                window.innerWidth - box.width - EDGE,
            );

            tip.style.top = `${Math.round(top)}px`;
            tip.style.left = `${Math.round(left)}px`;
            tip.style.opacity = "1";
        };

        place();
        // 세 번째 인자가 true 라야 안쪽 스크롤 컨테이너의 스크롤도 잡힙니다
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        return () => {
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
        };
    });

    return (
        <>
            <span ref={anchorRef} className="contents">
                {children}
            </span>
            {isOpen &&
                createPortal(
                    <div
                        ref={tipRef}
                        role="tooltip"
                        // 자리를 잡기 전에는 투명입니다. 안 그러면 좌상단에 한 프레임 번쩍입니다
                        style={{ position: "fixed", top: 0, left: 0, opacity: 0 }}
                        className="z-2000 pointer-events-none overflow-hidden border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] transition-opacity duration-100"
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </>
    );
};

export default RetroTooltip;

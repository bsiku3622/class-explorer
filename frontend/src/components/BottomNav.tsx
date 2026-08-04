/**
 * 하단 고정 메뉴 (모바일).
 *
 * **버튼은 다섯 개입니다 — 자주 여는 넷 + 나머지를 여는 햄버거.** 여덟 개를 폭에
 * 욱여넣으면 글자가 4px 이 되고 손가락이 옆 버튼을 누릅니다. 무엇이 앞의 넷인지는
 * `lib/navigation.ts` 의 순서가 정합니다 — 사이드바와 같은 배열입니다.
 *
 * 펼친 판은 하단 바 **바로 위**에 붙습니다. 화면 한가운데에 띄우면 방금 누른 버튼과
 * 멀어져서 어디서 열렸는지가 안 보입니다.
 */

import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ITEM, BOTTOM_NAV_COUNT, visibleNav } from "../lib/navigation";

interface BottomNavItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const BottomNavItem: React.FC<BottomNavItemProps> = ({
    icon: Icon,
    label,
    isActive,
    onClick,
}) => (
    <button
        onClick={onClick}
        className={`flex flex-1 flex-col items-center justify-center gap-1 border-2 border-transparent py-2 transition-all duration-100 ${
            isActive ? "border-t-white/30 text-white" : "text-white/50 hover:text-white/80"
        }`}
    >
        <Icon size={20} strokeWidth={2.5} />
        <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
    </button>
);

interface BottomNavProps {
    activePage: string;
    setActivePage: (page: string) => void;
    isAdmin?: boolean;
    /** 수강 변경 탐색 — 정정 기간에만 노출 */
    showTrade?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
    activePage,
    setActivePage,
    isAdmin = false,
    showTrade = false,
}) => {
    const [open, setOpen] = useState(false);

    const items = visibleNav(showTrade);
    const pinned = items.slice(0, BOTTOM_NAV_COUNT);
    const rest = [...items.slice(BOTTOM_NAV_COUNT), ...(isAdmin ? [ADMIN_ITEM] : [])];

    // 판이 열려 있는 동안은 뒤에 깔린 것을 못 누르므로(오버레이) 화면이 바뀌는 길은
    // 아래 `go()` 뿐입니다 — 라우트를 지켜보며 닫아 줄 필요가 없습니다

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const go = (id: string) => {
        setOpen(false);
        setActivePage(id);
    };

    /** 햄버거 안에 지금 보고 있는 화면이 들어 있으면 햄버거도 켜 둡니다 */
    const restIsActive = rest.some((item) => item.id === activePage);

    return (
        <>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/40 md:hidden"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="fixed bottom-16 left-0 right-0 z-50 border-t-2 border-black bg-retro-bg p-3 md:hidden">
                        <div className="grid grid-cols-2 gap-2">
                            {rest.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => go(item.id)}
                                    className={`flex items-center gap-2.5 border-2 px-3 py-3 font-black uppercase transition-all duration-100 ${
                                        activePage === item.id
                                            ? "border-black bg-black text-white"
                                            : "border-black bg-white text-black active:translate-x-0.5 active:translate-y-0.5"
                                    }`}
                                >
                                    <item.icon size={18} strokeWidth={2.5} />
                                    <span className="text-[13px] tracking-tight">
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t-2 border-black bg-retro-secondary shadow-[0_-4px_0_0_rgba(0,0,0,0.2)] md:hidden">
                {pinned.map((item) => (
                    <BottomNavItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={activePage === item.id}
                        onClick={() => go(item.id)}
                    />
                ))}
                <BottomNavItem
                    icon={open ? X : Menu}
                    label={open ? "Close" : "More"}
                    isActive={open || restIsActive}
                    onClick={() => setOpen((v) => !v)}
                />
            </nav>
        </>
    );
};

export default BottomNav;

/**
 * 하단 고정 메뉴 (모바일).
 *
 * **버튼은 다섯 개입니다 — 자주 여는 넷 + 나머지를 여는 햄버거.** 여덟 개를 폭에
 * 욱여넣으면 글자가 4px 이 되고 손가락이 옆 버튼을 누릅니다. 무엇이 앞의 넷인지는
 * `lib/navigation.ts` 의 순서가 정합니다 — 사이드바와 같은 배열입니다.
 *
 * 펼친 판은 **햄버거 바로 위 오른쪽 구석**에 박힙니다. 화면 한가운데에 띄우거나 폭을
 * 다 차지하면 방금 누른 버튼과 멀어져서 어디서 열렸는지가 안 보이고, 여섯 줄짜리
 * 목록에 390px 을 다 쓸 이유도 없습니다.
 */

import React, { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
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
    /** 좁은 화면에서는 상단 바에 자리가 없어 여기로 들어옵니다 */
    onLogout?: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
    activePage,
    setActivePage,
    isAdmin = false,
    showTrade = false,
    onLogout,
}) => {
    const [open, setOpen] = useState(false);
    /**
     * 로그아웃은 **두 번 눌러야** 합니다. 자주 쓰지도 않는데 잘못 누르면 되돌릴 방법이
     * 다시 로그인뿐이라, 판을 열자마자 손가락이 스치는 자리에 한 번 누르면 끝나는
     * 버튼을 두면 안 됩니다. 확인 버튼은 **오른쪽 끝**에 따로 나타나서, 방금 누른
     * 자리를 다시 눌러도 실행되지 않습니다.
     */
    const [armed, setArmed] = useState(false);

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

    // 눌러 놓고 딴짓하다 돌아왔을 때 무장 상태로 남아 있으면 그게 더 위험합니다
    useEffect(() => {
        if (!armed) return;
        const timer = setTimeout(() => setArmed(false), 5000);
        return () => clearTimeout(timer);
    }, [armed]);

    const close = () => {
        setOpen(false);
        setArmed(false);
    };

    const go = (id: string) => {
        close();
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
                        onClick={close}
                        aria-hidden="true"
                    />
                    {/* 하단 바와 같은 보라 바탕입니다 — 판이 햄버거에서 자라 나온 것으로
                        읽혀야 하는데, 흰 판을 얹으면 남의 창이 덮은 것처럼 보입니다.
                        그래서 버튼도 학기 선택(`TermSwitcher`)과 같은 반투명 흰색을
                        씁니다 — 이 앱에서 어두운 바탕 위의 버튼은 늘 그 모양입니다 */}
                    <div className="fixed bottom-[4.5rem] right-3 z-50 max-h-[65vh] w-52 overflow-y-auto border-2 border-black bg-retro-secondary p-2.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.25)] md:hidden">
                        {/* 로그아웃은 **맨 위 오른쪽 구석**입니다. 메뉴 사이에 두면
                            훑다가 스치고, 자주 쓰지도 않는데 잘못 누르면 되돌릴 방법이
                            다시 로그인뿐입니다.

                            ⚠️ 이 줄은 높이를 **고정**합니다 (`h-7`). 확인 버튼이 나타날
                            때 줄 키가 달라지면 아래 메뉴가 통째로 밀려서, 누르려던
                            항목이 손가락 밑에서 움직입니다.

                            ⚠️ 여기 버튼들은 `transition-all` 을 쓰지 않습니다. 폭까지
                            애니메이션되는 바람에 그 100ms 동안 버튼이 좁아 "로그아웃" 이
                            두 줄로 접히고 둘째 줄이 상자 아래로 삐져나왔습니다 —
                            `transition-colors` + `whitespace-nowrap` 으로 막습니다 */}
                        {onLogout && (
                            <div className="mb-2 flex h-7 justify-end gap-1.5">
                                {armed ? (
                                    <>
                                        {/* 확인은 **왼쪽**에 새로 나타납니다 — 방금 누른
                                            오른쪽 구석은 취소가 되므로, 같은 자리를 한 번
                                            더 눌러도 로그아웃되지 않습니다 */}
                                        <button
                                            onClick={() => {
                                                close();
                                                onLogout();
                                            }}
                                            className="flex h-full flex-1 items-center justify-center whitespace-nowrap border-2 border-white bg-white/25 px-2 text-[11px] font-black uppercase tracking-widest text-white transition-colors duration-100 active:bg-white/40"
                                        >
                                            로그아웃
                                        </button>
                                        <button
                                            onClick={() => setArmed(false)}
                                            className="flex h-full shrink-0 items-center justify-center whitespace-nowrap border-2 border-white/30 bg-white/10 px-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-colors duration-100 active:bg-white/20"
                                        >
                                            취소
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setArmed(true)}
                                        aria-label="로그아웃"
                                        className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-white/25 bg-white/5 text-white/50 transition-colors duration-100 active:bg-white/20 active:text-white"
                                    >
                                        <LogOut size={14} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            {rest.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => go(item.id)}
                                    className={`flex items-center gap-2.5 border-2 px-3 py-2 font-black uppercase text-white transition-all duration-100 ${
                                        activePage === item.id
                                            ? "border-white bg-white/25"
                                            : "border-white/30 bg-white/10 active:bg-white/20"
                                    }`}
                                >
                                    <item.icon size={16} strokeWidth={2.5} />
                                    <span className="text-[12px] tracking-widest">
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
                    onClick={() => (open ? close() : setOpen(true))}
                />
            </nav>
        </>
    );
};

export default BottomNav;

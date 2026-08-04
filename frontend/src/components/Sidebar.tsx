/**
 * 좌측 고정 메뉴 (데스크톱).
 *
 * **System Status 는 맨 아래에 붙어 있고 메뉴만 스크롤합니다.** 메뉴가 길어지면
 * 상태 카드가 화면 밖으로 밀려나는데, 그건 "지금 서버가 살아 있나" 를 확인하려고
 * 스크롤해야 한다는 뜻이라 표시등의 의미가 없어집니다.
 *
 * 메뉴 순서는 `lib/navigation.ts` 에서 옵니다 — 하단 바(모바일)와 같은 배열입니다.
 */

import React from "react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ITEM, visibleNav } from "../lib/navigation";

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
    icon: Icon,
    label,
    isActive,
    onClick,
}) => (
    <button
        onClick={onClick}
        className={`flex w-full items-center gap-3 border-2 px-4 py-3 font-black uppercase transition-all duration-100 ${
            isActive
                ? "border-black bg-black text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                : "border-transparent text-black/60 hover:bg-white/50 hover:text-black"
        }`}
    >
        <Icon size={20} strokeWidth={2.5} />
        <span className="text-sm tracking-tight">{label}</span>
    </button>
);

interface SidebarProps {
    activePage: string;
    setActivePage: (page: string) => void;
    isAdmin?: boolean;
    /** 수강 변경 탐색 — 정정 기간에만 노출 */
    showTrade?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
    activePage,
    setActivePage,
    isAdmin = false,
    showTrade = false,
}) => (
    <aside className="fixed bottom-0 left-0 top-20 z-40 hidden w-64 flex-col border-r-2 border-black bg-retro-bg md:flex">
        {/* 스크롤은 여기만 — 아래 상태 카드는 늘 보입니다 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
            <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                Main Navigation
            </p>
            <nav className="space-y-1">
                {visibleNav(showTrade).map((item) => (
                    <SidebarItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={activePage === item.id}
                        onClick={() => setActivePage(item.id)}
                    />
                ))}
            </nav>

            {/* 구분선은 **위에만** 둡니다. 아래에도 그으면 Admin 이 상자에 갇혀 보이고,
                바로 밑 상태 카드의 테두리와 겹쳐 선이 두 줄로 읽힙니다 */}
            {isAdmin && (
                <div className="mt-4 border-t-2 border-black/10 pt-4">
                    <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                        Admin
                    </p>
                    <SidebarItem
                        icon={ADMIN_ITEM.icon}
                        label={ADMIN_ITEM.label}
                        isActive={activePage === ADMIN_ITEM.id}
                        onClick={() => setActivePage(ADMIN_ITEM.id)}
                    />
                </div>
            )}
            <div className="h-6" />
        </div>

        <div className="shrink-0 px-6 pb-6">
            <div className="space-y-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    System Status
                </p>
                <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                        NETWORK
                    </span>
                    <span className="text-green-500">ONLINE</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        DATABASE
                    </span>
                    <span className="text-blue-500">STABLE</span>
                </div>
            </div>
        </div>
    </aside>
);

export default Sidebar;

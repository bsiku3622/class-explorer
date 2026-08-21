/**
 * 상단 고정 바.
 *
 * **좁은 화면에는 두 개만 둡니다 — 로고와 학기 선택.** 계정 이름과 로그아웃까지
 * 넣었더니 390px 에서 서로를 밀어내 잘렸습니다. 로그아웃은 하단 바의 More 안으로
 * 옮겼고(`BottomNav`), 거기서는 두 번 눌러야 실행됩니다 — 자주 쓰지도 않는데 잘못
 * 누르면 되돌릴 방법이 다시 로그인뿐입니다.
 */

import React from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import TermSwitcher from "./TermSwitcher";
import type { Term } from "../types";

interface NavigationProps {
    onLogoClick: () => void;
    onLogout: () => void;
    isAdmin?: boolean;
    username?: string;
    terms?: Term[];
    currentTerm?: Term | null;
    onTermChange?: (term: Term) => void;
}

const Navigation: React.FC<NavigationProps> = ({
    onLogoClick,
    onLogout,
    isAdmin = false,
    username = "",
    terms = [],
    currentTerm = null,
    onTermChange,
}) => {
    return (
        <nav className="fixed top-0 left-0 right-0 z-1000 flex h-20 items-center justify-between gap-4 border-b border-black bg-retro-secondary px-6 shadow-[0_4px_0_0_rgba(0,0,0,0.2)]">
            <div className="flex items-center">
                <button
                    onClick={onLogoClick}
                    className="transform text-2xl font-black uppercase -skew-x-6 tracking-tighter text-white transition-transform hover:scale-105 active:scale-95"
                >
                    Class Explorer
                </button>
            </div>
            <div className="flex items-center justify-end gap-3 sm:gap-6">
                {onTermChange && (
                    <TermSwitcher
                        terms={terms}
                        current={currentTerm}
                        onChange={onTermChange}
                    />
                )}
                {username && (
                    <span className="hidden sm:flex items-center gap-1.5 text-white/50 text-[11px] font-black uppercase tracking-widest">
                        {isAdmin && <ShieldCheck size={12} className="text-white/60" />}
                        {username}
                    </span>
                )}
                {/* 좁은 화면에서는 하단 바의 More 안에 있습니다 */}
                <button
                    onClick={onLogout}
                    className="hidden items-center gap-2 border-2 border-white/30 bg-white/10 px-3 py-1.5 text-white transition-all duration-100 hover:border-white hover:bg-white/20 sm:flex"
                >
                    <LogOut size={14} strokeWidth={2.5} />
                    <span className="text-xs font-black uppercase tracking-widest">
                        Logout
                    </span>
                </button>
            </div>
        </nav>
    );
};

export default Navigation;

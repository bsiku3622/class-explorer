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
import { AppBar, NavButton, TermSwitcher, Text } from "@studio-baeks/funky-ui";
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

const termLabel = (term: Term) => `${term.year}-${term.semester}`;

const Navigation: React.FC<NavigationProps> = ({
    onLogoClick,
    onLogout,
    isAdmin = false,
    username = "",
    terms = [],
    currentTerm = null,
    onTermChange,
}) => (
    <AppBar
        fixed
        brand="Class Explorer"
        onBrandClick={onLogoClick}
        actions={
            <>
                {onTermChange && (
                    <TermSwitcher
                        terms={terms.map((term) => ({ value: termLabel(term), label: termLabel(term) }))}
                        value={currentTerm ? termLabel(currentTerm) : ""}
                        onChange={(value) => {
                            const next = terms.find((term) => termLabel(term) === value);
                            if (next) onTermChange(next);
                        }}
                    />
                )}
                {username && (
                    <Text variant="label" tone="inverseMuted" className="hidden items-center gap-1.5 uppercase tracking-widest sm:flex">
                        {isAdmin && <ShieldCheck size={12} />}
                        {username}
                    </Text>
                )}
                {/* 좁은 화면에서는 하단 바의 More 안에 있습니다 */}
                <NavButton icon={LogOut} onClick={onLogout} className="hidden sm:inline-flex">
                    Logout
                </NavButton>
            </>
        }
    />
);

export default Navigation;

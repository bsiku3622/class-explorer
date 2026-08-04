/**
 * 메뉴 순서 — **여기 한 곳에서만 정합니다.**
 *
 * 사이드바(데스크톱)와 하단 바(모바일)가 각자 배열을 들고 있었더니 한쪽만 고쳐서
 * 순서가 서로 달랐습니다. 두 화면이 같은 앱이라는 걸 사용자가 아는 방법은 메뉴가
 * 같은 순서인 것뿐입니다.
 *
 * 순서는 **얼마나 자주 여는가**입니다 — 홈에서 시작해 사람·교실을 찾고, 그다음이
 * 일정과 성적, 한시 기능, 마지막이 안내입니다.
 */

import {
    ArrowLeftRight,
    BarChart3,
    CalendarDays,
    GraduationCap,
    House,
    Info,
    Library,
    Map,
    Search,
    ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
    /** 라우트. `home` 만 `/` 로 갑니다 */
    id: string;
    label: string;
    icon: LucideIcon;
    /** 수강 변경 기간에만 보이는 한시 기능 */
    temporary?: boolean;
    /** `role=admin` 만 */
    adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
    { id: "home", label: "Home", icon: House },
    { id: "search", label: "Search", icon: Search },
    { id: "browse", label: "Browse", icon: Library },
    { id: "emptyroomfinder", label: "Rooms", icon: Map },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "zamong", label: "Zamong", icon: GraduationCap },
    { id: "trade", label: "Trade", icon: ArrowLeftRight, temporary: true },
    { id: "analysis", label: "Analysis", icon: BarChart3 },
    { id: "about", label: "About", icon: Info },
];

export const ADMIN_ITEM: NavItem = {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
};

/**
 * 모바일 하단 바에 아이콘으로 놓을 개수. 나머지는 햄버거 안으로 들어갑니다 —
 * 화면 폭에 여덟 개를 욱여넣으면 글자가 4px 이 되고 손가락이 옆 버튼을 누릅니다.
 */
export const BOTTOM_NAV_COUNT = 4;

export const visibleNav = (showTrade: boolean): NavItem[] =>
    NAV_ITEMS.filter((item) => !item.temporary || showTrade);

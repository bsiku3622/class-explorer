/**
 * 메뉴 순서 — **여기 한 곳에서만 정합니다.**
 *
 * 사이드바(데스크톱)와 하단 바(모바일)가 각자 배열을 들고 있었더니 한쪽만 고쳐서
 * 순서가 서로 달랐습니다. 두 화면이 같은 앱이라는 걸 사용자가 아는 방법은 메뉴가
 * 같은 순서인 것뿐입니다.
 *
 * 순서는 두 가지가 정합니다 —
 *
 * 1. **얼마나 자주 여는가.** 앞 넷(홈·서치·룸·캘린더)이 모바일 하단 바에 그대로
 *    올라갑니다. 매일 여는 것이 손가락에 가까워야 합니다
 * 2. **누구 것을 보는가.** 브라우즈·아날리시스는 전교생과 통계, 자몽·트레이드는
 *    내 이수현황과 내 수강입니다 — 남을 보는 화면끼리, 내 것끼리 붙여 둡니다
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
    // 매일 여는 것 — 여기까지가 모바일 하단 바
    { id: "home", label: "Home", icon: House },
    { id: "search", label: "Search", icon: Search },
    { id: "emptyroomfinder", label: "Rooms", icon: Map },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    // 전교생·통계 — 남을 보는 화면
    { id: "browse", label: "Browse", icon: Library },
    { id: "analysis", label: "Analysis", icon: BarChart3 },
    // 내 것
    { id: "zamong", label: "Zamong", icon: GraduationCap },
    { id: "trade", label: "Trade", icon: ArrowLeftRight, temporary: true },
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

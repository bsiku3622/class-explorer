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
import React, { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { BottomNav as FunkyBottomNav, Floating, NavButton, surfaceClass } from "@studio-baeks/funky-ui";
import { ADMIN_ITEM, BOTTOM_NAV_COUNT, visibleNav } from "../lib/navigation";

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
    const moreRef = useRef<HTMLButtonElement>(null);
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
            {/* 하단 바와 같은 보라 면입니다 — 판이 햄버거에서 자라 나온 것으로 읽혀야 하는데,
                흰 판을 얹으면 남의 창이 덮은 것처럼 보입니다. 그래서 버튼도 학기 선택과 같은
                NavButton 을 씁니다 — 이 앱에서 어두운 바탕 위의 버튼은 늘 그 모양입니다 */}
            {open && (
                <Floating
                    anchor={moreRef}
                    placement="top"
                    align="end"
                    scrim
                    onDismiss={close}
                    padding="md"
                    className={`${surfaceClass({ fill: "brand", border: "line", shadow: "raised" })} max-h-[65vh] w-52 overflow-y-auto md:hidden`}
                >
                    {/* 로그아웃은 **맨 위 오른쪽 구석**입니다. 메뉴 사이에 두면 훑다가 스치고,
                        자주 쓰지도 않는데 잘못 누르면 되돌릴 방법이 다시 로그인뿐입니다.
                        ⚠️ 이 줄은 높이를 **고정**합니다 (`h-8`). 확인 버튼이 나타날 때 줄 키가
                        달라지면 아래 메뉴가 통째로 밀려서, 누르려던 항목이 손가락 밑에서 움직입니다 */}
                    {onLogout && (
                        <div className="mb-2 flex h-8 justify-end gap-1.5">
                            {armed ? (
                                <>
                                    {/* 확인은 **왼쪽**에 새로 나타납니다 — 방금 누른 오른쪽 구석은
                                        취소가 되므로, 같은 자리를 한 번 더 눌러도 로그아웃되지 않습니다 */}
                                    <NavButton
                                        selected
                                        className="flex-1"
                                        onClick={() => {
                                            close();
                                            onLogout();
                                        }}
                                    >
                                        로그아웃
                                    </NavButton>
                                    <NavButton onClick={() => setArmed(false)}>취소</NavButton>
                                </>
                            ) : (
                                <NavButton icon={LogOut} label="로그아웃" onClick={() => setArmed(true)} />
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        {rest.map((item) => (
                            <NavButton
                                key={item.id}
                                icon={item.icon}
                                selected={activePage === item.id}
                                className="w-full justify-start"
                                onClick={() => go(item.id)}
                            >
                                {item.label}
                            </NavButton>
                        ))}
                    </div>
                </Floating>
            )}
            {/* 판의 막(z 200)보다 위에 둡니다 — 판이 열려 있어도 햄버거를 눌러 닫습니다 */}
            <FunkyBottomNav fixed className="z-[250]">
                {pinned.map((item) => (
                    <FunkyBottomNav.Item key={item.id} icon={item.icon} active={activePage === item.id} onClick={() => go(item.id)}>
                        {item.label}
                    </FunkyBottomNav.Item>
                ))}
                <FunkyBottomNav.Item
                    ref={moreRef}
                    icon={open ? X : Menu}
                    active={open || restIsActive}
                    aria-expanded={open}
                    onClick={() => (open ? close() : setOpen(true))}
                >
                    {open ? "Close" : "More"}
                </FunkyBottomNav.Item>
            </FunkyBottomNav>
        </>
    );
};

export default BottomNav;

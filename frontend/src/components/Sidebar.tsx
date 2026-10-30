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
import { Divider, SideNav, Stack, Surface, Swatch, Text } from "@studio-baeks/funky-ui";
import { ADMIN_ITEM, visibleNav } from "../lib/navigation";

interface SidebarProps {
    activePage: string;
    setActivePage: (page: string) => void;
    isAdmin?: boolean;
    /** 수강 변경 탐색 — 정정 기간에만 노출 */
    showTrade?: boolean;
}

const SystemStatus: React.FC = () => (
    <Surface border="line" shadow="raised" padding="xl">
        <Stack gap="lg">
            <Text variant="overline">System Status</Text>
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Swatch accent="green" shape="round" pulse />
                    <Text variant="micro">NETWORK</Text>
                </span>
                <Text variant="micro" tone="green">
                    ONLINE
                </Text>
            </div>
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Swatch accent="sky" shape="round" />
                    <Text variant="micro">DATABASE</Text>
                </span>
                <Text variant="micro" tone="sky">
                    STABLE
                </Text>
            </div>
        </Stack>
    </Surface>
);

const Sidebar: React.FC<SidebarProps> = ({
    activePage,
    setActivePage,
    isAdmin = false,
    showTrade = false,
}) => (
    <SideNav fixed footer={<SystemStatus />}>
        <SideNav.Section label="Main Navigation">
            {visibleNav(showTrade).map((item) => (
                <SideNav.Item key={item.id} icon={item.icon} active={activePage === item.id} onClick={() => setActivePage(item.id)}>
                    {item.label}
                </SideNav.Item>
            ))}
        </SideNav.Section>
        {/* 구분선은 **위에만** 둡니다. 아래에도 그으면 Admin 이 상자에 갇혀 보이고,
            바로 밑 상태 카드의 테두리와 겹쳐 선이 두 줄로 읽힙니다 */}
        {isAdmin && (
            <>
                <Divider />
                <SideNav.Section label="Admin">
                    <SideNav.Item icon={ADMIN_ITEM.icon} active={activePage === ADMIN_ITEM.id} onClick={() => setActivePage(ADMIN_ITEM.id)}>
                        {ADMIN_ITEM.label}
                    </SideNav.Item>
                </SideNav.Section>
            </>
        )}
    </SideNav>
);

export default Sidebar;

/**
 * 오른쪽 아래 플로팅 버튼 — 어느 화면에서든 같은 대화를 엽니다 (⌘K / Ctrl+K 도 같습니다).
 *
 * 홈 맨 위 질문창 → 탑 바 버튼을 거쳐 여기로 왔습니다. 탑 바 버튼은 누르면 `/ai` 로 넘어가서,
 * 묻는 동안 보던 화면(시간표·달력)을 떠나야 했습니다.
 *
 * - **데스크탑 — 미니 창.** 버튼 자리에서 자라 나옵니다. ⚠️ **바깥을 눌러도 닫히지 않습니다.** 보던
 *   화면을 옆에 두고 물으라고 띄운 창이라, 옆을 누를 때마다 닫히면 쓸 수가 없습니다. 닫기는 ✕
 *   하나뿐이고, 페이지를 옮겨 다녀도 그대로 떠 있습니다. ⤢ 는 `/ai` 로 넘어갑니다
 * - **모바일 — 전체 화면 창.** 아직 `/ai` 가 아니라서 닫으면 보던 화면 그대로입니다. **보내는 순간
 *   `/ai` 로 옮겨 가고**, 입력창이 제자리에서 페이지 바닥으로 내려앉는 모션이 둘을 잇습니다
 *   (`lib/askMotion.ts`). 휴대폰 뒤로가기로도 닫힙니다
 * - 창이 닫힌 사이 답이 오면 버튼에 **노란 점** — 핑크는 "지금", 시안은 한시 기능이라 남는 색입니다
 * - 어느 쪽으로 그릴지는 **지금 화면 폭**이 정합니다. 열림은 하나(`open`)라 태블릿을 돌리면 창
 *   모양만 바뀝니다
 * - `/ai` 에서는 그리지 않습니다 (App) — 그 페이지가 곧 큰 창입니다
 *
 * 창(`AgentPanel`)은 따로 받습니다 — 버튼에 손이 가는 순간(올리기·누르기·포커스) 미리 받기 시작합니다.
 */
import React, { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { IconButton, Paint } from "@studio-baeks/funky-ui";
import type { AgentChat } from "../../hooks/useAgentChat";

const loadPanel = () => import("./AgentPanel");
const AgentPanel = React.lazy(loadPanel);

const prefetch = () => void loadPanel();

const Launcher: React.FC<{ unread: boolean; onClick: () => void }> = ({ unread, onClick }) => (
    // 모바일은 하단 바(64px) 위. ⚠️ z 는 하단 바 More 판의 덮개(z-40)보다 아래라야 판이 열릴 때 같이 덮입니다.
    // ⚠️ 흰 바탕 + 보라 아이콘, 누르면 **살짝 줄어듭니다** — 사용자 요청으로 앱 규칙(그림자를 숨기며
    // 내려앉기)에서 뺀 자리입니다. 규칙에 맞춘다고 되돌리지 마세요
    <div className="fixed bottom-20 right-4 z-30 md:bottom-6 md:right-6">
        <IconButton
            icon={Sparkles}
            label={unread ? "Ask — 새 답이 있습니다" : "Ask — AI 에게 묻기"}
            variant="paper"
            accent="purple"
            shadow="shrink"
            size="lg"
            onClick={onClick}
            onPointerEnter={prefetch}
            onPointerDown={prefetch}
            onFocus={prefetch}
            title="Ask (⌘K)"
            className="h-14 w-14"
        />
        {unread && <Paint as="span" accent="yellow" variant="solid" className="absolute -right-2 -top-2 h-4 w-4" />}
    </div>
);

interface AgentDockProps {
    chat: AgentChat;
    name: string;
    open: boolean;
    /** 바뀔 때마다 창의 입력칸으로 (⌘K) */
    focusKey: number;
    onOpen: () => void;
    onClose: () => void;
}

const AgentDock: React.FC<AgentDockProps> = ({ chat, name, open, focusKey, onOpen, onClose }) => {
    if (!open) return <Launcher unread={chat.unread} onClick={onOpen} />;
    // 창을 받는 동안은 버튼을 그대로 둡니다 — 빈자리가 깜빡이면 눌렸는지 모릅니다
    return (
        <Suspense fallback={<Launcher unread={false} onClick={onOpen} />}>
            <AgentPanel chat={chat} name={name} focusKey={focusKey} onClose={onClose} />
        </Suspense>
    );
};

export default AgentDock;

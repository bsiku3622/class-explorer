/**
 * `/ai` — AI 에게 묻는 큰 화면. 플로팅 버튼 창의 ⤢ · 사이드바 Ask · 주소로 들어오고, 모바일 창에서
 * 보내면 이리로 옮겨 옵니다 (`AgentDock`).
 *
 * ChatGPT·Claude 의 문법을 이 앱의 레트로 규칙으로 옮겼습니다.
 *
 * - **대화가 없을 때**: 화면 가운데에 인사 · 입력창 · 추천 질문 (`AgentEmpty`)
 * - **대화가 있을 때**: 가운데 한 열(`max-w-3xl`)에 대화, **입력창은 화면 아래에 붙습니다**
 *   (모바일은 하단 바 위). 아래로 갈수록 크림색으로 페이드해 본문이 입력창 밑으로 사라집니다
 * - 새 메시지가 오면 맨 아래로 따라가되, **위로 올려 읽는 중이면 끌어내리지 않습니다** (`useFollowBottom`)
 *
 * 대화 상태는 이 페이지가 아니라 `App` 의 `useAgentChat` 에 있습니다 — 다른 페이지에 갔다 와도,
 * 플로팅 버튼 창과 오가도 이어집니다. 새로고침하면 사라집니다(개인정보처리방침 4항).
 *
 * 홈 맨 위의 질문창 → 탑 바 패널(dock·drawer·spotlight 세 안)을 거쳐 여기로 왔습니다. 패널은 셋 다
 * 홈과 자리를 다퉜습니다 — 1440px 에서 400px 을 밀면 주간 격자가 찌그러지고, 덮으면 시간표를 가립니다.
 * 그래서 큰 화면은 페이지로 두고, 보던 화면 위에서 잠깐 묻는 일은 플로팅 버튼의 창이 맡습니다.
 */
import React, { useEffect, useLayoutEffect } from "react";
import { Sparkles, SquarePen } from "lucide-react";
import { Button, Icon, Surface, Text } from "@studio-baeks/funky-ui";
import AgentThread from "../components/agent/AgentThread";
import AgentComposer from "../components/agent/AgentComposer";
import AgentEmpty from "../components/agent/AgentEmpty";
import type { AgentChat } from "../hooks/useAgentChat";
import { useFollowBottom } from "../hooks/useFollowBottom";
import { ANSWER_NOTICE } from "../lib/agentChat";
import { AGENT_DEMOS } from "../lib/agentDemo";
import { ASK_COMPOSER, askPageReady } from "../lib/askMotion";

const DEMOS: { key: keyof typeof AGENT_DEMOS; label: string }[] = [
    { key: "short", label: "짧게" },
    { key: "long", label: "단계 많이" },
    { key: "failed", label: "도구 실패" },
    { key: "error", label: "오류" },
];

interface AiPageProps {
    chat: AgentChat;
    /** 바뀔 때마다 입력창에 포커스 (⌘K) */
    focusKey: number;
    name: string;
}

const AiPage: React.FC<AiPageProps> = ({ chat, focusKey, name }) => {
    const { refresh, warm } = chat;
    const empty = chat.turns.length === 0;
    useFollowBottom(chat.turns);

    // 모바일 창에서 보내 넘어왔다면, 바닥까지 내린 지금 이 화면을 모션의 끝 장면으로 찍게 합니다
    useLayoutEffect(() => askPageReady(), []);

    // 들어올 때 모델 목록·데스크탑 상태를 새로 받고, 쉬고 있으면 미리 깨웁니다
    useEffect(() => {
        refresh();
        warm();
    }, [refresh, warm]);

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col">
            {import.meta.env.DEV && (
                <Surface fill="none" border="soft" borderStyle="dashed" className="mb-4 flex flex-wrap items-center gap-1.5 px-3 py-2">
                    <Text variant="overline" tone="faint" className="mr-1">데모</Text>
                    {DEMOS.map(({ key, label }) => (
                        <Button
                            key={key}
                            size="xs"
                            variant="paper"
                            uppercase={false}
                            onClick={() => chat.play(AGENT_DEMOS[key].question, AGENT_DEMOS[key].events)}
                            disabled={chat.running}
                        >
                            {label}
                        </Button>
                    ))}
                </Surface>
            )}

            {empty ? (
                <div className="flex min-h-[calc(100dvh-14rem)] flex-col justify-center py-6">
                    <AgentEmpty
                        chat={chat}
                        name={name}
                        composer={<AgentComposer chat={chat} focusKey={focusKey} transitionName={ASK_COMPOSER} />}
                    />
                </div>
            ) : (
                // 대화가 짧아도 입력창은 화면 아래에 둡니다 — 남는 높이를 대화가 채웁니다
                <div className="flex min-h-[calc(100dvh-10rem)] flex-col md:min-h-[calc(100dvh-12rem)]">
                    <div className="mb-6 flex items-center gap-2">
                        <Icon icon={Sparkles} size={15} strokeWidth={2.75} tone="purple" />
                        <Text variant="overline">Ask</Text>
                        <Button variant="paper" shadow size="xs" uppercase={false} icon={SquarePen} onClick={chat.reset} className="ml-auto">
                            새 대화
                        </Button>
                    </div>
                    <div className="flex-1 pb-4">
                        <AgentThread turns={chat.turns} cold={chat.cold} />
                    </div>
                    <div className="sticky bottom-16 z-10 -mx-4 bg-gradient-to-t from-[var(--fk-surface-canvas)] from-70% to-transparent px-4 pb-3 pt-8 md:bottom-0 md:mx-0 md:px-0 md:pb-6">
                        <AgentComposer
                            chat={chat}
                            focusKey={focusKey}
                            placeholder="이어서 물어보세요"
                            transitionName={ASK_COMPOSER}
                        />
                        <Text as="p" variant="micro" weight="bold" tone="muted" align="center" className="mt-2">{ANSWER_NOTICE}</Text>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiPage;

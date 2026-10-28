/**
 * 플로팅 버튼이 여는 창 — 데스크탑이면 미니 창(`Window`), 폰이면 전체 화면 창(`Sheet`).
 * 어떻게 열리고 닫히는지는 `AgentDock` 에 적었습니다.
 *
 * ⚠️ **lazy 로 따로 받습니다** (`AgentDock`). 대화 본문·입력창·이미지 첨부가 다 딸려 와서, 버튼과 같이
 * 첫 로딩 번들에 실으면 그것만으로 gzip 10KB 가 늘었습니다 — 열지도 않을 창을 모든 화면이 받는 셈입니다.
 */
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, Sparkles, SquarePen, X } from "lucide-react";
import AgentComposer from "./AgentComposer";
import AgentEmpty from "./AgentEmpty";
import AgentThread from "./AgentThread";
import type { AgentChat } from "../../hooks/useAgentChat";
import { useFollowBottom } from "../../hooks/useFollowBottom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { ANSWER_NOTICE } from "../../lib/agentChat";
import { ASK_COMPOSER, moveToAskPage } from "../../lib/askMotion";

/** 모바일 창이 남긴 방문 기록에 붙이는 표시 (`history.state`) */
const SHEET_ENTRY = "askSheet";
const onSheetEntry = (): boolean => Boolean(window.history.state?.[SHEET_ENTRY]);

export interface AgentPanelProps {
    chat: AgentChat;
    name: string;
    /** 바뀔 때마다 창의 입력칸으로 (⌘K) */
    focusKey: number;
    onClose: () => void;
}

const HeadButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="grid size-8 place-items-center border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.18)] transition-transform duration-100 hover:scale-95 active:scale-[0.92]"
    >
        {children}
    </button>
);

/**
 * 창 머리 — 오늘 하루 보지 않기 창(`ShareMaterialsPrompt`)과 같은 보라 띠 + 흰 단추.
 * ⚠️ 단추는 플로팅 버튼처럼 누르면 **살짝 줄어듭니다**(내려앉지 않음) — 앱 규칙의 예외, 사용자 요청
 */
const Header: React.FC<{ chat: AgentChat; onExpand?: () => void; onClose: () => void }> = ({ chat, onExpand, onClose }) => (
    <div className="flex shrink-0 items-center gap-2 border-b-2 border-black bg-retro-secondary py-2.5 pl-4 pr-2.5 text-white">
        <Sparkles size={15} strokeWidth={2.75} />
        <span className="text-xs font-black uppercase tracking-widest">Ask</span>
        <div className="ml-auto flex items-center gap-1.5">
            {chat.turns.length > 0 && (
                <HeadButton label="새 대화" onClick={chat.reset}>
                    <SquarePen size={15} strokeWidth={2.75} />
                </HeadButton>
            )}
            {onExpand && (
                <HeadButton label="크게 보기" onClick={onExpand}>
                    <Maximize2 size={15} strokeWidth={2.75} />
                </HeadButton>
            )}
            <HeadButton label="닫기" onClick={onClose}>
                <X size={16} strokeWidth={2.75} />
            </HeadButton>
        </div>
    </div>
);

/** 데스크탑 미니 창 — 입력창은 늘 창 바닥에 있고, 위의 상자만 스크롤합니다 */
const Window: React.FC<AgentPanelProps> = ({ chat, name, focusKey, onClose }) => {
    const navigate = useNavigate();
    const box = useRef<HTMLDivElement>(null);
    const empty = chat.turns.length === 0;
    useFollowBottom(chat.turns, box);
    return (
        // 높이는 탑 바(80px) 아래 16px 까지. ⚠️ z 는 페이지 모달(z-50~)보다 아래 — 모달이 뜨면 이 창도 덮여야 합니다
        <section
            role="dialog"
            aria-label="Ask"
            className="animate-ask-pop fixed bottom-6 right-6 z-[45] flex h-[min(40rem,calc(100dvh-7.5rem))] w-[25rem] flex-col border-2 border-black bg-retro-bg shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]"
        >
            <Header chat={chat} onExpand={() => navigate("/ai")} onClose={onClose} />
            <div ref={box} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
                {empty ? (
                    <div className="flex min-h-full flex-col justify-center">
                        <AgentEmpty chat={chat} name={name} compact />
                    </div>
                ) : (
                    <AgentThread turns={chat.turns} cold={chat.cold} />
                )}
            </div>
            <div className="shrink-0 px-3 pb-3">
                <AgentComposer chat={chat} focusKey={focusKey} placeholder={empty ? undefined : "이어서 물어보세요"} />
                {!empty && <p className="mt-2 text-center text-[10.5px] font-bold text-black/35">{ANSWER_NOTICE}</p>}
            </div>
        </section>
    );
};

/**
 * 모바일 전체 화면 창 — 대화가 없으면 `/ai` 첫 화면과 같은 모양(입력창이 가운데)입니다. 그래야 보내는
 * 순간 입력창이 페이지 바닥으로 내려앉는 모션이 "같은 화면이 대화로 바뀐다" 로 읽힙니다.
 */
const Sheet: React.FC<AgentPanelProps> = ({ chat, name, focusKey, onClose }) => {
    const navigate = useNavigate();
    const box = useRef<HTMLDivElement>(null);
    const empty = chat.turns.length === 0;
    useFollowBottom(chat.turns, box);

    // 뒤 화면이 같이 스크롤되지 않게
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    // 휴대폰 뒤로가기로 닫히게 — 열 때 방문 기록을 하나 남기고, 그 기록이 빠지면(뒤로가기) 닫습니다.
    // 없으면 뒤로가기가 창은 그대로 둔 채 뒤에 깔린 페이지만 넘기고, 홈에서 열었으면 사이트를 떠납니다.
    // ⚠️ 이미 남겼으면 다시 남기지 않습니다 — 개발 모드(StrictMode)는 effect 를 두 번 돌립니다
    useEffect(() => {
        if (!onSheetEntry()) window.history.pushState({ ...window.history.state, [SHEET_ENTRY]: true }, "");
        const onPop = () => {
            if (!onSheetEntry()) onClose();
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [onClose]);

    // ✕ 는 남긴 기록을 되돌려 닫습니다(→ popstate) — 그냥 닫으면 다음 뒤로가기가 그 기록에 걸려 한 번 헛돕니다
    const close = () => {
        if (onSheetEntry()) window.history.back();
        else onClose();
    };

    // ⚠️ `/ai` 로는 **바꿔치기**합니다(replace) — 창이 남긴 기록 자리라서, push 하면 `/ai` 에서 뒤로가기를
    // 눌렀을 때 그 기록에 걸려 한 번 헛돕니다
    const send = (text: string, images: string[]) =>
        moveToAskPage(() => {
            chat.send(text, images);
            navigate("/ai", { replace: onSheetEntry() });
        });

    const composer = (placeholder?: string) => (
        <AgentComposer chat={chat} focusKey={focusKey} placeholder={placeholder} onSend={send} transitionName={ASK_COMPOSER} />
    );

    return (
        // 탑 바(z-1000)까지 덮습니다
        <div role="dialog" aria-modal="true" aria-label="Ask" className="animate-ask-rise fixed inset-0 z-[1100] flex flex-col bg-retro-bg">
            <Header chat={chat} onClose={close} />
            <div ref={box} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
                {empty ? (
                    <div className="flex min-h-full flex-col justify-center py-6">
                        <AgentEmpty chat={chat} name={name} composer={composer()} onPick={(text) => send(text, [])} />
                    </div>
                ) : (
                    <div className="py-5">
                        <AgentThread turns={chat.turns} cold={chat.cold} />
                    </div>
                )}
            </div>
            {!empty && (
                <div className="shrink-0 px-4 pb-3">
                    {composer("이어서 물어보세요")}
                    <p className="mt-2 text-center text-[10.5px] font-bold text-black/35">{ANSWER_NOTICE}</p>
                </div>
            )}
        </div>
    );
};

const AgentPanel: React.FC<AgentPanelProps> = (props) => {
    const desktop = useMediaQuery("(min-width: 768px)");
    const { refresh, warm } = props.chat;

    // 창을 열면 모델 목록·데스크탑 상태를 새로 받고, 쉬고 있으면 미리 깨웁니다 (`/ai` 와 같습니다)
    useEffect(() => {
        refresh();
        warm();
    }, [refresh, warm]);

    return desktop ? <Window {...props} /> : <Sheet {...props} />;
};

export default AgentPanel;

/**
 * 대화가 없을 때의 첫 화면 — 인사 한 줄 · 입력창 · 상자 없는 추천 질문 (ChatGPT 의 첫 화면).
 *
 * `/ai` · 데스크탑 미니 창 · 모바일 창이 같이 씁니다. 입력창은 부르는 쪽이 넘깁니다 — 페이지와 모바일
 * 창은 인사와 추천 사이에 두고, 미니 창은 창 바닥에 따로 둡니다(`composer` 없이).
 *
 * ⚠️ 장식을 다시 얹지 마세요. 기울인 큰 제목 · 떠 있는 아이콘 상자 · 긴 회색 설명 · 상자 카드 여섯 개를
 * 뒀다가 "밤티" 라는 말을 듣고 걷어냈습니다
 */
import React from "react";
import { CalendarCheck, CalendarDays, DoorOpen, FileText, Newspaper, Utensils } from "lucide-react";
import type { AgentChat } from "../../hooks/useAgentChat";

const SUGGESTIONS = [
    { icon: CalendarCheck, text: "오늘 내 필참교육 있어?" },
    { icon: DoorOpen, text: "오늘 형3404 빈 교시 뭐 있어?" },
    { icon: FileText, text: "R&E 관련해서 앞으로 낼 거 뭐 남았어?" },
    { icon: CalendarDays, text: "내일 내 시간표 알려줘" },
    { icon: Newspaper, text: "이번 주 ksain 중요 공지 알려줘" },
    { icon: Utensils, text: "오늘 저녁 급식 뭐야?" },
];

/** "백재원" → "재원" — 성 한 글자를 뗍니다. 그 밖의 이름은 그대로 */
const givenName = (name: string): string => (/^[가-힣]{3}$/.test(name) ? name.slice(1) : name);

interface AgentEmptyProps {
    chat: AgentChat;
    /** 계정 이름. Agent 가 아는 이름(`models.me.name`)이 오면 그쪽을 씁니다 */
    name: string;
    composer?: React.ReactNode;
    /** 추천 질문을 눌렀을 때 — 기본은 그냥 보내기. 모바일 창은 보내면서 `/ai` 로 옮겨 갑니다 */
    onPick?: (text: string) => void;
    /**
     * 미니 창 — 글자를 줄입니다. 창 폭은 폰만 한데 화면은 데스크탑이라 `md:` 가 켜져서,
     * 페이지 크기(28px)를 그대로 두면 인사가 두 줄로 꺾입니다
     */
    compact?: boolean;
}

const AgentEmpty: React.FC<AgentEmptyProps> = ({ chat, name, composer, onPick, compact = false }) => {
    const displayName = chat.models?.me?.name || name;
    const pick = onPick ?? ((text: string) => chat.send(text));
    const Heading = compact ? "h2" : "h1";
    return (
        <div className={`flex flex-col ${compact ? "gap-5" : "gap-8"}`}>
            <Heading
                className={`text-center font-black leading-tight tracking-tight ${compact ? "text-[20px]" : "text-[24px] md:text-[28px]"}`}
            >
                {displayName ? `${givenName(displayName)}님, 무엇이 궁금하세요?` : "무엇이 궁금하세요?"}
            </Heading>
            {composer}
            <ul className="flex flex-col">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                    <li key={text}>
                        <button
                            type="button"
                            onClick={() => pick(text)}
                            className={`flex w-full items-center gap-3.5 px-3 text-left font-bold text-black/50 transition-colors duration-100 hover:bg-black/[0.04] hover:text-black ${compact ? "py-2 text-[14px]" : "py-2.5 text-[14.5px]"}`}
                        >
                            <Icon size={compact ? 17 : 18} strokeWidth={2.25} className="shrink-0" />
                            {text}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AgentEmpty;

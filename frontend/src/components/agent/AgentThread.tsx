/**
 * Ask 의 대화 본문 — 사용자 말풍선, 답(작업 블록 + 본문 + 근거 글 + 꼬리말).
 * `/ai` · 미니 창 · 모바일 창이 같이 씁니다.
 *
 * 모양은 ChatGPT·Claude 를, 작업 표시는 DiskLens AI 사이드바를 옮겨 이 앱의 레트로 규칙으로 그렸습니다.
 *
 * - **사용자 말은 오른쪽 말풍선**(보라 15% + 검은 테두리 + 하드 그림자), **답은 말풍선 없이**
 *   왼쪽 ✨ 아이콘 옆에 전체 폭으로 둡니다. 답까지 상자에 넣으면 카드 안에 카드가 줄줄이 생깁니다
 * - **답이 도는 동안**은 상태 줄(스피너 · 지금 하는 일 · 경과 초)과 단계 줄이 실시간으로 펼쳐집니다.
 *   단계마다 실행 중 스피너 → ✓ 초록 / ✗ 빨강 + 결과 한 줄("글 6건") + 걸린 시간
 * - **끝나면 작업 블록이 한 줄로 접힙니다**("작업 2단계 · 0.1초 ▸") — ChatGPT 의 "n초 동안 생각함"
 *   자리입니다. 누르면 펼쳐지고, 단계를 누르면 도구에 넘긴 값이 보입니다
 * - 핑크는 쓰지 않습니다 (이 앱에서 핑크는 "지금")
 */
import React, { useEffect, useState } from "react";
import { Check, ChevronRight, CircleAlert, CircleCheck, CircleX, Copy, ExternalLink, Info, Sparkles } from "lucide-react";
import RetroSpinner from "../atoms/RetroSpinner";
import { blocks, duration, statusLine, type AgentStep, type AssistantTurn, type Turn } from "../../lib/agentChat";

const StepRow: React.FC<{ step: AgentStep }> = ({ step }) => {
    const [open, setOpen] = useState(false);
    const hasArgs = Object.keys(step.args).length > 0;
    return (
        <li>
            <button
                type="button"
                onClick={() => hasArgs && setOpen((v) => !v)}
                className={`flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12.5px] font-bold ${hasArgs ? "hover:bg-black/[0.04]" : "cursor-default"}`}
            >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {step.status === "running" ? (
                        <RetroSpinner size="sm" label={`${step.label} 중`} />
                    ) : step.status === "done" ? (
                        <CircleCheck size={14} strokeWidth={2.75} className="text-retro-green" />
                    ) : (
                        <CircleX size={14} strokeWidth={2.75} className="text-red-600" />
                    )}
                </span>
                <span className={`min-w-0 flex-1 truncate ${step.status === "failed" ? "text-red-600" : ""}`}>
                    {step.label}
                    {step.summary && <span className="ml-1.5 text-black/40">— {step.summary}</span>}
                </span>
                {step.ms !== undefined && (
                    <span className="shrink-0 text-[11px] tabular-nums text-black/35">{(step.ms / 1000).toFixed(1)}초</span>
                )}
                {hasArgs && (
                    <ChevronRight size={12} strokeWidth={3} className={`shrink-0 text-black/30 transition-transform duration-100 ${open ? "rotate-90" : ""}`} />
                )}
            </button>
            {open && (
                <pre className="mx-2.5 mb-1 overflow-x-auto bg-black/[0.05] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-black/60">
                    {step.name}({JSON.stringify(step.args, null, 1)})
                </pre>
            )}
        </li>
    );
};

/** 작업 블록 — 도는 동안 펼침, 끝나면 한 줄로 접힘 */
const Work: React.FC<{ turn: AssistantTurn }> = ({ turn }) => {
    const [expanded, setExpanded] = useState(false);
    const live = turn.phase !== "done";
    if (turn.steps.length === 0) return null;
    const failed = turn.steps.filter((s) => s.status === "failed").length;
    const total = turn.steps.reduce((sum, s) => sum + (s.ms ?? 0), 0) / 1000;
    const open = live || expanded;
    return (
        <div className="border-l-2 border-retro-secondary/40">
            {!live && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12.5px] font-black text-black/55 hover:bg-retro-secondary/[0.06] hover:text-black"
                >
                    <span className="shrink-0">
                        작업 {turn.steps.length}단계{failed > 0 ? ` · 실패 ${failed}` : ""} · {total.toFixed(1)}초
                    </span>
                    {!expanded && (
                        <span className="min-w-0 flex-1 truncate font-bold text-black/35">
                            {turn.steps.map((s) => s.label).join(" → ")}
                        </span>
                    )}
                    <ChevronRight size={12} strokeWidth={3} className={`ml-auto shrink-0 transition-transform duration-100 ${expanded ? "rotate-90" : ""}`} />
                </button>
            )}
            {open && (
                <ul>
                    {turn.steps.map((step) => <StepRow key={step.id} step={step} />)}
                </ul>
            )}
        </div>
    );
};

/** 도는 동안 답 자리 맨 위의 한 줄 — 스피너 · 지금 하는 일 · 경과 초 */
const LiveStatus: React.FC<{ turn: AssistantTurn; cold: boolean }> = ({ turn, cold }) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const elapsed = Math.max(0, (now - turn.startedAt) / 1000);
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[13px] font-black">
                <RetroSpinner size="sm" label="답을 찾는 중" />
                <span className="min-w-0 truncate">{statusLine(turn)}</span>
                <span className="shrink-0 tabular-nums text-black/35">· {duration(elapsed)}</span>
            </div>
            {cold && elapsed > 4 && turn.steps.length === 0 && (
                <p className="pl-6 text-[12px] font-bold text-black/40">데스크탑 모델을 깨우는 중이라 첫 답은 1분쯤 걸려요</p>
            )}
        </div>
    );
};

const Body: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex flex-col gap-2.5 text-[15px] font-medium leading-[1.75] text-black/85">
        {blocks(text).map((block, i) =>
            block.kind === "p" ? (
                <p key={i} className="whitespace-pre-wrap">{block.text}</p>
            ) : (
                <ul key={i} className="flex flex-col gap-1.5">
                    {block.items.map((item, j) => (
                        <li key={j} className="flex gap-2.5">
                            {block.kind === "ul" ? (
                                <span className="mt-[0.68em] h-1.5 w-1.5 shrink-0 bg-black" />
                            ) : (
                                <span className="w-5 shrink-0 text-right font-black tabular-nums text-retro-secondary">{j + 1}.</span>
                            )}
                            <span className="min-w-0">{item}</span>
                        </li>
                    ))}
                </ul>
            ),
        )}
    </div>
);

const Footer: React.FC<{ turn: AssistantTurn }> = ({ turn }) => {
    const [copied, setCopied] = useState(false);
    const modelName = turn.model?.replace(/^(local|openai):/, "");
    return (
        <div className="flex items-center gap-3 text-[11.5px] font-bold text-black/35">
            {turn.seconds !== undefined && <span className="tabular-nums">{duration(turn.seconds)}</span>}
            {modelName && <span>{modelName}</span>}
            {turn.text && (
                <button
                    type="button"
                    onClick={() => {
                        void navigator.clipboard?.writeText(turn.text ?? "").then(() => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                        });
                    }}
                    className="flex items-center gap-1 hover:text-black"
                >
                    {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} strokeWidth={2.75} />}
                    {copied ? "복사됨" : "복사"}
                </button>
            )}
        </div>
    );
};

const Assistant: React.FC<{ turn: AssistantTurn; cold: boolean }> = ({ turn, cold }) => (
    <div className="flex gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-retro-secondary text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]">
            <Sparkles size={15} strokeWidth={2.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
            {turn.phase !== "done" && <LiveStatus turn={turn} cold={cold} />}
            <Work turn={turn} />
            {turn.text && <Body text={turn.text} />}
            {turn.notice && (
                <p className={`flex items-start gap-1.5 text-[13px] font-bold ${turn.notice.tone === "error" ? "text-retro-accent4" : "text-black/40"}`}>
                    {turn.notice.tone === "error" ? <CircleAlert size={15} strokeWidth={2.75} className="mt-0.5 shrink-0" /> : <Info size={15} strokeWidth={2.75} className="mt-0.5 shrink-0" />}
                    {turn.notice.text}
                </p>
            )}
            {turn.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {turn.sources.map((s) => (
                        <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex max-w-full items-center gap-1.5 border-2 border-black bg-white px-2 py-1 text-[11.5px] font-black transition-colors duration-100 hover:bg-black hover:text-white"
                        >
                            <ExternalLink size={12} strokeWidth={2.75} className="shrink-0" />
                            <span className="truncate">{s.title}</span>
                        </a>
                    ))}
                </div>
            )}
            {turn.phase === "done" && <Footer turn={turn} />}
        </div>
    </div>
);

const AgentThread: React.FC<{ turns: Turn[]; cold: boolean }> = ({ turns, cold }) => (
    <div className="flex flex-col gap-8">
        {turns.map((turn) =>
            turn.kind === "user" ? (
                <div key={turn.id} className="flex max-w-[85%] flex-col items-end gap-2 self-end">
                    {turn.images && turn.images.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2">
                            {turn.images.map((src, i) => (
                                <img key={i} src={src} alt={`첨부 이미지 ${i + 1}`} className="h-28 max-w-[12rem] border-2 border-black object-cover shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]" />
                            ))}
                        </div>
                    )}
                    <div className="border-2 border-black bg-[#e4d4f4] px-4 py-2.5 text-[15px] font-bold leading-relaxed shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]">
                        <p className="whitespace-pre-wrap break-words">{turn.text}</p>
                    </div>
                </div>
            ) : (
                <Assistant key={turn.id} turn={turn} cold={cold} />
            ),
        )}
    </div>
);

export default AgentThread;

/**
 * 홈 맨 위의 질문창 — "오늘 형3404 빈 교시 뭐 있어?" 를 자연어로 묻습니다.
 *
 * 답은 서버의 Agent(`/agent/chat`)가 시간표·강의실·학사일정·시험·급식·ksain 공지를 도구로
 * 찾아서 만듭니다. 화면은 **진행 단계**(`시간표 확인 중…`)와 **답 + 근거 글 링크**만 그립니다.
 *
 * - **모델을 고를 수 있습니다** — 데스크탑 Gemma 가 기본이고, 서버에 OpenAI 키가 있으면 그
 *   모델들이 목록에 붙습니다. 고른 값은 이 기기에 남습니다 (`ksa_agent_model`)
 * - ⚠️ **데스크탑 모델은 평소 꺼져 있습니다.** 게이트웨이가 요청이 오면 켜고 1시간 쉬면
 *   끕니다. 꺼져 있을 때 첫 답은 1분쯤 걸리므로, 질문창에 포커스가 가는 순간 미리 깨우고
 *   (`warmupAgent`) 기다리는 동안 그 사정을 한 줄로 알립니다
 * - 이어 묻기를 위해 **최근 대화만** 메모리에 들고 있습니다. 새로고침하면 사라집니다
 * - 색은 쓰지 않습니다. 이 화면에서 핑크는 "지금", 시안은 한시 기능입니다
 */
import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, RotateCcw, Send } from "lucide-react";
import RetroSpinner from "../atoms/RetroSpinner";
import {
    askAgent,
    fetchAgentModels,
    TOOL_LABELS,
    warmupAgent,
    type AgentModels,
    type AgentSource,
    type AgentTurn,
} from "../../lib/agentApi";

const MODEL_KEY = "ksa_agent_model";
const WARMUP_EVERY_MS = 10 * 60_000;
const SUGGESTIONS = [
    "오늘 형3404 빈 교시 뭐 있어?",
    "오늘 필참교육 있어?",
    "R&E 보고서 제출 마감 언제야?",
    "내일 내 시간표 알려줘",
];

interface Answer {
    question: string;
    text: string;
    sources: AgentSource[];
    seconds?: number;
    error?: boolean;
}

const AgentBox: React.FC = () => {
    const [input, setInput] = useState("");
    const [models, setModels] = useState<AgentModels | null>(null);
    const [model, setModel] = useState<string>(() => localStorage.getItem(MODEL_KEY) ?? "");
    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<string[]>([]);
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [history, setHistory] = useState<AgentTurn[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const warmedAt = useRef(0);

    useEffect(() => {
        fetchAgentModels()
            .then((data) => {
                setModels(data);
                setModel((current) => (data.models.some((m) => m.id === current) ? current : data.default));
            })
            .catch(() => setModels(null));
        return () => abortRef.current?.abort();
    }, []);

    const selected = models?.models.find((m) => m.id === model);
    const cold = selected?.provider === "local" && models?.gateway?.running === false;

    const warm = () => {
        if (Date.now() - warmedAt.current < WARMUP_EVERY_MS) return;
        warmedAt.current = Date.now();
        warmupAgent(model || undefined);
    };

    const pickModel = (id: string) => {
        setModel(id);
        localStorage.setItem(MODEL_KEY, id);
        warmedAt.current = 0;
    };

    const ask = async (question: string) => {
        const text = question.trim();
        if (!text || running) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setRunning(true);
        setSteps([]);
        setAnswer(null);
        setInput("");
        try {
            await askAgent(
                { message: text, history: history.slice(-8), model: model || undefined },
                (event) => {
                    if (event.type === "tool") {
                        setSteps((prev) => [...prev, TOOL_LABELS[event.name] ?? event.name]);
                    } else if (event.type === "answer") {
                        setAnswer({ question: text, text: event.text, sources: event.sources, seconds: event.seconds });
                        setHistory((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: event.text }]);
                    } else if (event.type === "error") {
                        setAnswer({ question: text, text: event.message, sources: [], error: true });
                    }
                },
                controller.signal,
            );
        } catch (error) {
            if (!controller.signal.aborted) {
                setAnswer({ question: text, text: error instanceof Error ? error.message : "요청이 실패했습니다", sources: [], error: true });
            }
        } finally {
            if (abortRef.current === controller) setRunning(false);
        }
    };

    const reset = () => {
        abortRef.current?.abort();
        setRunning(false);
        setAnswer(null);
        setSteps([]);
        setHistory([]);
    };

    return (
        <section className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
            <div className="flex flex-wrap items-center gap-2 border-b-2 border-black px-3 py-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-black/40">Ask</h2>
                {history.length > 0 && (
                    <button
                        type="button"
                        onClick={reset}
                        className="flex items-center gap-1 text-[11px] font-black text-black/40 hover:text-black"
                    >
                        <RotateCcw size={12} strokeWidth={2.75} /> 새 대화
                    </button>
                )}
                {models && models.models.length > 0 && (
                    <select
                        value={model}
                        onChange={(e) => pickModel(e.target.value)}
                        className="ml-auto max-w-[12rem] border-2 border-black bg-white px-1.5 py-0.5 text-[11px] font-bold"
                        aria-label="모델"
                    >
                        {models.models.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <form
                className="flex items-stretch gap-2 p-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    void ask(input);
                }}
            >
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={warm}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
                    }}
                    maxLength={1000}
                    placeholder="시간표·빈 강의실·학사일정·시험·급식·ksain 공지를 물어보세요"
                    className="min-w-0 flex-1 border-2 border-black px-3 py-2 text-[13.5px] font-bold placeholder:text-black/30 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={running || !input.trim()}
                    aria-label="묻기"
                    className="flex shrink-0 items-center border-2 border-black bg-white px-3 shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                >
                    <Send size={16} strokeWidth={2.75} />
                </button>
            </form>

            {!running && !answer && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => {
                                warm();
                                void ask(s);
                            }}
                            className="border-2 border-black/20 px-2 py-0.5 text-[11.5px] font-bold text-black/60 transition-colors duration-100 hover:border-black hover:text-black"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {running && (
                <div className="flex flex-col gap-1.5 border-t-2 border-black/10 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-black/50">
                        <RetroSpinner size="sm" label="답을 찾는 중" />
                        {steps.length === 0 ? "생각하는 중…" : `${steps[steps.length - 1]} 중…`}
                        {steps.length > 1 && <span className="text-black/30">({steps.slice(0, -1).join(" · ")})</span>}
                    </div>
                    {cold && (
                        <p className="text-[11.5px] font-bold text-black/40">
                            데스크탑 모델을 깨우는 중이라 첫 답은 1분쯤 걸려요
                        </p>
                    )}
                </div>
            )}

            {answer && (
                <div className="flex flex-col gap-2 border-t-2 border-black/10 px-3 py-3">
                    <p className="text-[12px] font-bold text-black/40">Q. {answer.question}</p>
                    <p className={`whitespace-pre-wrap text-[13.5px] font-bold leading-relaxed ${answer.error ? "text-black/50" : ""}`}>
                        {answer.text}
                    </p>
                    {answer.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {answer.sources.map((s) => (
                                <a
                                    key={s.url}
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex max-w-full items-center gap-1 border-2 border-black px-2 py-0.5 text-[11px] font-black hover:bg-black hover:text-white"
                                >
                                    <ExternalLink size={11} strokeWidth={2.75} className="shrink-0" />
                                    <span className="truncate">{s.title}</span>
                                </a>
                            ))}
                        </div>
                    )}
                    {answer.seconds !== undefined && (
                        <p className="text-[10.5px] font-bold text-black/30">
                            {selected?.label ?? ""} · {answer.seconds}초
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default AgentBox;

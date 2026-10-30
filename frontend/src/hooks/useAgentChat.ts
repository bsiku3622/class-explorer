/**
 * Ask 의 대화 — 보내기·정지·새 대화·모델 고르기·데스크탑 깨우기.
 *
 * **App 에 한 벌만 둡니다.** 다른 페이지에 갔다 와도, 플로팅 버튼의 창과 `/ai` 를 오가도 대화가
 * 이어져야 해서입니다. 대신 **메모리에만** 들고 있어 새로고침하면 사라집니다 — 개인정보처리방침
 * 4항이 그렇게 약속합니다(앞선 질문·답은 이용자의 화면에만 남고 새로고침하면 지워집니다).
 *
 * - 정지하면 그 답의 늦은 이벤트는 버립니다 (DiskLens 와 같은 규칙)
 * - 대화가 안 보일 때(`/ai` 도 아니고 창도 닫혀 있을 때) 답이 오면 `unread` 를 켭니다 — 플로팅
 *   버튼에 점이 찍힙니다
 * - 데스크탑 모델은 1시간 조용하면 꺼져서, 대화를 펼치면 `warm()` 으로 미리 깨웁니다(10분에 한 번).
 *   서버도 로그인한 요청이 오면 따로 깨웁니다(`backend/agent/llm.py` 의 `nudge`)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { askAgent, fetchAgentModels, warmupAgent, type AgentEvent, type AgentModels } from "../lib/agentApi";
import { applyEvent, finish, historyOf, newAssistant, type AssistantTurn, type Turn } from "../lib/agentChat";

const MODEL_KEY = "ksa_agent_model";
const WARMUP_EVERY_MS = 10 * 60_000;

const uid = () => Math.random().toString(36).slice(2, 10);

export interface AgentChat {
    turns: Turn[];
    running: boolean;
    unread: boolean;
    models: AgentModels | null;
    model: string;
    /** 고른 모델이 데스크탑 것이고 지금 쉬는 중 — 첫 답이 1분쯤 걸립니다 */
    cold: boolean;
    /** `images` — 첨부 이미지 data URL (`lib/imageAttach.shrinkImage`) */
    send: (text: string, images?: string[]) => void;
    stop: () => void;
    reset: () => void;
    pickModel: (id: string) => void;
    refresh: () => void;
    warm: () => void;
    /** 개발 전용 — 서버 없이 이벤트를 흘려 화면 상태를 봅니다 */
    play: (question: string, events: { at: number; event: AgentEvent }[]) => void;
}

/** `open` — 지금 대화가 화면에 보이는가 (`/ai` · 미니 창 · 모바일 창) */
export function useAgentChat(open: boolean): AgentChat {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [running, setRunning] = useState(false);
    const [unread, setUnread] = useState(false);
    const [models, setModels] = useState<AgentModels | null>(null);
    const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) ?? "");
    const abortRef = useRef<AbortController | null>(null);
    const timersRef = useRef<number[]>([]);
    const activeRef = useRef<string | null>(null);
    const openRef = useRef(open);
    const warmedAt = useRef(0);
    const turnsRef = useRef<Turn[]>([]);

    useEffect(() => {
        openRef.current = open;
    }, [open]);

    // 대화가 보이면 알림 점을 끕니다. 플로팅 버튼·사이드바·주소창 어느 길로 펼쳐도 같아야 해서
    // 클릭 처리기가 아니라 "열림이 바뀌었을 때" 에 겁니다 (렌더 중 조정 — effect 안 setState 대신)
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setUnread(false);
    }

    useEffect(() => {
        turnsRef.current = turns;
    }, [turns]);

    const refresh = useCallback(() => {
        fetchAgentModels()
            .then((data) => {
                setModels(data);
                setModel((current) => (data.models.some((m) => m.id === current) ? current : data.default));
            })
            .catch(() => setModels(null));
    }, []);

    const warm = useCallback(() => {
        if (Date.now() - warmedAt.current < WARMUP_EVERY_MS) return;
        warmedAt.current = Date.now();
        warmupAgent(model || undefined);
    }, [model]);

    const update = useCallback((id: string, change: (turn: AssistantTurn) => AssistantTurn) => {
        setTurns((prev) => prev.map((t) => (t.kind === "assistant" && t.id === id ? change(t) : t)));
    }, []);

    const onEvent = useCallback((id: string, event: AgentEvent) => {
        if (activeRef.current !== id) return; // 정지한 답의 늦은 이벤트
        update(id, (turn) => applyEvent(turn, event, Date.now()));
        if (event.type === "answer" || event.type === "error") {
            activeRef.current = null;
            setRunning(false);
            if (!openRef.current) setUnread(true);
        }
    }, [update]);

    const begin = useCallback((question: string, images?: string[]): string => {
        const id = uid();
        activeRef.current = id;
        setRunning(true);
        setTurns((prev) => [...prev, { kind: "user", id: uid(), text: question, images }, newAssistant(id, Date.now())]);
        return id;
    }, []);

    const send = useCallback((text: string, images: string[] = []) => {
        // 이미지만 붙이고 보내면 질문을 대신 채웁니다 (서버는 빈 질문을 받지 않습니다)
        const question = text.trim() || (images.length ? "이 이미지에서 알아야 할 내용을 알려줘" : "");
        if (!question || activeRef.current) return;
        const history = historyOf(turnsRef.current);
        const id = begin(question, images.length ? images : undefined);
        const controller = new AbortController();
        abortRef.current = controller;
        askAgent({ message: question, history, model: model || undefined, images }, (event) => onEvent(id, event), controller.signal)
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                onEvent(id, { type: "error", message: error instanceof Error ? error.message : "요청이 실패했습니다" });
            })
            .finally(() => {
                // 스트림이 답 없이 끝났으면(연결이 끊긴 경우) 그대로 닫습니다
                if (activeRef.current === id) {
                    onEvent(id, { type: "error", message: "연결이 끊겼습니다. 다시 물어봐 주세요." });
                }
            });
    }, [begin, model, onEvent]);

    const stop = useCallback(() => {
        const id = activeRef.current;
        if (!id) return;
        activeRef.current = null;
        abortRef.current?.abort();
        timersRef.current.forEach((t) => window.clearTimeout(t));
        timersRef.current = [];
        setRunning(false);
        update(id, (turn) => ({ ...finish(turn), notice: { tone: "stopped", text: "멈췄습니다. 다음 질문은 이 대화에 이어집니다." } }));
    }, [update]);

    const reset = useCallback(() => {
        stop();
        setTurns([]);
    }, [stop]);

    const pickModel = useCallback((id: string) => {
        setModel(id);
        localStorage.setItem(MODEL_KEY, id);
        warmedAt.current = 0;
    }, []);

    const play = useCallback((question: string, events: { at: number; event: AgentEvent }[]) => {
        if (activeRef.current) return;
        const id = begin(question);
        timersRef.current = events.map(({ at, event }) => window.setTimeout(() => onEvent(id, event), at));
    }, [begin, onEvent]);

    useEffect(() => () => {
        abortRef.current?.abort();
        timersRef.current.forEach((t) => window.clearTimeout(t));
    }, []);

    const cold = models?.models.find((m) => m.id === model)?.provider !== "openai" && models?.gateway?.running === false;

    return { turns, running, unread, models, model, cold, send, stop, reset, pickModel, refresh, warm, play };
}

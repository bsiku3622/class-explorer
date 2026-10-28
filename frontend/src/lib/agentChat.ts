/**
 * Ask 패널의 대화 상태 — 서버 SSE 이벤트를 화면이 그릴 대화로 바꾸는 순수 함수들.
 *
 * 생김새는 DiskLens 의 AI 사이드바를 옮겼습니다. 사용자 말은 오른쪽 말풍선, 답은 말풍선 없이
 * 전체 폭이고, 답 하나는 **작업 단계 줄들 + 본문**으로 이뤄집니다. 단계 줄은 도구 호출마다
 * 하나씩 생겨서 "지금 무엇을 하고 있는지" 를 보여 줍니다 — 실행 중이면 스피너, 끝나면
 * ✓/✗ + 걸린 시간 + 결과 한 줄("글 6건").
 *
 * 라벨은 도구 이름이 아니라 **사람 말**입니다("ksain에서 'R&E 최종 보고서' 검색"). 모르는 도구는
 * 이름을 그대로 보여 줍니다 — 숨기면 서버에 도구를 붙였을 때 화면만 조용히 비어 보입니다.
 */
import type { AgentEvent, AgentSource } from "./agentApi";

/** 대화 아래 한 줄 — `/ai` 와 플로팅 버튼 창이 같이 씁니다 */
export const ANSWER_NOTICE = "AI 답은 틀릴 수 있어요. 중요한 일정은 근거 글에서 한 번 더 확인하세요.";

export type StepStatus = "running" | "done" | "failed";

export interface AgentStep {
    id: string;
    name: string;
    label: string;
    args: Record<string, unknown>;
    status: StepStatus;
    startedAt: number;
    ms?: number;
    summary?: string;
}

export type AssistantPhase = "starting" | "thinking" | "tool" | "writing" | "done";

export interface UserTurn {
    kind: "user";
    id: string;
    text: string;
    /** 첨부한 이미지 (data URL) — 말풍선 썸네일용. 메모리에만 있습니다 */
    images?: string[];
}

export interface AssistantTurn {
    kind: "assistant";
    id: string;
    phase: AssistantPhase;
    /** 몇 번째 생각 차례인지 — 0 은 질문을 읽는 중, 그 뒤는 도구 결과를 정리하는 중 */
    thinkingStep: number;
    steps: AgentStep[];
    text: string | null;
    sources: AgentSource[];
    startedAt: number;
    seconds?: number;
    model?: string;
    notice?: { tone: "error" | "stopped"; text: string };
}

export type Turn = UserTurn | AssistantTurn;

const short = (value: unknown): string => {
    const text = String(value ?? "").trim();
    return text.length > 24 ? `${text.slice(0, 23)}…` : text;
};

/** "2026-10-29" → "10/29" */
const md = (value: unknown): string => {
    const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(value ?? ""));
    return m ? `${Number(m[1])}/${Number(m[2])}` : "";
};

const withDate = (label: string, date: unknown): string => (md(date) ? `${label} · ${md(date)}` : label);

const isMe = (who: unknown): boolean => ["", "me", "나", "내"].includes(String(who ?? "me").trim());

/** 단계 줄 라벨 — 도구 이름 대신 하는 일을 사람 말로 */
export function stepLabel(name: string, args: Record<string, unknown>): string {
    switch (name) {
        case "today_info":
            return "오늘 날짜·교시 확인";
        case "timetable":
            return withDate(isMe(args.person) ? "내 시간표 확인" : `${short(args.person)} 시간표 확인`, args.date);
        case "room_schedule":
            return withDate(`${short(args.room)} 사용 현황 확인`, args.date);
        case "empty_rooms": {
            const periods = Array.isArray(args.periods) && args.periods.length ? ` ${args.periods.join("·")}교시` : "";
            return withDate(`빈 강의실 찾기${periods}`, args.date);
        }
        case "common_free": {
            const people = Array.isArray(args.people) ? args.people.map((p) => (isMe(p) ? "나" : short(p))) : [];
            return withDate(`${people.join(", ") || "여럿"} 공강 맞추기`, args.date);
        }
        case "class_info":
            return `${short(args.subject)}${args.section ? ` ${short(args.section)}` : ""} 분반 확인`;
        case "find_person":
            return `'${short(args.query)}' 찾기`;
        case "calendar":
            return withDate(args.query ? `학사일정에서 '${short(args.query)}' 찾기` : "학사일정 확인", args.start);
        case "my_exams":
            return "내 시험 시간표 확인";
        case "meal":
            return withDate("급식 확인", args.date);
        case "course_info":
            return `${short(args.name)} 교육과정 확인`;
        case "search_ksain":
            return `ksain에서 '${short(args.query)}' 검색`;
        case "read_ksain":
            return `ksain 글 #${short(args.post_id)} 읽기`;
        case "ksain_digest": {
            const span = md(args.start) && md(args.end) && md(args.start) !== md(args.end)
                ? ` · ${md(args.start)}–${md(args.end)}`
                : md(args.start) ? ` · ${md(args.start)}` : "";
            return `ksain 중요 공지 모으기${span}`;
        }
        default:
            return name;
    }
}

/** 상태 줄 — 지금 이 답이 무엇을 하는 중인지 한 줄로 */
export function statusLine(turn: AssistantTurn): string {
    const running = turn.steps.find((s) => s.status === "running");
    if (running) return `${running.label} 중`;
    if (turn.phase === "starting") return "시작하는 중";
    if (turn.phase === "writing" || (turn.phase === "thinking" && turn.thinkingStep > 0)) return "답 정리 중";
    return "질문 읽는 중";
}

/** 8초 · 1분 5초 */
export function duration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

export function newAssistant(id: string, now: number): AssistantTurn {
    return { kind: "assistant", id, phase: "starting", thinkingStep: 0, steps: [], text: null, sources: [], startedAt: now };
}

/** 서버 이벤트 하나를 답에 반영합니다 */
export function applyEvent(turn: AssistantTurn, event: AgentEvent, now: number): AssistantTurn {
    switch (event.type) {
        case "start":
            return { ...turn, model: event.model };
        case "thinking":
            return { ...turn, phase: event.step > 0 ? "writing" : "thinking", thinkingStep: event.step };
        case "tool":
            return {
                ...turn, phase: "tool",
                steps: [...turn.steps, {
                    id: event.id, name: event.name, args: event.args,
                    label: stepLabel(event.name, event.args), status: "running", startedAt: now,
                }],
            };
        case "tool_done":
            return {
                ...turn,
                steps: turn.steps.map((s) => s.id === event.id
                    ? { ...s, status: event.ok ? "done" : "failed", ms: event.ms, summary: event.summary }
                    : s),
            };
        case "answer":
            return { ...finish(turn), text: event.text, sources: event.sources, seconds: event.seconds };
        case "error":
            return { ...finish(turn), notice: { tone: "error", text: event.message } };
    }
}

/** 답이 끝났을 때 — 아직 도는 단계가 남아 있으면 실패로 닫습니다 */
export function finish(turn: AssistantTurn): AssistantTurn {
    return {
        ...turn, phase: "done",
        steps: turn.steps.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)),
    };
}

/**
 * 서버에 보낼 앞선 대화 — 끝난 답만, 최근 8개.
 *
 * 앞선 질문의 이미지는 다시 보내지 않고 "(이미지 n장 첨부)" 로만 적습니다. 매 질문마다 수백 KB 를
 * 되풀이해 실어 보낼 이유가 없고, 모델은 그 이미지에 대해 이미 한 답을 대화에서 봅니다.
 */
export function historyOf(turns: Turn[]): { role: "user" | "assistant"; content: string }[] {
    const out: { role: "user" | "assistant"; content: string }[] = [];
    for (const turn of turns) {
        if (turn.kind === "user") {
            const note = turn.images?.length ? ` (이미지 ${turn.images.length}장 첨부)` : "";
            out.push({ role: "user", content: `${turn.text}${note}` });
        } else if (turn.text) {
            out.push({ role: "assistant", content: turn.text });
        }
    }
    return out.slice(-8);
}

export type Block =
    | { kind: "p"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] };

/**
 * 답 본문을 문단·목록으로 나눕니다. 서버가 표와 굵게는 쓰지 말라고 시키므로 그 둘만 압니다.
 * 마크다운 라이브러리를 들이지 않는 이유는 UI 라이브러리를 새로 들이지 않는다는 원칙과 같습니다.
 */
export function blocks(text: string): Block[] {
    const out: Block[] = [];
    let fresh = true; // 빈 줄 다음은 새 문단입니다
    for (const raw of text.replace(/\*\*/g, "").split("\n")) {
        const line = raw.trim();
        const bullet = /^[-•*]\s+(.*)$/.exec(line);
        const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
        const last = out[out.length - 1];
        if (!line) {
            fresh = true;
        } else if (bullet) {
            if (last?.kind === "ul") last.items.push(bullet[1]);
            else out.push({ kind: "ul", items: [bullet[1]] });
            fresh = true;
        } else if (numbered) {
            if (last?.kind === "ol") last.items.push(numbered[1]);
            else out.push({ kind: "ol", items: [numbered[1]] });
            fresh = true;
        } else if (!fresh && last?.kind === "p") {
            last.text += `\n${line}`;
        } else {
            out.push({ kind: "p", text: line });
            fresh = false;
        }
    }
    return out;
}

/**
 * 홈 질문창의 백엔드 — `/agent/*`.
 *
 * 답은 **SSE** 로 옵니다 (`tool` 단계 → `answer`). axios 는 브라우저에서 응답을 조각으로
 * 받지 못해서 이 요청만 `fetch` 의 `ReadableStream` 으로 읽습니다. 주소는 `api.ts` 인스턴스의
 * `baseURL` 을 그대로 따라가므로 배포·개발 프록시 설정을 따로 들지 않습니다.
 */
import api from "./api";
import { authHeader } from "./session";

export interface AgentModel {
    id: string;
    label: string;
    provider: "local" | "openai";
}

export interface AgentModels {
    models: AgentModel[];
    default: string;
    /** 데스크탑 게이트웨이. `running` 이 false 면 첫 답에 1분쯤 걸립니다 (모델 적재) */
    gateway: { running: boolean; idle_seconds: number; idle_limit: number } | null;
}

export interface AgentSource {
    title: string;
    url: string;
}

export type AgentEvent =
    | { type: "start"; model: string }
    | { type: "tool"; name: string; args: Record<string, unknown> }
    | { type: "answer"; text: string; sources: AgentSource[]; seconds: number }
    | { type: "error"; message: string };

export interface AgentTurn {
    role: "user" | "assistant";
    content: string;
}

/** 도구 이름 → 진행 중에 보여 줄 말 */
export const TOOL_LABELS: Record<string, string> = {
    today_info: "오늘 확인",
    timetable: "시간표 확인",
    room_schedule: "강의실 확인",
    empty_rooms: "빈 강의실 찾기",
    common_free: "공강 맞추기",
    class_info: "분반 확인",
    find_person: "사람 찾기",
    calendar: "학사일정 확인",
    my_exams: "시험 시간표 확인",
    meal: "급식 확인",
    course_info: "교육과정 확인",
    search_ksain: "ksain 검색",
    read_ksain: "ksain 글 읽기",
    ksain_digest: "ksain 공지 모으기",
};

export const fetchAgentModels = async (): Promise<AgentModels> =>
    (await api.get<AgentModels>("/agent/models", { headers: authHeader() })).data;

/** 데스크탑 모델을 미리 깨웁니다. 실패해도 질문은 그대로 됩니다 */
export const warmupAgent = (model?: string): void => {
    void api.post("/agent/warmup", { model }, { headers: authHeader() }).catch(() => undefined);
};

export async function askAgent(
    body: { message: string; history: AgentTurn[]; model?: string },
    onEvent: (event: AgentEvent) => void,
    signal: AbortSignal,
): Promise<void> {
    const base = String(api.defaults.baseURL ?? "/api").replace(/\/$/, "");
    const res = await fetch(`${base}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
        signal,
    });
    if (!res.ok || !res.body) {
        let detail = `요청이 실패했습니다 (${res.status})`;
        try {
            detail = (await res.json()).detail ?? detail;
        } catch {
            /* 본문이 JSON 이 아니면 상태 코드만 */
        }
        throw new Error(detail);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (line) onEvent(JSON.parse(line.slice(6)) as AgentEvent);
        }
    }
}

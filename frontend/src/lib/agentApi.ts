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
    /** 입력창에 보이는 짧은 이름 ("gemma4:12b") */
    name: string;
    /** 어디서 도는지까지 붙인 이름 ("gemma4:12b (데스크탑)") */
    label: string;
    provider: "local" | "openai";
}

export interface AgentModels {
    models: AgentModel[];
    default: string;
    /** 데스크탑 게이트웨이. `running` 이 false 면 첫 답에 1분쯤 걸립니다 (모델 적재) */
    gateway: { running: boolean; idle_seconds: number; idle_limit: number } | null;
    /** Agent 가 아는 "나" — 학번으로 서버가 계산합니다. 학번이 없으면 null */
    me: { name: string | null; stu_id: string; grade: number; track: "내국인" | "외국인" } | null;
}

export interface AgentSource {
    title: string;
    url: string;
}

export type AgentEvent =
    | { type: "start"; model: string }
    /** 모델이 생각하는 차례. step 0 은 질문을 읽는 중, 그 뒤는 도구 결과를 정리하는 중 */
    | { type: "thinking"; step: number }
    | { type: "tool"; id: string; name: string; args: Record<string, unknown> }
    | { type: "tool_done"; id: string; name: string; ok: boolean; ms: number; summary: string }
    | { type: "answer"; text: string; sources: AgentSource[]; seconds: number }
    | { type: "error"; message: string };

export interface AgentTurn {
    role: "user" | "assistant";
    content: string;
}

export const fetchAgentModels = async (): Promise<AgentModels> =>
    (await api.get<AgentModels>("/agent/models", { headers: authHeader() })).data;

/** 데스크탑 모델을 미리 깨웁니다. 실패해도 질문은 그대로 됩니다 */
export const warmupAgent = (model?: string): void => {
    void api.post("/agent/warmup", { model }, { headers: authHeader() }).catch(() => undefined);
};

export async function askAgent(
    body: { message: string; history: AgentTurn[]; model?: string; images?: string[] },
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

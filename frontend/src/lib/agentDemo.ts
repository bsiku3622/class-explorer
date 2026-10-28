/**
 * Ask 패널 DEV 데모 — 서버 없이 이벤트를 시간차로 흘려 화면 상태를 봅니다.
 *
 * 홈의 DEV 줄에서만 부릅니다. 실제 서버가 보내는 이벤트와 **같은 모양**이라, 화면이 실제
 * 응답을 어떻게 그리는지 그대로 확인됩니다 (목업 화면을 따로 만들지 않습니다).
 */
import type { AgentEvent } from "./agentApi";

type Script = { question: string; events: { at: number; event: AgentEvent }[] };

const tool = (at: number, id: string, name: string, args: Record<string, unknown>) =>
    ({ at, event: { type: "tool", id, name, args } as AgentEvent });
const done = (at: number, id: string, name: string, summary: string, ok = true) =>
    ({ at, event: { type: "tool_done", id, name, ok, ms: 300 + (at % 900), summary } as AgentEvent });
const think = (at: number, step: number) => ({ at, event: { type: "thinking", step } as AgentEvent });

export const AGENT_DEMOS: Record<"short" | "long" | "failed" | "error", Script> = {
    short: {
        question: "오늘 내 필참교육 있어?",
        events: [
            { at: 100, event: { type: "start", model: "local:gemma4:12b" } },
            think(150, 0),
            tool(1600, "a", "today_info", {}),
            done(1900, "a", "today_info", "2026-10-28 16:41"),
            think(2000, 1),
            tool(3200, "b", "ksain_digest", { start: "2026-10-28", end: "2026-10-28" }),
            done(4100, "b", "ksain_digest", "공지 4건 · 일정 6건"),
            think(4200, 2),
            {
                at: 6900,
                event: {
                    type: "answer", seconds: 6.8,
                    text: "오늘(2026-10-28) 본인에게 해당하는 필참교육이 있습니다.\n\n- 2학년(내국인) 수강신청 OT: 9교시(17:40–18:30) · 중강당\n\n2학년 내국인 학생이라 해당됩니다.",
                    sources: [{ title: "[1, 2학년 필참] 2027-1학기 학년별 수강신청 오리엔테이션 일정 안내(10.28 수)", url: "https://ksain.kr/document/3062" }],
                },
            },
        ],
    },
    long: {
        question: "나 R&E 관련해서 앞으로 낼 거 뭐 남았어? 그리고 그 주에 빈 강의실도",
        events: [
            { at: 100, event: { type: "start", model: "local:gemma4:12b" } },
            think(150, 0),
            tool(1200, "a", "calendar", { query: "R&E", start: "2026-10-28" }),
            done(1500, "a", "calendar", "일정 7건"),
            tool(1600, "b", "search", { query: "R&E 최종 보고서 제출" }),
            done(2400, "b", "search", "사실 2건 · 글 6건"),
            tool(2500, "c", "read_ksain", { post_id: 100109 }),
            done(3100, "c", "read_ksain", "본문·첨부 4개 읽음"),
            tool(3200, "d", "empty_rooms", { date: "2026-11-09", periods: [5, 6] }),
            done(3600, "d", "empty_rooms", "2개 교시"),
            tool(3700, "e", "timetable", { person: "me", date: "2026-11-09" }),
            done(4000, "e", "timetable", "수업 5개 · 빈 교시 6개"),
            think(4100, 1),
            {
                at: 8200,
                event: {
                    type: "answer", seconds: 8.1,
                    text: "2학년 내국인이라 해당되는 R&E 제출은 이렇습니다.\n\n1. 11/8(일) 23:59 — R&E 초록\n2. 11/15(일) 23:59 — 포스터·PPT\n3. 11/16(월) 09:00 — 연구노트 (교무연구부 직접 제출)\n4. 11/29(일) 23:59 — R&E 최종보고서\n\n11/9(월) 5·6교시에는 형3302, 형3404, 형3406 이 비어 있습니다.",
                    sources: [
                        { title: "[2학년]2026학년도 R&E 최종발표회 일정 및 제출자료 안내", url: "https://ksain.kr/document/100109" },
                    ],
                },
            },
        ],
    },
    failed: {
        question: "홍길동 시간표 보여줘",
        events: [
            { at: 100, event: { type: "start", model: "local:gemma4:12b" } },
            think(150, 0),
            tool(1300, "a", "timetable", { person: "홍길동" }),
            done(1600, "a", "timetable", "같은 이름이 여럿입니다", false),
            think(1700, 1),
            {
                at: 3600,
                event: {
                    type: "answer", seconds: 3.5,
                    text: "'홍길동' 학생이 여러 명입니다. 학번으로 다시 물어봐 주세요.\n- 24-0xx 홍길동\n- 26-1xx 홍길동",
                    sources: [],
                },
            },
        ],
    },
    error: {
        question: "오늘 저녁 급식 뭐야?",
        events: [
            { at: 100, event: { type: "start", model: "local:gemma4:12b" } },
            think(150, 0),
            { at: 2600, event: { type: "error", message: "모델에 닿지 않습니다 — gemma4:12b (데스크탑) 에 닿지 않습니다" } },
        ],
    },
};

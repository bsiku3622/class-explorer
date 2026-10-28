/**
 * 기억 — Admin 의 기억 패널(`components/admin/FactsPanel`)이 쓰는 `/facts/*`. **매니저 이상**만 열립니다.
 *
 * 기억은 ksain 글에서 분석기가 뽑은 **사실**입니다. Ask 가 질문에 맞는 것을 골라 답에 싣습니다
 * (`backend/ksain.guide.md` 의 「기억」). **글에 묶인 요약 DB** 라서 여기서는 **고치고 숨기기만**
 * 합니다 — 새 사실을 지어 넣는 API 는 일부러 없습니다. 출처 글이 없는 사실은 Ask 가 근거를 댈 수
 * 없습니다.
 *
 * 고친 사실(`edited`)과 숨긴 사실은 글을 다시 분석해도 그대로 남습니다 — 서버가 지키는 규칙이고,
 * 화면은 그걸 알려 주기만 합니다.
 */

import api from "./api";
import { authHeader } from "./session";

export type FactStatus = "active" | "hidden";

/**
 * 목록 거르개. `edited` 는 상태가 아니라 표시라서 **숨긴 것도 같이** 걸리고, `active` 에는 고친
 * 것도 들어 있습니다.
 */
export type FactFilter = FactStatus | "edited";

export interface Fact {
    id: number;
    /** 글을 안 읽은 사람이 봐도 뜻이 통하는 한 문장 */
    statement: string;
    /** `"주중 외출 시간"` — 비어 있을 수 있습니다 */
    topic: string;
    post_id: number;
    post_title: string;
    /**
     * 출처 게시판과 말머리 — `"공지사항 · 교무연구부"`, `"규정 게시판 · 폐지"`. Ask 가 학교 공지와 동아리
     * 홍보를 가려 읽으라고 같이 받습니다. 이 칸이 생기기 전에 뽑은 사실은 다시 분석될 때까지 비어 있습니다
     */
    board?: string | null;
    /** `YYYY-MM-DD` */
    posted_on: string | null;
    url: string;
    /** 대상 학년(1~3). 비어 있으면 전교생 */
    target_grades: number[];
    /** 대상 전공 트랙. 비어 있으면 전공 무관 (옛 서버는 안 보냅니다) */
    target_majors?: string[];
    /** 쓸모가 끝나는 날 `YYYY-MM-DD`. `null` 이면 계속 유효합니다(규칙처럼) */
    valid_until: string | null;
    confidence: number;
    status: FactStatus;
    /** 사람이 문장·주제·기한을 고쳤는가 */
    edited: boolean;
}

/** 글 하나와 그 글에서 나온 사실들 — 목록의 단위입니다 */
export interface FactPost {
    post_id: number;
    post_title: string;
    posted_on: string | null;
    url: string;
    /** 분석기가 쓴 글 요약. 분석 DB 를 못 읽으면 `null` */
    summary: string | null;
    /** 거르개·검색에 걸린 사실만 들어 있습니다 */
    facts: Fact[];
}

/**
 * 글의 게시판 — 서버는 사실마다 싣지만 한 글의 사실은 게시판이 같아서, 화면은 글 머리에 한 번만
 * 씁니다(사실 줄마다 되풀이하면 같은 말이 대여섯 번 섭니다). 사람이 고친 사실만 남은 옛 글처럼
 * 비어 있는 사실이 섞일 수 있어 처음 찬 값을 씁니다.
 */
export const boardOf = (post: FactPost): string | null =>
    post.facts.find((fact) => fact.board)?.board ?? null;

export interface FactsPage {
    /** 새 글부터 */
    posts: FactPost[];
    page: number;
    per_page: number;
    /** 거르고 찾은 결과의 **글** 수 — 쪽 수는 이걸로 셉니다 */
    total_posts: number;
    /**
     * ⚠️ **거르개·검색과 무관한 전체 개수**입니다. 화면에서 셀 수 없어서(한 쪽만 받습니다) 저장한
     * 뒤에는 목록을 다시 받아야 맞습니다.
     */
    counts: { active: number; hidden: number; edited: number };
}

export interface FactsQuery {
    /** 문장·주제·글 제목에서 찾습니다. 비어 있으면 전체 */
    q: string;
    /** `null` 이면 전체 */
    status: FactFilter | null;
    page: number;
}

/** 서버 검증과 같은 값 (`backend/routers/facts.py` 의 `FactPatch` · `q`) */
export const FACT_LIMITS = {
    statementMin: 5,
    statementMax: 300,
    topicMax: 60,
    queryMax: 100,
} as const;

export interface FactPatch {
    statement?: string;
    topic?: string;
    /** `"YYYY-MM-DD"`, 또는 `""` 이면 기한을 지웁니다(= 계속 유효) */
    valid_until?: string;
    status?: FactStatus;
}

export const listFacts = async ({
    q = "",
    status = null,
    page = 1,
}: Partial<FactsQuery> = {}): Promise<FactsPage> => {
    const { data } = await api.get<FactsPage>("/facts", {
        headers: authHeader(),
        // 빈 칸은 아예 보내지 않습니다 — `status=` 처럼 빈 값이 가면 서버가 422 로 거절합니다
        params: {
            q: q.trim().slice(0, FACT_LIMITS.queryMax) || undefined,
            status: status ?? undefined,
            page,
        },
    });
    return data;
};

/** 고친 사실을 그대로 돌려받습니다 (목록의 사실과 같은 모양) */
export const updateFact = async (id: number, patch: FactPatch): Promise<Fact> => {
    const { data } = await api.patch<Fact>(`/facts/${id}`, patch, { headers: authHeader() });
    return data;
};

/** 쪽 수 — 쪽은 사실이 아니라 **글** 단위입니다(한 쪽에 글 `per_page` 개) */
export const pageCount = (page: FactsPage): number =>
    Math.max(1, Math.ceil(page.total_posts / page.per_page));

/** 저장하고 돌려받은 사실을 목록의 그 자리에 끼웁니다 — 다시 받는 동안 옛 상태가 보이지 않게 */
export const withFact = (page: FactsPage, fact: Fact): FactsPage => ({
    ...page,
    posts: page.posts.map((post) =>
        post.post_id === fact.post_id
            ? { ...post, facts: post.facts.map((item) => (item.id === fact.id ? fact : item)) }
            : post,
    ),
});

/** 고치는 칸들. `validUntil` 은 `<input type="date">` 의 값이라 비어 있으면 `""`(= 계속 유효) */
export interface FactDraft {
    statement: string;
    topic: string;
    validUntil: string;
}

export const draftOf = (fact: Fact): FactDraft => ({
    statement: fact.statement,
    topic: fact.topic,
    validUntil: fact.valid_until ?? "",
});

/**
 * **바뀐 칸만** 보냅니다. 손대지 않은 칸까지 보내면 그 사이 다른 매니저가 고친 값을 덮어씁니다.
 * 바뀐 게 없으면 `null` 입니다.
 */
export const draftPatch = (fact: Fact, draft: FactDraft): FactPatch | null => {
    const patch: FactPatch = {};
    const statement = draft.statement.trim();
    const topic = draft.topic.trim();
    if (statement !== fact.statement) patch.statement = statement;
    if (topic !== fact.topic) patch.topic = topic;
    if (draft.validUntil !== (fact.valid_until ?? "")) patch.valid_until = draft.validUntil;
    return Object.keys(patch).length > 0 ? patch : null;
};

/**
 * 저장할 수 없는 이유. 없으면 `null` — 서버 검증(문장 5~300자 · 주제 60자)을 미리 막습니다.
 * 서버(파이썬)는 글자 단위로 세므로 여기서도 UTF-16 길이가 아니라 글자 수로 셉니다.
 */
export const draftProblem = (draft: FactDraft): string | null => {
    const length = [...draft.statement.trim()].length;
    if (length < FACT_LIMITS.statementMin) return `문장은 ${FACT_LIMITS.statementMin}자 이상이어야 합니다.`;
    if (length > FACT_LIMITS.statementMax) return `문장은 ${FACT_LIMITS.statementMax}자까지입니다.`;
    if ([...draft.topic.trim()].length > FACT_LIMITS.topicMax) return `주제는 ${FACT_LIMITS.topicMax}자까지입니다.`;
    return null;
};

/**
 * 오늘 — **학교 날짜**(KST) `YYYY-MM-DD`. 서버가 기한을 재는 기준(`core/clock.today()`)과 같아야
 * 화면이 "유효" 라고 한 사실을 Ask 가 빼는 일이 없습니다.
 */
export const todayInKorea = (): string =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());

/**
 * 유효 기한 한 줄 — `~11/29까지 유효`, 지났으면 `11/29 기한 지남`. 올해가 아니면 연도를 붙입니다
 * (`~2027/1/15까지 유효`). 기한이 없으면(계속 유효) `null`.
 *
 * 기한이 지난 사실은 숨기지 않았어도 **Ask 가 쓰지 않습니다**(`knowledge/facts.py` 의 `_usable`) —
 * 그래서 따로 가려 그립니다.
 */
export const validityOf = (
    validUntil: string | null,
    today: string,
): { label: string; expired: boolean } | null => {
    if (!validUntil) return null;
    const [year, month, day] = validUntil.split("-");
    const date = `${year === today.slice(0, 4) ? "" : `${year}/`}${Number(month)}/${Number(day)}`;
    const expired = validUntil < today;
    return { label: expired ? `${date} 기한 지남` : `~${date}까지 유효`, expired };
};

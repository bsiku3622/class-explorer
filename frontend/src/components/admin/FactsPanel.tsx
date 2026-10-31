/**
 * Ask 의 기억 — 글 단위로 묶은 사실 + 고치기·숨기기. Admin 의 `Ask Memory` 칸입니다.
 *
 * ```
 * ksain 글에서 분석기가 뽑은 사실입니다. …                          [Refetch]
 * [ 문장·주제·글 제목으로 찾기 — Enter                                  ✕ ]
 * [전체 37] [활성 36] [숨김 1] [고친 것 1]     글 9개 [‹ 이전] 1 / 1 쪽 [다음 ›]
 * ┌ 2024-06-14 · 공지사항 · 학생생활부 · #750 · 사실 4 ────────────────┐
 * │ 2학기 주중 외출 안내 ↗                                            │
 * │ 글 요약 (옅게)                                                     │
 * ├───────────────────────────────────────────────────────────────────┤
 * │ 주중 외출은 …                                   [고치기] [숨기기] │
 * │ [주중 외출 시간] 2학년 물리지구과학부 ~11/29까지 유효 [고친 것]      │
 * └───────────────────────────────────────────────────────────────────┘
 * ```
 *
 * **글에 묶인 요약 DB 이지 메모장이 아닙니다.** 그래서 글이 단위이고(쪽도 글 20개씩), 새 사실을
 * 지어 넣는 칸이 없습니다(API 도 없습니다). 사실마다 출처 글이 붙어 있어야 Ask 가 근거를 댑니다.
 *
 * - **저장하면 받은 사실을 그 자리에 끼운 뒤 목록을 다시 받습니다.** 위의 개수는 거르개·검색과
 *   무관한 전체 값이라 서버만 셀 수 있습니다 — 다시 받지 않으면 숨긴 뒤에도 `활성 36` 이 남습니다
 * - **고칠 때는 바뀐 칸만 보냅니다**(`draftPatch`) — 그 사이 다른 사람이 고친 칸을 덮지 않게
 * - 숨긴 사실과 기한이 지난 사실은 **옅게** 그립니다 — 둘 다 Ask 가 쓰지 않습니다
 * - 게시판(말머리 포함)은 **글 머리에 한 번** 씁니다(`boardOf`) — 한 글의 사실은 게시판이 같습니다.
 *   대상 학년·전공은 사실마다 다를 수 있어 줄마다 붙습니다
 * - ⚠️ 거르는 중에 숨기면(활성 보기) 그 사실은 목록에서 빠지고, 그래서 쪽이 비면 마지막 쪽으로
 *   물러납니다. 빈 쪽에 "조건에 맞는 기억이 없습니다" 가 뜨면 기억이 사라진 줄 압니다
 * - 검색은 **Enter 로 확정**합니다(`SearchInput` 의 `onEnter` — 한글 조합 중 Enter 는 거기서
 *   거릅니다). 칸을 비우면(✕) 곧바로 전체로 돌아갑니다
 */

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
    Brain,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Eye,
    EyeOff,
    Pencil,
    RefreshCw,
} from "lucide-react";
import {
    FACT_LIMITS,
    boardOf,
    draftOf,
    draftPatch,
    draftProblem,
    listFacts,
    pageCount,
    todayInKorea,
    updateFact,
    validityOf,
    withFact,
    type Fact,
    type FactDraft,
    type FactFilter,
    type FactPatch,
    type FactsPage,
    type FactsQuery,
} from "../../lib/factsApi";
import { majorLabel } from "../../lib/majors";
import SearchInput from "../atoms/SearchInput";
import {
    Badge,
    Button,
    Card,
    EmptyState,
    FormField,
    Icon,
    Input,
    Link,
    Notice,
    SegmentedControl,
    Spinner,
    Surface,
    Text,
    Textarea,
} from "@studio-baeks/funky-ui";

/** 거르개 — 붙는 개수는 서버가 준 전체 값입니다(검색과 무관) */
const FILTERS: {
    value: FactFilter | null;
    label: string;
    count: (counts: FactsPage["counts"]) => number;
}[] = [
    { value: null, label: "전체", count: (c) => c.active + c.hidden },
    { value: "active", label: "활성", count: (c) => c.active },
    { value: "hidden", label: "숨김", count: (c) => c.hidden },
    { value: "edited", label: "고친 것", count: (c) => c.edited },
];

/**
 * 서버가 준 사유. ⚠️ 검증 오류(422)는 `detail` 이 **배열**이라 그대로 그리면 화면이 통째로
 * 깨집니다 — 글자일 때만 씁니다.
 */
const failureText = (reason: unknown, fallback: string): string => {
    const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
    return typeof detail === "string" && detail ? detail : fallback;
};

/** 같은 화면인가 — "다시 받기" 와 "다른 쪽·거르개로 넘어가기" 를 가릅니다 */
const viewOf = (query: FactsQuery): string => `${query.status ?? "all"}|${query.page}|${query.q}`;

// ─── 고치기 ─────────────────────────────────────────────────────────────────
interface FactEditorProps {
    fact: Fact;
    draft: FactDraft;
    busy: boolean;
    error: string;
    onDraft: (patch: Partial<FactDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
}

/** 문장·주제·유효 기한. 저장은 바뀐 칸만 보냅니다 */
const FactEditor: React.FC<FactEditorProps> = ({
    fact, draft, busy, error, onDraft, onCancel, onSave,
}) => {
    const problem = draftProblem(draft);
    const changed = draftPatch(fact, draft) !== null;

    /** Esc 는 닫기. 문장 칸은 ⌘/Ctrl+Enter, 나머지는 Enter 로 저장 — 한글 조합 중 Enter 는 거릅니다 */
    const handleKey = (e: React.KeyboardEvent, withModifier: boolean) => {
        if (e.key === "Escape") {
            onCancel();
            return;
        }
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        if (withModifier && !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        onSave();
    };

    return (
        <div className="space-y-3">
            <FormField
                label="문장"
                hint={
                    <span className="flex justify-between gap-3">
                        <span>글을 안 읽은 사람도 알아듣는 한 문장 · ⌘/Ctrl+Enter 로 저장</span>
                        <span className="shrink-0">
                            {draft.statement.trim().length}/{FACT_LIMITS.statementMax}
                        </span>
                    </span>
                }
            >
                <Textarea
                    autoFocus
                    shadow
                    rows={3}
                    maxLength={FACT_LIMITS.statementMax}
                    value={draft.statement}
                    onChange={(e) => onDraft({ statement: e.target.value })}
                    onKeyDown={(e) => handleKey(e, true)}
                    className="resize-y"
                />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="주제">
                    <Input
                        type="text"
                        shadow
                        maxLength={FACT_LIMITS.topicMax}
                        value={draft.topic}
                        onChange={(e) => onDraft({ topic: e.target.value })}
                        onKeyDown={(e) => handleKey(e, false)}
                        placeholder="예: 주중 외출 시간"
                    />
                </FormField>
                <div className="space-y-1.5">
                    <Text as="div" variant="overline">유효 기한</Text>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            type="date"
                            shadow
                            aria-label="유효 기한"
                            value={draft.validUntil}
                            onChange={(e) => onDraft({ validUntil: e.target.value })}
                            onKeyDown={(e) => handleKey(e, false)}
                            className="w-auto"
                        />
                        <Button
                            size="sm"
                            variant="paper"
                            shadow
                            disabled={!draft.validUntil}
                            onClick={() => onDraft({ validUntil: "" })}
                        >
                            계속 유효
                        </Button>
                    </div>
                    <Text as="p" variant="caption" tone="muted">
                        {draft.validUntil
                            ? "이 날이 지나면 Ask 가 쓰지 않습니다."
                            : "기한 없이 씁니다 — 규칙처럼 늘 맞는 사실."}
                    </Text>
                </div>
            </div>

            <Text as="p" variant="caption" tone="muted">
                고친 사실은 <b>글을 다시 분석해도 그대로 남습니다.</b>
            </Text>
            {error ? (
                <Text as="p" variant="caption" tone="error">{error}</Text>
            ) : (
                problem && <Text as="p" variant="caption" tone="warning">⚠ {problem}</Text>
            )}

            <div className="flex justify-end gap-2">
                <Button size="sm" variant="paper" shadow onClick={onCancel}>
                    취소
                </Button>
                <Button
                    size="sm"
                    variant="filled"
                    shadow
                    disabled={busy || !changed || !!problem}
                    onClick={onSave}
                >
                    {busy ? "저장 중…" : "저장"}
                </Button>
            </div>
        </div>
    );
};

// ─── 사실 한 줄 ─────────────────────────────────────────────────────────────
interface FactRowProps {
    fact: Fact;
    /** 기한이 지났는지 재는 날 (`YYYY-MM-DD`, 학교 날짜) */
    today: string;
    /** 이 줄을 고치는 중이면 그 칸들 */
    draft: FactDraft | null;
    busy: boolean;
    error: string;
    onEdit: () => void;
    onDraft: (patch: Partial<FactDraft>) => void;
    onCancel: () => void;
    onSave: () => void;
    onToggleHidden: () => void;
}

const FactRow: React.FC<FactRowProps> = ({
    fact, today, draft, busy, error, onEdit, onDraft, onCancel, onSave, onToggleHidden,
}) => {
    if (draft) {
        return (
            <Surface as="li" fill="none" border="subtle" borderSide="top" className="px-4 py-3">
                <FactEditor
                    fact={fact}
                    draft={draft}
                    busy={busy}
                    error={error}
                    onDraft={onDraft}
                    onCancel={onCancel}
                    onSave={onSave}
                />
            </Surface>
        );
    }

    const hidden = fact.status === "hidden";
    const validity = validityOf(fact.valid_until, today);
    /** Ask 가 지금 쓰는 사실인가 — 숨겼거나 기한이 지났으면 옅게 그립니다 */
    const inUse = !hidden && !validity?.expired;

    return (
        <Surface as="li" fill="none" border="subtle" borderSide="top" className="px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Text
                        as="p"
                        leading="relaxed"
                        tone={inUse ? undefined : "muted"}
                        className="break-words"
                    >
                        {fact.statement}
                    </Text>
                    <Text as="div" variant="caption" tone="muted" className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {fact.topic && (
                            <Badge size="sm" variant="hairline" className="max-w-full">
                                <span className="min-w-0 truncate" title={fact.topic}>
                                    {fact.topic}
                                </span>
                            </Badge>
                        )}
                        {fact.target_grades.length > 0 && (
                            <span>{fact.target_grades.join("·")}학년</span>
                        )}
                        {majorLabel(fact.target_majors) && (
                            <span>{majorLabel(fact.target_majors)}</span>
                        )}
                        {validity && (
                            <Text variant="caption" tone={validity.expired ? "faint" : "inherit"}>
                                {validity.label}
                            </Text>
                        )}
                        {hidden && (
                            <Badge size="sm" variant="wash">
                                숨김
                            </Badge>
                        )}
                        {fact.edited && (
                            <Badge size="sm" accent="purple" variant="plain">
                                고친 것
                            </Badge>
                        )}
                    </Text>
                </div>
                <div className="flex gap-1.5">
                    <Button
                        size="xs"
                        variant="muted"
                        icon={Pencil}
                        disabled={busy}
                        onClick={onEdit}
                        className="shrink-0 whitespace-nowrap"
                    >
                        고치기
                    </Button>
                    <Button
                        size="xs"
                        variant="muted"
                        icon={hidden ? Eye : EyeOff}
                        disabled={busy}
                        onClick={onToggleHidden}
                        title={
                            hidden
                                ? "숨김을 풉니다"
                                : "Ask 가 더는 쓰지 않습니다 — 글을 다시 분석해도 되살아나지 않습니다"
                        }
                        className="shrink-0 whitespace-nowrap"
                    >
                        {hidden ? "되살리기" : "숨기기"}
                    </Button>
                </div>
            </div>
            {error && <Text as="p" variant="caption" tone="error" className="mt-2">{error}</Text>}
        </Surface>
    );
};

// ─── 패널 ───────────────────────────────────────────────────────────────────
const FactsPanel: React.FC = () => {
    /** 검색칸의 글자 — Enter 를 눌러야 `query.q` 가 됩니다 */
    const [input, setInput] = useState("");
    const [query, setQuery] = useState<FactsQuery>({ q: "", status: null, page: 1 });
    /** 같은 화면을 다시 받을 때 올립니다 (Refetch · 저장한 뒤) */
    const [nonce, setNonce] = useState(0);
    /** 마지막으로 받은 목록 — 다른 쪽을 받는 동안에도 지우지 않고 흐리게 둡니다 */
    const [shown, setShown] = useState<{ view: string; page: FactsPage } | null>(null);
    /** 마지막으로 끝난 요청 — 지금 화면·`nonce` 와 맞으면 다 받은 것입니다 */
    const [settled, setSettled] = useState<{ view: string; nonce: number; error: string } | null>(null);
    const [editing, setEditing] = useState<{ id: number; draft: FactDraft } | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
    /** 기한이 지났는지 재는 날 — 패널이 열려 있는 동안 하나로 둡니다 */
    const [today] = useState(todayInKorea);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ignore = false;
        const view = viewOf(query);
        listFacts(query).then(
            (page) => {
                if (ignore) return;
                // 숨겨서 마지막 쪽이 비면 한 쪽 물러납니다 — 빈 쪽은 기억이 사라진 것처럼 보입니다
                const last = pageCount(page);
                if (page.posts.length === 0 && query.page > last) {
                    setQuery((prev) => ({ ...prev, page: last }));
                    return;
                }
                setShown({ view, page });
                setSettled({ view, nonce, error: "" });
            },
            (reason) => {
                if (ignore) return;
                setSettled({ view, nonce, error: failureText(reason, "기억을 불러오지 못했습니다.") });
            },
        );
        return () => {
            ignore = true;
        };
    }, [query, nonce]);

    const view = viewOf(query);
    const current = settled && settled.view === view && settled.nonce === nonce ? settled : null;
    const loading = current === null;
    const data = shown?.page ?? null;
    /** 다른 쪽·거르개를 받는 중 — 옛 목록을 흐리게 둡니다 */
    const stale = shown !== null && shown.view !== view;
    const pages = data ? pageCount(data) : 1;

    /**
     * 거르개·쪽·검색어를 바꿉니다 — 고치던 칸은 닫고 목록은 맨 위로. 같은 화면이면 아무것도 하지
     * 않습니다(골라 둔 칩을 또 눌렀다고 고치던 칸이 닫히면 안 됩니다).
     */
    const go = (next: Partial<FactsQuery>) => {
        const target = { ...query, ...next };
        if (viewOf(target) === viewOf(query)) return;
        setQuery(target);
        setEditing(null);
        setRowError(null);
        listRef.current?.scrollTo({ top: 0 });
    };

    const search = () => go({ q: input.trim().slice(0, FACT_LIMITS.queryMax), page: 1 });

    const handleInput = (value: string) => {
        setInput(value);
        // ✕ 로 지우거나 다 지운 칸은 곧바로 전체로 — 빈 칸에서 Enter 를 또 누르게 하지 않습니다
        if (!value.trim() && query.q) go({ q: "", page: 1 });
    };

    const save = async (fact: Fact, patch: FactPatch) => {
        setBusyId(fact.id);
        setRowError(null);
        try {
            const updated = await updateFact(fact.id, patch);
            // 받은 사실을 먼저 끼우고 다시 받습니다 — 위의 개수는 서버만 셀 수 있습니다
            setShown((prev) => prev && { ...prev, page: withFact(prev.page, updated) });
            setEditing((prev) => (prev?.id === fact.id ? null : prev));
            setNonce((n) => n + 1);
        } catch (reason) {
            setRowError({ id: fact.id, message: failureText(reason, "저장하지 못했습니다.") });
        } finally {
            setBusyId(null);
        }
    };

    const saveDraft = (fact: Fact) => {
        if (!editing || editing.id !== fact.id || draftProblem(editing.draft)) return;
        const patch = draftPatch(fact, editing.draft);
        if (patch) void save(fact, patch);
        else setEditing(null); // 바뀐 게 없으면 닫기만 합니다
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <Text as="p" variant="caption" tone="muted" leading="relaxed" className="min-w-0 flex-1 basis-64">
                    ksain 글에서 분석기가 뽑은 사실입니다. Ask 는 질문에 맞는 것을 골라 답에
                    씁니다(숨긴 것·기한이 지난 것은 빼고). 숨기거나 고친 사실은{" "}
                    <b>글을 다시 분석해도 그대로 남습니다.</b>
                </Text>
                <Button
                    size="xs"
                    variant="muted"
                    icon={RefreshCw}
                    iconSpin={loading}
                    onClick={() => setNonce((n) => n + 1)}
                    className="shrink-0 whitespace-nowrap"
                >
                    Refetch
                </Button>
            </div>

            <SearchInput
                size="sm"
                value={input}
                onChange={handleInput}
                onEnter={search}
                placeholder="문장·주제·글 제목으로 찾기 — Enter"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                    aria-label="기억 거르개"
                    variant="paper"
                    shadow
                    value={FILTERS.find((filter) => filter.value === query.status)?.label ?? ""}
                    onChange={(label) => {
                        const filter = FILTERS.find((item) => item.label === label);
                        if (filter) go({ status: filter.value, page: 1 });
                    }}
                    options={FILTERS.map((filter) => ({
                        value: filter.label,
                        label: (
                            <>
                                {filter.label}
                                {data && <span className="opacity-50">{filter.count(data.counts)}</span>}
                            </>
                        ),
                    }))}
                />
                <div className="flex items-center gap-2">
                    {data && (
                        <Text variant="caption" tone="muted" className="whitespace-nowrap">
                            글 {data.total_posts}개
                        </Text>
                    )}
                    <Button
                        size="sm"
                        variant="paper"
                        shadow
                        icon={ChevronLeft}
                        disabled={query.page <= 1}
                        onClick={() => go({ page: query.page - 1 })}
                    >
                        이전
                    </Button>
                    <Text variant="caption" weight="black" className="whitespace-nowrap">
                        {query.page} / {pages} 쪽
                    </Text>
                    <Button
                        size="sm"
                        variant="paper"
                        shadow
                        iconEnd={ChevronRight}
                        disabled={query.page >= pages}
                        onClick={() => go({ page: query.page + 1 })}
                    >
                        다음
                    </Button>
                </div>
            </div>

            {current?.error && (
                <Notice
                    role="alert"
                    action={
                        <Button size="xs" accent="error" variant="outline" onClick={() => setNonce((n) => n + 1)}>
                            다시 시도
                        </Button>
                    }
                >
                    {current.error}
                </Notice>
            )}

            {data === null ? (
                loading && (
                    <Text as="p" tone="muted" className="flex items-center gap-2">
                        <Spinner size="sm" />
                        불러오는 중…
                    </Text>
                )
            ) : data.posts.length === 0 ? (
                data.counts.active + data.counts.hidden === 0 ? (
                    <EmptyState framed icon={Brain}>
                        아직 기억이 없습니다 — ksain 분석이 돌면 쌓입니다.
                    </EmptyState>
                ) : (
                    <Text as="p" tone="muted">조건에 맞는 기억이 없습니다.</Text>
                )
            ) : (
                <div
                    ref={listRef}
                    aria-busy={loading}
                    className={`max-h-[70vh] space-y-4 overflow-y-auto pr-1 pb-1 transition-opacity duration-100 ${
                        stale ? "opacity-50" : ""
                    }`}
                >
                    {data.posts.map((post) => (
                        <Card shadow="raised" key={post.post_id} padding="0">
                            <div className="px-4 py-3">
                                <Text as="p" variant="caption" tone="muted">
                                    {[post.posted_on, boardOf(post), `#${post.post_id}`, `사실 ${post.facts.length}`]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </Text>
                                <Text as="div" weight="black" className="mt-0.5">
                                    <Link
                                        underline="hover"
                                        href={post.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-start gap-1"
                                    >
                                        {post.post_title || "제목 없는 글"}
                                        <Icon
                                            icon={ExternalLink}
                                            size={12}
                                            tone="muted"
                                            className="mt-1 shrink-0"
                                        />
                                    </Link>
                                </Text>
                                {post.summary && (
                                    <Text as="p" variant="caption" tone="muted" leading="relaxed" className="mt-1.5">
                                        {post.summary}
                                    </Text>
                                )}
                            </div>
                            <ul>
                                {post.facts.map((fact) => (
                                    <FactRow
                                        key={fact.id}
                                        fact={fact}
                                        today={today}
                                        draft={editing?.id === fact.id ? editing.draft : null}
                                        busy={busyId === fact.id}
                                        error={rowError?.id === fact.id ? rowError.message : ""}
                                        onEdit={() => {
                                            setEditing({ id: fact.id, draft: draftOf(fact) });
                                            setRowError(null);
                                        }}
                                        onDraft={(patch) =>
                                            setEditing((prev) =>
                                                prev?.id === fact.id
                                                    ? { ...prev, draft: { ...prev.draft, ...patch } }
                                                    : prev,
                                            )
                                        }
                                        onCancel={() => {
                                            setEditing(null);
                                            setRowError(null);
                                        }}
                                        onSave={() => saveDraft(fact)}
                                        onToggleHidden={() =>
                                            void save(fact, {
                                                status: fact.status === "hidden" ? "active" : "hidden",
                                            })
                                        }
                                    />
                                ))}
                            </ul>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FactsPanel;

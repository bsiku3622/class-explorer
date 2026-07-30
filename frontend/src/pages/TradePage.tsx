import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    ArrowLeftRight,
    ArrowRight,
    Check,
    ChevronDown,
    Plus,
    Search,
    Trash2,
    TriangleAlert,
    Users,
    X,
} from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    buildSubjectIndex,
    buildStudentIndex,
    getStudentSchedule,
    findPlans,
    applyPlan,
    scheduleToTimes,
    evaluateAddCandidates,
    findBlockers,
    findAddableAfterDrop,
    findTradePartners,
    buildTradePost,
    totalCredits,
    missingCreditSubjects,
    MAX_PLAN_RESULTS,
    type AddSelection,
    type PlanAction,
    type PlanResult,
    type SectionInfo,
    type SlotKey,
} from "../lib/tradeEngine";
import {
    getKoreanName,
    getSectionNumber,
    getStudentColor,
    formatSectionTimes,
} from "../lib/utils";
import { fuzzyMatch } from "../lib/searchEngine";
import { loadState, saveState } from "../lib/userState";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import PageHeader from "../components/molecules/PageHeader";
import TimetableGrid from "../components/TimetableGrid";
import SectionsTimetable from "../components/SectionsTimetable";
import CopyButton from "../components/atoms/CopyButton";

interface TradePageProps {
    allClassesData: SubjectData[];
    term: Term | null;
    /** 계정에 등록된 본인 학번 — 저장된 계획이 없을 때 기본으로 잡습니다 */
    myStuId: string | null;
}

const ACTION_LABEL: Record<PlanAction, string> = {
    keep: "유지",
    move: "이동",
    drop: "드랍",
};

const ACTION_ORDER: PlanAction[] = ["keep", "move", "drop"];

const sectionLabel = (s: SectionInfo) =>
    `${getSectionNumber(s.section)}분반 · ${s.teacher}`;

/** 계정 저장으로 옮기기 전에 쓰던 키 — 남아 있으면 한 번 옮겨 옵니다 */
const LEGACY_STATE_KEY = "ksa_trade_state";

interface SavedState {
    stuId: string | null;
    actions: Record<string, PlanAction>;
    addSelections: AddSelection[];
    moveTargets: Record<string, number | null>;
}

const TradePage: React.FC<TradePageProps> = ({ allClassesData, term, myStuId }) => {
    const [stuId, setStuId] = useState<string | null>(null);
    const [studentQuery, setStudentQuery] = useState("");
    const [actions, setActions] = useState<Record<string, PlanAction>>({});
    const [addSelections, setAddSelections] = useState<AddSelection[]>([]);
    /** 이동으로 표시한 과목의 목표 분반 (null = 아무 분반이나 탐색) */
    const [moveTargets, setMoveTargets] = useState<Record<string, number | null>>({});
    const [addQuery, setAddQuery] = useState("");
    const [openSubject, setOpenSubject] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    /** 불러오기 전에는 저장하지 않습니다 — 빈 값으로 덮어쓰는 걸 막습니다 */
    const [restored, setRestored] = useState(false);

    // 계정 정보(`myStuId`)가 늦게 도착할 수 있어, 복원 전까지는 다시 시도합니다
    useEffect(() => {
        if (restored) return;
        let cancelled = false;
        loadState<SavedState>("trade", LEGACY_STATE_KEY)
            .then((state) => {
                if (cancelled) return;
                if (state?.stuId) {
                    setStuId(state.stuId);
                    setActions(state.actions ?? {});
                    setAddSelections(
                        Array.isArray(state.addSelections) ? state.addSelections : [],
                    );
                    setMoveTargets(state.moveTargets ?? {});
                } else if (myStuId) {
                    // 저장된 계획이 없으면 본인 시간표에서 시작합니다
                    setStuId(myStuId);
                }
                setRestored(true);
            })
            .catch(() => {
                if (!cancelled) setRestored(true);
            });
        return () => {
            cancelled = true;
        };
    }, [restored, myStuId]);

    /** 작업 중인 계획은 계정에 남아 다른 기기에서도 이어집니다 */
    useEffect(() => {
        if (!restored) return;
        saveState("trade", stuId ? { stuId, actions, addSelections, moveTargets } : {});
    }, [restored, stuId, actions, addSelections, moveTargets]);

    const index = useMemo(() => buildSubjectIndex(allClassesData), [allClassesData]);
    const studentIndex = useMemo(
        () => buildStudentIndex(allClassesData),
        [allClassesData],
    );

    const allStudents = useMemo(() => {
        const map = new Map<string, string>();
        allClassesData.forEach((subj) =>
            subj.sections.forEach((sec) =>
                sec.students?.forEach((s) => map.set(s.stuId, s.name)),
            ),
        );
        return Array.from(map, ([id, name]) => ({ stuId: id, name })).sort((a, b) =>
            a.stuId.localeCompare(b.stuId),
        );
    }, [allClassesData]);

    const studentMatches = useMemo(() => {
        const q = studentQuery.trim();
        if (!q) return [];
        return allStudents
            .filter((s) => fuzzyMatch(s.stuId, q) || fuzzyMatch(s.name, q))
            .slice(0, 24);
    }, [allStudents, studentQuery]);

    const schedule = useMemo(
        () => (stuId ? getStudentSchedule(allClassesData, stuId) : []),
        [allClassesData, stuId],
    );

    const selectStudent = useCallback((id: string) => {
        setStuId(id);
        setStudentQuery("");
        setActions({});
        setAddSelections([]);
        setMoveTargets({});
        setAddQuery("");
        setOpenSubject(null);
        setPreviewKey(null);
    }, []);

    const setAction = useCallback((subject: string, action: PlanAction) => {
        setPreviewKey(null);
        setActions((prev) => ({ ...prev, [subject]: action }));
        // 이동을 껐다 켜면 목표 분반은 초기화합니다
        if (action !== "move") {
            setMoveTargets((prev) => {
                if (!(subject in prev)) return prev;
                const next = { ...prev };
                delete next[subject];
                return next;
            });
        }
    }, []);

    const setMoveTarget = useCallback(
        (subject: string, sectionId: number | null) => {
            setPreviewKey(null);
            setMoveTargets((prev) => ({ ...prev, [subject]: sectionId }));
        },
        [],
    );

    const toggleAddSubject = useCallback((subject: string) => {
        setPreviewKey(null);
        setAddSelections((prev) =>
            prev.some((a) => a.subject === subject)
                ? prev.filter((a) => a.subject !== subject)
                : [...prev, { subject, sectionId: null }],
        );
    }, []);

    const setAddSection = useCallback(
        (subject: string, sectionId: number | null) => {
            setPreviewKey(null);
            setAddSelections((prev) =>
                prev.map((a) => (a.subject === subject ? { ...a, sectionId } : a)),
            );
        },
        [],
    );

    const { results: plans, truncated } = useMemo(() => {
        if (!stuId || schedule.length === 0)
            return { results: [] as PlanResult[], truncated: false };
        return findPlans({ schedule, index, actions, addSelections, moveTargets });
    }, [stuId, schedule, index, actions, addSelections, moveTargets]);

    /** 분반을 직접 고르지 않고 "자동"으로 둔 항목이 있는지 */
    const hasAutoChoice = useMemo(
        () =>
            addSelections.some((a) => a.sectionId === null) ||
            schedule.some(
                (s) =>
                    (actions[s.subject] ?? "keep") === "move" &&
                    moveTargets[s.subject] == null,
            ),
        [addSelections, schedule, actions, moveTargets],
    );

    /**
     * 미리 볼 조합. 사용자가 고른 게 있으면 그것을,
     * 없더라도 자동으로 맡긴 항목이 있으면 첫 조합을 보여줍니다 —
     * "자동"인데 시간표가 그대로면 아무 일도 안 한 것처럼 보이니까요.
     */
    const previewPlan = useMemo(() => {
        if (previewKey) return plans.find((p) => p.key === previewKey) ?? null;
        return hasAutoChoice ? (plans[0] ?? null) : null;
    }, [plans, previewKey, hasAutoChoice]);

    /** 자동으로 고른 조합인지 (사용자가 직접 누른 게 아님) */
    const isAutoPreview = !previewKey && previewPlan !== null;

    /**
     * 왼쪽 시간표에 그릴 내용.
     * 조합을 고르면 그 결과를, 고르기 전에는 지금까지 지정한 드랍·추가를 바로 반영합니다.
     * 빠지는 과목은 남겨둔 채 색으로 구분해 어느 시간이 비는지 보이게 합니다.
     */
    const {
        previewSchedule,
        effectiveSchedule,
        leavingSubjects,
        enteringSubjects,
        movedSubjects,
        conflictingSubjects,
    } = useMemo(() => {
        const leaving = new Set<string>();
        const entering = new Set<string>();
        const moved = new Set<string>();
        const conflicting = new Set<string>();

        {
            if (previewPlan) {
                previewPlan.choices.forEach((c) => {
                    if (!c.to) leaving.add(c.subject);
                    else if (!c.from) entering.add(c.subject);
                    else if (c.from.id !== c.to.id) moved.add(c.subject);
                });
                const dropped = schedule.filter((s) => leaving.has(s.subject));
                // 빠지는 과목을 앞에 둬서, 같은 칸이 겹치면 새로 들어오는 쪽이 보이게 합니다
                const applied = applyPlan(schedule, previewPlan);
                return {
                    previewSchedule: [...dropped, ...applied],
                    effectiveSchedule: applied,
                    leavingSubjects: leaving,
                    enteringSubjects: entering,
                    movedSubjects: moved,
                    conflictingSubjects: conflicting, // 성립한 조합이라 충돌이 없습니다
                };
            }

            schedule.forEach((s) => {
                if ((actions[s.subject] ?? "keep") === "drop") leaving.add(s.subject);
            });

            // 목표 분반을 고른 이동은 그 자리로 옮겨 그립니다
            const movedTo = new Map<string, SectionInfo>();
            schedule.forEach((s) => {
                if ((actions[s.subject] ?? "keep") !== "move") return;
                const targetId = moveTargets[s.subject];
                if (targetId == null || targetId === s.id) return;
                const target = (index.get(s.subject) ?? []).find(
                    (x) => x.id === targetId,
                );
                if (target) movedTo.set(s.subject, target);
            });

            const staying = schedule
                .filter((s) => !leaving.has(s.subject))
                .map((s) => movedTo.get(s.subject) ?? s);
            movedTo.forEach((_, subject) => moved.add(subject));

            // 옮겨간 분반이 다른 과목과 부딪히는지
            movedTo.forEach((target, subject) => {
                findBlockers(
                    staying.filter((s) => s.subject !== subject),
                    target,
                ).forEach((b) => conflicting.add(b.subject));
            });

            const added: SectionInfo[] = [];
            addSelections.forEach(({ subject, sectionId }) => {
                if (sectionId === null) return; // 분반 미정이면 그릴 수 없습니다
                const section = (index.get(subject) ?? []).find((s) => s.id === sectionId);
                if (!section) return;
                added.push(section);
                entering.add(subject);
                // 충돌을 감수하고 고정했다면, 부딪히는 기존 과목을 짚어줍니다
                findBlockers(staying, section).forEach((b) =>
                    conflicting.add(b.subject),
                );
            });

            const dropped = schedule.filter((s) => leaving.has(s.subject));
            return {
                previewSchedule: [...dropped, ...staying, ...added],
                effectiveSchedule: [...staying, ...added],
                leavingSubjects: leaving,
                enteringSubjects: entering,
                movedSubjects: moved,
                conflictingSubjects: conflicting,
            };
        }
    }, [schedule, previewPlan, actions, addSelections, moveTargets, index]);

    /**
     * 조합에 포함된 분반 이동마다, 그 자리를 서로 맞바꿀 수 있는 학생.
     * 조합을 고른 뒤에만 계산합니다 — 후보가 수백 개일 수 있어서입니다.
     */
    const partnersForPreview = useMemo(() => {
        if (!previewPlan || !stuId) return [];
        return previewPlan.choices
            .filter((c) => c.from && c.to && c.from.id !== c.to.id)
            .map((c) => ({
                subject: c.subject,
                from: c.from as SectionInfo,
                to: c.to as SectionInfo,
                partners: findTradePartners(
                    studentIndex,
                    stuId,
                    c.from as SectionInfo,
                    c.to as SectionInfo,
                ),
            }));
    }, [previewPlan, stuId, studentIndex]);

    /** 펼친 과목의 분반별 교환 상대 수 */
    const partnerCountBySection = useCallback(
        (current: SectionInfo, target: SectionInfo): number => {
            if (!stuId || current.id === target.id) return 0;
            return findTradePartners(studentIndex, stuId, current, target).length;
        },
        [studentIndex, stuId],
    );

    // index.css의 테마 값 (retro-primary / retro-green / retro-accent4)
    /** 지금 수강 학점과, 계획을 적용했을 때의 학점 */
    const creditSummary = useMemo(() => {
        const now = totalCredits(schedule);
        const planned = totalCredits(effectiveSchedule);
        return {
            now,
            planned,
            delta: planned - now,
            unknown: [
                ...new Set([
                    ...missingCreditSubjects(schedule),
                    ...missingCreditSubjects(effectiveSchedule),
                ]),
            ],
        };
    }, [schedule, effectiveSchedule]);

    const cellColorFor = useCallback(
        (time: { subject?: string }) => {
            if (!time.subject) return undefined;
            if (conflictingSubjects.has(time.subject)) return "#ff9100";
            if (leavingSubjects.has(time.subject)) return "#ff4eba";
            if (movedSubjects.has(time.subject)) return "#00c8ff";
            if (enteringSubjects.has(time.subject)) return "#00c22a";
            return undefined;
        },
        [leavingSubjects, movedSubjects, enteringSubjects, conflictingSubjects],
    );

    /** 특정 과목을 비웠다고 가정했을 때 다른 과목이 차지 중인 슬롯 */
    const busySlotsExcluding = useCallback(
        (subject: string): Set<SlotKey> => {
            const set = new Set<SlotKey>();
            schedule.forEach((s) => {
                if (s.subject === subject) return;
                if ((actions[s.subject] ?? "keep") === "drop") return;
                s.slots.forEach((slot) => set.add(slot));
            });
            return set;
        },
        [schedule, actions],
    );

    const enrolledSubjects = useMemo(
        () => new Set(schedule.map((s) => s.subject)),
        [schedule],
    );

    const dropSubjects = useMemo(
        () =>
            schedule
                .map((s) => s.subject)
                .filter((subject) => actions[subject] === "drop"),
        [schedule, actions],
    );

    /** 드랍한 과목은 목록 맨 아래로 */
    const orderedSchedule = useMemo(() => {
        const dropped = new Set(dropSubjects);
        return [
            ...schedule.filter((s) => !dropped.has(s.subject)),
            ...schedule.filter((s) => dropped.has(s.subject)),
        ];
    }, [schedule, dropSubjects]);

    /** 드랍으로 비는 시간에 새로 들어갈 수 있는 과목 (과목 단위로 묶음) */
    const openedByDrop = useMemo(() => {
        if (dropSubjects.length === 0) return [];
        // 지금 계획대로의 시간표 기준 — 이동·추가까지 반영해야 실제로 들어갈 수 있는 것만 남습니다
        const addable = findAddableAfterDrop(effectiveSchedule, index, []);
        const grouped = new Map<string, SectionInfo[]>();
        addable.forEach((sec) => {
            if (!grouped.has(sec.subject)) grouped.set(sec.subject, []);
            grouped.get(sec.subject)!.push(sec);
        });
        // 드랍으로 비운 시간을 실제로 쓰는 과목만 남깁니다
        const freedSlots = new Set<SlotKey>();
        schedule
            .filter((s) => dropSubjects.includes(s.subject))
            .forEach((s) => s.slots.forEach((slot) => freedSlots.add(slot)));

        return Array.from(grouped, ([subject, sections]) => ({
            subject,
            sections,
            usesFreed: sections.some((sec) =>
                sec.slots.some((slot) => freedSlots.has(slot)),
            ),
        }))
            .filter((g) => g.usesFreed)
            .sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
    }, [dropSubjects, schedule, effectiveSchedule, index]);

    const addedSubjects = useMemo(
        () => addSelections.map((a) => a.subject),
        [addSelections],
    );

    const addMatches = useMemo(() => {
        const q = addQuery.trim();
        if (!q) return [];
        return allClassesData
            .filter((s) => !enrolledSubjects.has(s.subject))
            .filter(
                (s) =>
                    fuzzyMatch(s.subject, q) ||
                    fuzzyMatch(getKoreanName(s.subject), q) ||
                    (!!s.subject_english && fuzzyMatch(s.subject_english, q)),
            )
            .slice(0, 20)
            .map((s) => s.subject);
    }, [allClassesData, addQuery, enrolledSubjects]);

    /** 추가 후보 과목별로 "바로 들어가는 분반이 있는지" 요약 */
    const addSummaries = useMemo(() => {
        const map = new Map<string, { free: number; total: number }>();
        [...addedSubjects, ...addMatches].forEach((subject) => {
            if (map.has(subject)) return;
            const candidates = evaluateAddCandidates(effectiveSchedule, index, subject);
            map.set(subject, {
                free: candidates.filter((c) => c.blockers.length === 0).length,
                total: candidates.length,
            });
        });
        return map;
    }, [addedSubjects, addMatches, effectiveSchedule, index]);

    const studentColor = stuId ? getStudentColor(stuId) : "#000000";

    if (!term || term.semester !== 2 || term.year !== 2026) {
        return (
            <div className="flex flex-col gap-6 pb-20">
                <PageHeader
                    title="Trade"
                    subtitle="수강 변경 탐색"
                    icon={ArrowLeftRight}
                />
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/40">
                        2026-2 학기에서만 사용할 수 있습니다
                    </p>
                    <p className="text-xs font-bold text-black/40 mt-2">
                        상단의 학기 전환에서 2026-2를 선택해주세요.
                    </p>
                </RetroCard>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader
                title="Trade"
                subtitle="수강 변경 탐색"
                icon={ArrowLeftRight}
                action={
                    stuId ? (
                        <RetroButton
                            size="sm"
                            onClick={() => selectStudent("")}
                            icon={<X size={14} strokeWidth={2.5} />}
                        >
                            Reset
                        </RetroButton>
                    ) : undefined
                }
            >
                <div className="space-y-3">
                    <RetroSubTitle title="Select Student" icon={Search} />
                    <input
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        placeholder="학번 또는 이름으로 검색 (예: 25-059, 백재원)"
                        className="w-full border-2 border-black px-4 py-3 text-sm font-bold outline-none focus:shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100"
                    />
                    {studentMatches.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {studentMatches.map((s) => (
                                <button
                                    key={s.stuId}
                                    onClick={() => selectStudent(s.stuId)}
                                    className="flex items-center gap-2 border-2 px-2 py-1 text-[11px] font-black italic transition-all duration-100 hover:scale-105 active:scale-95"
                                    style={{
                                        backgroundColor: `${getStudentColor(s.stuId)}15`,
                                        borderColor: getStudentColor(s.stuId),
                                        color: getStudentColor(s.stuId),
                                    }}
                                >
                                    {s.stuId} {s.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {stuId && (
                        <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                Planning for
                            </span>
                            <span
                                className="border-2 px-2 py-1 text-xs font-black italic"
                                style={{
                                    backgroundColor: `${studentColor}15`,
                                    borderColor: studentColor,
                                    color: studentColor,
                                }}
                            >
                                {stuId}{" "}
                                {allStudents.find((s) => s.stuId === stuId)?.name}
                            </span>
                            <span className="text-[10px] font-bold text-black/40">
                                {schedule.length}과목 수강 중
                            </span>
                            <span className="border-2 border-black px-2 py-1 text-[11px] font-black">
                                {creditSummary.now}학점
                                {creditSummary.delta !== 0 && (
                                    <span
                                        className={
                                            creditSummary.delta > 0
                                                ? "text-retro-green"
                                                : "text-retro-primary"
                                        }
                                    >
                                        {" "}
                                        → {creditSummary.planned}학점 (
                                        {creditSummary.delta > 0 ? "+" : ""}
                                        {creditSummary.delta})
                                    </span>
                                )}
                            </span>
                            {creditSummary.unknown.length > 0 && (
                                <span
                                    className="text-[10px] font-bold text-retro-accent4"
                                    title={creditSummary.unknown.join(", ")}
                                >
                                    학점 미등록 {creditSummary.unknown.length}과목 제외
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </PageHeader>

            {!stuId ? (
                <RetroCard className="bg-white p-10 text-center">
                    <p className="font-black uppercase tracking-widest text-black/30">
                        학생을 선택하면 시간표 기준으로 변경 가능한 조합을 찾습니다
                    </p>
                </RetroCard>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                    {/* 좌: 시간표 미리보기 */}
                    <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <RetroSubTitle
                                title={
                                    isAutoPreview
                                        ? "Auto Preview"
                                        : previewPlan
                                          ? "Preview"
                                          : "Current Schedule"
                                }
                            />
                            {previewPlan && (
                                <RetroButton
                                    size="sm"
                                    onClick={() => setPreviewKey(null)}
                                    icon={<X size={12} strokeWidth={2.5} />}
                                >
                                    Clear
                                </RetroButton>
                            )}
                        </div>
                        <TimetableGrid
                            times={scheduleToTimes(previewSchedule)}
                            color={studentColor}
                            colorFor={cellColorFor}
                            showTitle={false}
                            mode="student"
                        />
                        {(leavingSubjects.size > 0 ||
                            enteringSubjects.size > 0 ||
                            movedSubjects.size > 0 ||
                            conflictingSubjects.size > 0) && (
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                                {leavingSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-black bg-retro-primary/30" />
                                        빠짐
                                    </span>
                                )}
                                {movedSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-black bg-retro-accent5/40" />
                                        이동
                                    </span>
                                )}
                                {enteringSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-black bg-retro-green/30" />
                                        들어옴
                                    </span>
                                )}
                                {conflictingSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-black bg-retro-accent4/40" />
                                        충돌
                                    </span>
                                )}
                            </div>
                        )}
                        <p className="text-[10px] font-bold text-black/40">
                            {isAutoPreview
                                ? "* 자동으로 맡긴 항목을 아래 조합 중 첫 번째로 배치해본 결과입니다. 다른 조합을 눌러 바꿔볼 수 있습니다."
                                : previewPlan
                                  ? "* 선택한 조합을 적용한 결과입니다. 실제 신청은 직접 진행해야 합니다."
                                  : "* 지정한 드랍·이동·추가가 바로 반영됩니다."}
                        </p>
                    </div>

                    {/* 우: 과목별 처리 + 추가신청 */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="space-y-3">
                            <RetroSubTitle title="My Subjects" />
                            <div className="space-y-2">
                                {/* 추가 신청 과목 — 목록 맨 위 */}
                                {addSelections.map(({ subject, sectionId }) => {
                                    const siblings = index.get(subject) ?? [];
                                    const isOpen = openSubject === subject;
                                    const candidates = evaluateAddCandidates(
                                        effectiveSchedule,
                                        index,
                                        subject,
                                    );
                                    const chosen = siblings.find(
                                        (s) => s.id === sectionId,
                                    );
                                    return (
                                        <RetroCard
                                            key={`add-${subject}`}
                                            shadow="sm"
                                            className="bg-retro-green/15 border-retro-green"
                                        >
                                            <div className="p-3 flex flex-wrap items-center gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-black text-sm truncate flex items-center gap-1.5">
                                                        <Plus
                                                            size={12}
                                                            strokeWidth={3}
                                                            className="shrink-0"
                                                        />
                                                        {getKoreanName(subject)}
                                                    </p>
                                                    {(() => {
                                                        const chosenBlockers = chosen
                                                            ? (candidates.find(
                                                                  (c) =>
                                                                      c.section.id ===
                                                                      chosen.id,
                                                              )?.blockers ?? [])
                                                            : [];
                                                        const freeCount = candidates.filter(
                                                            (c) => c.blockers.length === 0,
                                                        ).length;

                                                        if (chosen) {
                                                            return (
                                                                <p
                                                                    className={`text-[10px] font-bold truncate ${chosenBlockers.length ? "text-retro-accent4" : "text-black/50"}`}
                                                                >
                                                                    {sectionLabel(chosen)} ·{" "}
                                                                    {formatSectionTimes(
                                                                        chosen.times,
                                                                    )}
                                                                    {chosenBlockers.length >
                                                                        0 &&
                                                                        ` — ${chosenBlockers.map((b) => getKoreanName(b.subject)).join(", ")} 비워야 함`}
                                                                </p>
                                                            );
                                                        }
                                                        return (
                                                            <p
                                                                className={`text-[10px] font-bold truncate ${freeCount === 0 ? "text-retro-accent4" : "text-black/50"}`}
                                                            >
                                                                {freeCount > 0
                                                                    ? `분반 미지정 — 바로 들어갈 수 있는 분반 ${freeCount}/${candidates.length}개`
                                                                    : `지금 그대로는 들어갈 분반이 없습니다 — 다른 과목을 이동·드랍해보세요 (${"∨"} 눌러 충돌 확인)`}
                                                            </p>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            setAddSection(subject, null)
                                                        }
                                                        className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-100 ${
                                                            sectionId === null
                                                                ? "bg-retro-green text-black border-retro-green"
                                                                : "bg-white/50 border-retro-green text-retro-green hover:bg-white/80"
                                                        }`}
                                                    >
                                                        자동
                                                    </button>
                                                    {siblings.map((sib) => {
                                                        const sibBlockers =
                                                            candidates.find(
                                                                (c) =>
                                                                    c.section.id === sib.id,
                                                            )?.blockers ?? [];
                                                        const blocked = sibBlockers.length;
                                                        return (
                                                            <button
                                                                key={sib.id}
                                                                onClick={() =>
                                                                    setAddSection(
                                                                        subject,
                                                                        sib.id,
                                                                    )
                                                                }
                                                                title={`${sib.teacher} · ${formatSectionTimes(sib.times)}${blocked ? ` · 충돌: ${sibBlockers.map((b) => getKoreanName(b.subject)).join(", ")}` : " · 바로 추가 가능"}`}
                                                                className={`px-2 py-1 border-2 text-[10px] font-black transition-all duration-100 ${
                                                                    sectionId === sib.id
                                                                        ? blocked
                                                                            ? "bg-retro-accent4 text-black border-retro-accent4"
                                                                            : "bg-retro-green text-black border-retro-green"
                                                                        : blocked
                                                                          ? "bg-retro-accent4/25 border-retro-accent4 text-retro-accent4 hover:bg-retro-accent4/40"
                                                                          : "bg-white/50 border-retro-green text-retro-green hover:bg-white/80"
                                                                }`}
                                                            >
                                                                {getSectionNumber(
                                                                    sib.section,
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                    <button
                                                        onClick={() =>
                                                            setOpenSubject(
                                                                isOpen ? null : subject,
                                                            )
                                                        }
                                                        title="모든 분반 시간표 보기"
                                                        className={`p-1.5 border-2 transition-all duration-100 ${
                                                            isOpen
                                                                ? "bg-black text-white border-black"
                                                                : "bg-white/50 border-retro-green text-retro-green hover:bg-white/80"
                                                        }`}
                                                    >
                                                        <ChevronDown
                                                            size={14}
                                                            strokeWidth={2.5}
                                                            className={`transition-transform duration-100 ${isOpen ? "rotate-180" : ""}`}
                                                        />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            toggleAddSubject(subject)
                                                        }
                                                        title="추가 취소"
                                                        className="p-1.5 border-2 bg-white/50 border-retro-green text-retro-green hover:bg-white/80 transition-all duration-100"
                                                    >
                                                        <Trash2
                                                            size={14}
                                                            strokeWidth={2.5}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                            {isOpen && (
                                                <div className="border-t-2 border-black/10 p-3 space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                                        {getKoreanName(subject)} ·{" "}
                                                        {siblings.length}개 분반
                                                    </p>
                                                    <SectionsTimetable
                                                        sections={siblings}
                                                        currentSectionId={
                                                            sectionId ?? undefined
                                                        }
                                                        busySlots={busySlotsExcluding("")}
                                                    />
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {candidates.map(
                                                            ({ section, blockers }) => (
                                                                <div
                                                                    key={section.id}
                                                                    className={`border-2 px-2 py-1 text-[10px] font-bold ${
                                                                        blockers.length ===
                                                                        0
                                                                            ? "bg-retro-green/20 border-black"
                                                                            : "bg-retro-accent4/25 border-retro-accent4 text-retro-accent4"
                                                                    }`}
                                                                >
                                                                    <span className="font-black">
                                                                        {getSectionNumber(
                                                                            section.section,
                                                                        )}
                                                                        분반
                                                                    </span>{" "}
                                                                    {section.teacher} ·{" "}
                                                                    {formatSectionTimes(
                                                                        section.times,
                                                                    )}
                                                                    <span className="block text-[9px]">
                                                                        {blockers.length >
                                                                        0
                                                                            ? `${blockers.map((b) => getKoreanName(b.subject)).join(", ")} 비워야 함`
                                                                            : "바로 추가 가능"}
                                                                    </span>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </RetroCard>
                                    );
                                })}
                                {orderedSchedule.map((sec) => {
                                    const action = actions[sec.subject] ?? "keep";
                                    const isOpen = openSubject === sec.subject;
                                    const siblings = index.get(sec.subject) ?? [];
                                    const isDropped = action === "drop";
                                    const isMoving = action === "move";
                                    const moveTarget = moveTargets[sec.subject] ?? null;
                                    const movedSection = isMoving
                                        ? siblings.find((s) => s.id === moveTarget)
                                        : undefined;
                                    // 이동 후보별 충돌 — 다른 과목(드랍 제외) 기준
                                    const othersForMove = effectiveSchedule.filter(
                                        (s) => s.subject !== sec.subject,
                                    );
                                    const movableCount = isMoving
                                        ? siblings.filter(
                                              (s) =>
                                                  s.id !== sec.id &&
                                                  findBlockers(othersForMove, s).length === 0,
                                          ).length
                                        : 0;
                                    return (
                                        <RetroCard
                                            key={sec.subject}
                                            shadow="sm"
                                            className={
                                                isDropped
                                                    ? "bg-retro-primary/15 border-retro-primary"
                                                    : isMoving
                                                      ? "bg-retro-accent5/15 border-retro-accent5"
                                                      : "bg-white border-black"
                                            }
                                        >
                                            <div className="p-3 flex flex-wrap items-center gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className={`font-black text-sm truncate ${isDropped ? "text-retro-primary line-through" : ""}`}
                                                    >
                                                        {getKoreanName(sec.subject)}
                                                    </p>
                                                    {isMoving ? (
                                                        <p className="text-[10px] font-bold truncate text-black/60">
                                                            {movedSection ? (
                                                                <>
                                                                    {getSectionNumber(
                                                                        sec.section,
                                                                    )}
                                                                    분반 →{" "}
                                                                    <b>
                                                                        {sectionLabel(
                                                                            movedSection,
                                                                        )}
                                                                    </b>{" "}
                                                                    ·{" "}
                                                                    {formatSectionTimes(
                                                                        movedSection.times,
                                                                    )}
                                                                </>
                                                            ) : (
                                                                `옮길 분반을 고르세요 — 지금 갈 수 있는 분반 ${movableCount}개 (자동은 조합에서 탐색)`
                                                            )}
                                                        </p>
                                                    ) : (
                                                        <p
                                                            className={`text-[10px] font-bold truncate ${isDropped ? "text-retro-primary/60" : "text-black/40"}`}
                                                        >
                                                            {sectionLabel(sec)} ·{" "}
                                                            {formatSectionTimes(sec.times)}
                                                            {sec.credits != null &&
                                                                ` · ${sec.credits}학점`}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {ACTION_ORDER.map((a) => (
                                                        <button
                                                            key={a}
                                                            onClick={() =>
                                                                setAction(sec.subject, a)
                                                            }
                                                            className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-100 ${
                                                                action === a
                                                                    ? a === "drop"
                                                                        ? "bg-retro-primary text-white border-retro-primary"
                                                                        : a === "move"
                                                                          ? "bg-retro-accent5 text-black border-retro-accent5"
                                                                          : "bg-black text-white border-black"
                                                                    : isDropped
                                                                      ? // 드랍한 카드 안에서는 버튼도 카드 색을 따릅니다
                                                                        "bg-white/50 border-retro-primary text-retro-primary hover:bg-white/80"
                                                                      : isMoving
                                                                        ? "bg-white/60 border-retro-accent5 text-black/50 hover:bg-white hover:text-black"
                                                                        : "bg-white border-black text-black/40 hover:border-black hover:text-black"
                                                            }`}
                                                        >
                                                            {ACTION_LABEL[a]}
                                                        </button>
                                                    ))}

                                                    {/* 이동 대상 분반 — 자동은 조합 탐색에 맡깁니다 */}
                                                    {isMoving && (
                                                        <>
                                                            <span className="w-px h-5 bg-black/20 mx-0.5" />
                                                            <button
                                                                onClick={() =>
                                                                    setMoveTarget(
                                                                        sec.subject,
                                                                        null,
                                                                    )
                                                                }
                                                                className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-100 ${
                                                                    moveTarget === null
                                                                        ? "bg-retro-accent5 text-black border-retro-accent5"
                                                                        : "bg-white/60 border-retro-accent5 text-black/50 hover:bg-white hover:text-black"
                                                                }`}
                                                            >
                                                                자동
                                                            </button>
                                                            {siblings
                                                                .filter(
                                                                    (sib) =>
                                                                        sib.id !== sec.id,
                                                                )
                                                                .map((sib) => {
                                                                    const sibBlockers =
                                                                        findBlockers(
                                                                            othersForMove,
                                                                            sib,
                                                                        );
                                                                    const blocked =
                                                                        sibBlockers.length;
                                                                    return (
                                                                        <button
                                                                            key={sib.id}
                                                                            onClick={() =>
                                                                                setMoveTarget(
                                                                                    sec.subject,
                                                                                    sib.id,
                                                                                )
                                                                            }
                                                                            title={`${sib.teacher} · ${formatSectionTimes(sib.times)} · ${sib.studentCount}명${blocked ? ` · 충돌: ${sibBlockers.map((b) => getKoreanName(b.subject)).join(", ")}` : " · 바로 이동 가능"}`}
                                                                            className={`px-2 py-1 border-2 text-[10px] font-black transition-all duration-100 ${
                                                                                moveTarget ===
                                                                                sib.id
                                                                                    ? blocked
                                                                                        ? "bg-retro-accent4 text-black border-retro-accent4"
                                                                                        : "bg-retro-accent5 text-black border-retro-accent5"
                                                                                    : blocked
                                                                                      ? "bg-retro-accent4/25 border-retro-accent4 text-retro-accent4 hover:bg-retro-accent4/40"
                                                                                      : "bg-white/60 border-retro-accent5 text-black/60 hover:bg-white hover:text-black"
                                                                            }`}
                                                                        >
                                                                            {getSectionNumber(
                                                                                sib.section,
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            <span className="w-px h-5 bg-black/20 mx-0.5" />
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() =>
                                                            setOpenSubject(
                                                                isOpen ? null : sec.subject,
                                                            )
                                                        }
                                                        title="모든 분반 시간표 보기"
                                                        className={`p-1.5 border-2 transition-all duration-100 ${
                                                            isOpen
                                                                ? "bg-black text-white border-black"
                                                                : isDropped
                                                                  ? "bg-white/50 border-retro-primary text-retro-primary hover:bg-white/80"
                                                                  : isMoving
                                                                    ? "bg-white/60 border-retro-accent5 text-black/50 hover:bg-white hover:text-black"
                                                                    : "bg-white border-black text-black/40 hover:border-black hover:text-black"
                                                        }`}
                                                    >
                                                        <ChevronDown
                                                            size={14}
                                                            strokeWidth={2.5}
                                                            className={`transition-transform duration-100 ${isOpen ? "rotate-180" : ""}`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                            {movedSection && (
                                                <div className="border-t-2 border-black/10 p-3 flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                                        구인 글
                                                    </span>
                                                    <code className="text-[10px] font-bold text-black/60 whitespace-pre-line leading-tight">
                                                        {buildTradePost(
                                                            sec.subject,
                                                            sec,
                                                            movedSection,
                                                        )}
                                                    </code>
                                                    <CopyButton
                                                        className="ml-auto"
                                                        text={buildTradePost(
                                                            sec.subject,
                                                            sec,
                                                            movedSection,
                                                        )}
                                                    />
                                                </div>
                                            )}
                                            {isOpen && (
                                                <div className="border-t-2 border-black/10 p-3 space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                                        {getKoreanName(sec.subject)} ·{" "}
                                                        {siblings.length}개 분반
                                                    </p>
                                                    <SectionsTimetable
                                                        sections={siblings}
                                                        currentSectionId={sec.id}
                                                        busySlots={busySlotsExcluding(
                                                            sec.subject,
                                                        )}
                                                    />
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {siblings.map((sib) => {
                                                            const blockers =
                                                                sib.id === sec.id
                                                                    ? []
                                                                    : findBlockers(
                                                                          effectiveSchedule.filter(
                                                                              (s) =>
                                                                                  s.subject !==
                                                                                  sec.subject,
                                                                          ),
                                                                          sib,
                                                                      );
                                                            const isCurrent =
                                                                sib.id === sec.id;
                                                            return (
                                                                <div
                                                                    key={sib.id}
                                                                    className={`border-2 px-2 py-1 text-[10px] font-bold ${
                                                                        isCurrent
                                                                            ? "bg-retro-accent1 border-black text-black"
                                                                            : blockers.length ===
                                                                                0
                                                                              ? "bg-retro-green/20 border-black"
                                                                              : "bg-retro-accent4/25 border-retro-accent4 text-retro-accent4"
                                                                    }`}
                                                                >
                                                                    <span className="font-black">
                                                                        {getSectionNumber(
                                                                            sib.section,
                                                                        )}
                                                                        분반
                                                                    </span>{" "}
                                                                    {sib.teacher} ·{" "}
                                                                    {sib.studentCount}명
                                                                    {!isCurrent &&
                                                                        blockers.length >
                                                                            0 && (
                                                                            <span className="block text-[9px]">
                                                                                충돌:{" "}
                                                                                {blockers
                                                                                    .map((b) =>
                                                                                        getKoreanName(
                                                                                            b.subject,
                                                                                        ),
                                                                                    )
                                                                                    .join(", ")}
                                                                            </span>
                                                                        )}
                                                                    {!isCurrent &&
                                                                        blockers.length ===
                                                                            0 &&
                                                                        (() => {
                                                                            const n =
                                                                                partnerCountBySection(
                                                                                    sec,
                                                                                    sib,
                                                                                );
                                                                            return (
                                                                                <span
                                                                                    className={`block text-[9px] ${n > 0 ? "text-black/60" : "text-black/35"}`}
                                                                                >
                                                                                    {n > 0
                                                                                        ? `교환 상대 ${n}명`
                                                                                        : "교환 상대 없음"}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </RetroCard>
                                    );
                                })}

                            </div>
                        </div>

                        {openedByDrop.length > 0 && (
                            <div className="space-y-3">
                                <RetroSubTitle
                                    title="Opened by Drop"
                                    icon={Trash2}
                                />
                                <p className="text-[10px] font-bold text-black/40">
                                    드랍으로 비는 시간에 새로 들어갈 수 있는 과목입니다.
                                    누르면 추가 후보에 담깁니다.
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {openedByDrop.map(({ subject, sections }) => (
                                        <button
                                            key={subject}
                                            onClick={() => toggleAddSubject(subject)}
                                            className={`border-2 px-2 py-1 text-[11px] font-bold text-left transition-all duration-100 ${
                                                addedSubjects.includes(subject)
                                                    ? "bg-black text-white border-black"
                                                    : "bg-retro-green/20 border-black hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
                                            }`}
                                        >
                                            <span className="font-black">
                                                {getKoreanName(subject)}
                                            </span>
                                            <span
                                                className={
                                                    addedSubjects.includes(subject)
                                                        ? "text-white/60"
                                                        : "text-black/50"
                                                }
                                            >
                                                {" "}
                                                · {sections.length}개 분반
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <RetroSubTitle title="Add Subjects" icon={Plus} />
                            <input
                                value={addQuery}
                                onChange={(e) => setAddQuery(e.target.value)}
                                placeholder="추가로 듣고 싶은 과목 검색 (예: 정3)"
                                className="w-full border-2 border-black px-4 py-3 text-sm font-bold outline-none focus:shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100"
                            />
                            {addMatches.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {addMatches.map((subject) => {
                                        const picked = addedSubjects.includes(subject);
                                        const summary = addSummaries.get(subject);
                                        return (
                                            <button
                                                key={subject}
                                                onClick={() => toggleAddSubject(subject)}
                                                className={`border-2 px-2 py-1 text-[11px] font-bold transition-all duration-100 ${
                                                    picked
                                                        ? "bg-black text-white border-black"
                                                        : "bg-white border-black hover:border-black"
                                                }`}
                                            >
                                                <span className="font-black">
                                                    {getKoreanName(subject)}
                                                </span>
                                                {summary && (
                                                    <span
                                                        className={
                                                            picked
                                                                ? "text-white/60"
                                                                : "text-black/40"
                                                        }
                                                    >
                                                        {" "}
                                                        · 바로가능 {summary.free}/
                                                        {summary.total}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 선택한 조합의 교환 상대 */}
                    {partnersForPreview.length > 0 && (
                        <div className="lg:col-span-12 space-y-3">
                            <RetroSubTitle title="Trade Partners" icon={Users} />
                            <p className="text-[10px] font-bold text-black/40">
                                선택한 조합에서 분반을 맞바꿀 수 있는 사람입니다. 상대가 그
                                분반을 듣고 있고, 내 자리로 옮겨도 상대 시간표가 깨지지
                                않는 경우만 나옵니다.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {partnersForPreview.map(
                                    ({ subject, from, to, partners }) => (
                                        <RetroCard
                                            key={subject}
                                            shadow="sm"
                                            className="bg-white"
                                        >
                                            <div className="p-3 space-y-2">
                                                <div>
                                                    <p className="font-black text-sm truncate">
                                                        {getKoreanName(subject)}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-[11px] font-bold text-black/50">
                                                        {getSectionNumber(from.section)}
                                                        분반
                                                        <ArrowRight size={10} />
                                                        {getSectionNumber(to.section)}분반
                                                        · {to.teacher}
                                                    </p>
                                                    <CopyButton
                                                        label="구인 글 복사"
                                                        className="mt-2"
                                                        text={buildTradePost(
                                                            subject,
                                                            from,
                                                            to,
                                                        )}
                                                    />
                                                </div>
                                                {partners.length === 0 ? (
                                                    <p className="text-[11px] font-bold text-black/40 border-t-2 border-black/10 pt-2">
                                                        맞바꿀 상대가 없습니다. 빈자리가
                                                        나기를 노려야 합니다.
                                                    </p>
                                                ) : (
                                                    <div className="border-t-2 border-black/10 pt-2 space-y-1.5">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                                            {partners.length}명
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {partners.map((p) => (
                                                                <span
                                                                    key={p.stuId}
                                                                    className="border-2 px-2 py-1 text-[11px] font-black italic"
                                                                    style={{
                                                                        backgroundColor: `${getStudentColor(p.stuId)}15`,
                                                                        borderColor:
                                                                            getStudentColor(
                                                                                p.stuId,
                                                                            ),
                                                                        color: getStudentColor(
                                                                            p.stuId,
                                                                        ),
                                                                    }}
                                                                >
                                                                    {p.stuId} {p.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </RetroCard>
                                    ),
                                )}
                            </div>
                        </div>
                    )}

                    {/* 결과 */}
                    <div className="lg:col-span-12 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <RetroSubTitle title="Possible Plans" icon={ArrowLeftRight} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                {plans.length}
                                {truncated ? `+ (상위 ${MAX_PLAN_RESULTS})` : ""} 개
                            </span>
                        </div>

                        {plans.length === 0 ? (
                            <RetroCard className="bg-white p-6">
                                <div className="flex items-start gap-3">
                                    <TriangleAlert
                                        size={18}
                                        strokeWidth={2.5}
                                        className="text-black/40 shrink-0 mt-0.5"
                                    />
                                    <div className="space-y-1">
                                        <p className="font-black text-sm">
                                            가능한 조합이 없습니다
                                        </p>
                                        <p className="text-xs font-bold text-black/40">
                                            과목을 <b>이동</b>이나 <b>드랍</b>으로 표시하면
                                            탐색 범위가 넓어집니다. 추가하려는 과목이 있다면
                                            위에서 충돌하는 과목을 확인해보세요.
                                        </p>
                                    </div>
                                </div>
                            </RetroCard>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {plans.map((plan, i) => {
                                    const active =
                                        plan.key === previewKey ||
                                        (isAutoPreview && plan.key === previewPlan?.key);
                                    return (
                                        <RetroCard
                                            key={plan.key}
                                            shadow="sm"
                                            className={`bg-white transition-all duration-100 ${active ? "border-black" : "border-black"}`}
                                        >
                                            <button
                                                onClick={() =>
                                                    setPreviewKey(active ? null : plan.key)
                                                }
                                                className="w-full text-left p-3 space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                                        Plan {i + 1}
                                                        {(() => {
                                                            const after = totalCredits(
                                                                applyPlan(schedule, plan),
                                                            );
                                                            const diff =
                                                                after - creditSummary.now;
                                                            return (
                                                                <span className="ml-1.5 text-black/60">
                                                                    {after}학점
                                                                    {diff !== 0 &&
                                                                        ` (${diff > 0 ? "+" : ""}${diff})`}
                                                                </span>
                                                            );
                                                        })()}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[10px] font-black">
                                                        {plan.moveCount > 0 && (
                                                            <span className="border border-black px-1">
                                                                이동 {plan.moveCount}
                                                            </span>
                                                        )}
                                                        {plan.dropCount > 0 && (
                                                            <span className="border border-black px-1">
                                                                드랍 {plan.dropCount}
                                                            </span>
                                                        )}
                                                        {plan.addCount > 0 && (
                                                            <span className="border border-black px-1 bg-retro-green/30">
                                                                추가 {plan.addCount}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {plan.choices.map((c) => (
                                                        <div
                                                            key={c.subject}
                                                            className="text-[11px] font-bold leading-tight"
                                                        >
                                                            <p className="font-black truncate">
                                                                {getKoreanName(c.subject)}
                                                            </p>
                                                            <p className="flex items-center gap-1 text-black/50">
                                                                {c.from ? (
                                                                    <span>
                                                                        {getSectionNumber(
                                                                            c.from.section,
                                                                        )}
                                                                        분반
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-black/40">
                                                                        신규
                                                                    </span>
                                                                )}
                                                                <ArrowRight size={10} />
                                                                {c.to ? (
                                                                    <span className="text-black">
                                                                        {getSectionNumber(
                                                                            c.to.section,
                                                                        )}
                                                                        분반 ·{" "}
                                                                        {formatSectionTimes(
                                                                            c.to.times,
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-black">
                                                                        드랍
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-1 pt-1 text-[10px] font-black uppercase tracking-widest text-black/40">
                                                    {active ? (
                                                        <>
                                                            <Check
                                                                size={12}
                                                                strokeWidth={3}
                                                            />
                                                            {isAutoPreview
                                                                ? "Auto"
                                                                : "Previewing"}
                                                        </>
                                                    ) : (
                                                        "Click to preview"
                                                    )}
                                                </div>
                                            </button>
                                        </RetroCard>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradePage;

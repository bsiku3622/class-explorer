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
    buildPlannedSchedule,
    getStudentSchedule,
    findPlans,
    applyPlan,
    hasAutoChoice,
    scheduleToTimes,
    evaluateAddCandidates,
    findBlockers,
    findAddableAfterDrop,
    findTradePartners,
    buildTradePost,
    totalCredits,
    missingCreditSubjects,
    MAX_PLAN_RESULTS,
    TRADE_STATE_LEGACY_KEY,
    type AddSelection,
    type PlanAction,
    type PlanResult,
    type SavedTradePlan,
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
import api from "../lib/api";
import { authHeader } from "../lib/session";
import { fetchCurriculum } from "../lib/curriculumApi";
import {
    buildPrereqIndex,
    courseState,
    inferPrereqs,
    type Curriculum,
    type ProgressTerm,
} from "../lib/curriculum";
import { loadState, saveState } from "../lib/userState";
import StudentBadge from "../components/atoms/StudentBadge";
import TimetableGrid from "../components/TimetableGrid";
import SectionsTimetable from "../components/SectionsTimetable";
import CopyButton from "../components/atoms/CopyButton";
import {
    Badge,
    Button,
    Card,
    Divider,
    Icon,
    IconButton,
    Input,
    PageHeader,
    Paint,
    SectionTitle,
    Surface,
    Text,
    ToneSwatch,
} from "@studio-baeks/funky-ui";
import { ACCENT_COLORS } from "@studio-baeks/funky-ui/tokens";

interface TradePageProps {
    allClassesData: SubjectData[];
    term: Term | null;
    /** 계정에 등록된 본인 학번 — 저장된 계획이 없을 때 기본으로 잡습니다 */
    myStuId: string | null;
}

/**
 * 이 과목을 지금 새로 담을 수 있는지.
 *
 * `taken` 은 이미 들은 과목(또는 선수 체인으로 들었을 수밖에 없는 과목), `locked` 는
 * 선수를 아직 안 채운 과목입니다. 교육과정에 없는 과목(외국인 전형 등)은 판단할 근거가
 * 없어 `open` 으로 둡니다 — 모르는 걸 막으면 멀쩡한 과목이 사라집니다.
 */
type Addability = "open" | "taken" | "locked";

const ADDABILITY_LABEL: Record<Addability, string> = {
    open: "",
    taken: "이수함",
    locked: "선수 미이수",
};

const ACTION_LABEL: Record<PlanAction, string> = {
    keep: "유지",
    move: "이동",
    drop: "드랍",
};

const ACTION_ORDER: PlanAction[] = ["keep", "move", "drop"];

const sectionLabel = (s: SectionInfo) =>
    `${getSectionNumber(s.section)}분반 · ${s.teacher}`;

const TradePage: React.FC<TradePageProps> = ({ allClassesData, term, myStuId }) => {
    const [stuId, setStuId] = useState<string | null>(null);
    const [studentQuery, setStudentQuery] = useState("");
    const [actions, setActions] = useState<Record<string, PlanAction>>({});
    const [addSelections, setAddSelections] = useState<AddSelection[]>([]);
    /** 이동으로 표시한 과목의 목표 분반 (null = 아무 분반이나 탐색) */
    const [moveTargets, setMoveTargets] = useState<Record<string, number | null>>({});
    const [addQuery, setAddQuery] = useState("");
    const [openSubject, setOpenSubject] = useState<string | null>(null);
    /** 목록에서 마우스를 올린 과목 — 시간표에서 그 과목만 남깁니다 */
    const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    /** 불러오기 전에는 저장하지 않습니다 — 빈 값으로 덮어쓰는 걸 막습니다 */
    const [restored, setRestored] = useState(false);
    /** 이미 들은 과목과 선수 조건을 가리는 데 씁니다 */
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    /** 어느 학생의 응답인지 함께 들고 있어야 학번이 바뀔 때 섞이지 않습니다 */
    const [progress, setProgress] = useState<{
        stuId: string;
        terms: ProgressTerm[];
    } | null>(null);

    useEffect(() => {
        fetchCurriculum()
            .then(setCurriculum)
            .catch(() => setCurriculum(null));
    }, []);

    useEffect(() => {
        if (!stuId) return;
        let cancelled = false;
        api.get(`/curriculum/progress/${encodeURIComponent(stuId)}`, {
            headers: authHeader(),
        })
            .then((res) => {
                if (!cancelled) setProgress({ stuId, terms: res.data.terms ?? [] });
            })
            .catch(() => {
                if (!cancelled) setProgress({ stuId, terms: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [stuId]);

    // 계정 정보(`myStuId`)가 늦게 도착할 수 있어, 복원 전까지는 다시 시도합니다
    useEffect(() => {
        if (restored) return;
        let cancelled = false;
        loadState<SavedTradePlan>("trade", TRADE_STATE_LEGACY_KEY)
            .then((state) => {
                if (cancelled) return;
                if (state?.stuId) {
                    setStuId(state.stuId);
                    setActions(state.actions ?? {});
                    setAddSelections(
                        Array.isArray(state.addSelections) ? state.addSelections : [],
                    );
                    setMoveTargets(state.moveTargets ?? {});
                    setPreviewKey(state.previewKey ?? null);
                } else if (myStuId) {
                    // 저장된 계획이 없으면 본인 시간표에서 시작합니다
                    setStuId(myStuId);
                }
                setRestored(true);
            })
            .catch(() => {
                // ⚠️ 여기서 `restored` 를 켜면 안 됩니다. 저장은 전체 교체라, 못
                // 불러온 빈 상태가 그대로 저장돼 서버에 있던 계획을 지웁니다.
                // 안 켜 두면 이번 화면에서는 저장이 안 되지만 남아 있던 건 지킵니다
            });
        return () => {
            cancelled = true;
        };
    }, [restored, myStuId]);

    /**
     * 작업 중인 계획은 계정에 남아 다른 기기에서도 이어집니다.
     *
     * **고른 조합(`previewKey`)까지 같이 남깁니다** — 홈이 같은 계획을 그릴 때 이게
     * 없으면 각자 첫 조합을 골라서, 같은 계획인데 두 화면의 시간표가 갈라집니다.
     */
    useEffect(() => {
        if (!restored) return;
        saveState(
            "trade",
            stuId ? { stuId, actions, addSelections, moveTargets, previewKey } : {},
        );
    }, [restored, stuId, actions, addSelections, moveTargets, previewKey]);

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
    const autoChoice = useMemo(
        () => hasAutoChoice(schedule, { actions, addSelections, moveTargets }),
        [schedule, actions, addSelections, moveTargets],
    );

    /**
     * 미리 볼 조합. 사용자가 고른 게 있으면 그것을,
     * 없더라도 자동으로 맡긴 항목이 있으면 첫 조합을 보여줍니다 —
     * "자동"인데 시간표가 그대로면 아무 일도 안 한 것처럼 보이니까요.
     */
    const previewPlan = useMemo(() => {
        if (previewKey) return plans.find((p) => p.key === previewKey) ?? null;
        return autoChoice ? (plans[0] ?? null) : null;
    }, [plans, previewKey, autoChoice]);

    /** 자동으로 고른 조합인지 (사용자가 직접 누른 게 아님) */
    const isAutoPreview = !previewKey && previewPlan !== null;

    /**
     * 왼쪽 시간표에 그릴 내용.
     * 조합을 고르면 그 결과를, 고르기 전에는 지금까지 지정한 드랍·추가를 바로 반영합니다.
     *
     * ⚠️ **계산은 `tradeEngine.buildPlannedSchedule` 이 합니다** — 홈의 "트레이드"
     * 시간표가 같은 함수를 부릅니다. 여기서 따로 세면 두 화면이 갈라집니다.
     */
    const {
        effectiveSchedule,
        enteringSubjects,
        movedSubjects,
        conflictingSubjects,
    } = useMemo(() => {
        const planned = buildPlannedSchedule(
            schedule,
            index,
            { actions, addSelections, moveTargets },
            previewPlan,
        );
        return {
            effectiveSchedule: planned.sections,
            enteringSubjects: planned.entering,
            movedSubjects: planned.moved,
            conflictingSubjects: planned.conflicting,
        };
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
            if (conflictingSubjects.has(time.subject)) return ACCENT_COLORS.orange.solid;
            if (movedSubjects.has(time.subject)) return ACCENT_COLORS.sky.solid;
            if (enteringSubjects.has(time.subject)) return ACCENT_COLORS.green.solid;
            return undefined;
        },
        [movedSubjects, enteringSubjects, conflictingSubjects],
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

    const prereqIndex = useMemo(
        () => buildPrereqIndex(curriculum?.prerequisites ?? []),
        [curriculum],
    );

    /**
     * 이 학생이 지금까지 들은 과목 / 이번 학기에 듣고 있는 과목.
     *
     * 응답의 마지막 학기가 이번 학기입니다. 지난 학기 것이 `taken`, 이번 학기 것이
     * `current` 이고, 둘을 나누는 이유는 **이번 학기 과목은 "이미 들었다" 가 아니기**
     * 때문입니다 — 그건 시간표에 이미 있어서 따로 걸러집니다.
     */
    const { taken, current } = useMemo(() => {
        const terms = progress?.stuId === stuId ? progress.terms : [];
        const past = new Set<string>();
        const now = new Set<string>();
        terms.forEach((term, i) => {
            const target = i === terms.length - 1 ? now : past;
            term.courses.forEach((item) => {
                if (item.course) target.add(item.course);
            });
        });
        return { taken: past, current: now };
    }, [progress, stuId]);

    const inferred = useMemo(
        () => inferPrereqs(new Set([...taken, ...current]), prereqIndex),
        [taken, current, prereqIndex],
    );

    /**
     * 이 과목을 새로 담을 수 있는지. 교육과정을 아직 못 받았으면 아무것도 가리지
     * 않습니다 — 데이터가 늦게 온다고 과목이 사라지면 안 됩니다.
     */
    const addabilityOf = useCallback(
        (subject: string): Addability => {
            if (!curriculum) return "open";
            const course = curriculum.subject_map[subject];
            if (!course) return "open"; // 교육과정에 없는 과목은 판단할 근거가 없습니다
            const state = courseState(course, taken, current, inferred, prereqIndex);
            if (state === "taken" || state === "inferred") return "taken";
            if (state === "locked") return "locked";
            return "open";
        },
        [curriculum, taken, current, inferred, prereqIndex],
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
            // 이미 들었거나 선수를 안 채운 과목은 권할 수 없습니다. 그래도 굳이 보고
            // 싶으면 아래 검색으로 찾을 수 있습니다
            .filter((g) => addabilityOf(g.subject) === "open")
            .sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
    }, [dropSubjects, schedule, effectiveSchedule, index, addabilityOf]);

    const addedSubjects = useMemo(
        () => addSelections.map((a) => a.subject),
        [addSelections],
    );

    /**
     * 검색 결과. **거르지 않고 다 보여 줍니다** — 이미 들었거나 선수를 안 채운 과목도
     * 찾을 수는 있어야 합니다. 대신 담을 수 있는 것부터 놓고 나머지는 회색으로 눕힙니다.
     */
    const addMatches = useMemo(() => {
        const q = addQuery.trim();
        if (!q) return [];
        const RANK: Record<Addability, number> = { open: 0, taken: 1, locked: 2 };
        return allClassesData
            .filter((s) => !enrolledSubjects.has(s.subject))
            .filter(
                (s) =>
                    fuzzyMatch(s.subject, q) ||
                    fuzzyMatch(getKoreanName(s.subject), q) ||
                    (!!s.subject_english && fuzzyMatch(s.subject_english, q)),
            )
            .map((s) => ({ subject: s.subject, state: addabilityOf(s.subject) }))
            .sort((a, b) => RANK[a.state] - RANK[b.state])
            .slice(0, 20);
    }, [allClassesData, addQuery, enrolledSubjects, addabilityOf]);

    /** 추가 후보 과목별로 "바로 들어가는 분반이 있는지" 요약 */
    const addSummaries = useMemo(() => {
        const map = new Map<string, { free: number; total: number }>();
        [...addedSubjects, ...addMatches.map((m) => m.subject)].forEach((subject) => {
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
                    subtitle="Course Change"
                    icon={ArrowLeftRight}
                />
                <Card padding="0" className="p-8 text-center">
                    <Text as="p" variant="subtitle">
                        2026-2 학기에서만 사용할 수 있습니다
                    </Text>
                    <Text as="p" variant="caption" tone="muted" className="mt-2">
                        상단의 학기 전환에서 2026-2를 선택해주세요.
                    </Text>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader
                title="Trade"
                subtitle="Course Change"
                icon={ArrowLeftRight}
                action={
                    stuId ? (
                        <Button
                            size="sm"
                            variant="paper"
                            shadow
                            onClick={() => selectStudent("")}
                            icon={X}
                        >
                            Reset
                        </Button>
                    ) : undefined
                }
            >
                <div className="space-y-3">
                    <SectionTitle title="Select Student" icon={Search} />
                    <Input
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        placeholder="학번 또는 이름으로 검색 (예: 25-059, 백재원)"
                    />
                    {studentMatches.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {studentMatches.map((s) => (
                                <StudentBadge
                                    fullId
                                    key={s.stuId}
                                    studentId={s.stuId}
                                    studentName={s.name}
                                    onClick={() => selectStudent(s.stuId)}
                                />
                            ))}
                        </div>
                    )}
                    {stuId && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Text variant="overline">Planning for</Text>
                            <StudentBadge
                                fullId
                                studentId={stuId}
                                studentName={
                                    allStudents.find((s) => s.stuId === stuId)?.name ?? ""
                                }
                                size="sm"
                            />
                            <Text variant="micro" weight="bold" tone="muted">
                                {schedule.length}과목 수강 중
                            </Text>
                            <Surface as="span" border="line" className="px-2 py-1">
                                <Text as="span" variant="label">
                                    {creditSummary.now}학점
                                    {creditSummary.delta !== 0 && (
                                        <Text
                                            as="span"
                                            variant="label"
                                            tone={creditSummary.delta > 0 ? "green" : "pink"}
                                        >
                                            {" "}
                                            → {creditSummary.planned}학점 (
                                            {creditSummary.delta > 0 ? "+" : ""}
                                            {creditSummary.delta})
                                        </Text>
                                    )}
                                </Text>
                            </Surface>
                            {creditSummary.unknown.length > 0 && (
                                <Text
                                    variant="micro"
                                    weight="bold"
                                    tone="orange"
                                    title={creditSummary.unknown.join(", ")}
                                >
                                    학점 미등록 {creditSummary.unknown.length}과목 제외
                                </Text>
                            )}
                        </div>
                    )}
                </div>
            </PageHeader>

            {!stuId ? (
                <Card padding="0" className="p-10 text-center">
                    <Text as="p" variant="subtitle">
                        학생을 선택하면 시간표 기준으로 변경 가능한 조합을 찾습니다
                    </Text>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                    {/* 좌: 시간표 미리보기 */}
                    <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionTitle
                                title={
                                    isAutoPreview
                                        ? "Auto Preview"
                                        : previewPlan
                                          ? "Preview"
                                          : "Current Schedule"
                                }
                            />
                            {previewPlan && (
                                <Button
                                    size="sm"
                                    variant="paper"
                                    shadow
                                    onClick={() => setPreviewKey(null)}
                                    icon={X}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                        <TimetableGrid
                            times={scheduleToTimes(effectiveSchedule)}
                            color={studentColor}
                            colorFor={cellColorFor}
                            highlightSubject={hoveredSubject}
                            showTitle={false}
                            mode="student"
                        />
                        {(enteringSubjects.size > 0 ||
                            movedSubjects.size > 0 ||
                            conflictingSubjects.size > 0) && (
                            <Text
                                as="div"
                                variant="overline"
                                tone="primary"
                                className="flex flex-wrap items-center gap-3"
                            >
                                {movedSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <ToneSwatch tone={ACCENT_COLORS.sky.solid} />
                                        이동
                                    </span>
                                )}
                                {enteringSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <ToneSwatch tone={ACCENT_COLORS.green.solid} />
                                        들어옴
                                    </span>
                                )}
                                {conflictingSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <ToneSwatch tone={ACCENT_COLORS.orange.solid} />
                                        충돌
                                    </span>
                                )}
                            </Text>
                        )}
                        <Text as="p" variant="micro" weight="bold" tone="muted">
                            {isAutoPreview
                                ? "* 자동으로 맡긴 항목을 아래 조합 중 첫 번째로 배치해본 결과입니다. 다른 조합을 눌러 바꿔볼 수 있습니다."
                                : previewPlan
                                  ? "* 선택한 조합을 적용한 결과입니다. 실제 신청은 직접 진행해야 합니다."
                                  : "* 지정한 드랍·이동·추가가 바로 반영됩니다."}
                        </Text>
                    </div>

                    {/* 우: 과목별 처리 + 추가신청 */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="space-y-3">
                            <SectionTitle title="My Subjects" />
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
                                        <Paint
                                            key={`add-${subject}`}
                                            accent="green"
                                            variant="plain"
                                            shadow
                                            className="transition-transform duration-100 hover:-translate-y-1"
                                            onMouseEnter={() => setHoveredSubject(subject)}
                                            onMouseLeave={() => setHoveredSubject(null)}
                                        >
                                            <div className="p-3 flex flex-wrap items-center gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <Text
                                                        as="p"
                                                        tone="primary"
                                                        weight="black"
                                                        truncate
                                                        className="flex items-center gap-1.5"
                                                    >
                                                        <Icon
                                                            icon={Plus}
                                                            size={12}
                                                            strokeWidth={3}
                                                            className="shrink-0"
                                                        />
                                                        {getKoreanName(subject)}
                                                    </Text>
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
                                                                <Text
                                                                    as="p"
                                                                    variant="micro"
                                                                    weight="bold"
                                                                    tone={chosenBlockers.length ? "orange" : "muted"}
                                                                    truncate
                                                                >
                                                                    {sectionLabel(chosen)} ·{" "}
                                                                    {formatSectionTimes(
                                                                        chosen.times,
                                                                    )}
                                                                    {chosenBlockers.length >
                                                                        0 &&
                                                                        ` — ${chosenBlockers.map((b) => getKoreanName(b.subject)).join(", ")} 비워야 함`}
                                                                </Text>
                                                            );
                                                        }
                                                        return (
                                                            <Text
                                                                as="p"
                                                                variant="micro"
                                                                weight="bold"
                                                                tone={freeCount === 0 ? "orange" : "muted"}
                                                                truncate
                                                            >
                                                                {freeCount > 0
                                                                    ? `분반 미지정 — 바로 들어갈 수 있는 분반 ${freeCount}/${candidates.length}개`
                                                                    : `지금 그대로는 들어갈 분반이 없습니다 — 다른 과목을 이동·드랍해보세요 (${"∨"} 눌러 충돌 확인)`}
                                                            </Text>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button grow={false}
                                                        size="xs"
                                                        accent="green"
                                                        variant="outline"
                                                        selected={sectionId === null}
                                                        onClick={() =>
                                                            setAddSection(subject, null)
                                                        }
                                                    >
                                                        자동
                                                    </Button>
                                                    {siblings.map((sib) => {
                                                        const sibBlockers =
                                                            candidates.find(
                                                                (c) =>
                                                                    c.section.id === sib.id,
                                                            )?.blockers ?? [];
                                                        const blocked = sibBlockers.length;
                                                        return (
                                                            <Button grow={false}
                                                                key={sib.id}
                                                                size="xs"
                                                                accent={blocked ? "orange" : "green"}
                                                                variant={blocked ? "plain" : "outline"}
                                                                selected={sectionId === sib.id}
                                                                onClick={() =>
                                                                    setAddSection(
                                                                        subject,
                                                                        sib.id,
                                                                    )
                                                                }
                                                                title={`${sib.teacher} · ${formatSectionTimes(sib.times)}${blocked ? ` · 충돌: ${sibBlockers.map((b) => getKoreanName(b.subject)).join(", ")}` : " · 바로 추가 가능"}`}
                                                            >
                                                                {getSectionNumber(
                                                                    sib.section,
                                                                )}
                                                            </Button>
                                                        );
                                                    })}
                                                    <Button grow={false}
                                                        size="xs"
                                                        accent={isOpen ? "black" : undefined}
                                                        variant="outline"
                                                        selected={isOpen}
                                                        iconEnd={ChevronDown}
                                                        aria-expanded={isOpen}
                                                        aria-label="모든 분반 시간표 보기"
                                                        onClick={() =>
                                                            setOpenSubject(
                                                                isOpen ? null : subject,
                                                            )
                                                        }
                                                        title="모든 분반 시간표 보기"
                                                    />
                                                    <IconButton
                                                        icon={Trash2}
                                                        label="추가 취소"
                                                        size="xs"
                                                        variant="outline"
                                                        onClick={() =>
                                                            toggleAddSubject(subject)
                                                        }
                                                        title="추가 취소"
                                                    />
                                                </div>
                                            </div>
                                            {isOpen && (
                                                <Surface
                                                    fill="none"
                                                    border="subtle"
                                                    borderSide="top"
                                                    className="p-3 space-y-2"
                                                >
                                                    <Text as="p" variant="overline">
                                                        {getKoreanName(subject)} ·{" "}
                                                        {siblings.length}개 분반
                                                    </Text>
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
                                                                <Paint
                                                                    key={section.id}
                                                                    accent={blockers.length === 0 ? "green" : "orange"}
                                                                    variant={blockers.length === 0 ? "solidMuted" : "plain"}
                                                                    className="px-2 py-1"
                                                                >
                                                                    <Text variant="micro" weight="bold">
                                                                        <Text as="span" variant="micro">
                                                                            {getSectionNumber(
                                                                                section.section,
                                                                            )}
                                                                            분반
                                                                        </Text>{" "}
                                                                        {section.teacher} ·{" "}
                                                                        {formatSectionTimes(
                                                                            section.times,
                                                                        )}
                                                                        <Text as="span" variant="micro" weight="bold" className="block">
                                                                            {blockers.length >
                                                                            0
                                                                                ? `${blockers.map((b) => getKoreanName(b.subject)).join(", ")} 비워야 함`
                                                                                : "바로 추가 가능"}
                                                                        </Text>
                                                                    </Text>
                                                                </Paint>
                                                            ),
                                                        )}
                                                    </div>
                                                </Surface>
                                            )}
                                        </Paint>
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
                                    // 드랍한 카드는 핑크, 이동 중인 카드는 하늘 — 색 있는 상자는 Paint 입니다.
                                    // 평소 카드는 흰 Card. 안의 버튼은 카드 색을 따릅니다
                                    const Frame: React.ElementType = isDropped || isMoving ? Paint : Card;
                                    const frameProps = isDropped
                                        ? { accent: "pink", variant: "plain", shadow: true }
                                        : isMoving
                                          ? { accent: "sky", variant: "plain", shadow: true }
                                          : { padding: "0" };
                                    return (
                                        <Frame
                                            key={sec.subject}
                                            {...frameProps}
                                            onMouseEnter={() => setHoveredSubject(sec.subject)}
                                            onMouseLeave={() => setHoveredSubject(null)}
                                            className="transition-transform duration-100 hover:-translate-y-1"
                                        >
                                            <div className="p-3 flex flex-wrap items-center gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <Text
                                                        as="p"
                                                        weight="black"
                                                        tone={isDropped ? "pink" : "primary"}
                                                        decoration={isDropped ? "strike" : undefined}
                                                        truncate
                                                    >
                                                        {getKoreanName(sec.subject)}
                                                    </Text>
                                                    {isMoving ? (
                                                        <Text as="p" variant="micro" weight="bold" tone="secondary" truncate>
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
                                                        </Text>
                                                    ) : (
                                                        <Text
                                                            as="p"
                                                            variant="micro"
                                                            weight="bold"
                                                            tone={isDropped ? "pink" : "muted"}
                                                            truncate
                                                        >
                                                            {sectionLabel(sec)} ·{" "}
                                                            {formatSectionTimes(sec.times)}
                                                            {sec.credits != null &&
                                                                ` · ${sec.credits}학점`}
                                                        </Text>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {ACTION_ORDER.map((a) => (
                                                        <Button grow={false}
                                                            key={a}
                                                            size="xs"
                                                            selected={action === a}
                                                            accent={
                                                                action === a
                                                                    ? a === "drop"
                                                                        ? "pink"
                                                                        : a === "move"
                                                                          ? "sky"
                                                                          : "black"
                                                                    : isMoving
                                                                      ? "sky"
                                                                      : undefined
                                                            }
                                                            // 드랍한 카드 안에서는 버튼도 카드 색을 따릅니다
                                                            variant={
                                                                action === a
                                                                    ? "muted"
                                                                    : isDropped
                                                                      ? "outline"
                                                                      : "framelineMuted"
                                                            }
                                                            onClick={() =>
                                                                setAction(sec.subject, a)
                                                            }
                                                        >
                                                            {ACTION_LABEL[a]}
                                                        </Button>
                                                    ))}

                                                    {/* 이동 대상 분반 — 자동은 조합 탐색에 맡깁니다 */}
                                                    {isMoving && (
                                                        <>
                                                            <Divider orientation="vertical" tone="soft" className="mx-0.5 h-5" />
                                                            <Button grow={false}
                                                                size="xs"
                                                                accent="sky"
                                                                variant="framelineMuted"
                                                                selected={moveTarget === null}
                                                                onClick={() =>
                                                                    setMoveTarget(
                                                                        sec.subject,
                                                                        null,
                                                                    )
                                                                }
                                                            >
                                                                자동
                                                            </Button>
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
                                                                        <Button grow={false}
                                                                            key={sib.id}
                                                                            size="xs"
                                                                            accent={blocked ? "orange" : "sky"}
                                                                            variant={blocked ? "plain" : "framelineMuted"}
                                                                            selected={moveTarget === sib.id}
                                                                            onClick={() =>
                                                                                setMoveTarget(
                                                                                    sec.subject,
                                                                                    sib.id,
                                                                                )
                                                                            }
                                                                            title={`${sib.teacher} · ${formatSectionTimes(sib.times)} · ${sib.studentCount}명${blocked ? ` · 충돌: ${sibBlockers.map((b) => getKoreanName(b.subject)).join(", ")}` : " · 바로 이동 가능"}`}
                                                                        >
                                                                            {getSectionNumber(
                                                                                sib.section,
                                                                            )}
                                                                        </Button>
                                                                    );
                                                                })}
                                                            <Divider orientation="vertical" tone="soft" className="mx-0.5 h-5" />
                                                        </>
                                                    )}

                                                    <Button grow={false}
                                                        size="xs"
                                                        accent={isOpen ? "black" : isMoving ? "sky" : undefined}
                                                        variant={isDropped ? "outline" : "framelineMuted"}
                                                        selected={isOpen}
                                                        iconEnd={ChevronDown}
                                                        aria-expanded={isOpen}
                                                        aria-label="모든 분반 시간표 보기"
                                                        onClick={() =>
                                                            setOpenSubject(
                                                                isOpen ? null : sec.subject,
                                                            )
                                                        }
                                                        title="모든 분반 시간표 보기"
                                                    />
                                                </div>
                                            </div>
                                            {movedSection && (
                                                <Surface
                                                    fill="none"
                                                    border="subtle"
                                                    borderSide="top"
                                                    className="p-3 flex flex-wrap items-center gap-2"
                                                >
                                                    <Text variant="overline">구인 글</Text>
                                                    <Text
                                                        as="code"
                                                        variant="micro"
                                                        weight="bold"
                                                        tone="secondary"
                                                        className="whitespace-pre-line leading-tight"
                                                    >
                                                        {buildTradePost(
                                                            sec.subject,
                                                            sec,
                                                            movedSection,
                                                        )}
                                                    </Text>
                                                    <CopyButton
                                                        className="ml-auto"
                                                        text={buildTradePost(
                                                            sec.subject,
                                                            sec,
                                                            movedSection,
                                                        )}
                                                    />
                                                </Surface>
                                            )}
                                            {isOpen && (
                                                <Surface
                                                    fill="none"
                                                    border="subtle"
                                                    borderSide="top"
                                                    className="p-3 space-y-2"
                                                >
                                                    <Text as="p" variant="overline">
                                                        {getKoreanName(sec.subject)} ·{" "}
                                                        {siblings.length}개 분반
                                                    </Text>
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
                                                                <Paint
                                                                    key={sib.id}
                                                                    accent={
                                                                        isCurrent
                                                                            ? "cyan"
                                                                            : blockers.length === 0
                                                                              ? "green"
                                                                              : "orange"
                                                                    }
                                                                    variant={
                                                                        isCurrent
                                                                            ? "solid"
                                                                            : blockers.length === 0
                                                                              ? "solidMuted"
                                                                              : "plain"
                                                                    }
                                                                    className="px-2 py-1"
                                                                >
                                                                    <Text variant="micro" weight="bold">
                                                                        <Text as="span" variant="micro">
                                                                            {getSectionNumber(
                                                                                sib.section,
                                                                            )}
                                                                            분반
                                                                        </Text>{" "}
                                                                        {sib.teacher} ·{" "}
                                                                        {sib.studentCount}명
                                                                        {!isCurrent &&
                                                                            blockers.length >
                                                                                0 && (
                                                                                <Text as="span" variant="micro" weight="bold" className="block">
                                                                                    충돌:{" "}
                                                                                    {blockers
                                                                                        .map((b) =>
                                                                                            getKoreanName(
                                                                                                b.subject,
                                                                                            ),
                                                                                        )
                                                                                        .join(", ")}
                                                                                </Text>
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
                                                                                    <Text
                                                                                        as="span"
                                                                                        variant="micro"
                                                                                        weight="bold"
                                                                                        tone={n > 0 ? "secondary" : "muted"}
                                                                                        className="block"
                                                                                    >
                                                                                        {n > 0
                                                                                            ? `교환 상대 ${n}명`
                                                                                            : "교환 상대 없음"}
                                                                                    </Text>
                                                                                );
                                                                            })()}
                                                                    </Text>
                                                                </Paint>
                                                            );
                                                        })}
                                                    </div>
                                                </Surface>
                                            )}
                                        </Frame>
                                    );
                                })}

                            </div>
                        </div>

                        {openedByDrop.length > 0 && (
                            <div className="space-y-3">
                                <SectionTitle title="You Can Add" icon={Plus} />
                                <Text as="p" variant="micro" weight="bold" tone="muted">
                                    드랍으로 비는 시간에 새로 들어갈 수 있는 과목입니다.
                                    이미 들었거나 선수를 안 채운 과목은 빼 뒀습니다 —
                                    그런 과목은 아래 검색으로 찾을 수 있습니다.
                                </Text>
                                <div className="flex flex-wrap gap-1.5">
                                    {openedByDrop.map(({ subject, sections }) => (
                                        <Button
                                            key={subject}
                                            size="xs"
                                            accent={addedSubjects.includes(subject) ? "black" : "green"}
                                            variant="solidMuted"
                                            shadow="hover"
                                            selected={addedSubjects.includes(subject)}
                                            uppercase={false}
                                            onClick={() => toggleAddSubject(subject)}
                                        >
                                            <span>{getKoreanName(subject)}</span>
                                            <span className="opacity-60">
                                                {" "}
                                                · {sections.length}개 분반
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <SectionTitle title="Add Subjects" icon={Plus} />
                            <Input
                                value={addQuery}
                                onChange={(e) => setAddQuery(e.target.value)}
                                placeholder="추가로 듣고 싶은 과목 검색 (예: 정3)"
                            />
                            {addMatches.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {addMatches.map(({ subject, state }) => {
                                        const picked = addedSubjects.includes(subject);
                                        const summary = addSummaries.get(subject);
                                        // 이미 들었거나 선수를 안 채운 과목 — 고를 수는
                                        // 있지만 눈에 덜 띄게 눕혀 둡니다
                                        const dim = state !== "open";
                                        return (
                                            <Button grow={false}
                                                key={subject}
                                                size="xs"
                                                variant={dim ? "muted" : "paper"}
                                                selected={picked}
                                                uppercase={false}
                                                onClick={() => toggleAddSubject(subject)}
                                                title={ADDABILITY_LABEL[state] || undefined}
                                            >
                                                <span>{getKoreanName(subject)}</span>
                                                {dim ? (
                                                    <span className="opacity-60">
                                                        {" "}
                                                        · {ADDABILITY_LABEL[state]}
                                                    </span>
                                                ) : (
                                                    summary && (
                                                        <span className="opacity-60">
                                                            {" "}
                                                            · 바로가능 {summary.free}/
                                                            {summary.total}
                                                        </span>
                                                    )
                                                )}
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 선택한 조합의 교환 상대 */}
                    {partnersForPreview.length > 0 && (
                        <div className="lg:col-span-12 space-y-3">
                            <SectionTitle title="Trade Partners" icon={Users} />
                            <Text as="p" variant="micro" weight="bold" tone="muted">
                                선택한 조합에서 분반을 맞바꿀 수 있는 사람입니다. 상대가 그
                                분반을 듣고 있고, 내 자리로 옮겨도 상대 시간표가 깨지지
                                않는 경우만 나옵니다.
                            </Text>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {partnersForPreview.map(
                                    ({ subject, from, to, partners }) => (
                                        <Card key={subject} padding="0">
                                            <div className="p-3 space-y-2">
                                                <div>
                                                    <Text as="p" weight="black" truncate>
                                                        {getKoreanName(subject)}
                                                    </Text>
                                                    <Text
                                                        as="p"
                                                        variant="label"
                                                        weight="bold"
                                                        tone="muted"
                                                        className="flex items-center gap-1"
                                                    >
                                                        {getSectionNumber(from.section)}
                                                        분반
                                                        <Icon icon={ArrowRight} size={10} />
                                                        {getSectionNumber(to.section)}분반
                                                        · {to.teacher}
                                                    </Text>
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
                                                    <Surface fill="none" border="subtle" borderSide="top" className="pt-2">
                                                        <Text as="p" variant="label" weight="bold" tone="muted">
                                                            맞바꿀 상대가 없습니다. 빈자리가
                                                            나기를 노려야 합니다.
                                                        </Text>
                                                    </Surface>
                                                ) : (
                                                    <Surface fill="none" border="subtle" borderSide="top" className="pt-2 space-y-1.5">
                                                        <Text as="p" variant="overline">
                                                            {partners.length}명
                                                        </Text>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {partners.map((p) => (
                                                                <StudentBadge
                                                                    fullId
                                                                    key={p.stuId}
                                                                    studentId={p.stuId}
                                                                    studentName={p.name}
                                                                />
                                                            ))}
                                                        </div>
                                                    </Surface>
                                                )}
                                            </div>
                                        </Card>
                                    ),
                                )}
                            </div>
                        </div>
                    )}

                    {/* 결과 */}
                    <div className="lg:col-span-12 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionTitle title="Possible Plans" icon={ArrowLeftRight} />
                            <Text variant="overline">
                                {plans.length}
                                {truncated ? `+ (상위 ${MAX_PLAN_RESULTS})` : ""} 개
                            </Text>
                        </div>

                        {plans.length === 0 ? (
                            <Card padding="0" className="p-6">
                                <div className="flex items-start gap-3">
                                    <Icon
                                        icon={TriangleAlert}
                                        size={18}
                                        tone="muted"
                                        className="shrink-0 mt-0.5"
                                    />
                                    <div className="space-y-1">
                                        <Text as="p" weight="black">
                                            가능한 조합이 없습니다
                                        </Text>
                                        <Text as="p" variant="caption" tone="muted">
                                            과목을 <b>이동</b>이나 <b>드랍</b>으로 표시하면
                                            탐색 범위가 넓어집니다. 추가하려는 과목이 있다면
                                            위에서 충돌하는 과목을 확인해보세요.
                                        </Text>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {plans.map((plan, i) => {
                                    const active =
                                        plan.key === previewKey ||
                                        (isAutoPreview && plan.key === previewPlan?.key);
                                    return (
                                        <Card
                                            key={plan.key}
                                            motion="sink"
                                            padding="0"
                                            onClick={() =>
                                                setPreviewKey(active ? null : plan.key)
                                            }
                                            className="w-full text-left p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <Text as="span" variant="overline">
                                                    Plan {i + 1}
                                                    {(() => {
                                                        const after = totalCredits(
                                                            applyPlan(schedule, plan),
                                                        );
                                                        const diff =
                                                            after - creditSummary.now;
                                                        return (
                                                            <Text as="span" variant="overline" tone="secondary" className="ml-1.5">
                                                                {after}학점
                                                                {diff !== 0 &&
                                                                    ` (${diff > 0 ? "+" : ""}${diff})`}
                                                            </Text>
                                                        );
                                                    })()}
                                                </Text>
                                                <span className="flex items-center gap-1">
                                                    {plan.moveCount > 0 && (
                                                        <Badge size="sm" variant="frameline">
                                                            이동 {plan.moveCount}
                                                        </Badge>
                                                    )}
                                                    {plan.dropCount > 0 && (
                                                        <Badge size="sm" variant="frameline">
                                                            드랍 {plan.dropCount}
                                                        </Badge>
                                                    )}
                                                    {plan.addCount > 0 && (
                                                        <Badge size="sm" accent="green" variant="solidMuted">
                                                            추가 {plan.addCount}
                                                        </Badge>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {plan.choices.map((c) => (
                                                    <div
                                                        key={c.subject}
                                                        className="leading-tight"
                                                    >
                                                        <Text as="p" variant="label" truncate>
                                                            {getKoreanName(c.subject)}
                                                        </Text>
                                                        <Text
                                                            as="p"
                                                            variant="label"
                                                            weight="bold"
                                                            tone="muted"
                                                            className="flex items-center gap-1"
                                                        >
                                                            {c.from ? (
                                                                <span>
                                                                    {getSectionNumber(
                                                                        c.from.section,
                                                                    )}
                                                                    분반
                                                                </span>
                                                            ) : (
                                                                <span>신규</span>
                                                            )}
                                                            <Icon icon={ArrowRight} size={10} />
                                                            {c.to ? (
                                                                <Text as="span" variant="label" weight="bold" tone="primary">
                                                                    {getSectionNumber(
                                                                        c.to.section,
                                                                    )}
                                                                    분반 ·{" "}
                                                                    {formatSectionTimes(
                                                                        c.to.times,
                                                                    )}
                                                                </Text>
                                                            ) : (
                                                                <Text as="span" variant="label" weight="bold" tone="primary">
                                                                    드랍
                                                                </Text>
                                                            )}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </div>
                                            <Text as="div" variant="overline" className="flex items-center gap-1 pt-1">
                                                {active ? (
                                                    <>
                                                        <Icon icon={Check} size={12} strokeWidth={3} />
                                                        {isAutoPreview
                                                            ? "Auto"
                                                            : "Previewing"}
                                                    </>
                                                ) : (
                                                    "Click to preview"
                                                )}
                                            </Text>
                                        </Card>
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

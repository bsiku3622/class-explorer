import React, { useState, useMemo, useCallback } from "react";
import {
    ArrowLeftRight,
    ArrowRight,
    Check,
    ChevronDown,
    Plus,
    Search,
    Trash2,
    TriangleAlert,
    X,
} from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    buildSubjectIndex,
    getStudentSchedule,
    findPlans,
    applyPlan,
    scheduleToTimes,
    evaluateAddCandidates,
    findBlockers,
    findAddableAfterDrop,
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
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import PageHeader from "../components/molecules/PageHeader";
import TimetableGrid from "../components/TimetableGrid";
import SectionsTimetable from "../components/SectionsTimetable";

interface TradePageProps {
    allClassesData: SubjectData[];
    term: Term | null;
}

const ACTION_LABEL: Record<PlanAction, string> = {
    keep: "유지",
    move: "이동",
    drop: "드랍",
};

const ACTION_ORDER: PlanAction[] = ["keep", "move", "drop"];

const sectionLabel = (s: SectionInfo) =>
    `${getSectionNumber(s.section)}분반 · ${s.teacher}`;

const TradePage: React.FC<TradePageProps> = ({ allClassesData, term }) => {
    const [stuId, setStuId] = useState<string | null>(null);
    const [studentQuery, setStudentQuery] = useState("");
    const [actions, setActions] = useState<Record<string, PlanAction>>({});
    const [addSelections, setAddSelections] = useState<AddSelection[]>([]);
    const [addQuery, setAddQuery] = useState("");
    const [openSubject, setOpenSubject] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState<string | null>(null);

    const index = useMemo(() => buildSubjectIndex(allClassesData), [allClassesData]);

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
        setAddQuery("");
        setOpenSubject(null);
        setPreviewKey(null);
    }, []);

    const setAction = useCallback((subject: string, action: PlanAction) => {
        setPreviewKey(null);
        setActions((prev) => ({ ...prev, [subject]: action }));
    }, []);

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
        return findPlans({ schedule, index, actions, addSelections });
    }, [stuId, schedule, index, actions, addSelections]);

    const previewPlan = useMemo(
        () => plans.find((p) => p.key === previewKey) ?? null,
        [plans, previewKey],
    );

    /**
     * 왼쪽 시간표에 그릴 내용.
     * 조합을 고르면 그 결과를, 고르기 전에는 지금까지 지정한 드랍·추가를 바로 반영합니다.
     * 빠지는 과목은 남겨둔 채 색으로 구분해 어느 시간이 비는지 보이게 합니다.
     */
    const { previewSchedule, leavingSubjects, enteringSubjects } = useMemo(() => {
        const leaving = new Set<string>();
        const entering = new Set<string>();

        if (previewPlan) {
            previewPlan.choices.forEach((c) => {
                if (!c.to) leaving.add(c.subject);
                else if (!c.from || c.from.id !== c.to.id) entering.add(c.subject);
            });
            const dropped = schedule.filter((s) => leaving.has(s.subject));
            // 빠지는 과목을 앞에 둬서, 같은 칸이 겹치면 새로 들어오는 쪽이 보이게 합니다
            return {
                previewSchedule: [...dropped, ...applyPlan(schedule, previewPlan)],
                leavingSubjects: leaving,
                enteringSubjects: entering,
            };
        }

        schedule.forEach((s) => {
            if ((actions[s.subject] ?? "keep") === "drop") leaving.add(s.subject);
        });

        const added: SectionInfo[] = [];
        addSelections.forEach(({ subject, sectionId }) => {
            if (sectionId === null) return; // 분반 미정이면 그릴 수 없습니다
            const section = (index.get(subject) ?? []).find((s) => s.id === sectionId);
            if (section) {
                added.push(section);
                entering.add(subject);
            }
        });

        const dropped = schedule.filter((s) => leaving.has(s.subject));
        const kept = schedule.filter((s) => !leaving.has(s.subject));
        return {
            previewSchedule: [...dropped, ...kept, ...added],
            leavingSubjects: leaving,
            enteringSubjects: entering,
        };
    }, [schedule, previewPlan, actions, addSelections, index]);

    const cellColorFor = useCallback(
        (time: { subject?: string }) => {
            if (!time.subject) return undefined;
            if (leavingSubjects.has(time.subject)) return "#ff3e3e";
            if (enteringSubjects.has(time.subject)) return "#00a32a";
            return undefined;
        },
        [leavingSubjects, enteringSubjects],
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
        const addable = findAddableAfterDrop(schedule, index, dropSubjects);
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
    }, [dropSubjects, schedule, index]);

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
                    (s.aliases || []).some((a) => fuzzyMatch(a, q)),
            )
            .slice(0, 20)
            .map((s) => s.subject);
    }, [allClassesData, addQuery, enrolledSubjects]);

    /** 추가 후보 과목별로 "바로 들어가는 분반이 있는지" 요약 */
    const addSummaries = useMemo(() => {
        const map = new Map<string, { free: number; total: number }>();
        [...addedSubjects, ...addMatches].forEach((subject) => {
            if (map.has(subject)) return;
            const candidates = evaluateAddCandidates(schedule, index, subject);
            map.set(subject, {
                free: candidates.filter((c) => c.blockers.length === 0).length,
                total: candidates.length,
            });
        });
        return map;
    }, [addedSubjects, addMatches, schedule, index]);

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
                                title={previewPlan ? "Preview" : "Current Schedule"}
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
                        {(leavingSubjects.size > 0 || enteringSubjects.size > 0) && (
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                                {leavingSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-black bg-retro-primary/30" />
                                        빠짐
                                    </span>
                                )}
                                {enteringSubjects.size > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 border-2 border-black bg-retro-green/30" />
                                        들어옴
                                    </span>
                                )}
                            </div>
                        )}
                        <p className="text-[10px] font-bold text-black/40">
                            {previewPlan
                                ? "* 선택한 조합을 적용한 결과입니다. 실제 신청은 직접 진행해야 합니다."
                                : "* 지정한 드랍·추가가 바로 반영됩니다. 분반을 정하지 않은 추가 과목은 그리지 않습니다."}
                        </p>
                    </div>

                    {/* 우: 과목별 처리 + 추가신청 */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="space-y-3">
                            <RetroSubTitle title="My Subjects" />
                            <div className="space-y-2">
                                {orderedSchedule.map((sec) => {
                                    const action = actions[sec.subject] ?? "keep";
                                    const isOpen = openSubject === sec.subject;
                                    const siblings = index.get(sec.subject) ?? [];
                                    const isDropped = action === "drop";
                                    return (
                                        <RetroCard
                                            key={sec.subject}
                                            shadow="sm"
                                            className={
                                                isDropped
                                                    ? "bg-retro-primary/15 border-retro-primary"
                                                    : `bg-white ${action !== "keep" ? "border-black" : "border-black/20"}`
                                            }
                                        >
                                            <div className="p-3 flex flex-wrap items-center gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className={`font-black text-sm truncate ${isDropped ? "text-retro-primary line-through" : ""}`}
                                                    >
                                                        {getKoreanName(sec.subject)}
                                                    </p>
                                                    <p
                                                        className={`text-[10px] font-bold truncate ${isDropped ? "text-retro-primary/60" : "text-black/40"}`}
                                                    >
                                                        {sectionLabel(sec)} ·{" "}
                                                        {formatSectionTimes(sec.times)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {ACTION_ORDER.map((a) => (
                                                        <button
                                                            key={a}
                                                            onClick={() =>
                                                                setAction(sec.subject, a)
                                                            }
                                                            className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-100 ${
                                                                action !== a
                                                                    ? "bg-white border-black/20 text-black/40 hover:border-black hover:text-black"
                                                                    : a === "drop"
                                                                      ? "bg-retro-primary text-white border-retro-primary"
                                                                      : "bg-black text-white border-black"
                                                            }`}
                                                        >
                                                            {ACTION_LABEL[a]}
                                                        </button>
                                                    ))}
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
                                                                  ? "bg-white border-retro-primary/40 text-retro-primary hover:border-retro-primary"
                                                                  : "bg-white border-black/20 text-black/40 hover:border-black hover:text-black"
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
                                                                          schedule.filter(
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
                                                                            ? "bg-black text-white border-black"
                                                                            : blockers.length ===
                                                                                0
                                                                              ? "bg-retro-green/20 border-black"
                                                                              : "bg-black/[0.04] border-black/10 text-black/40"
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
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </RetroCard>
                                    );
                                })}

                                {/* 추가 신청 과목 — 같은 리스트에 이어 붙습니다 */}
                                {addSelections.map(({ subject, sectionId }) => {
                                    const siblings = index.get(subject) ?? [];
                                    const isOpen = openSubject === subject;
                                    const candidates = evaluateAddCandidates(
                                        schedule,
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
                                                    <p className="text-[10px] font-bold text-black/50 truncate">
                                                        {chosen
                                                            ? `${sectionLabel(chosen)} · ${formatSectionTimes(chosen.times)}`
                                                            : "분반 미지정 — 가능한 분반을 모두 탐색합니다"}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            setAddSection(subject, null)
                                                        }
                                                        className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-100 ${
                                                            sectionId === null
                                                                ? "bg-black text-white border-black"
                                                                : "bg-white border-black/20 text-black/40 hover:border-black hover:text-black"
                                                        }`}
                                                    >
                                                        자동
                                                    </button>
                                                    {siblings.map((sib) => {
                                                        const blocked = candidates.find(
                                                            (c) =>
                                                                c.section.id === sib.id,
                                                        )?.blockers.length;
                                                        return (
                                                            <button
                                                                key={sib.id}
                                                                onClick={() =>
                                                                    setAddSection(
                                                                        subject,
                                                                        sib.id,
                                                                    )
                                                                }
                                                                title={`${sib.teacher} · ${formatSectionTimes(sib.times)}${blocked ? " · 충돌 있음" : ""}`}
                                                                className={`px-2 py-1 border-2 text-[10px] font-black transition-all duration-100 ${
                                                                    sectionId === sib.id
                                                                        ? "bg-black text-white border-black"
                                                                        : blocked
                                                                          ? "bg-white border-black/10 text-black/25 hover:border-black/40"
                                                                          : "bg-white border-black/20 text-black/60 hover:border-black hover:text-black"
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
                                                                : "bg-white border-black/20 text-black/40 hover:border-black hover:text-black"
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
                                                        className="p-1.5 border-2 border-black/20 hover:border-black transition-all duration-100"
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
                                                                            : "bg-black/[0.04] border-black/10 text-black/40"
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
                                                        : "bg-white border-black/20 hover:border-black"
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
                                    const active = plan.key === previewKey;
                                    return (
                                        <RetroCard
                                            key={plan.key}
                                            shadow="sm"
                                            className={`bg-white transition-all duration-100 ${active ? "border-black" : "border-black/20"}`}
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
                                                            Previewing
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

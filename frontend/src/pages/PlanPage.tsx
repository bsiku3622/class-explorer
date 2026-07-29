import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    GraduationCap,
    Search,
    X,
    Check,
    Lock,
    BookOpen,
    CircleAlert,
} from "lucide-react";
import api from "../lib/api";
import type { SubjectData } from "../types";
import {
    buildPrereqIndex,
    buildUnlockIndex,
    computeProgress,
    courseState,
    inferPrereqs,
    layoutGraph,
    CATEGORY_LABEL,
    DEPARTMENT_ORDER,
    NODE_WIDTH,
    NODE_HEIGHT,
    type Course,
    type CourseState,
    type Curriculum,
    type ProgressTerm,
} from "../lib/curriculum";
import { fuzzyMatch } from "../lib/searchEngine";
import { getStudentColor } from "../lib/utils";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import PageHeader from "../components/molecules/PageHeader";

const SESSION_TOKEN_KEY = "ksa_session_token";
const STATE_KEY = "ksa_plan_state";

const authHeader = () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

interface PlanPageProps {
    allClassesData: SubjectData[];
}

/** 학번별로 직접 체크한 과목을 기억합니다 (수집 이전 학기용) */
interface SavedState {
    stuId: string | null;
    manual: Record<string, string[]>;
}

const loadState = (): SavedState => {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return { stuId: null, manual: {} };
        const parsed = JSON.parse(raw);
        return {
            stuId: typeof parsed?.stuId === "string" ? parsed.stuId : null,
            manual: typeof parsed?.manual === "object" && parsed.manual ? parsed.manual : {},
        };
    } catch {
        return { stuId: null, manual: {} };
    }
};

const STATE_STYLE: Record<CourseState, { box: string; text: string }> = {
    taken: { box: "bg-retro-green/20 border-retro-green", text: "text-black" },
    current: { box: "bg-retro-accent5/20 border-retro-accent5", text: "text-black" },
    inferred: {
        box: "bg-retro-green/[0.07] border-retro-green border-dashed",
        text: "text-black/60",
    },
    available: { box: "bg-white border-black", text: "text-black" },
    locked: { box: "bg-black/[0.04] border-black/20", text: "text-black/35" },
};

const STATE_LABEL: Record<CourseState, string> = {
    taken: "이수",
    current: "수강 중",
    inferred: "이수 추정",
    available: "수강 가능",
    locked: "선수 미이수",
};

const PlanPage: React.FC<PlanPageProps> = ({ allClassesData }) => {
    const saved = useMemo(() => loadState(), []);

    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [stuId, setStuId] = useState<string | null>(saved.stuId);
    const [studentQuery, setStudentQuery] = useState("");
    /** 어느 학생의 응답인지 함께 들고 있어야 학생을 빠르게 바꿀 때 섞이지 않습니다 */
    const [progressData, setProgressData] = useState<{
        stuId: string;
        terms: ProgressTerm[];
    } | null>(null);
    const [manual, setManual] = useState<Record<string, string[]>>(saved.manual);
    const [department, setDepartment] = useState<string>("수학");
    const [focused, setFocused] = useState<string | null>(null);

    useEffect(() => {
        api.get("/curriculum", { headers: authHeader() })
            .then((res) => setCurriculum(res.data))
            .catch(() => setLoadError("교육과정 데이터를 불러오지 못했습니다."));
    }, []);

    useEffect(() => {
        if (!stuId) return;
        let cancelled = false;
        api.get(`/curriculum/progress/${encodeURIComponent(stuId)}`, { headers: authHeader() })
            .then((res) => {
                if (!cancelled) setProgressData({ stuId, terms: res.data.terms ?? [] });
            })
            .catch(() => {
                if (!cancelled) setProgressData({ stuId, terms: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [stuId]);

    useEffect(() => {
        localStorage.setItem(STATE_KEY, JSON.stringify({ stuId, manual }));
    }, [stuId, manual]);

    const allStudents = useMemo(() => {
        const map = new Map<string, string>();
        allClassesData.forEach((subject) =>
            subject.sections.forEach((section) =>
                section.students?.forEach((student) => map.set(student.stuId, student.name)),
            ),
        );
        return Array.from(map, ([id, name]) => ({ stuId: id, name })).sort((a, b) =>
            a.stuId.localeCompare(b.stuId),
        );
    }, [allClassesData]);

    const studentMatches = useMemo(() => {
        const query = studentQuery.trim();
        if (!query) return [];
        return allStudents
            .filter((s) => fuzzyMatch(s.stuId, query) || fuzzyMatch(s.name, query))
            .slice(0, 12);
    }, [allStudents, studentQuery]);

    const terms = useMemo(
        () => (progressData?.stuId === stuId ? progressData.terms : []),
        [progressData, stuId],
    );

    const byName = useMemo(
        () => new Map((curriculum?.courses ?? []).map((course) => [course.name, course])),
        [curriculum],
    );
    const prereqIndex = useMemo(
        () => buildPrereqIndex(curriculum?.prerequisites ?? []),
        [curriculum],
    );
    const unlockIndex = useMemo(
        () => buildUnlockIndex(curriculum?.prerequisites ?? []),
        [curriculum],
    );

    /** 가장 최근 학기는 "수강 중", 그 이전은 "이수"로 봅니다 */
    const { autoTaken, currentCourses } = useMemo(() => {
        const auto = new Set<string>();
        const now = new Set<string>();
        terms.forEach((term, index) => {
            const target = index === terms.length - 1 ? now : auto;
            term.courses.forEach((item) => item.course && target.add(item.course));
        });
        return { autoTaken: auto, currentCourses: now };
    }, [terms]);

    const manualTaken = useMemo(
        () => new Set(stuId ? (manual[stuId] ?? []) : []),
        [manual, stuId],
    );

    const taken = useMemo(
        () => new Set([...autoTaken, ...manualTaken]),
        [autoTaken, manualTaken],
    );

    /**
     * 기록에 없지만 선수 조건상 들었을 과목. 학점에는 넣지 않습니다 — 추정이라
     * 실제 이수와 섞으면 숫자를 믿을 수 없게 됩니다.
     */
    const inferred = useMemo(
        () => inferPrereqs(new Set([...taken, ...currentCourses]), prereqIndex),
        [taken, currentCourses, prereqIndex],
    );

    /** 진척도는 이번 학기를 마쳤을 때 기준으로 봅니다 */
    const earned = useMemo(
        () => new Set([...taken, ...currentCourses]),
        [taken, currentCourses],
    );

    const progress = useMemo(
        () => computeProgress(earned, byName, curriculum?.requirements ?? {}),
        [earned, byName, curriculum],
    );

    const departments = useMemo(() => {
        const present = new Set((curriculum?.courses ?? []).map((course) => course.department));
        return DEPARTMENT_ORDER.filter((name) => present.has(name));
    }, [curriculum]);

    const graph = useMemo(() => {
        const courses = (curriculum?.courses ?? []).filter(
            (course) => course.department === department,
        );
        if (!courses.length) return null;
        return layoutGraph(courses, curriculum?.prerequisites ?? [], byName);
    }, [curriculum, department, byName]);

    const toggleManual = useCallback(
        (name: string) => {
            if (!stuId || autoTaken.has(name) || currentCourses.has(name)) return;
            setManual((prev) => {
                const list = new Set(prev[stuId] ?? []);
                if (list.has(name)) list.delete(name);
                else list.add(name);
                return { ...prev, [stuId]: [...list] };
            });
        },
        [stuId, autoTaken, currentCourses],
    );

    const focusedCourse: Course | undefined = focused ? byName.get(focused) : undefined;

    if (loadError) {
        return (
            <div className="flex flex-col gap-6 pb-20">
                <PageHeader title="Plan" subtitle="교육과정 이수 현황" icon={GraduationCap} />
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/40">{loadError}</p>
                </RetroCard>
            </div>
        );
    }

    const studentColor = stuId ? getStudentColor(stuId) : "#000000";
    const studentName = allStudents.find((s) => s.stuId === stuId)?.name;

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader
                title="Plan"
                subtitle="교육과정 이수 현황"
                icon={GraduationCap}
                action={
                    stuId ? (
                        <RetroButton
                            size="sm"
                            onClick={() => {
                                setStuId(null);
                                setStudentQuery("");
                            }}
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
                            {studentMatches.map((student) => (
                                <button
                                    key={student.stuId}
                                    onClick={() => {
                                        setStuId(student.stuId);
                                        setStudentQuery("");
                                    }}
                                    className="flex items-center gap-2 border-2 px-2 py-1 text-[11px] font-black italic transition-all duration-100 hover:scale-105 active:scale-95"
                                    style={{
                                        backgroundColor: `${getStudentColor(student.stuId)}15`,
                                        borderColor: getStudentColor(student.stuId),
                                        color: getStudentColor(student.stuId),
                                    }}
                                >
                                    {student.stuId} {student.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {stuId && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
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
                                {stuId} {studentName}
                            </span>
                            <span className="border-2 border-black px-2 py-1 text-[11px] font-black">
                                {progress.totalCredits}학점 이수
                            </span>
                            {progress.apCredits > 0 && (
                                <span className="border-2 border-black px-2 py-1 text-[11px] font-black">
                                    AP {progress.apCredits}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </PageHeader>

            {!curriculum ? (
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/30 animate-pulse">
                        Loading curriculum...
                    </p>
                </RetroCard>
            ) : !stuId ? (
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/40">
                        학생을 선택하면 이수 현황이 표시됩니다
                    </p>
                    <p className="text-xs font-bold text-black/40 mt-2">
                        교육과정에는 {curriculum.courses.length}개 과목과{" "}
                        {curriculum.prerequisites.length}개의 선수관계가 등록되어 있습니다.
                    </p>
                </RetroCard>
            ) : (
                <>
                    <RetroCard className="bg-white p-6 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <RetroSubTitle title="Graduation Requirements" icon={GraduationCap} />
                            {progress.graduationReady && (
                                <span className="border-2 border-retro-green bg-retro-green/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-retro-green">
                                    요건 충족
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {progress.requirements.map((item) => {
                                const ratio = Math.min(1, item.earned / item.required);
                                return (
                                    <div key={item.key} className="space-y-1.5">
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-sm font-black uppercase">
                                                {item.label}
                                            </span>
                                            <span className="text-xs font-bold">
                                                <span
                                                    className={
                                                        item.met
                                                            ? "text-retro-green"
                                                            : "text-black"
                                                    }
                                                >
                                                    {item.earned}
                                                </span>
                                                <span className="text-black/40">
                                                    {" / "}
                                                    {item.required}학점
                                                </span>
                                            </span>
                                        </div>
                                        <div className="h-5 border-2 border-black bg-white">
                                            <div
                                                className={`h-full transition-all duration-100 ${
                                                    item.met
                                                        ? "bg-retro-green"
                                                        : "bg-retro-primary"
                                                }`}
                                                style={{ width: `${ratio * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] font-bold text-black/40 leading-relaxed">
                            수집된 학기(2026-1 이후)는 자동으로 반영됩니다. 그 이전 학기는 아래
                            그래프에서 과목을 눌러 직접 체크해주세요.
                            {inferred.size > 0 && (
                                <>
                                    {" "}선수 조건상 들었을 과목 {inferred.size}개는 점선으로
                                    표시했고, 추정이라 학점에는 넣지 않았습니다 — 눌러서 확정하면
                                    합산됩니다.
                                </>
                            )}
                        </p>
                    </RetroCard>

                    <RetroCard className="bg-white p-6 space-y-4">
                        <RetroSubTitle title="Enrolled by Term" icon={BookOpen} />
                        {terms.length === 0 ? (
                            <p className="text-xs font-bold text-black/40">
                                수집된 수강 이력이 없습니다.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {terms.map((term, index) => {
                                    const isCurrent = index === terms.length - 1;
                                    const credits = term.courses.reduce(
                                        (sum, item) =>
                                            sum + (item.course ? (byName.get(item.course)?.credits ?? 0) : 0),
                                        0,
                                    );
                                    return (
                                        <div key={`${term.year}-${term.semester}`} className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black uppercase tracking-widest">
                                                    {term.year}-{term.semester}
                                                </span>
                                                {isCurrent && (
                                                    <span className="border-2 border-retro-accent5 bg-retro-accent5/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest">
                                                        수강 중
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold text-black/40">
                                                    {term.courses.length}과목 · {credits}학점
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {term.courses.map((item) => (
                                                    <span
                                                        key={item.subject}
                                                        onMouseEnter={() => item.course && setFocused(item.course)}
                                                        className={`border-2 px-1.5 py-0.5 text-[10px] font-bold ${
                                                            item.course
                                                                ? isCurrent
                                                                    ? "border-retro-accent5 bg-retro-accent5/15"
                                                                    : "border-retro-green bg-retro-green/15"
                                                                : "border-retro-accent4 bg-retro-accent4/15 text-retro-accent4"
                                                        }`}
                                                        title={
                                                            item.course
                                                                ? undefined
                                                                : "교육과정에 연결되지 않은 과목 — 학점 집계에서 빠집니다"
                                                        }
                                                    >
                                                        {item.course ?? item.subject}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </RetroCard>

                    <RetroCard className="bg-white p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <RetroSubTitle title="Course Map" icon={GraduationCap} />
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
                                {(Object.keys(STATE_LABEL) as CourseState[]).map((state) => (
                                    <span key={state} className="flex items-center gap-1.5">
                                        <span
                                            className={`w-3 h-3 border-2 ${STATE_STYLE[state].box}`}
                                        />
                                        {STATE_LABEL[state]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {departments.map((name) => (
                                <RetroButton
                                    key={name}
                                    size="sm"
                                    isSelected={department === name}
                                    onClick={() => setDepartment(name)}
                                >
                                    {name}
                                </RetroButton>
                            ))}
                        </div>

                        {graph && (
                            <div className="overflow-x-auto border-2 border-black/10 bg-retro-bg/40 p-4">
                                <svg
                                    width={graph.width}
                                    height={graph.height}
                                    viewBox={`0 0 ${graph.width} ${graph.height}`}
                                    style={{ minWidth: graph.width }}
                                >
                                    {graph.edges.map((edge) => (
                                        <path
                                            key={`${edge.before}→${edge.after}`}
                                            d={edge.path}
                                            fill="none"
                                            stroke={
                                                focused === edge.before || focused === edge.after
                                                    ? "#000000"
                                                    : "rgba(0,0,0,0.25)"
                                            }
                                            strokeWidth={2}
                                            strokeDasharray={edge.alternative ? "5 4" : undefined}
                                        />
                                    ))}
                                    {graph.nodes.map((node) => {
                                        const state = courseState(
                                            node.name,
                                            taken,
                                            currentCourses,
                                            inferred,
                                            prereqIndex,
                                        );
                                        const style = STATE_STYLE[state];
                                        const isManual = manualTaken.has(node.name);
                                        const editable =
                                            !autoTaken.has(node.name) && !currentCourses.has(node.name);
                                        return (
                                            <foreignObject
                                                key={node.name}
                                                x={node.x}
                                                y={node.y}
                                                width={NODE_WIDTH}
                                                height={NODE_HEIGHT}
                                            >
                                                <button
                                                    onClick={() => toggleManual(node.name)}
                                                    onMouseEnter={() => setFocused(node.name)}
                                                    disabled={!editable}
                                                    className={`w-full h-full border-2 px-2 flex flex-col items-start justify-center gap-0.5 text-left transition-all duration-100 ${style.box} ${style.text} ${
                                                        editable
                                                            ? "cursor-pointer hover:shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
                                                            : "cursor-default"
                                                    } ${focused === node.name ? "shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]" : ""}`}
                                                >
                                                    <span className="flex items-center gap-1 w-full">
                                                        {state === "locked" && (
                                                            <Lock size={10} strokeWidth={3} className="shrink-0" />
                                                        )}
                                                        {isManual && (
                                                            <Check
                                                                size={10}
                                                                strokeWidth={3}
                                                                className="shrink-0 text-retro-green"
                                                            />
                                                        )}
                                                        <span className="text-[11px] font-black truncate">
                                                            {node.course.name}
                                                        </span>
                                                    </span>
                                                    <span className="text-[9px] font-bold opacity-60">
                                                        {node.course.department !== department && (
                                                            <span className="text-retro-secondary">
                                                                {node.course.department}{" · "}
                                                            </span>
                                                        )}
                                                        {node.course.credits}학점
                                                        {node.course.is_ec && " · EC"}
                                                        {node.course.is_pf && " · P/F"}
                                                    </span>
                                                </button>
                                            </foreignObject>
                                        );
                                    })}
                                </svg>
                            </div>
                        )}

                        {focusedCourse ? (
                            <div className="border-2 border-black bg-retro-accent-light p-3 space-y-1">
                                <div className="flex flex-wrap items-baseline gap-2">
                                    <span className="text-sm font-black">{focusedCourse.name}</span>
                                    {focusedCourse.english_name && (
                                        <span className="text-[10px] font-bold text-black/40">
                                            {focusedCourse.english_name}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold text-black/60">
                                        {focusedCourse.credits}학점 ·{" "}
                                        {CATEGORY_LABEL[focusedCourse.category]}
                                        {focusedCourse.recommended_semester &&
                                            ` · 권장 ${focusedCourse.recommended_semester}학기`}
                                    </span>
                                </div>
                                {(() => {
                                    const edges = prereqIndex.get(focusedCourse.name) ?? [];
                                    const unlocks = unlockIndex.get(focusedCourse.name) ?? [];
                                    const optional = edges.filter((edge) => edge.alternative);
                                    const required = edges.filter((edge) => !edge.alternative);
                                    return (
                                        <>
                                            {edges.length > 0 && (
                                                <p className="text-[10px] font-bold text-black/60">
                                                    선수:{" "}
                                                    {[
                                                        ...required.map((edge) => edge.before),
                                                        ...(optional.length
                                                            ? [
                                                                  `(${optional
                                                                      .map((edge) => edge.before)
                                                                      .join(" 또는 ")})`,
                                                              ]
                                                            : []),
                                                    ].join(", ")}
                                                </p>
                                            )}
                                            {unlocks.length > 0 && (
                                                <p className="text-[10px] font-bold text-black/60">
                                                    이 과목을 들으면 열립니다: {unlocks.join(", ")}
                                                </p>
                                            )}
                                        </>
                                    );
                                })()}
                                {focusedCourse.description && (
                                    <p className="text-[11px] font-medium text-black/70 leading-relaxed pt-1">
                                        {focusedCourse.description}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="flex items-center gap-1.5 text-[10px] font-bold text-black/40">
                                <CircleAlert size={12} strokeWidth={2.5} />
                                과목에 마우스를 올리면 상세가, 클릭하면 이수 여부가 바뀝니다 (수집된
                                학기는 바꿀 수 없습니다)
                            </p>
                        )}
                    </RetroCard>
                </>
            )}
        </div>
    );
};

export default PlanPage;

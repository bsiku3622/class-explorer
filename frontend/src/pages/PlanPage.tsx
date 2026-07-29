import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    GraduationCap,
    Search,
    X,
    Check,
    Lock,
    BookOpen,
    CircleAlert,
    Award,
} from "lucide-react";
import api from "../lib/api";
import type { SubjectData } from "../types";
import {
    buildPrereqIndex,
    buildUnlockIndex,
    computeGpa,
    computeProgress,
    courseState,
    inferPrereqs,
    layoutGraph,
    CATEGORY_LABEL,
    DEPARTMENT_ORDER,
    GRADE_OPTIONS,
    NODE_WIDTH,
    NODE_HEIGHT,
    type Course,
    type CourseState,
    type Curriculum,
    type GradeMap,
    type ProgressTerm,
} from "../lib/curriculum";
import { loadState, saveState } from "../lib/userState";
import { fuzzyMatch } from "../lib/searchEngine";
import { getStudentColor } from "../lib/utils";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import PageHeader from "../components/molecules/PageHeader";

const SESSION_TOKEN_KEY = "ksa_session_token";
/** 계정 저장으로 옮기기 전에 쓰던 키 — 남아 있으면 한 번 옮겨 옵니다 */
const LEGACY_STATE_KEY = "ksa_plan_state";

const authHeader = () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

interface PlanPageProps {
    allClassesData: SubjectData[];
}

/** 계정에 저장하는 화면 상태 — 성적은 `/curriculum/grades`에 따로 둡니다 */
interface PlanState {
    stuId?: string | null;
    /** 옛 형식: 학번 → 직접 체크한 과목 목록. 처음 열 때 성적 기록으로 옮깁니다 */
    manual?: Record<string, string[]>;
}

/** 이수 기록을 서버에 통째로 올립니다. 실패해도 화면은 계속 쓸 수 있게 조용히 넘깁니다 */
const persistGrades = (stuId: string, grades: GradeMap) => {
    const entries = Object.entries(grades).map(([course, grade]) => ({ course, grade }));
    api
        .put(
            `/curriculum/grades/${encodeURIComponent(stuId)}`,
            { entries },
            { headers: authHeader() },
        )
        .catch(() => {});
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
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [stuId, setStuId] = useState<string | null>(null);
    const [studentQuery, setStudentQuery] = useState("");
    /** 어느 학생의 응답인지 함께 들고 있어야 학생을 빠르게 바꿀 때 섞이지 않습니다 */
    const [progressData, setProgressData] = useState<{
        stuId: string;
        terms: ProgressTerm[];
    } | null>(null);
    /** 이 계정이 기록한 이수 내역 — 값이 평어, null이면 이수만 체크한 상태 */
    const [gradeData, setGradeData] = useState<{ stuId: string; grades: GradeMap } | null>(null);
    const [department, setDepartment] = useState<string>("수학");
    const [focused, setFocused] = useState<string | null>(null);
    /** 불러오기 전에는 저장하지 않습니다 — 빈 값으로 덮어쓰는 걸 막습니다 */
    const [restored, setRestored] = useState(false);

    /** 옛 localStorage 형식에 남아 있던 직접 체크 내역 — 학생을 고르면 그때 옮깁니다 */
    const pendingLegacy = useRef<Record<string, string[]>>({});

    useEffect(() => {
        api.get("/curriculum", { headers: authHeader() })
            .then((res) => setCurriculum(res.data))
            .catch(() => setLoadError("교육과정 데이터를 불러오지 못했습니다."));
    }, []);

    useEffect(() => {
        let cancelled = false;
        loadState<PlanState>("plan", LEGACY_STATE_KEY)
            .then((state) => {
                if (cancelled) return;
                pendingLegacy.current = state?.manual ?? {};
                if (state?.stuId) setStuId(state.stuId);
                setRestored(true);
            })
            .catch(() => {
                if (!cancelled) setRestored(true);
            });
        return () => {
            cancelled = true;
        };
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
        if (!stuId) return;
        let cancelled = false;
        api.get(`/curriculum/grades/${encodeURIComponent(stuId)}`, { headers: authHeader() })
            .then((res) => {
                if (cancelled) return;
                const loaded: GradeMap = {};
                (res.data.entries ?? []).forEach(
                    (entry: { course: string; grade: string | null }) => {
                        loaded[entry.course] = entry.grade;
                    },
                );
                // 계정에 기록이 없고 옛 기기 데이터가 있으면 그걸 옮겨 심습니다
                const legacy = pendingLegacy.current[stuId];
                if (!Object.keys(loaded).length && legacy?.length) {
                    legacy.forEach((name) => {
                        loaded[name] = null;
                    });
                    delete pendingLegacy.current[stuId];
                    persistGrades(stuId, loaded);
                    // 옮긴 뒤에는 화면 상태에서도 지웁니다
                    saveState("plan", { stuId, manual: pendingLegacy.current });
                }
                setGradeData({ stuId, grades: loaded });
            })
            .catch(() => {
                if (cancelled) return;
                setGradeData({ stuId, grades: {} });
            });
        return () => {
            cancelled = true;
        };
    }, [stuId]);

    useEffect(() => {
        if (!restored) return;
        // 아직 성적 기록으로 옮기지 못한 옛 체크 내역은 그대로 들고 갑니다 —
        // 여기서 빠뜨리면 학생을 고르기 전에 저장이 돌 때 사라집니다
        saveState("plan", { stuId, manual: pendingLegacy.current });
    }, [restored, stuId]);

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

    const grades = useMemo(
        () => (gradeData?.stuId === stuId ? gradeData.grades : {}),
        [gradeData, stuId],
    );

    /** 기록에 행이 있으면 이수한 것으로 봅니다 — 평어는 선택 사항입니다 */
    const recorded = useMemo(() => new Set(Object.keys(grades)), [grades]);

    const taken = useMemo(
        () => new Set([...autoTaken, ...recorded]),
        [autoTaken, recorded],
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

    /** 기록을 바꾸고 서버에 올립니다 */
    const updateGrades = useCallback(
        (mutate: (draft: GradeMap) => void) => {
            // 아직 서버 기록을 못 받았으면 손대지 않습니다 — 빈 값으로 덮어쓰게 됩니다
            if (!stuId || gradeData?.stuId !== stuId) return;
            setGradeData((prev) => {
                const base = prev?.stuId === stuId ? prev.grades : {};
                const next = { ...base };
                mutate(next);
                persistGrades(stuId, next);
                return { stuId, grades: next };
            });
        },
        [stuId, gradeData],
    );

    /** 수집된 학기는 이미 확정이라 손대지 않습니다 */
    const toggleTaken = useCallback(
        (name: string) => {
            if (autoTaken.has(name) || currentCourses.has(name)) return;
            updateGrades((draft) => {
                if (name in draft) delete draft[name];
                else draft[name] = null;
            });
        },
        [autoTaken, currentCourses, updateGrades],
    );

    const setGrade = useCallback(
        (name: string, grade: string | null) => {
            updateGrades((draft) => {
                if (grade === null && !autoTaken.has(name) && !currentCourses.has(name)) {
                    // 직접 체크한 과목은 평어를 지우면 이수 표시만 남습니다
                    draft[name] = null;
                } else {
                    draft[name] = grade;
                }
            });
        },
        [updateGrades, autoTaken, currentCourses],
    );

    /** 평어를 넣을 수 있는 과목 — 이수·수강 중인 것 전부 */
    const gradableCourses = useMemo(() => {
        const names = [...new Set([...taken, ...currentCourses])];
        return names
            .map((name) => byName.get(name))
            .filter((course): course is Course => Boolean(course))
            .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
    }, [taken, currentCourses, byName]);

    const gpa = useMemo(
        () =>
            computeGpa(
                grades,
                byName,
                curriculum?.grade_points ?? {},
                new Set(gradableCourses.map((course) => course.name)),
            ),
        [grades, byName, curriculum, gradableCourses],
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
                            {gpa.overall !== null && (
                                <span className="border-2 border-black px-2 py-1 text-[11px] font-black">
                                    GPA {gpa.overall.toFixed(2)}
                                    {gpa.natural !== null && (
                                        <span className="text-black/50">
                                            {" · 자연 "}
                                            {gpa.natural.toFixed(2)}
                                        </span>
                                    )}
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
                            <RetroSubTitle title="Grades" icon={Award} />
                            <div className="flex flex-wrap items-center gap-2">
                                {gpa.overall !== null ? (
                                    <>
                                        <span className="border-2 border-black px-2 py-1 text-[11px] font-black">
                                            전체 {gpa.overall.toFixed(2)}
                                        </span>
                                        {gpa.natural !== null && (
                                            <span className="border-2 border-black px-2 py-1 text-[11px] font-black">
                                                자연 {gpa.natural.toFixed(2)}
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold text-black/40">
                                            {gpa.gradedCredits}학점 반영
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-[10px] font-bold text-black/40">
                                        평어를 넣으면 평점이 계산됩니다
                                    </span>
                                )}
                                {gpa.missing > 0 && (
                                    <span className="text-[10px] font-bold text-retro-accent4">
                                        미입력 {gpa.missing}과목
                                    </span>
                                )}
                            </div>
                        </div>

                        {gradableCourses.length === 0 ? (
                            <p className="text-xs font-bold text-black/40">
                                이수한 과목이 없습니다.
                            </p>
                        ) : (
                            <div className="divide-y-2 divide-black/10 border-2 border-black/10">
                                {gradableCourses.map((course) => {
                                    const grade = grades[course.name] ?? null;
                                    const isAuto =
                                        autoTaken.has(course.name) || currentCourses.has(course.name);
                                    return (
                                        <div
                                            key={course.name}
                                            className="flex flex-wrap items-center gap-2 px-2 py-1.5"
                                            onMouseEnter={() => setFocused(course.name)}
                                        >
                                            <span className="text-[11px] font-black min-w-[9rem] flex-1 truncate">
                                                {course.name}
                                            </span>
                                            <span className="text-[10px] font-bold text-black/40 shrink-0">
                                                {course.department} · {course.credits}학점
                                                {!isAuto && " · 직접 체크"}
                                            </span>
                                            {course.is_pf ? (
                                                <span className="border-2 border-black/20 px-2 py-0.5 text-[10px] font-black text-black/40 shrink-0">
                                                    P/F — 평점 제외
                                                </span>
                                            ) : (
                                                <select
                                                    value={grade ?? ""}
                                                    onChange={(e) =>
                                                        setGrade(course.name, e.target.value || null)
                                                    }
                                                    className={`shrink-0 w-20 border-2 px-1.5 py-0.5 text-[11px] font-black outline-none transition-all duration-100 ${
                                                        grade
                                                            ? "bg-black text-white border-black"
                                                            : "bg-white border-black/20 hover:border-black"
                                                    }`}
                                                >
                                                    <option value="">—</option>
                                                    {GRADE_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[10px] font-bold text-black/40 leading-relaxed">
                            평어는 계정에 저장되어 다른 기기에서도 그대로 보입니다. P/F 과목은
                            등급이 아니라 통과 여부라 평점에서 뺍니다.
                        </p>
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
                                        const isManual = recorded.has(node.name);
                                        const grade = grades[node.name];
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
                                                    onClick={() => toggleTaken(node.name)}
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
                                                        {grade && (
                                                            <span className="ml-auto shrink-0 border-2 border-black bg-white px-1 text-[9px] font-black">
                                                                {grade}
                                                            </span>
                                                        )}
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

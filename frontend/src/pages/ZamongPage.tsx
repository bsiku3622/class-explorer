import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    GraduationCap,
    BookOpen,
    CircleAlert,
    Award,
    IdCard,
} from "lucide-react";
import api from "../lib/api";
import {
    ALL_DEPARTMENTS,
    buildPrereqIndex,
    buildUnlockIndex,
    computeGpa,
    computeProgress,
    inferPrereqs,
    CATEGORY_LABEL,
    DEPARTMENT_ORDER,
    GRADE_OPTIONS,
    type Course,
    type Curriculum,
    type GradeMap,
    type ProgressTerm,
} from "../lib/curriculum";
import { clearState, loadState } from "../lib/userState";
import { getStudentColor } from "../lib/utils";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import PageHeader from "../components/molecules/PageHeader";
import LinkStudentModal from "../components/LinkStudentModal";
import CourseGraph, { CourseGraphLegend } from "../components/CourseGraph";

const SESSION_TOKEN_KEY = "ksa_session_token";
/** 계정 저장으로 옮기기 전에 쓰던 키 — 남아 있으면 한 번 옮겨 옵니다 */
const LEGACY_STATE_KEY = "ksa_plan_state";

const authHeader = () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

interface ZamongPageProps {
    /** 계정에 등록된 본인 학번 — 없으면 등록 안내를 띄웁니다 */
    stuId: string | null;
    studentName: string | null;
    onLinked: (info: { stu_id: string; student_name: string }) => void;
}

/** 옛 localStorage 형식 — 학번별로 직접 체크한 과목을 담고 있었습니다 */
interface LegacyPlanState {
    stuId?: string | null;
    manual?: Record<string, string[]>;
}

/** 이수 기록을 서버에 통째로 올립니다. 실패해도 화면은 계속 쓸 수 있게 조용히 넘깁니다 */
const persistGrades = (grades: GradeMap) => {
    const entries = Object.entries(grades).map(([course, grade]) => ({ course, grade }));
    api.put("/curriculum/grades", { entries }, { headers: authHeader() }).catch(() => {});
};

const ZamongPage: React.FC<ZamongPageProps> = ({ stuId, studentName, onLinked }) => {
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    /** 어느 학생의 응답인지 함께 들고 있어야 학번이 바뀔 때 섞이지 않습니다 */
    const [progressData, setProgressData] = useState<{
        stuId: string;
        terms: ProgressTerm[];
    } | null>(null);
    /** 이 계정이 기록한 이수 내역 — 값이 평어, null이면 이수만 체크한 상태 */
    const [gradeData, setGradeData] = useState<{ stuId: string; grades: GradeMap } | null>(null);
    const [department, setDepartment] = useState<string>("수학");
    const [focused, setFocused] = useState<string | null>(null);
    const [dismissedLink, setDismissedLink] = useState(false);

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
        if (!stuId) return;
        let cancelled = false;
        api.get("/curriculum/grades", { headers: authHeader() })
            .then(async (res) => {
                if (cancelled) return;
                const loaded: GradeMap = {};
                (res.data.entries ?? []).forEach(
                    (entry: { course: string; grade: string | null }) => {
                        loaded[entry.course] = entry.grade;
                    },
                );
                // 계정에 기록이 없으면, 예전 기기에 남은 체크 내역을 한 번 옮겨 옵니다
                if (!Object.keys(loaded).length) {
                    const legacy = await loadState<LegacyPlanState>("plan", LEGACY_STATE_KEY);
                    const checked = legacy?.manual?.[stuId];
                    if (checked?.length) {
                        checked.forEach((name) => {
                            loaded[name] = null;
                        });
                        persistGrades(loaded);
                    }
                    // 학번이 계정에 붙은 뒤로는 이 상태가 필요 없습니다
                    await clearState("plan");
                }
                if (!cancelled) setGradeData({ stuId, grades: loaded });
            })
            .catch(() => {
                if (cancelled) return;
                setGradeData({ stuId, grades: {} });
            });
        return () => {
            cancelled = true;
        };
    }, [stuId]);

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
    const { autoTaken, currentCourses, englishTaken } = useMemo(() => {
        const auto = new Set<string>();
        const now = new Set<string>();
        // EC 요건은 과목의 성질이 아니라 어느 분반을 들었느냐로 정해집니다
        const english = new Set<string>();
        terms.forEach((term, index) => {
            const target = index === terms.length - 1 ? now : auto;
            term.courses.forEach((item) => {
                if (!item.course) return;
                target.add(item.course);
                if (item.subject.endsWith("(EC)")) english.add(item.course);
            });
        });
        return { autoTaken: auto, currentCourses: now, englishTaken: english };
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
        () => computeProgress(earned, byName, curriculum?.requirements ?? {}, englishTaken),
        [earned, byName, curriculum, englishTaken],
    );

    /** 서버가 표시 순서대로 내려줍니다. 없으면 예전 상수 순서로 */
    const departments = useMemo(() => {
        const fromServer = (curriculum?.departments ?? []).map((d) => d.name);
        if (fromServer.length) return fromServer;
        const present = new Set((curriculum?.courses ?? []).map((course) => course.department));
        return DEPARTMENT_ORDER.filter((name) => present.has(name));
    }, [curriculum]);

    /** 수집된 학기라 이미 확정된 과목 — 손댈 수 없습니다 */
    const fixedCourses = useMemo(
        () => new Set([...autoTaken, ...currentCourses]),
        [autoTaken, currentCourses],
    );

    /** 기록을 바꾸고 서버에 올립니다 */
    const updateGrades = useCallback(
        (mutate: (draft: GradeMap) => void) => {
            // 아직 서버 기록을 못 받았으면 손대지 않습니다 — 빈 값으로 덮어쓰게 됩니다
            if (!stuId || gradeData?.stuId !== stuId) return;
            setGradeData((prev) => {
                const base = prev?.stuId === stuId ? prev.grades : {};
                const next = { ...base };
                mutate(next);
                persistGrades(next);
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
                <PageHeader title="Zamong" subtitle="교육과정 이수 현황" icon={GraduationCap} />
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/40">{loadError}</p>
                </RetroCard>
            </div>
        );
    }

    const studentColor = stuId ? getStudentColor(stuId) : "#000000";

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            {!stuId && !dismissedLink && (
                <LinkStudentModal
                    onLinked={onLinked}
                    onDismiss={() => setDismissedLink(true)}
                />
            )}

            <PageHeader title="Zamong" subtitle="교육과정 이수 현황" icon={GraduationCap}>
                {stuId && (
                    <div className="flex flex-wrap items-center gap-2">
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
            </PageHeader>

            {!curriculum ? (
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/30 animate-pulse">
                        Loading curriculum...
                    </p>
                </RetroCard>
            ) : !stuId ? (
                <RetroCard className="bg-white p-8 text-center space-y-3">
                    <p className="font-black uppercase tracking-widest text-black/40">
                        학번을 등록하면 이수 현황이 표시됩니다
                    </p>
                    <p className="text-xs font-bold text-black/40">
                        이수 기록과 성적은 계정에 저장되므로 누구의 기록인지 정해야 합니다.
                    </p>
                    <div className="flex justify-center pt-1">
                        <RetroButton
                            size="sm"
                            isSelected
                            onClick={() => setDismissedLink(false)}
                            icon={<IdCard size={14} strokeWidth={2.5} />}
                        >
                            학번 등록
                        </RetroButton>
                    </div>
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
                            <CourseGraphLegend />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <RetroButton
                                size="sm"
                                isSelected={department === ALL_DEPARTMENTS}
                                onClick={() => setDepartment(ALL_DEPARTMENTS)}
                            >
                                전체
                            </RetroButton>
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

                        <CourseGraph
                            courses={curriculum.courses}
                            prerequisites={curriculum.prerequisites}
                            departments={departments}
                            department={department}
                            taken={taken}
                            current={currentCourses}
                            inferred={inferred}
                            englishTaken={englishTaken}
                            grades={grades}
                            recorded={recorded}
                            fixed={fixedCourses}
                            focused={focused}
                            onFocus={setFocused}
                            onSelect={toggleTaken}
                        />

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

export default ZamongPage;

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Library, GraduationCap, BookOpen, Network, Users } from "lucide-react";
import { fetchCurriculum } from "../lib/curriculumApi";
import type { SubjectData, Term } from "../types";
import { getKoreanName, getStudentColor } from "../lib/utils";
import SearchInput from "../components/atoms/SearchInput";
import PageHeader from "../components/molecules/PageHeader";
import StudentCard from "../components/atoms/StudentCard";
import TeacherCard from "../components/atoms/TeacherCard";
import RetroButton from "../components/atoms/RetroButton";
import { Filter, RotateCcw } from "lucide-react";
import CourseGraph from "../components/CourseGraph";
import FriendsManager from "../components/FriendsManager";
import RetroCard from "../components/atoms/RetroCard";
import { useVirtualGrid } from "../hooks/useVirtualGrid";
import {
    ALL_DEPARTMENTS,
    CATEGORY_LABEL,
    type Category,
    type Curriculum,
} from "../lib/curriculum";

type BrowseMode = "students" | "teachers" | "courses" | "friends";

interface BrowsePageProps {
    allClassesData: SubjectData[];
    /** 친구 탭이 "지금 공강" 을 물을 때 씁니다 */
    term: Term | null;
    myStuId: string | null;
    studentCounts: Record<string, number>;
    lastUpdated: number | null;
    fetchInitialData: (force?: boolean) => void;
    handleSearch: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const BrowsePage: React.FC<BrowsePageProps> = ({
    allClassesData,
    term,
    myStuId,
    studentCounts,
    lastUpdated,
    fetchInitialData,
    handleSearch,
}) => {
    const [mode, setMode] = useState<BrowseMode>("students");
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);
    const [focused, setFocused] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [selectedYears, setSelectedYears] = useState<string[]>(() => Object.keys(studentCounts));

    useEffect(() => {
        const years = Object.keys(studentCounts);
        if (years.length > 0 && selectedYears.length === 0) setSelectedYears(years);
    }, [studentCounts]);

    useEffect(() => {
        if (mode !== "courses" || curriculum) return;
        fetchCurriculum()
            .then(setCurriculum)
            .catch(() => {});
    }, [mode, curriculum]);

    // ── Students ────────────────────────────────────────────────────────────
    const allStudents = useMemo(() => {
        const map = new Map<string, { stuId: string; name: string; subjects: string[]; periodCount: number }>();
        const periodSets: Record<string, Set<string>> = {};
        allClassesData.forEach((sub) => {
            sub.sections.forEach((sec) => {
                sec.students.forEach((stu) => {
                    if (!map.has(stu.stuId)) {
                        map.set(stu.stuId, { stuId: stu.stuId, name: stu.name, subjects: [], periodCount: 0 });
                    }
                    const entry = map.get(stu.stuId)!;
                    const subjectName = getKoreanName(sub.subject);
                    if (!entry.subjects.includes(subjectName)) entry.subjects.push(subjectName);
                    if (!periodSets[stu.stuId]) periodSets[stu.stuId] = new Set();
                    (sec.times || []).forEach((t) => periodSets[stu.stuId].add(`${t.day}-${t.period}`));
                });
            });
        });
        map.forEach((s) => { s.periodCount = periodSets[s.stuId]?.size || 0; });
        return Array.from(map.values()).sort((a, b) => a.stuId.localeCompare(b.stuId));
    }, [allClassesData]);

    const filteredStudents = useMemo(() => {
        const periodsMatch = searchInput.match(/^periods:(\d+)$/i);
        const subcountMatch = searchInput.match(/^subcount:(\d+)$/i);
        return allStudents.filter((s) => {
            const year = s.stuId.split("-")[0];
            if (selectedYears.length > 0 && !selectedYears.includes(year)) return false;
            if (periodsMatch) return s.periodCount === Number(periodsMatch[1]);
            if (subcountMatch) return s.subjects.length === Number(subcountMatch[1]);
            if (searchInput) {
                const q = searchInput.toLowerCase();
                return s.name.toLowerCase().includes(q) || s.stuId.toLowerCase().includes(q);
            }
            return true;
        });
    }, [allStudents, selectedYears, searchInput]);

    // ── Teachers ────────────────────────────────────────────────────────────
    const allTeachers = useMemo(() => {
        const map = new Map<string, { name: string; sections: number; periods: number; subjects: string[] }>();
        allClassesData.forEach((sub) => {
            sub.sections.forEach((sec) => {
                if (!sec.teacher || sec.teacher === "배정중") return;
                if (!map.has(sec.teacher)) {
                    map.set(sec.teacher, { name: sec.teacher, sections: 0, periods: 0, subjects: [] });
                }
                const entry = map.get(sec.teacher)!;
                entry.sections += 1;
                entry.periods += (sec.times || []).length;
                const subjectName = getKoreanName(sub.subject);
                if (!entry.subjects.includes(subjectName)) entry.subjects.push(subjectName);
            });
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }, [allClassesData]);

    const filteredTeachers = useMemo(() => {
        if (!searchInput) return allTeachers;
        const q = searchInput.toLowerCase();
        return allTeachers.filter((t) => t.name.toLowerCase().includes(q));
    }, [allTeachers, searchInput]);

    const handleModeChange = (next: BrowseMode) => {
        setMode(next);
        setSearchInput("");
    };

    const departments = useMemo(
        () => (curriculum?.departments ?? []).map((d) => d.name),
        [curriculum],
    );

    // 전교생을 한 번에 그리면 DOM 이 7천 노드를 넘습니다. 보이는 줄만 그립니다
    const studentBox = useRef<HTMLDivElement>(null);
    const studentRows = useRef<HTMLDivElement>(null);
    const teacherBox = useRef<HTMLDivElement>(null);
    const teacherRows = useRef<HTMLDivElement>(null);
    const students = useVirtualGrid(filteredStudents, {
        containerRef: studentBox,
        gridRef: studentRows,
    });
    const teachers = useVirtualGrid(filteredTeachers, {
        containerRef: teacherBox,
        gridRef: teacherRows,
    });

    const focusedCourse = useMemo(
        () => (curriculum?.courses ?? []).find((c) => c.name === focused) ?? null,
        [curriculum, focused],
    );

    const subtitle =
        mode === "students"
            ? `${allStudents.length} Students`
            : mode === "teachers"
              ? `${allTeachers.length} Teachers`
              : mode === "courses"
                ? `${curriculum?.courses.length ?? 0} Courses`
                : "Friends";

    const placeholder =
        mode === "students"
            ? "Search by name or student ID..."
            : "Search by teacher name...";

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="Browse" subtitle={subtitle} icon={Library} />

            {/* Mode toggle */}
            <div className="flex flex-wrap gap-2 md:gap-3">
                <RetroButton
                    size="sm"
                    isSelected={mode === "students"}
                    icon={<GraduationCap size={14} strokeWidth={2.5} />}
                    onClick={() => handleModeChange("students")}
                >
                    Students
                </RetroButton>
                <RetroButton
                    size="sm"
                    isSelected={mode === "teachers"}
                    icon={<BookOpen size={14} strokeWidth={2.5} />}
                    onClick={() => handleModeChange("teachers")}
                >
                    Teachers
                </RetroButton>
                <RetroButton
                    size="sm"
                    isSelected={mode === "courses"}
                    icon={<Network size={14} strokeWidth={2.5} />}
                    onClick={() => handleModeChange("courses")}
                >
                    Courses
                </RetroButton>
                <RetroButton
                    size="sm"
                    isSelected={mode === "friends"}
                    icon={<Users size={14} strokeWidth={2.5} />}
                    onClick={() => handleModeChange("friends")}
                >
                    Friends
                </RetroButton>
            </div>

            {mode === "friends" && (
                <FriendsManager
                    term={term}
                    myStuId={myStuId}
                    allClassesData={allClassesData}
                />
            )}

            {/* Search */}
            {(mode === "students" || mode === "teachers") && (
                <SearchInput value={searchInput} onChange={setSearchInput} placeholder={placeholder} />
            )}

            {/* Year filter — students only */}
            {mode === "students" && (
                <div className="bg-white border-2 border-black p-4 md:p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-black/40 shrink-0" />
                            <span className="text-xs font-bold text-black/40 uppercase tracking-widest">
                                Filter by Cohort
                            </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            {lastUpdated && (
                                <span className="hidden sm:inline text-[10px] font-bold uppercase text-black/30">
                                    {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            )}
                            <button
                                onClick={() => fetchInitialData(true)}
                                className="flex items-center gap-1.5 text-xs font-black uppercase hover:text-retro-primary transition-colors group"
                            >
                                <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                                Refresh
                            </button>
                            {selectedYears.length < Object.keys(studentCounts).length && (
                                <button
                                    onClick={() => setSelectedYears(Object.keys(studentCounts))}
                                    className="text-xs font-black uppercase underline hover:text-retro-primary transition-colors"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 md:gap-4 overflow-x-auto md:flex-wrap md:overflow-visible pb-0.5 md:pb-0">
                        {Object.entries(studentCounts).map(([year]) => {
                            const isSelected = selectedYears.includes(year);
                            const color = getStudentColor(year);
                            return (
                                <label
                                    key={year}
                                    className={`shrink-0 flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 border-2 border-black cursor-pointer transition-all duration-100 ${
                                        isSelected
                                            ? "bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                                            : "grayscale opacity-40 hover:grayscale-0 hover:opacity-100 bg-white shadow-none"
                                    }`}
                                    style={{ backgroundColor: isSelected ? `${color}20` : "" }}
                                >
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isSelected}
                                        onChange={() =>
                                            setSelectedYears(
                                                isSelected
                                                    ? selectedYears.filter((y) => y !== year)
                                                    : [...selectedYears, year],
                                            )
                                        }
                                    />
                                    <div
                                        className="w-3 h-3 md:w-4 md:h-4 border-2 border-black shrink-0"
                                        style={{ backgroundColor: isSelected ? color : "transparent" }}
                                    />
                                    <span className={`text-xs md:text-sm font-black uppercase whitespace-nowrap ${isSelected ? "text-black" : "text-black/40"}`}>
                                        {year}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Count */}
            {(mode === "students" || mode === "teachers") && (
                <p className="text-xs font-bold text-black/30 -mt-2">
                    {mode === "students" ? filteredStudents.length : filteredTeachers.length}명 표시 중
                </p>
            )}

            {/* Courses — 교육과정 선수관계 그래프 */}
            {mode === "courses" && (
                <RetroCard className="bg-white p-6 space-y-4">
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

                    {curriculum ? (
                        <CourseGraph
                            courses={curriculum.courses}
                            prerequisites={curriculum.prerequisites}
                            departments={departments}
                            department={department}
                            focused={focused}
                            onFocus={setFocused}
                        />
                    ) : (
                        <p className="py-16 text-center font-black uppercase tracking-widest text-black/30 animate-pulse">
                            Loading curriculum...
                        </p>
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
                                    {focusedCourse.credits}학점 · {focusedCourse.department} ·{" "}
                                    {CATEGORY_LABEL[focusedCourse.category as Category]}
                                    {focusedCourse.recommended_semester &&
                                        ` · 권장 ${focusedCourse.recommended_semester}학기`}
                                </span>
                            </div>
                            {focusedCourse.description && (
                                <p className="text-[11px] font-medium leading-relaxed text-black/70 pt-1">
                                    {focusedCourse.description}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-[10px] font-bold text-black/40">
                            가로는 선수 깊이입니다 — 왼쪽이 선수 없는 과목, 오른쪽으로 갈수록
                            쌓아 올린 과목입니다. 점선은 택일 관계이고, 학과를 가로지르는 선은
                            융합 과목이 다른 학과 과목을 선수로 받는 경우입니다.
                        </p>
                    )}
                </RetroCard>
            )}

            {/* Grid */}
            {mode === "courses" || mode === "friends" ? null : mode === "students" ? (
                <>
                    <div ref={studentBox} className="-mt-4">
                        <div style={{ height: students.topSpacer }} />
                        <div
                            ref={studentRows}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {students.visible.map((s) => (
                                <StudentCard
                                    key={s.stuId}
                                    stuId={s.stuId}
                                    name={s.name}
                                    subjects={s.subjects}
                                    onClick={() => handleSearch(s.stuId)}
                                />
                            ))}
                        </div>
                        <div style={{ height: students.bottomSpacer }} />
                    </div>
                    {filteredStudents.length === 0 && (
                        <div className="flex items-center justify-center py-24">
                            <p className="text-sm font-black text-black/20 uppercase tracking-widest">No Students Found</p>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div ref={teacherBox} className="-mt-4">
                        <div style={{ height: teachers.topSpacer }} />
                        <div
                            ref={teacherRows}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {teachers.visible.map((t) => (
                                <TeacherCard
                                    key={t.name}
                                    name={t.name}
                                    subjects={t.subjects}
                                    onClick={() => handleSearch(t.name, true)}
                                />
                            ))}
                        </div>
                        <div style={{ height: teachers.bottomSpacer }} />
                    </div>
                    {filteredTeachers.length === 0 && (
                        <div className="flex items-center justify-center py-24">
                            <p className="text-sm font-black text-black/20 uppercase tracking-widest">No Teachers Found</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BrowsePage;

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Library, GraduationCap, BookOpen, Network, Users } from "lucide-react";
import { fetchCurriculum } from "../lib/curriculumApi";
import type { SubjectData, Term } from "../types";
import { getKoreanName, getStudentColor } from "../lib/utils";
import SearchInput from "../components/atoms/SearchInput";
import StudentCard from "../components/atoms/StudentCard";
import TeacherCard from "../components/atoms/TeacherCard";
import { Filter, RotateCcw } from "lucide-react";
import CourseGraph from "../components/CourseGraph";
import FriendsManager from "../components/FriendsManager";
import { useVirtualGrid } from "../hooks/useVirtualGrid";
import {
    ALL_DEPARTMENTS,
    CATEGORY_LABEL,
    type Category,
    type Curriculum,
} from "../lib/curriculum";
import {
    Button,
    Card,
    EmptyState,
    Icon,
    PageHeader,
    Paint,
    SegmentedControl,
    Tabs,
    Text,
    ToneChip,
} from "@studio-baeks/funky-ui";

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
            <Tabs value={mode} onChange={handleModeChange}>
                <Tabs.List aria-label="Browse mode">
                    <Tabs.Tab value="students" icon={GraduationCap}>
                        Students
                    </Tabs.Tab>
                    <Tabs.Tab value="teachers" icon={BookOpen}>
                        Teachers
                    </Tabs.Tab>
                    <Tabs.Tab value="courses" icon={Network}>
                        Courses
                    </Tabs.Tab>
                    <Tabs.Tab value="friends" icon={Users}>
                        Friends
                    </Tabs.Tab>
                </Tabs.List>
            </Tabs>

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
                <Card padding="0" className="p-4 md:p-6">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <Icon icon={Filter} size="sm" tone="muted" className="shrink-0" />
                            <Text variant="subtitle">Filter by Cohort</Text>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            {lastUpdated && (
                                <Text variant="micro" weight="bold" tone="faint" className="hidden sm:inline uppercase">
                                    {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </Text>
                            )}
                            <Button
                                size="xs"
                                variant="ghost"
                                icon={RotateCcw}
                                iconMotion="turn"
                                onClick={() => fetchInitialData(true)}
                            >
                                Refresh
                            </Button>
                            {selectedYears.length < Object.keys(studentCounts).length && (
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => setSelectedYears(Object.keys(studentCounts))}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 md:gap-4 overflow-x-auto md:flex-wrap md:overflow-visible pb-0.5 md:pb-0">
                        {Object.entries(studentCounts).map(([year]) => {
                            const isSelected = selectedYears.includes(year);
                            return (
                                <ToneChip
                                    key={year}
                                    tone={getStudentColor(year)}
                                    selected={isSelected}
                                    onClick={() =>
                                        setSelectedYears(
                                            isSelected
                                                ? selectedYears.filter((y) => y !== year)
                                                : [...selectedYears, year],
                                        )
                                    }
                                    className="shrink-0"
                                >
                                    {year}
                                </ToneChip>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Count */}
            {(mode === "students" || mode === "teachers") && (
                <Text as="p" variant="caption" tone="muted" className="-mt-2">
                    {mode === "students" ? filteredStudents.length : filteredTeachers.length}명 표시 중
                </Text>
            )}

            {/* Courses — 교육과정 선수관계 그래프 */}
            {mode === "courses" && (
                <Card padding="0" className="p-6 space-y-4">
                    <SegmentedControl
                        aria-label="Department"
                        variant="paper"
                        shadow
                        value={department}
                        onChange={setDepartment}
                        options={[
                            { value: ALL_DEPARTMENTS, label: "전체" },
                            ...departments.map((name) => ({ value: name, label: name })),
                        ]}
                    />

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
                        <Text as="p" variant="subtitle" tone="faint" align="center" pulse className="py-16">
                            Loading curriculum...
                        </Text>
                    )}

                    {focusedCourse ? (
                        <Paint accent="cyan" variant="solidMuted" padding="lg" className="space-y-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                                <Text weight="black">{focusedCourse.name}</Text>
                                {focusedCourse.english_name && (
                                    <Text variant="micro" weight="bold" tone="muted">
                                        {focusedCourse.english_name}
                                    </Text>
                                )}
                                <Text variant="micro" weight="bold" tone="secondary">
                                    {focusedCourse.credits}학점 · {focusedCourse.department} ·{" "}
                                    {CATEGORY_LABEL[focusedCourse.category as Category]}
                                    {focusedCourse.recommended_semester &&
                                        ` · 권장 ${focusedCourse.recommended_semester}학기`}
                                </Text>
                            </div>
                            {focusedCourse.description && (
                                <Text as="p" variant="label" weight="medium" leading="relaxed" tone="secondary" className="pt-1">
                                    {focusedCourse.description}
                                </Text>
                            )}
                        </Paint>
                    ) : (
                        <Text as="p" variant="micro" weight="bold" tone="muted">
                            가로는 선수 깊이입니다 — 왼쪽이 선수 없는 과목, 오른쪽으로 갈수록
                            쌓아 올린 과목입니다. 점선은 택일 관계이고, 학과를 가로지르는 선은
                            융합 과목이 다른 학과 과목을 선수로 받는 경우입니다.
                        </Text>
                    )}
                </Card>
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
                        <EmptyState title="No Students Found" className="py-24" />
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
                        <EmptyState title="No Teachers Found" className="py-24" />
                    )}
                </>
            )}
        </div>
    );
};

export default BrowsePage;

import React, { useMemo, useState, useEffect } from "react";
import { Library, BookOpen, Network } from "lucide-react";
import api from "../lib/api";
import type { SubjectData } from "../types";
import { getKoreanName } from "../lib/utils";
import SearchInput from "../components/atoms/SearchInput";
import PageHeader from "../components/molecules/PageHeader";
import TeacherCard from "../components/atoms/TeacherCard";
import RetroButton from "../components/atoms/RetroButton";
import CourseGraph from "../components/CourseGraph";
import RetroCard from "../components/atoms/RetroCard";
import {
    ALL_DEPARTMENTS,
    CATEGORY_LABEL,
    type Category,
    type Curriculum,
} from "../lib/curriculum";

/**
 * ksa-bench 에는 **학생 목록이 없습니다.** 전교생을 한 화면에 늘어놓는 건 명단
 * 그 자체라서요. 사람은 검색에서 `student:이름` 으로 한 명씩 찾습니다.
 */
type BrowseMode = "teachers" | "courses";

const SESSION_TOKEN_KEY = "ksa_session_token";

const authHeader = () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

interface BrowsePageProps {
    allClassesData: SubjectData[];
    handleSearch: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const BrowsePage: React.FC<BrowsePageProps> = ({
    allClassesData,
    handleSearch,
}) => {
    const [mode, setMode] = useState<BrowseMode>("teachers");
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);
    const [focused, setFocused] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        if (mode !== "courses" || curriculum) return;
        api.get("/curriculum", { headers: authHeader() })
            .then((res) => setCurriculum(res.data))
            .catch(() => {});
    }, [mode, curriculum]);

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

    const focusedCourse = useMemo(
        () => (curriculum?.courses ?? []).find((c) => c.name === focused) ?? null,
        [curriculum, focused],
    );

    const subtitle =
        mode === "teachers"
            ? `${allTeachers.length} Teachers`
            : `${curriculum?.courses.length ?? 0} Courses`;

    const placeholder = "Search by teacher name...";

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="Browse" subtitle={subtitle} icon={Library} />

            {/* Mode toggle */}
            <div className="flex gap-3">
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
            </div>

            {/* Search */}
            {mode !== "courses" && (
                <SearchInput value={searchInput} onChange={setSearchInput} placeholder={placeholder} />
            )}

            {/* Count */}
            {mode !== "courses" && (
                <p className="text-xs font-bold text-black/30 -mt-2">
                    {filteredTeachers.length}명 표시 중
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
            {mode === "courses" ? null : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 -mt-4">
                        {filteredTeachers.map((t) => (
                            <TeacherCard
                                key={t.name}
                                name={t.name}
                                subjects={t.subjects}
                                onClick={() => handleSearch(t.name, true)}
                            />
                        ))}
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

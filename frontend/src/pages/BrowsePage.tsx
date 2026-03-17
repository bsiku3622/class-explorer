import React, { useMemo, useState, useEffect } from "react";
import { Library, GraduationCap, BookOpen } from "lucide-react";
import type { SubjectData } from "../types";
import { getKoreanName, getStudentColor } from "../lib/utils";
import SearchInput from "../components/atoms/SearchInput";
import PageHeader from "../components/molecules/PageHeader";
import StudentCard from "../components/atoms/StudentCard";
import TeacherCard from "../components/atoms/TeacherCard";
import RetroButton from "../components/atoms/RetroButton";
import { Filter, RotateCcw } from "lucide-react";

type BrowseMode = "students" | "teachers";

interface BrowsePageProps {
    allClassesData: SubjectData[];
    studentCounts: Record<string, number>;
    lastUpdated: number | null;
    fetchInitialData: (force?: boolean) => void;
    handleSearch: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const BrowsePage: React.FC<BrowsePageProps> = ({
    allClassesData,
    studentCounts,
    lastUpdated,
    fetchInitialData,
    handleSearch,
}) => {
    const [mode, setMode] = useState<BrowseMode>("students");
    const [searchInput, setSearchInput] = useState("");
    const [selectedYears, setSelectedYears] = useState<string[]>(() => Object.keys(studentCounts));

    useEffect(() => {
        const years = Object.keys(studentCounts);
        if (years.length > 0 && selectedYears.length === 0) setSelectedYears(years);
    }, [studentCounts]);

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

    const subtitle = mode === "students"
        ? `${allStudents.length} Students`
        : `${allTeachers.length} Teachers`;

    const placeholder = mode === "students"
        ? "Search by name or student ID..."
        : "Search by teacher name...";

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="Browse" subtitle={subtitle} icon={Library} />

            {/* Mode toggle */}
            <div className="flex gap-3">
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
            </div>

            {/* Search */}
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder={placeholder} />

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
            <p className="text-xs font-bold text-black/30 -mt-2">
                {mode === "students" ? filteredStudents.length : filteredTeachers.length}
                {mode === "students" ? "명" : "명"} 표시 중
            </p>

            {/* Grid */}
            {mode === "students" ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 -mt-4">
                        {filteredStudents.map((s) => (
                            <StudentCard
                                key={s.stuId}
                                stuId={s.stuId}
                                name={s.name}
                                subjects={s.subjects}
                                onClick={() => handleSearch(s.stuId)}
                            />
                        ))}
                    </div>
                    {filteredStudents.length === 0 && (
                        <div className="flex items-center justify-center py-24">
                            <p className="text-sm font-black text-black/20 uppercase tracking-widest">No Students Found</p>
                        </div>
                    )}
                </>
            ) : (
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

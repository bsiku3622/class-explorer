import React, { useMemo, useState, useEffect } from "react";
import {
    BarChart3,
    Users,
    BookOpen,
    MapPin,
    Clock,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    Plus,
    Minus,
    Calendar,
    X,
} from "lucide-react";
import { Spinner, Tooltip } from "@heroui/react";
import type { SubjectData } from "../types";
import { getStudentColor, getKoreanName } from "../lib/utils";
import { tooltipMotionProps } from "../constants/motion";
import { useModifierKey } from "../hooks/useModifierKey";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import StudentBadge from "../components/atoms/StudentBadge";

interface AnalysisPageProps {
    allClassesData: SubjectData[];
    loading?: boolean;
    handleSearch: (
        value: string,
        isTeacher?: boolean,
        isRoom?: boolean,
    ) => void;
}

const AccordionSection = ({
    id,
    title,
    icon: Icon,
    isOpen,
    onToggle,
    children,
    className = "",
}: any) => {
    return (
        <div
            className={`bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] overflow-hidden h-fit ${className}`}
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-5 bg-white hover:bg-retro-accent-light transition-all duration-100 group"
            >
                <div className="flex items-center gap-4">
                    <Icon size={22} strokeWidth={3} className="text-black" />
                    <h3 className="text-xl font-black uppercase tracking-tighter text-black">
                        {title}
                    </h3>
                </div>
                {isOpen ? (
                    <ChevronUp size={24} strokeWidth={3} />
                ) : (
                    <ChevronDown size={24} strokeWidth={3} />
                )}
            </button>
            {isOpen && (
                <div className="p-6 border-t-2 border-black/10 animate-in fade-in duration-300">
                    {children}
                </div>
            )}
        </div>
    );
};

const ShowMoreButton = ({
    id,
    currentCount,
    totalCount,
    isExpanded,
    onToggle,
}: {
    id: string;
    currentCount: number;
    totalCount: number;
    isExpanded: boolean;
    onToggle: () => void;
}) => {
    if (totalCount <= 15) return null;
    return (
        <div className="mt-8 flex justify-center">
            <RetroButton
                onClick={onToggle}
                size="sm"
                icon={
                    isExpanded ? (
                        <Minus size={14} strokeWidth={3} />
                    ) : (
                        <Plus size={14} strokeWidth={3} />
                    )
                }
            >
                {isExpanded
                    ? "Show Less"
                    : `Show More (${totalCount - currentCount} more)`}
            </RetroButton>
        </div>
    );
};

const AnalysisPage: React.FC<AnalysisPageProps> = ({
    allClassesData,
    loading = false,
    handleSearch,
}) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        compare: false,
        subjects: false,
        teachers: false,
        rooms: false,
    });
    const [expandLists, setExpandLists] = useState<Record<string, boolean>>({
        subjects: false,
        teachers: false,
        rooms: false,
    });
    const [compareSearch, setCompareSearch] = useState("");
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
    const [activeCellKey, setActiveCellKey] = useState<string | null>(null);

    const isModifierPressed = useModifierKey();

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActiveCellKey(null);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    const toggleSection = (section: string) =>
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    const toggleExpand = (listId: string) =>
        setExpandLists((prev) => ({ ...prev, [listId]: !prev[listId] }));

    // --- Data Processing ---
    const studentInfoMap = useMemo(() => {
        const map: Record<
            string,
            { name: string; schedule: Record<string, string> }
        > = {};
        if (!allClassesData) return map;
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    if (!map[stu.stuId])
                        map[stu.stuId] = { name: stu.name, schedule: {} };
                    (sec.times || []).forEach((t) => {
                        map[stu.stuId].schedule[`${t.day}-${t.period}`] =
                            getKoreanName(sub.subject);
                    });
                }),
            ),
        );
        return map;
    }, [allClassesData]);

    const studentSuggestions = useMemo(() => {
        if (compareSearch.length < 2) return [];
        return Object.entries(studentInfoMap)
            .filter(
                ([id, data]) =>
                    data.name.includes(compareSearch) ||
                    id.includes(compareSearch),
            )
            .filter(([id]) => !selectedStudentIds.includes(id))
            .slice(0, 5);
    }, [compareSearch, studentInfoMap, selectedStudentIds]);

    const commonFreePeriods = useMemo(() => {
        if (selectedStudentIds.length < 2) return [];
        const DAYS = ["MON", "TUE", "WED", "THU", "FRI"],
            PERIODS = Array.from({ length: 11 }, (_, i) => i + 1),
            free: string[] = [];
        DAYS.forEach((day) =>
            PERIODS.forEach((period) => {
                const key = `${day}-${period}`;
                if (
                    selectedStudentIds.every(
                        (id) => !studentInfoMap[id]?.schedule[key],
                    )
                )
                    free.push(key);
            }),
        );
        return free;
    }, [selectedStudentIds, studentInfoMap]);

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing || studentSuggestions.length === 0)
            return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedSuggestionIndex((p) =>
                p < studentSuggestions.length - 1 ? p + 1 : p,
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedSuggestionIndex((p) => (p > 0 ? p - 1 : 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const targetId =
                focusedSuggestionIndex >= 0
                    ? studentSuggestions[focusedSuggestionIndex][0]
                    : studentSuggestions[0][0];
            setSelectedStudentIds((prev) => [...prev, targetId]);
            setCompareSearch("");
        }
    };

    const allSubjectStats = useMemo(
        () =>
            allClassesData
                .map((sub) => ({
                    name: sub.subject,
                    studentCount: sub.subject_student_count || 0,
                }))
                .sort((a, b) => b.studentCount - a.studentCount),
        [allClassesData],
    );
    const allTeacherStats = useMemo(() => {
        const stats: Record<string, { sections: number; periods: number }> = {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) => {
                if (!sec.teacher || sec.teacher === "배정중") return;
                if (!stats[sec.teacher])
                    stats[sec.teacher] = { sections: 0, periods: 0 };
                stats[sec.teacher].sections += 1;
                stats[sec.teacher].periods += (sec.times || []).length;
            }),
        );
        return Object.entries(stats)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.periods - a.periods);
    }, [allClassesData]);
    const allRoomStats = useMemo(() => {
        const stats: Record<string, { sectionCount: number; periods: number }> =
            {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) => {
                const seen = new Set();
                (sec.times || []).forEach((t) => {
                    const room = t.room || sec.room;
                    if (!room || room === "배정중") return;
                    if (!stats[room])
                        stats[room] = { sectionCount: 0, periods: 0 };
                    stats[room].periods += 1;
                    if (!seen.has(room)) {
                        stats[room].sectionCount += 1;
                        seen.add(room);
                    }
                });
            }),
        );
        return Object.entries(stats)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.periods - a.periods);
    }, [allClassesData]);

    const maxStudents = Math.max(
        1,
        ...allSubjectStats.map((s) => s.studentCount),
    );
    const maxTeacherPeriods = Math.max(
        1,
        ...allTeacherStats.map((t) => t.periods),
    );
    const maxRoomPeriods = Math.max(1, ...allRoomStats.map((r) => r.periods));

    if (loading)
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Spinner size="lg" />
                <p className="font-black uppercase animate-pulse">
                    Analyzing Data...
                </p>
            </div>
        );

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="bg-white border-2 border-black p-8 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] relative overflow-hidden">
                <div className="absolute top-0 right-0 px-6 py-1.5 bg-black text-white text-xs font-black tracking-widest uppercase">
                    Feature: Data Analysis
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter text-black uppercase mb-2">
                            Visual Analysis
                        </h2>
                        <RetroSubTitle
                            title="Academic Statistics Dashboard"
                            icon={BarChart3}
                        />
                    </div>
                    <RetroButton
                        onClick={() =>
                            window.scrollTo({ top: 0, behavior: "smooth" })
                        }
                        icon={<TrendingUp size={18} />}
                    >
                        Back to Top
                    </RetroButton>
                </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: "Total Hrs",
                        value: allTeacherStats.reduce(
                            (acc, t) => acc + t.periods,
                            0,
                        ),
                    },
                    { label: "Active Rms", value: allRoomStats.length },
                    { label: "Subjects", value: allSubjectStats.length },
                    {
                        label: "Avg Size",
                        value: (
                            allSubjectStats.reduce(
                                (acc, s) => acc + s.studentCount,
                                0,
                            ) / (allSubjectStats.length || 1)
                        ).toFixed(0),
                    },
                ].map((s, i) => (
                    <div
                        key={i}
                        className="bg-white p-4 border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] flex flex-col justify-center items-center"
                    >
                        <span className="text-xs font-bold uppercase text-black/40 mb-1">
                            {s.label}
                        </span>
                        <span className="text-2xl font-black text-black">
                            {s.value}
                        </span>
                    </div>
                ))}
            </div>
            <AccordionSection
                id="compare"
                title="Timetable Compare"
                icon={Calendar}
                isOpen={openSections.compare}
                onToggle={() => toggleSection("compare")}
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="relative">
                            <RetroSubTitle
                                title="Search & Add Students"
                                icon={Users}
                            />
                            <input
                                type="text"
                                placeholder="Name or ID..."
                                value={compareSearch}
                                onChange={(e) =>
                                    setCompareSearch(e.target.value)
                                }
                                onKeyDown={handleSearchKeyDown}
                                className="w-full bg-white border-2 border-black p-3 text-sm font-bold focus:outline-none shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]"
                            />
                            {studentSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-50 bg-white border-2 border-black mt-1 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                                    {studentSuggestions.map(
                                        ([id, data], index) => (
                                            <button
                                                key={id}
                                                onClick={() => {
                                                    setSelectedStudentIds(
                                                        (prev) => [...prev, id],
                                                    );
                                                    setCompareSearch("");
                                                }}
                                                className={`w-full text-left p-3 border-b last:border-b-0 border-black/5 flex items-center ${index === focusedSuggestionIndex ? "bg-retro-accent-light" : "hover:bg-retro-accent-light"}`}
                                            >
                                                <StudentBadge
                                                    studentId={id}
                                                    studentName={data.name}
                                                />
                                            </button>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <RetroSubTitle
                                title="Comparing Students"
                                icon={Users}
                            />
                            <div className="flex flex-wrap gap-2">
                                {selectedStudentIds.map((id) => (
                                    <StudentBadge
                                        key={id}
                                        studentId={id}
                                        studentName={studentInfoMap[id]?.name}
                                        onClick={() =>
                                            setSelectedStudentIds((prev) =>
                                                prev.filter(
                                                    (sid) => sid !== id,
                                                ),
                                            )
                                        }
                                    />
                                ))}
                                {selectedStudentIds.length === 0 && (
                                    <p className="text-sm font-bold text-black/20">
                                        No selection.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="w-full">
                        <RetroSubTitle
                            title="Common Empty Slots"
                            icon={Clock}
                        />
                        <div className="bg-white border-2 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,0.1)]">
                            <div className="grid grid-cols-[40px_repeat(5,1fr)] divide-x divide-black/10 border-b border-black bg-black text-white">
                                <div className="p-2 text-[10px] font-black text-center">
                                    PD
                                </div>
                                {["MON", "TUE", "WED", "THU", "FRI"].map(
                                    (day) => (
                                        <div
                                            key={day}
                                            className="p-2 text-[10px] font-black text-center"
                                        >
                                            {day}
                                        </div>
                                    ),
                                )}
                            </div>
                            {Array.from({ length: 11 }, (_, i) => i + 1).map(
                                (period) => (
                                    <div
                                        key={period}
                                        className="grid grid-cols-[40px_repeat(5,1fr)] divide-x divide-black/10 border-b last:border-b-0 border-black/5"
                                    >
                                        <div className="bg-black/5 flex items-center justify-center text-[10px] font-black">
                                            {period}
                                        </div>
                                        {[
                                            "MON",
                                            "TUE",
                                            "WED",
                                            "THU",
                                            "FRI",
                                        ].map((day) => {
                                            const key = `${day}-${period}`,
                                                isFree =
                                                    selectedStudentIds.length >=
                                                        2 &&
                                                    commonFreePeriods.includes(
                                                        key,
                                                    ),
                                                first =
                                                    selectedStudentIds.length >
                                                    0
                                                        ? studentInfoMap[
                                                              selectedStudentIds[0]
                                                          ]?.schedule[key]
                                                        : null,
                                                isCommonClass =
                                                    selectedStudentIds.length >=
                                                        2 &&
                                                    first &&
                                                    selectedStudentIds.every(
                                                        (id) =>
                                                            studentInfoMap[id]
                                                                ?.schedule[
                                                                key
                                                            ] === first,
                                                    );
                                            return (
                                                <Tooltip
                                                    key={day}
                                                    isOpen={
                                                        activeCellKey === key
                                                    }
                                                    content={
                                                        <div className="p-3 min-w-[180px] space-y-1.5">
                                                            <p className="text-[10px] font-black border-b border-black/10 pb-1 mb-2 uppercase">
                                                                {day} Pd{" "}
                                                                {period}
                                                            </p>
                                                            {selectedStudentIds.map(
                                                                (id) => (
                                                                    <div
                                                                        key={id}
                                                                        className="flex justify-between gap-4"
                                                                    >
                                                                        <span
                                                                            className="text-[10px] font-black"
                                                                            style={{
                                                                                color: getStudentColor(
                                                                                    id,
                                                                                ),
                                                                            }}
                                                                        >
                                                                            {
                                                                                studentInfoMap[
                                                                                    id
                                                                                ]
                                                                                    ?.name
                                                                            }
                                                                        </span>
                                                                        <span
                                                                            className={`text-[9px] font-bold px-1.5 py-0.5 border ${studentInfoMap[id]?.schedule[key] ? "bg-black/5 text-black/60" : "bg-retro-green/10 text-retro-green"}`}
                                                                        >
                                                                            {studentInfoMap[
                                                                                id
                                                                            ]
                                                                                ?.schedule[
                                                                                key
                                                                            ] ||
                                                                                "Free"}
                                                                        </span>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    }
                                                    classNames={{
                                                        content:
                                                            "p-0 rounded-none border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]",
                                                    }}
                                                    motionProps={
                                                        tooltipMotionProps
                                                    }
                                                >
                                                    <div
                                                        onClick={() =>
                                                            setActiveCellKey(
                                                                activeCellKey ===
                                                                    key
                                                                    ? null
                                                                    : key,
                                                            )
                                                        }
                                                        className={`h-10 transition-all duration-300 relative cursor-pointer ${activeCellKey === key ? "ring-2 ring-inset ring-black z-10" : "hover:bg-black/[0.03]"} ${isCommonClass ? "bg-retro-primary/20" : isFree ? "bg-retro-green/20" : "bg-white"}`}
                                                    />
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                </div>
            </AccordionSection>
            <AccordionSection
                id="subjects"
                title="Students Analysis"
                icon={Users}
                isOpen={openSections.subjects}
                onToggle={() => toggleSection("subjects")}
            >
                <div className="space-y-3">
                    {allSubjectStats
                        .slice(
                            0,
                            expandLists.subjects ? allSubjectStats.length : 15,
                        )
                        .map((s, i) => (
                            <div
                                key={i}
                                className="group flex items-center gap-4"
                            >
                                <div className="w-56 shrink-0">
                                    <button
                                        onClick={() =>
                                            handleSearch(getKoreanName(s.name))
                                        }
                                        className="text-sm font-black uppercase truncate block hover:text-retro-primary hover:underline decoration-2 underline-offset-4 transition-all text-left"
                                    >
                                        {getKoreanName(s.name)}
                                    </button>
                                </div>
                                <div className="flex-1 flex items-center gap-4">
                                    <div className="flex-1 h-5 border-2 border-black bg-black/5 relative overflow-hidden">
                                        <div
                                            className="h-full bg-retro-primary transition-all duration-500 ease-out group-hover:bg-[#ff7e7e]"
                                            style={{
                                                width: `${(s.studentCount / maxStudents) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="w-24 text-right text-xs font-black text-black/60 shrink-0">
                                        {s.studentCount} Students
                                    </span>
                                </div>
                            </div>
                        ))}
                </div>
                <ShowMoreButton
                    id="subjects"
                    currentCount={15}
                    totalCount={allSubjectStats.length}
                    isExpanded={expandLists.subjects}
                    onToggle={() => toggleExpand("subjects")}
                />
            </AccordionSection>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                <AccordionSection
                    id="teachers"
                    title="Teaching Load"
                    icon={Clock}
                    isOpen={openSections.teachers}
                    onToggle={() => toggleSection("teachers")}
                >
                    <div className="space-y-4">
                        {allTeacherStats
                            .slice(
                                0,
                                expandLists.teachers
                                    ? allTeacherStats.length
                                    : 15,
                            )
                            .map((t, i) => (
                                <div
                                    key={i}
                                    className="group flex flex-col gap-1.5"
                                >
                                    <div className="flex justify-between items-end px-1">
                                        <button
                                            onClick={() =>
                                                handleSearch(t.name, true)
                                            }
                                            className="text-sm font-black uppercase hover:text-retro-primary hover:underline decoration-2 underline-offset-4 transition-all text-left"
                                        >
                                            {t.name} T.
                                        </button>
                                        <span className="text-sm font-black text-retro-primary shrink-0">
                                            {t.periods} PDS | {t.sections}{" "}
                                            Sections
                                        </span>
                                    </div>
                                    <div className="h-5 border-2 border-black bg-black/5 relative overflow-hidden">
                                        <div
                                            className="h-full bg-retro-primary transition-all duration-500 ease-out group-hover:bg-[#ff7e7e]"
                                            style={{
                                                width: `${(t.periods / maxTeacherPeriods) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                    <ShowMoreButton
                        id="teachers"
                        currentCount={15}
                        totalCount={allTeacherStats.length}
                        isExpanded={expandLists.teachers}
                        onToggle={() => toggleExpand("teachers")}
                    />
                </AccordionSection>
                <AccordionSection
                    id="rooms"
                    title="Classroom Utilization"
                    icon={MapPin}
                    isOpen={openSections.rooms}
                    onToggle={() => toggleSection("rooms")}
                >
                    <div className="space-y-4">
                        {allRoomStats
                            .slice(
                                0,
                                expandLists.rooms ? allRoomStats.length : 15,
                            )
                            .map((r, i) => (
                                <div
                                    key={i}
                                    className="group flex flex-col gap-1.5"
                                >
                                    <div className="flex justify-between items-end px-1">
                                        <button
                                            onClick={() =>
                                                handleSearch(
                                                    r.name,
                                                    false,
                                                    true,
                                                )
                                            }
                                            className="text-sm font-black uppercase hover:text-retro-primary hover:underline decoration-2 underline-offset-4 transition-all text-left"
                                        >
                                            {r.name}
                                        </button>
                                        <span className="text-sm font-black text-black/60 shrink-0">
                                            {r.periods} HRS/WK |{" "}
                                            {r.sectionCount} Classes
                                        </span>
                                    </div>
                                    <div className="h-5 border-2 border-black bg-black/5 relative overflow-hidden">
                                        <div
                                            className="h-full bg-retro-primary transition-all duration-500 ease-out group-hover:bg-[#ff7e7e]"
                                            style={{
                                                width: `${(r.periods / maxRoomPeriods) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                    <ShowMoreButton
                        id="rooms"
                        currentCount={15}
                        totalCount={allRoomStats.length}
                        isExpanded={expandLists.rooms}
                        onToggle={() => toggleExpand("rooms")}
                    />
                </AccordionSection>
            </div>
        </div>
    );
};

export default AnalysisPage;

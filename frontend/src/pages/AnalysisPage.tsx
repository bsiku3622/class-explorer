import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    BarChart3,
    Users,
    MapPin,
    Clock,
    Plus,
    Minus,
    Calendar,
    BookOpen,
} from "lucide-react";
import { Spinner, Tooltip } from "@heroui/react";
import type { SubjectData } from "../types";
import { getStudentColor, getKoreanName } from "../lib/utils";
import { tooltipMotionProps } from "../constants/motion";
import RetroButton from "../components/atoms/RetroButton";
import RetroCard from "../components/atoms/RetroCard";
import FilterSection from "../components/FilterSection";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import StudentBadge from "../components/atoms/StudentBadge";
import PageHeader from "../components/molecules/PageHeader";
import AccordionSection from "../components/molecules/AccordionSection";
import BarChartRow from "../components/molecules/BarChartRow";

interface AnalysisPageProps {
    allClassesData: SubjectData[];
    studentCounts: Record<string, number>;
    lastUpdated: number | null;
    fetchInitialData: (force?: boolean) => void;
    loading?: boolean;
    handleSearch: (
        value: string,
        isTeacher?: boolean,
        isRoom?: boolean,
    ) => void;
}


const YEAR_COLORS: Record<string, string> = {
    "23": "#7828C8",
    "24": "#FC8200",
    "25": "#00B327",
    "26": "#00B5E7",
};

const YearBreakdown = ({ yearData }: { yearData: Record<string, number> }) => (
    <div className="px-3 py-2 flex items-center gap-4 whitespace-nowrap">
        {Object.entries(yearData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, count]) => (
                <div key={year} className="flex items-center gap-1.5">
                    <span className="text-xs font-black" style={{ color: YEAR_COLORS[year] || "#000" }}>
                        {year}
                    </span>
                    <span className="text-xs font-black text-black">{count}명</span>
                </div>
            ))}
    </div>
);

const ShowMoreButton = ({
    currentCount,
    totalCount,
    isExpanded,
    onToggle,
}: {
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
    studentCounts,
    lastUpdated,
    fetchInitialData,
    loading = false,
    handleSearch,
}) => {
    const navigate = useNavigate();
    const [selectedYears, setSelectedYears] = useState<string[]>(() => Object.keys(studentCounts));

    useEffect(() => {
        const years = Object.keys(studentCounts);
        if (years.length > 0 && selectedYears.length === 0) setSelectedYears(years);
    }, [studentCounts]);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        compare: false,
        subjects: false,
        periodsDistribution: false,
        subjectCountDistribution: false,
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

    const allSubjectStats = useMemo(() => {
        return allClassesData
            .map((sub) => {
                const uniqueStudents = new Set<string>();
                sub.sections.forEach((sec) =>
                    sec.students.forEach((stu) => {
                        if (selectedYears.includes(stu.stuId.split("-")[0]))
                            uniqueStudents.add(stu.stuId);
                    }),
                );
                return { name: sub.subject, studentCount: uniqueStudents.size };
            })
            .filter((s) => s.studentCount > 0)
            .sort((a, b) => b.studentCount - a.studentCount);
    }, [allClassesData, selectedYears]);
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

    const weeklyPeriodsStats = useMemo(() => {
        const studentPeriods: Record<string, Set<string>> = {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    if (!selectedYears.includes(stu.stuId.split("-")[0])) return;
                    if (!studentPeriods[stu.stuId])
                        studentPeriods[stu.stuId] = new Set();
                    (sec.times || []).forEach((t) => {
                        studentPeriods[stu.stuId].add(`${t.day}-${t.period}`);
                    });
                }),
            ),
        );
        const countMap: Record<number, number> = {};
        Object.values(studentPeriods).forEach((periods) => {
            const count = periods.size;
            countMap[count] = (countMap[count] || 0) + 1;
        });
        return Object.entries(countMap)
            .map(([periods, students]) => ({ periods: Number(periods), students }))
            .sort((a, b) => a.periods - b.periods);
    }, [allClassesData, selectedYears]);

    const subjectCountStats = useMemo(() => {
        const studentSubjects: Record<string, Set<string>> = {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    if (!selectedYears.includes(stu.stuId.split("-")[0])) return;
                    if (!studentSubjects[stu.stuId])
                        studentSubjects[stu.stuId] = new Set();
                    studentSubjects[stu.stuId].add(sub.subject);
                }),
            ),
        );
        const countMap: Record<number, number> = {};
        Object.values(studentSubjects).forEach((subjects) => {
            const count = subjects.size;
            countMap[count] = (countMap[count] || 0) + 1;
        });
        return Object.entries(countMap)
            .map(([subjectCount, students]) => ({
                subjectCount: Number(subjectCount),
                students,
            }))
            .sort((a, b) => a.subjectCount - b.subjectCount);
    }, [allClassesData, selectedYears]);

    const subjectYearStats = useMemo(() => {
        const map: Record<string, Record<string, Set<string>>> = {};
        allClassesData.forEach((sub) => {
            if (!map[sub.subject]) map[sub.subject] = {};
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    const year = stu.stuId.split("-")[0];
                    if (!selectedYears.includes(year)) return;
                    if (!map[sub.subject][year]) map[sub.subject][year] = new Set();
                    map[sub.subject][year].add(stu.stuId);
                }),
            );
        });
        const result: Record<string, Record<string, number>> = {};
        Object.entries(map).forEach(([sub, years]) => {
            result[sub] = {};
            Object.entries(years).forEach(([year, ids]) => {
                result[sub][year] = ids.size;
            });
        });
        return result;
    }, [allClassesData, selectedYears]);

    const periodsYearStats = useMemo(() => {
        const studentData: Record<string, { year: string; periods: Set<string> }> = {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    const year = stu.stuId.split("-")[0];
                    if (!selectedYears.includes(year)) return;
                    if (!studentData[stu.stuId])
                        studentData[stu.stuId] = { year, periods: new Set() };
                    (sec.times || []).forEach((t) =>
                        studentData[stu.stuId].periods.add(`${t.day}-${t.period}`),
                    );
                }),
            ),
        );
        const map: Record<number, Record<string, number>> = {};
        Object.values(studentData).forEach(({ year, periods }) => {
            const count = periods.size;
            if (!map[count]) map[count] = {};
            map[count][year] = (map[count][year] || 0) + 1;
        });
        return map;
    }, [allClassesData, selectedYears]);

    const subjectCountYearStats = useMemo(() => {
        const studentData: Record<string, { year: string; subjects: Set<string> }> = {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    const year = stu.stuId.split("-")[0];
                    if (!selectedYears.includes(year)) return;
                    if (!studentData[stu.stuId])
                        studentData[stu.stuId] = { year, subjects: new Set() };
                    studentData[stu.stuId].subjects.add(sub.subject);
                }),
            ),
        );
        const map: Record<number, Record<string, number>> = {};
        Object.values(studentData).forEach(({ year, subjects }) => {
            const count = subjects.size;
            if (!map[count]) map[count] = {};
            map[count][year] = (map[count][year] || 0) + 1;
        });
        return map;
    }, [allClassesData, selectedYears]);

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
            <PageHeader
                tag="Feature: Data Analysis"
                title="Visual Analysis"
                subtitle="Academic Statistics Dashboard"
                icon={BarChart3}
            />
            <FilterSection
                studentCounts={studentCounts}
                selectedYears={selectedYears}
                setSelectedYears={setSelectedYears}
                lastUpdated={lastUpdated}
                onRefresh={() => fetchInitialData(true)}
            />
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
                    <RetroCard key={i} className="bg-white p-4 flex flex-col justify-center items-center">
                        <span className="text-xs font-bold uppercase text-black/40 mb-1">
                            {s.label}
                        </span>
                        <span className="text-2xl font-black text-black">
                            {s.value}
                        </span>
                    </RetroCard>
                ))}
            </div>
            <AccordionSection
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
                            <div className="mt-3" />
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
                        <div className="mt-3" />
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
                title="Subjects by Enrollment"
                icon={BookOpen}
                isOpen={openSections.subjects}
                onToggle={() => toggleSection("subjects")}
            >
                <div className="space-y-3">
                    {allSubjectStats
                        .slice(0, expandLists.subjects ? allSubjectStats.length : 15)
                        .map((s, i) => (
                            <BarChartRow
                                key={i}
                                label={getKoreanName(s.name)}
                                value={s.studentCount}
                                maxValue={maxStudents}
                                caption={`${s.studentCount} Students`}
                                captionClassName="text-retro-primary"
                                layout="horizontal"
                                onLabelClick={() => handleSearch(getKoreanName(s.name))}
                                tooltipContent={
                                    subjectYearStats[s.name]
                                        ? <YearBreakdown yearData={subjectYearStats[s.name]} />
                                        : undefined
                                }
                            />
                        ))}
                    <ShowMoreButton
                        currentCount={15}
                        totalCount={allSubjectStats.length}
                        isExpanded={expandLists.subjects}
                        onToggle={() => toggleExpand("subjects")}
                    />
                </div>
            </AccordionSection>
            <AccordionSection
                title="Weekly Periods Distribution"
                icon={Clock}
                isOpen={openSections.periodsDistribution}
                onToggle={() => toggleSection("periodsDistribution")}
            >
                <div className="space-y-3">
                    {weeklyPeriodsStats.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.periods} Periods`}
                            value={s.students}
                            maxValue={Math.max(1, ...weeklyPeriodsStats.map((r) => r.students))}
                            caption={`${s.students} Students`}
                            captionClassName="text-retro-primary"
                            layout="horizontal"
                            onLabelClick={() => navigate(`/students?q=periods:${s.periods}`)}
                            tooltipContent={
                                periodsYearStats[s.periods]
                                    ? <YearBreakdown yearData={periodsYearStats[s.periods]} />
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </AccordionSection>
            <AccordionSection
                title="Subject Count Distribution"
                icon={BarChart3}
                isOpen={openSections.subjectCountDistribution}
                onToggle={() => toggleSection("subjectCountDistribution")}
            >
                <div className="space-y-3">
                    {subjectCountStats.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.subjectCount} Subjects`}
                            value={s.students}
                            maxValue={Math.max(1, ...subjectCountStats.map((r) => r.students))}
                            caption={`${s.students} Students`}
                            captionClassName="text-retro-primary"
                            layout="horizontal"
                            onLabelClick={() => navigate(`/students?q=subcount:${s.subjectCount}`)}
                            tooltipContent={
                                subjectCountYearStats[s.subjectCount]
                                    ? <YearBreakdown yearData={subjectCountYearStats[s.subjectCount]} />
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </AccordionSection>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                <AccordionSection
                    title="Teaching Load"
                    icon={Clock}
                    isOpen={openSections.teachers}
                    onToggle={() => toggleSection("teachers")}
                >
                    <div className="space-y-3">
                        {allTeacherStats
                            .slice(0, expandLists.teachers ? allTeacherStats.length : 15)
                            .map((t, i) => (
                                <BarChartRow
                                    key={i}
                                    label={`${t.name} T.`}
                                    value={t.periods}
                                    maxValue={maxTeacherPeriods}
                                    caption={`${t.periods} PDS | ${t.sections} SEC`}
                                    captionClassName="text-retro-primary"
                                    onLabelClick={() => handleSearch(t.name, true)}
                                />
                            ))}
                    </div>
                    <ShowMoreButton
                        currentCount={15}
                        totalCount={allTeacherStats.length}
                        isExpanded={expandLists.teachers}
                        onToggle={() => toggleExpand("teachers")}
                    />
                </AccordionSection>
                <AccordionSection
                    title="Classroom Utilization"
                    icon={MapPin}
                    isOpen={openSections.rooms}
                    onToggle={() => toggleSection("rooms")}
                >
                    <div className="space-y-3">
                        {allRoomStats
                            .slice(0, expandLists.rooms ? allRoomStats.length : 15)
                            .map((r, i) => (
                                <BarChartRow
                                    key={i}
                                    label={r.name}
                                    value={r.periods}
                                    maxValue={maxRoomPeriods}
                                    caption={`${r.periods} HRS | ${r.sectionCount} CLS`}
                                    captionClassName="text-retro-primary"
                                    onLabelClick={() => handleSearch(r.name, false, true)}
                                />
                            ))}
                    </div>
                    <ShowMoreButton
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

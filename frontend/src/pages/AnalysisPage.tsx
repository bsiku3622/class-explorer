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
import type { SubjectData } from "../types";
import { getStudentColor, getKoreanName } from "../lib/utils";
import FilterSection from "../components/FilterSection";
import StudentBadge from "../components/atoms/StudentBadge";
import BarChartRow from "../components/molecules/BarChartRow";
import {
    Accordion,
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Popover,
    SectionTitle,
    SlotCell,
    Spinner,
    Surface,
    Pressable,
    Text,
    TimetableGrid,
    ToneText,
    surfaceClass,
} from "@studio-baeks/funky-ui";

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


const COMPARE_DAYS = ["MON", "TUE", "WED", "THU", "FRI"];

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
                    {YEAR_COLORS[year] ? (
                        <ToneText variant="caption" weight="black" tone={YEAR_COLORS[year]}>
                            {year}
                        </ToneText>
                    ) : (
                        <Text variant="caption" weight="black">
                            {year}
                        </Text>
                    )}
                    <Text variant="caption" weight="black">{count}명</Text>
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
            <Button
                variant="paper"
                shadow
                onClick={onToggle}
                size="sm"
                icon={isExpanded ? Minus : Plus}
            >
                {isExpanded
                    ? "Show Less"
                    : `Show More (${totalCount - currentCount} more)`}
            </Button>
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
        teacherLoadDistribution: false,
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

    // weeklyPeriodsStats + periodsYearStats 통합 (단일 순회)
    const periodStats = useMemo(() => {
        const byStudent: Record<string, { year: string; periods: Set<string> }> = {};
        allClassesData.forEach((sub) =>
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    const year = stu.stuId.split("-")[0];
                    if (!selectedYears.includes(year)) return;
                    if (!byStudent[stu.stuId]) byStudent[stu.stuId] = { year, periods: new Set() };
                    (sec.times || []).forEach((t) =>
                        byStudent[stu.stuId].periods.add(`${t.day}-${t.period}`),
                    );
                }),
            ),
        );
        const countMap: Record<number, number> = {};
        const yearMap: Record<number, Record<string, number>> = {};
        Object.values(byStudent).forEach(({ year, periods }) => {
            const count = periods.size;
            countMap[count] = (countMap[count] || 0) + 1;
            if (!yearMap[count]) yearMap[count] = {};
            yearMap[count][year] = (yearMap[count][year] || 0) + 1;
        });
        return {
            weeklyPeriodsStats: Object.entries(countMap)
                .map(([periods, students]) => ({ periods: Number(periods), students }))
                .sort((a, b) => a.periods - b.periods),
            periodsYearStats: yearMap,
        };
    }, [allClassesData, selectedYears]);

    // subjectCountStats + subjectCountYearStats + subjectYearStats 통합 (단일 순회)
    const subjectStats = useMemo(() => {
        const byStudent: Record<string, { year: string; subjects: Set<string> }> = {};
        const subjectYearSets: Record<string, Record<string, Set<string>>> = {};
        allClassesData.forEach((sub) => {
            sub.sections.forEach((sec) =>
                sec.students.forEach((stu) => {
                    const year = stu.stuId.split("-")[0];
                    if (!selectedYears.includes(year)) return;
                    if (!byStudent[stu.stuId]) byStudent[stu.stuId] = { year, subjects: new Set() };
                    byStudent[stu.stuId].subjects.add(sub.subject);
                    if (!subjectYearSets[sub.subject]) subjectYearSets[sub.subject] = {};
                    if (!subjectYearSets[sub.subject][year]) subjectYearSets[sub.subject][year] = new Set();
                    subjectYearSets[sub.subject][year].add(stu.stuId);
                }),
            );
        });
        const countMap: Record<number, number> = {};
        const yearMap: Record<number, Record<string, number>> = {};
        Object.values(byStudent).forEach(({ year, subjects }) => {
            const count = subjects.size;
            countMap[count] = (countMap[count] || 0) + 1;
            if (!yearMap[count]) yearMap[count] = {};
            yearMap[count][year] = (yearMap[count][year] || 0) + 1;
        });
        const subjectYearStats: Record<string, Record<string, number>> = {};
        Object.entries(subjectYearSets).forEach(([sub, years]) => {
            subjectYearStats[sub] = {};
            Object.entries(years).forEach(([year, ids]) => {
                subjectYearStats[sub][year] = ids.size;
            });
        });
        return {
            subjectCountStats: Object.entries(countMap)
                .map(([subjectCount, students]) => ({ subjectCount: Number(subjectCount), students }))
                .sort((a, b) => a.subjectCount - b.subjectCount),
            subjectCountYearStats: yearMap,
            subjectYearStats,
        };
    }, [allClassesData, selectedYears]);

    const conflictCount = useMemo(() => {
        if (selectedStudentIds.length < 2) return 0;
        const DAYS_LIST = ["MON", "TUE", "WED", "THU", "FRI"];
        const PERIODS_LIST = Array.from({ length: 11 }, (_, i) => i + 1);
        let count = 0;
        DAYS_LIST.forEach((day) =>
            PERIODS_LIST.forEach((period) => {
                const key = `${day}-${period}`;
                if (!selectedStudentIds.every((id) => !!studentInfoMap[id]?.schedule[key])) return;
                const first = studentInfoMap[selectedStudentIds[0]]?.schedule[key];
                if (!selectedStudentIds.every((id) => studentInfoMap[id]?.schedule[key] === first)) count++;
            }),
        );
        return count;
    }, [selectedStudentIds, studentInfoMap]);

    const teacherLoadDistribution = useMemo(() => {
        const countMap: Record<number, number> = {};
        allTeacherStats.forEach(({ periods }) => {
            countMap[periods] = (countMap[periods] || 0) + 1;
        });
        return Object.entries(countMap)
            .map(([periods, teachers]) => ({ periods: Number(periods), teachers }))
            .sort((a, b) => a.periods - b.periods);
    }, [allTeacherStats]);

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
                <Text as="p" variant="subtitle" tone="primary" pulse>
                    Analyzing Data...
                </Text>
            </div>
        );

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader
                title="Visual Analysis"
                subtitle="Statistics"
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
                    <Card key={i} padding="0" className="p-4 flex flex-col justify-center items-center">
                        <Text variant="overline" className="mb-1">
                            {s.label}
                        </Text>
                        <Text variant="title">
                            {s.value}
                        </Text>
                    </Card>
                ))}
            </div>
            <Accordion
                titleStyle="section"
                title="Timetable Compare"
                icon={Calendar}
                open={openSections.compare}
                onOpenChange={() => toggleSection("compare")}
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="relative">
                            <SectionTitle
                                title="Search & Add Students"
                                icon={Users}
                            />
                            <div className="mt-3" />
                            <Input
                                type="text"
                                placeholder="Name or ID..."
                                value={compareSearch}
                                onChange={(e) =>
                                    setCompareSearch(e.target.value)
                                }
                                onKeyDown={handleSearchKeyDown}
                                shadow
                                className="w-full"
                            />
                            {studentSuggestions.length > 0 && (
                                <Surface
                                    border="line"
                                    shadow="raised"
                                    className="absolute top-full left-0 right-0 z-50 mt-1"
                                >
                                    {studentSuggestions.map(
                                        ([id, data], index) => (
                                            <Pressable
                                                key={id}
                                                onClick={() => {
                                                    setSelectedStudentIds(
                                                        (prev) => [...prev, id],
                                                    );
                                                    setCompareSearch("");
                                                }}
                                                className={`${surfaceClass({
                                                    fill: index === focusedSuggestionIndex ? "well" : "none",
                                                    border: index < studentSuggestions.length - 1 ? "subtle" : "none",
                                                    borderSide: "bottom",
                                                    hoverable: true,
                                                })} w-full text-left p-3 flex items-center`}
                                            >
                                                <StudentBadge
                                                    studentId={id}
                                                    studentName={data.name}
                                                />
                                            </Pressable>
                                        ),
                                    )}
                                </Surface>
                            )}
                        </div>
                        <div className="space-y-3">
                            <SectionTitle
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
                                    <Text as="p" tone="muted">
                                        No selection.
                                    </Text>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="w-full">
                        <div className="flex items-center gap-3">
                            <SectionTitle
                                title="Common Empty Slots"
                                icon={Clock}
                            />
                            {conflictCount > 0 && (
                                <Badge accent="orange" variant="plain" size="sm">
                                    {conflictCount} Conflict{conflictCount > 1 ? "s" : ""}
                                </Badge>
                            )}
                        </div>
                        <div className="mt-3" />
                        <div className="overflow-x-auto">
                            <TimetableGrid
                                flush
                                className="min-w-[280px]"
                                corner="PD"
                                days={COMPARE_DAYS.map((day) => ({ key: day, label: day }))}
                                periods={Array.from({ length: 11 }, (_, i) => i + 1).map((period) => ({
                                    key: String(period),
                                    label: period,
                                }))}
                                renderCell={(day, periodKey) => {
                                    const period = Number(periodKey);
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
                                            ),
                                        isConflict =
                                            selectedStudentIds.length >=
                                                2 &&
                                            !isCommonClass &&
                                            !isFree &&
                                            selectedStudentIds.every(
                                                (id) =>
                                                    !!studentInfoMap[id]
                                                        ?.schedule[key],
                                            );
                                    return (
                                        <Popover
                                            trigger="manual"
                                            block
                                            open={activeCellKey === key}
                                            content={
                                                <div className="min-w-[180px] space-y-1.5">
                                                    <Surface
                                                        fill="none"
                                                        border="subtle"
                                                        borderSide="bottom"
                                                        className="pb-1 mb-2"
                                                    >
                                                        <Text variant="overline" tone="primary">
                                                            {day} Pd{" "}
                                                            {period}
                                                        </Text>
                                                    </Surface>
                                                    {selectedStudentIds.map(
                                                        (id) => (
                                                            <div
                                                                key={id}
                                                                className="flex justify-between gap-4"
                                                            >
                                                                <ToneText
                                                                    variant="micro"
                                                                    tone={getStudentColor(id)}
                                                                >
                                                                    {
                                                                        studentInfoMap[
                                                                            id
                                                                        ]
                                                                            ?.name
                                                                    }
                                                                </ToneText>
                                                                {studentInfoMap[id]?.schedule[key] ? (
                                                                    <Badge size="sm" variant="wash">
                                                                        {studentInfoMap[id]?.schedule[key]}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge size="sm" accent="green" variant="plain">
                                                                        Free
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            }
                                        >
                                            <SlotCell
                                                state={
                                                    isConflict
                                                        ? "conflict"
                                                        : isCommonClass
                                                          ? "common"
                                                          : isFree
                                                            ? "free"
                                                            : "empty"
                                                }
                                                onToggle={() =>
                                                    setActiveCellKey(
                                                        activeCellKey ===
                                                            key
                                                            ? null
                                                            : key,
                                                    )
                                                }
                                                label={`${day} ${period}교시`}
                                                className={`h-10 w-full ${activeCellKey === key ? "relative z-10 outline outline-2 -outline-offset-2 outline-[var(--fk-line-base)]" : ""}`}
                                            />
                                        </Popover>
                                    );
                                }}
                            />
                        </div>
                    </div>
                </div>
            </Accordion>
            <Accordion
                titleStyle="section"
                title="Subjects by Enrollment"
                icon={BookOpen}
                open={openSections.subjects}
                onOpenChange={() => toggleSection("subjects")}
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
                                    onLabelClick={() => handleSearch(getKoreanName(s.name))}
                                tooltipContent={
                                    subjectStats.subjectYearStats[s.name]
                                        ? <YearBreakdown yearData={subjectStats.subjectYearStats[s.name]} />
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
            </Accordion>
            <Accordion
                titleStyle="section"
                title="Weekly Periods Distribution"
                icon={Clock}
                open={openSections.periodsDistribution}
                onOpenChange={() => toggleSection("periodsDistribution")}
            >
                <div className="space-y-3">
                    {periodStats.weeklyPeriodsStats.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.periods} Periods`}
                            value={s.students}
                            maxValue={Math.max(1, ...periodStats.weeklyPeriodsStats.map((r) => r.students))}
                            caption={`${s.students} Students`}
                            onLabelClick={() => navigate(`/students?q=periods:${s.periods}`)}
                            tooltipContent={
                                periodStats.periodsYearStats[s.periods]
                                    ? <YearBreakdown yearData={periodStats.periodsYearStats[s.periods]} />
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </Accordion>
            <Accordion
                titleStyle="section"
                title="Subject Count Distribution"
                icon={BarChart3}
                open={openSections.subjectCountDistribution}
                onOpenChange={() => toggleSection("subjectCountDistribution")}
            >
                <div className="space-y-3">
                    {subjectStats.subjectCountStats.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.subjectCount} Subjects`}
                            value={s.students}
                            maxValue={Math.max(1, ...subjectStats.subjectCountStats.map((r) => r.students))}
                            caption={`${s.students} Students`}
                            onLabelClick={() => navigate(`/students?q=subcount:${s.subjectCount}`)}
                            tooltipContent={
                                subjectStats.subjectCountYearStats[s.subjectCount]
                                    ? <YearBreakdown yearData={subjectStats.subjectCountYearStats[s.subjectCount]} />
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </Accordion>
            <Accordion
                titleStyle="section"
                title="Teacher Load Distribution"
                icon={Users}
                open={openSections.teacherLoadDistribution}
                onOpenChange={() => toggleSection("teacherLoadDistribution")}
            >
                <div className="space-y-3">
                    {teacherLoadDistribution.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.periods} Periods`}
                            value={s.teachers}
                            maxValue={Math.max(1, ...teacherLoadDistribution.map((r) => r.teachers))}
                            caption={`${s.teachers} Teacher${s.teachers > 1 ? "s" : ""}`}
                        />
                    ))}
                </div>
            </Accordion>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 items-start">
                <Accordion
                    titleStyle="section"
                    title="Teaching Load"
                    icon={Clock}
                    open={openSections.teachers}
                    onOpenChange={() => toggleSection("teachers")}
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
                </Accordion>
                <Accordion
                    titleStyle="section"
                    title="Classroom Utilization"
                    icon={MapPin}
                    open={openSections.rooms}
                    onOpenChange={() => toggleSection("rooms")}
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
                </Accordion>
            </div>
        </div>
    );
};

export default AnalysisPage;

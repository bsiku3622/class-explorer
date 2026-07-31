import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    BarChart3,
    Users,
    MapPin,
    Clock,
    Plus,
    Minus,
    BookOpen,
} from "lucide-react";
import { Spinner } from "@heroui/react";
import type {
    EnrollmentStats,
    Histogram,
    SubjectData,
    Term,
} from "../types";
import { fetchEnrollmentStats } from "../lib/benchApi";
import { getKoreanName } from "../lib/utils";
import RetroButton from "../components/atoms/RetroButton";
import RetroCard from "../components/atoms/RetroCard";
import FilterSection from "../components/FilterSection";
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
    /** 수강 분포를 서버에서 받을 때 씁니다 */
    term: Term | null;
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
    term,
}) => {
    const navigate = useNavigate();
    const [selectedYears, setSelectedYears] = useState<string[]>(() => Object.keys(studentCounts));
    const [enrollmentStats, setEnrollmentStats] = useState<EnrollmentStats | null>(
        null,
    );

    useEffect(() => {
        const years = Object.keys(studentCounts);
        if (years.length > 0 && selectedYears.length === 0) setSelectedYears(years);
    }, [studentCounts]);

    // 수강 분포는 명단이 있어야 셀 수 있어서 서버가 세어 줍니다
    useEffect(() => {
        let cancelled = false;
        fetchEnrollmentStats(term)
            .then((result) => {
                if (!cancelled) setEnrollmentStats(result);
            })
            .catch(() => {
                if (!cancelled) setEnrollmentStats(null);
            });
        return () => {
            cancelled = true;
        };
    }, [term]);

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
    const toggleSection = (section: string) =>
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    const toggleExpand = (listId: string) =>
        setExpandLists((prev) => ({ ...prev, [listId]: !prev[listId] }));

    // 예전에는 명단을 직접 세면서 학년까지 걸렀습니다. 명단이 없으니 서버가 세어 준
    // 과목 전체 인원을 씁니다 — 대신 학년 필터가 이 목록에는 걸리지 않습니다.
    const allSubjectStats = useMemo(() => {
        return allClassesData
            .map((sub) => ({
                name: sub.subject,
                studentCount: sub.subject_student_count,
            }))
            .filter((s) => s.studentCount > 0)
            .sort((a, b) => b.studentCount - a.studentCount);
    }, [allClassesData]);
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

    // 예전에는 명단을 프론트가 통째로 들고 직접 셌습니다. 명단이 없으니 세는 일을
    // 서버가 대신합니다 (`GET /stats/enrollment`) — 분포만 오고 누가 어디 있는지는
    // 오지 않습니다. 학년별로 쪼갠 값은 전교 집계라 그대로 받습니다.
    //
    // **과목별 학번 분포는 사라졌습니다.** 1학년 필수 과목에서 혼자 다른 학번이면
    // 그게 곧 재수강 표시라, 이름이 없어도 그 사실만으로 드러납니다.
    const periodStats = useMemo(() => {
        const histogram: Histogram | undefined = enrollmentStats?.weekly_periods;
        return {
            weeklyPeriodsStats: Object.entries(histogram?.total ?? {})
                .map(([periods, students]) => ({
                    periods: Number(periods),
                    students,
                }))
                .sort((a, b) => a.periods - b.periods),
            periodsYearStats: histogram?.by_year ?? {},
        };
    }, [enrollmentStats]);

    const subjectStats = useMemo(() => {
        const histogram: Histogram | undefined = enrollmentStats?.subject_count;
        return {
            subjectCountStats: Object.entries(histogram?.total ?? {})
                .map(([subjectCount, students]) => ({
                    subjectCount: Number(subjectCount),
                    students,
                }))
                .sort((a, b) => a.subjectCount - b.subjectCount),
            subjectCountYearStats: histogram?.by_year ?? {},
        };
    }, [enrollmentStats]);

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
                <p className="font-black uppercase animate-pulse">
                    Analyzing Data...
                </p>
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
            {/* "Timetable Compare" 가 여기 있었습니다 — 학생 여럿을 골라 시간표를
                겹쳐 보고 공강을 찾는 기능이었는데, 명단도 다중 조회도 없는 ksa-bench 에서는
                성립하지 않아 뺐습니다. 되살린다면 서로 동의한 사이에서만 되는 형태여야 합니다 */}
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
                                onLabelClick={() => handleSearch(getKoreanName(s.name))}
                                /* 과목별 학번 분포는 뺐습니다 — 1학년 필수 과목에서
                                   혼자 다른 학번이면 그게 곧 재수강 표시입니다 */
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
                    {periodStats.weeklyPeriodsStats.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.periods} Periods`}
                            value={s.students}
                            maxValue={Math.max(1, ...periodStats.weeklyPeriodsStats.map((r) => r.students))}
                            caption={`${s.students} Students`}
                            captionClassName="text-retro-primary"
                            onLabelClick={() => navigate(`/students?q=periods:${s.periods}`)}
                            tooltipContent={
                                periodStats.periodsYearStats[s.periods]
                                    ? <YearBreakdown yearData={periodStats.periodsYearStats[s.periods]} />
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
                    {subjectStats.subjectCountStats.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.subjectCount} Subjects`}
                            value={s.students}
                            maxValue={Math.max(1, ...subjectStats.subjectCountStats.map((r) => r.students))}
                            caption={`${s.students} Students`}
                            captionClassName="text-retro-primary"
                            onLabelClick={() => navigate(`/students?q=subcount:${s.subjectCount}`)}
                            tooltipContent={
                                subjectStats.subjectCountYearStats[s.subjectCount]
                                    ? <YearBreakdown yearData={subjectStats.subjectCountYearStats[s.subjectCount]} />
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </AccordionSection>
            <AccordionSection
                title="Teacher Load Distribution"
                icon={Users}
                isOpen={openSections.teacherLoadDistribution}
                onToggle={() => toggleSection("teacherLoadDistribution")}
            >
                <div className="space-y-3">
                    {teacherLoadDistribution.map((s, i) => (
                        <BarChartRow
                            key={i}
                            label={`${s.periods} Periods`}
                            value={s.teachers}
                            maxValue={Math.max(1, ...teacherLoadDistribution.map((r) => r.teachers))}
                            caption={`${s.teachers} Teacher${s.teachers > 1 ? "s" : ""}`}
                            captionClassName="text-retro-primary"
                        />
                    ))}
                </div>
            </AccordionSection>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 items-start">
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

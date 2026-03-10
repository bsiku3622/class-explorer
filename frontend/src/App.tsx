import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Spinner } from "@heroui/react";
import type { SubjectData, Stats, SearchResultStats } from "./types";
import SubjectAccordionItem from "./components/SubjectAccordionItem";
import { searchInClient } from "./lib/searchEngine";
import { useModifierKey } from "./hooks/useModifierKey";
import Navigation from "./components/Navigation";
import FilterSection from "./components/FilterSection";
import StatsCards from "./components/StatsCards";
import SearchResultDisplay from "./components/SearchResultDisplay";

const App: React.FC = () => {
    const [data, setData] = useState<SubjectData[]>([]);
    const [allClassesData, setAllClassesData] = useState<SubjectData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResultStats | null>(null);
    const [searchMode, setSearchMode] = useState<"general" | "student" | "teacher">("general");
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    const isModifierPressed = useModifierKey();

    const hasStudentInSearch = useMemo(() => {
        if (!searchResult) return false;
        return searchResult.entities.some((e) => e.type === "student");
    }, [searchResult]);

    const studentSubjectMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        allClassesData.forEach((item) => {
            item.sections.forEach((section) => {
                section.students.forEach((student) => {
                    if (!map[student.stuId]) map[student.stuId] = [];
                    if (!map[student.stuId].includes(item.subject))
                        map[student.stuId].push(item.subject);
                });
            });
        });
        return map;
    }, [allClassesData]);

    const teacherSubjectMap = useMemo(() => {
        const map: Record<string, Record<string, string[]>> = {};
        allClassesData.forEach((item) => {
            item.sections.forEach((section) => {
                if (!map[section.teacher]) map[section.teacher] = {};
                if (!map[section.teacher][item.subject])
                    map[section.teacher][item.subject] = [];
                if (!map[section.teacher][item.subject].includes(section.section)) {
                    map[section.teacher][item.subject].push(section.section);
                }
            });
        });
        return map;
    }, [allClassesData]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const response = await axios.get("/api/");
            const { student_counts, data } = response.data;
            setStudentCounts(student_counts);
            setSelectedYears(Object.keys(student_counts));
            setAllClassesData(data);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = useCallback(() => {
        if (allClassesData.length === 0) return;

        if (selectedYears.length === 0) {
            setData([]);
            setStats(null);
            setSearchResult(null);
            setSearchMode("general");
            return;
        }

        if (searchTerm.trim()) {
            const result = searchInClient(allClassesData, searchTerm, selectedYears);

            const filteredByYear = result.data
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter(
                        (sec: SubjectData["sections"][0]) =>
                            result.mode !== "general" ||
                            sec.students.some((s) =>
                                selectedYears.includes(s.stuId.split("-")[0]),
                            ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);

            setData(filteredByYear);
            setSearchMode(result.mode);
            setSearchResult({
                keyword: result.stats.keyword || searchTerm,
                prefix: result.mode !== "general" ? result.mode : "",
                entities: result.entities,
                total_subjects: result.stats.total_subjects,
                total_sections: result.stats.total_sections,
                warning: result.warning,
            });
            setStats(null);
        } else {
            setSearchMode("general");
            const filteredData = allClassesData
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter((sec: SubjectData["sections"][0]) =>
                        sec.students.some((s) => selectedYears.includes(s.stuId.split("-")[0])),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);

            setData(filteredData);

            const totalSecs = filteredData.reduce((acc, sub) => acc + sub.sections.length, 0);
            const activeStus = new Set(
                filteredData.flatMap((sub) =>
                    sub.sections.flatMap((sec) => sec.students.map((s) => s.stuId)),
                ),
            );

            setStats({
                total_subjects: filteredData.length,
                total_sections: totalSecs,
                total_active_students: activeStus.size,
            });
            setSearchResult(null);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [searchTerm, selectedYears, allClassesData]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    const handleSearchToggle = (value: string, isTeacher: boolean = false) => {
        const finalValue = isTeacher
            ? `teacher:${value}`
            : value.includes("-")
              ? `student:${value}`
              : value;
        setSearchTerm((prev) => (prev === finalValue ? "" : finalValue));
    };

    const handleSearchSelect = (value: string, isTeacher: boolean = false) => {
        const finalValue = isTeacher
            ? `teacher:${value}`
            : isTeacher === false && value.includes("-")
              ? `student:${value}`
              : value;
        setSearchTerm(finalValue);
    };

    const toggleSubject = (subjectName: string) => {
        setExpandedSubjects((prev) =>
            prev.includes(subjectName)
                ? prev.filter((s) => s !== subjectName)
                : [...prev, subjectName],
        );
    };

    const isLogicalSearch = useMemo(() => {
        return (
            searchTerm.includes("+") ||
            searchTerm.includes("&") ||
            searchTerm.includes("/") ||
            searchTerm.includes("(")
        );
    }, [searchTerm]);

    const isConsolidatedView = useMemo(() => {
        return searchMode !== "general" || isLogicalSearch;
    }, [searchMode, isLogicalSearch]);

    return (
        <div className="min-h-screen bg-retro-bg text-retro-fg pb-20 font-sans">
            <Navigation searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

            <main className="max-w-6xl mx-auto px-6 pt-32">
                <FilterSection
                    studentCounts={studentCounts}
                    selectedYears={selectedYears}
                    setSelectedYears={setSelectedYears}
                />

                {searchResult && (
                    <div className="mb-12 space-y-8">
                        <SearchResultDisplay
                            searchResult={searchResult}
                            searchMode={searchMode}
                            isLogicalSearch={isLogicalSearch}
                            isConsolidatedView={isConsolidatedView}
                            isModifierPressed={isModifierPressed}
                            hoveredEntityId={hoveredEntityId}
                            setHoveredEntityId={setHoveredEntityId}
                            handleSearchToggle={handleSearchToggle}
                            handleSearchSelect={handleSearchSelect}
                        />
                    </div>
                )}

                {stats && <StatsCards stats={stats} />}

                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-start pt-40 gap-4 bg-retro-bg/40 backdrop-blur-[2px]">
                            <Spinner color="primary" size="lg" />
                            <p className="text-lg font-black italic uppercase animate-pulse">
                                Scanning Grid...
                            </p>
                        </div>
                    )}

                    <div
                        className={`space-y-0 transition-opacity duration-300 ${loading ? "opacity-30 pointer-events-none" : "opacity-100"}`}
                    >
                        {data.length > 0 ? (
                            data.map((subject: SubjectData) => (
                                <SubjectAccordionItem
                                    key={subject.subject}
                                    subject={subject}
                                    searchTerm={searchTerm}
                                    handleSearchToggle={handleSearchToggle}
                                    studentSubjectMap={studentSubjectMap}
                                    teacherSubjectMap={teacherSubjectMap}
                                    isModifierPressed={isModifierPressed}
                                    hasStudentInSearch={hasStudentInSearch}
                                    selectedYears={selectedYears}
                                    searchMode={searchMode}
                                    isOpen={expandedSubjects.includes(subject.subject)}
                                    onToggle={() => toggleSubject(subject.subject)}
                                    isSingleStudentSearch={
                                        searchMode === "student" &&
                                        searchResult?.entities.length === 1
                                    }
                                />
                            ))
                        ) : (
                            !loading && (
                                <div className="py-28 flex flex-col items-center justify-center text-black/20">
                                    <p className="text-2xl font-black uppercase italic tracking-widest">
                                        No Data Found
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;

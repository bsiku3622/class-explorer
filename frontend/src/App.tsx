import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
    useLocation,
    useNavigate,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import type { SubjectData, Stats, SearchResultStats } from "./types";
import { searchInClient } from "./lib/searchEngine";
import { useModifierKey } from "./hooks/useModifierKey";
import Navigation from "./components/Navigation";
import Sidebar from "./components/Sidebar";

// Pages
import SearchPage from "./pages/SearchPage";
import RoomsPage from "./pages/RoomsPage";
import AnalysisPage from "./pages/AnalysisPage";
import StudentsPage from "./pages/StudentsPage";
import TeachersPage from "./pages/TeachersPage";

const App: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const initialSearch = useMemo(
        () =>
            location.pathname === "/"
                ? new URLSearchParams(location.search).get("q") || ""
                : "",
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const [allClassesData, setAllClassesData] = useState<SubjectData[]>([]);
    const [displayData, setDisplayData] = useState<SubjectData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>(
        {},
    );
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResultStats | null>(
        null,
    );
    const [searchMode, setSearchMode] = useState<
        "general" | "student" | "teacher" | "room"
    >("general");
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    const isModifierPressed = useModifierKey();

    useEffect(() => {
        if (location.pathname === "/") {
            const q = new URLSearchParams(location.search).get("q") || "";
            if (q !== searchInput) {
                setSearchInput(q);
                setSearchTerm(q);
            }
        }
    }, [location.pathname]);

    const hasStudentInSearch = useMemo(() => {
        if (!searchResult) return false;
        return searchResult.entities.some((e) => e.type === "student");
    }, [searchResult]);

    const isLogicalSearch = useMemo(
        () =>
            searchTerm.includes("+") ||
            searchTerm.includes("&") ||
            searchTerm.includes("/") ||
            searchTerm.includes("("),
        [searchTerm],
    );

    const isConsolidatedView = useMemo(
        () => searchMode !== "general" || isLogicalSearch,
        [searchMode, isLogicalSearch],
    );

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
                if (
                    !map[section.teacher][item.subject].includes(
                        section.section,
                    )
                ) {
                    map[section.teacher][item.subject].push(section.section);
                }
            });
        });
        return map;
    }, [allClassesData]);

    const fetchInitialData = async (force: boolean = false) => {
        try {
            setLoading(true);
            const cached =
                !force && localStorage.getItem("ksa_class_finder_cache");
            if (cached) {
                const { timestamp, student_counts, data } = JSON.parse(cached);
                const CACHE_EXPIRY = 60 * 60 * 1000;
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    setStudentCounts(student_counts);
                    setSelectedYears(Object.keys(student_counts));
                    setAllClassesData(data);
                    setLastUpdated(timestamp);
                    setLoading(false);
                    return;
                }
            }
            const response = await axios.get("/api/");
            const { student_counts, data } = response.data;
            const now = Date.now();
            localStorage.setItem(
                "ksa_class_finder_cache",
                JSON.stringify({ timestamp: now, student_counts, data }),
            );
            setStudentCounts(student_counts);
            setSelectedYears(Object.keys(student_counts));
            setAllClassesData(data);
            setLastUpdated(now);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = useCallback(() => {
        if (allClassesData.length === 0 || location.pathname !== "/") return;
        if (selectedYears.length === 0) {
            setDisplayData([]);
            setStats(null);
            setSearchResult(null);
            setSearchMode("general");
            return;
        }
        if (searchTerm.trim()) {
            const result = searchInClient(
                allClassesData,
                searchTerm,
                selectedYears,
            );
            const filteredByYear = result.data
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter((sec: any) =>
                        sec.students.some((s: any) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);
            setDisplayData(filteredByYear);
            setSearchMode(result.mode);
            setSearchResult({
                keyword: result.stats.keyword || searchTerm,
                prefix: result.mode !== "general" ? result.mode : "",
                entities: result.entities,
                total_subjects: result.stats.total_subjects,
                total_sections: result.stats.total_sections,
                total_matched_students: result.stats.total_matched_students,
                warning: result.warning,
            });
            setStats(null);
        } else {
            setSearchMode("general");
            const filteredData = allClassesData
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter((sec: any) =>
                        sec.students.some((s: any) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);
            setDisplayData(filteredData);
            const totalSecs = filteredData.reduce(
                (acc, sub) => acc + sub.sections.length,
                0,
            );
            const activeStus = new Set(
                filteredData.flatMap((sub) =>
                    sub.sections.flatMap((sec) =>
                        sec.students.map((s: any) => s.stuId),
                    ),
                ),
            );
            setStats({
                total_subjects: filteredData.length,
                total_sections: totalSecs,
                total_active_students: activeStus.size,
            });
            setSearchResult(null);
        }
    }, [searchTerm, selectedYears, allClassesData, location.pathname]);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    useEffect(() => {
        if (location.pathname !== "/") return;
        const handler = setTimeout(() => {
            const currentParams = new URLSearchParams(location.search);
            if (searchTerm !== currentParams.get("q")) {
                if (searchTerm) currentParams.set("q", searchTerm);
                else currentParams.delete("q");
                const qs = currentParams.toString();
                navigate(qs ? `/?${qs}` : "/", { replace: true });
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, location.pathname, navigate]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchTerm(searchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchInput]);

    const buildSearchValue = (
        value: string,
        isTeacher: boolean,
        isRoom: boolean,
    ): string => {
        if (isRoom) return `room:${value}`;
        if (isTeacher) return `teacher:${value}`;
        if (value.includes("-")) return `student:${value}`;
        return value;
    };

    const handleSearchToggle = (
        value: string,
        isTeacher: boolean = false,
        isRoom: boolean = false,
    ) => {
        const finalValue = buildSearchValue(value, isTeacher, isRoom);
        const newValue = searchTerm === finalValue ? "" : finalValue;
        setSearchInput(newValue);
        setSearchTerm(newValue);
        if (location.pathname !== "/")
            navigate(newValue ? `/?q=${encodeURIComponent(newValue)}` : "/");
    };

    const handleSearchSelect = (
        value: string,
        isTeacher: boolean = false,
        isRoom: boolean = false,
    ) => {
        const finalValue = buildSearchValue(value, isTeacher, isRoom);
        setSearchInput(finalValue);
        setSearchTerm(finalValue);
        if (location.pathname !== "/")
            navigate(`/?q=${encodeURIComponent(finalValue)}`);
    };

    const toggleSubject = (name: string) => {
        setExpandedSubjects((prev) =>
            prev.includes(name)
                ? prev.filter((s) => s !== name)
                : [...prev, name],
        );
    };

    return (
        <div className="min-h-screen bg-retro-bg text-retro-fg font-sans">
            <Navigation
                onLogoClick={() => {
                    setSearchInput("");
                    navigate("/");
                }}
            />
            <div className="flex pt-20">
                <Sidebar
                    activePage={
                        location.pathname === "/"
                            ? "home"
                            : location.pathname.slice(1)
                    }
                    setActivePage={(id) =>
                        navigate(id === "home" ? "/" : `/${id}`)
                    }
                />
                <main className="flex-1 p-6 md:p-10 transition-all duration-300 md:ml-64 min-w-0">
                    <div className="max-w-6xl mx-auto">
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <SearchPage
                                        searchInput={searchInput}
                                        setSearchInput={setSearchInput}
                                        searchTerm={searchTerm}
                                        studentCounts={studentCounts}
                                        selectedYears={selectedYears}
                                        setSelectedYears={setSelectedYears}
                                        lastUpdated={lastUpdated}
                                        fetchInitialData={fetchInitialData}
                                        searchResult={searchResult}
                                        searchMode={searchMode}
                                        isLogicalSearch={isLogicalSearch}
                                        isConsolidatedView={isConsolidatedView}
                                        isModifierPressed={isModifierPressed}
                                        hoveredEntityId={hoveredEntityId}
                                        setHoveredEntityId={setHoveredEntityId}
                                        handleSearchToggle={handleSearchToggle}
                                        handleSearchSelect={handleSearchSelect}
                                        stats={stats}
                                        loading={loading}
                                        displayData={displayData}
                                        studentSubjectMap={studentSubjectMap}
                                        teacherSubjectMap={teacherSubjectMap}
                                        hasStudentInSearch={hasStudentInSearch}
                                        expandedSubjects={expandedSubjects}
                                        toggleSubject={toggleSubject}
                                    />
                                }
                            />
                            <Route
                                path="/emptyroomfinder"
                                element={
                                    <RoomsPage
                                        allClassesData={allClassesData}
                                    />
                                }
                            />
                            <Route
                                path="/analysis"
                                element={
                                    <AnalysisPage
                                        allClassesData={allClassesData}
                                        studentCounts={studentCounts}
                                        lastUpdated={lastUpdated}
                                        fetchInitialData={fetchInitialData}
                                        handleSearch={handleSearchToggle}
                                    />
                                }
                            />
                            <Route
                                path="/students"
                                element={
                                    <StudentsPage
                                        allClassesData={allClassesData}
                                        studentCounts={studentCounts}
                                        lastUpdated={lastUpdated}
                                        fetchInitialData={fetchInitialData}
                                        handleSearch={handleSearchSelect}
                                    />
                                }
                            />
                            <Route
                                path="/teachers"
                                element={
                                    <TeachersPage
                                        allClassesData={allClassesData}
                                        handleSearch={handleSearchSelect}
                                    />
                                }
                            />
                            <Route
                                path="*"
                                element={<Navigate to="/" replace />}
                            />
                        </Routes>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    Input,
    Card,
    CardBody,
    Chip,
    Spinner,
    Tooltip,
} from "@heroui/react";
import {
    Search,
    User,
    BookOpen,
    Filter,
    HelpCircle,
    X,
    Users,
} from "lucide-react";
import { getStudentColor } from "./lib/utils";
import type { SubjectData, Stats, SearchResultStats } from "./types";
import { tooltipMotionProps } from "./constants/motion";
import SubjectAccordionItem from "./components/SubjectAccordionItem";
import { searchInClient } from "./lib/searchEngine";

const App: React.FC = () => {
    const [data, setData] = useState<SubjectData[]>([]);
    const [allClassesData, setAllClassesData] = useState<SubjectData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [_, setAllStats] = useState<Stats | null>(null);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>(
        {},
    );
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [isModifierPressed, setIsModifierPressed] = useState(false);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResultStats | null>(
        null,
    );
    const [searchMode, setSearchMode] = useState<
        "general" | "student" | "teacher"
    >("general");
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    const hasStudentInSearch = useMemo(() => {
        if (!searchResult) return false;
        return searchResult.entities.some((e) => e.type === "student");
    }, [searchResult]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) setIsModifierPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.metaKey && !e.ctrlKey) setIsModifierPressed(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

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

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        handleSearch();
    }, [searchTerm, selectedYears, allClassesData]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const response = await axios.get("/api/");
            const { stats, student_counts, data } = response.data;

            setStudentCounts(student_counts);
            setSelectedYears(Object.keys(student_counts));
            setAllClassesData(data);
            setAllStats(stats);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (allClassesData.length === 0) return;

        if (selectedYears.length === 0) {
            setData([]);
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

            // 학번 필터 적용 (최종 표시 데이터)
            const filteredByYear = result.data
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter(
                        (sec: SubjectData["sections"][0]) =>
                            result.mode !== "general" || // 인물 검색 모드일 때는 해당 인물 포함된 분반을 보여줌
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
            });
            setStats(null);
        } else {
            setSearchMode("general");
            // 학번 필터만 적용된 전체 데이터
            const filteredData = allClassesData
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter(
                        (sec: SubjectData["sections"][0]) =>
                            sec.students.some((s) =>
                                selectedYears.includes(s.stuId.split("-")[0]),
                            ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);

            setData(filteredData);

            // 통계 계산
            const totalSecs = filteredData.reduce(
                (acc, sub) => acc + sub.sections.length,
                0,
            );
            const activeStus = new Set(
                filteredData.flatMap((sub) =>
                    sub.sections.flatMap((sec) =>
                        sec.students.map((s) => s.stuId),
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

        // 검색 결과 변경 시 상단으로 부드럽게 이동
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

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
            <Navbar
                isBordered={false}
                className="fixed top-0 left-0 right-0 bg-retro-secondary border-b border-black h-20 shadow-[0_4px_0_0_rgba(0,0,0,0.2)] z-1000"
                maxWidth="full"
            >
                <NavbarBrand>
                    <p className="text-2xl font-black italic tracking-tighter text-white uppercase transform -skew-x-6">
                        Class Explorer
                    </p>
                </NavbarBrand>
                <NavbarContent
                    className="hidden sm:flex gap-4 h-12"
                    justify="end"
                >
                    <div className="relative h-full">
                        <Input
                            labelPlacement="outside"
                            classNames={{
                                base: "w-96 h-full",
                                input: "h-full text-base font-semibold px-2 pr-10 flex-1 h-full focus:outline-none",
                                inputWrapper:
                                    "h-full bg-white border-2 border-black rounded-none data-[hover=true]:border-black group-data-[focus=true]:border-black px-4 flex items-center outline-none ring-0 relative",
                                innerWrapper:
                                    "h-full flex flex-row items-center gap-2 w-full h-full",
                            }}
                            placeholder="Search by Something..."
                            startContent={
                                <Search
                                    className="text-black/60 shrink-0"
                                    size={18}
                                />
                            }
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="text-black/40 hover:text-black/70 transition-colors p-1"
                                >
                                    <X size={18} strokeWidth={2} />
                                </button>
                            )}
                        </div>
                    </div>

                    <Tooltip
                        placement="bottom-end"
                        className="max-w-100"
                        content={
                            <div className="p-6 space-y-6 min-w-96">
                                <p className="font-black text-lg border-b border-black pb-2 mb-4 uppercase italic">
                                    Search Guide
                                </p>
                                <div className="space-y-5">
                                    <div>
                                        <p className="text-xs font-black text-retro-secondary uppercase mb-1.5 tracking-widest">
                                            Basic & Logic Search
                                        </p>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-2">
                                                <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                    키워드 검색
                                                </span>
                                                <p className="text-sm font-bold">
                                                    이름, 학번, 과목, 선생님
                                                    성함
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                    논리 연산
                                                </span>
                                                <div>
                                                    <p className="text-sm font-bold">
                                                        대상간의 공통/합집합
                                                        분반을 리스트업
                                                    </p>
                                                    <p className="text-sm font-bold mt-1.5">
                                                        <span className="text-retro-primary font-black">
                                                            &
                                                        </span>{" "}
                                                        (같은 과목),{" "}
                                                        <span className="text-retro-primary font-black">
                                                            &&
                                                        </span>{" "}
                                                        (같은 분반)
                                                    </p>
                                                    <p className="text-sm font-bold">
                                                        <span className="text-retro-primary font-black">
                                                            +
                                                        </span>{" "}
                                                        (OR),{" "}
                                                        <span className="text-retro-primary font-black">
                                                            ( )
                                                        </span>{" "}
                                                        (괄호) 지원
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                    과목 / 인물
                                                </span>
                                                <p className="text-sm font-bold leading-snug">
                                                    특정 과목 내에서 특정 인물을
                                                    검색
                                                    <br />
                                                    <span className="text-xs text-black/40 italic">
                                                        예: 미적분학 / 유지원
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-retro-secondary uppercase mb-1.5 tracking-widest">
                                            Advanced Search
                                        </p>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-2">
                                                <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                    student:학번
                                                </span>
                                                <p className="text-sm font-bold">
                                                    학생 집중 검색 (학번만 가능)
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="bg-black text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                    teacher:성함
                                                </span>
                                                <p className="text-sm font-bold">
                                                    선생님 집중 검색
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-5 border-t border-black/10">
                                        <div className="flex items-start gap-2">
                                            <span className="bg-retro-primary text-white px-1.5 py-0.5 text-[11px] font-black shrink-0">
                                                TIP
                                            </span>
                                            <p className="text-sm font-bold leading-snug">
                                                <span className="text-retro-primary font-black">
                                                    Ctrl (또는 Cmd)
                                                </span>{" "}
                                                키를 누른 상태로 이름 위에
                                                마우스를 가져가면 상세 정보를 볼
                                                수 있습니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        }
                        motionProps={tooltipMotionProps}
                        classNames={{
                            content:
                                "rounded-none border border-black bg-white shadow-[4px_4px_0_0_rgba(120,40,200,0.3)]",
                        }}
                    >
                        <div className="w-12 h-12 flex items-center justify-center border-2 border-black bg-white text-black hover:bg-retro-accent1 cursor-help transition-colors active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex-none">
                            <HelpCircle size={24} strokeWidth={2.5} />
                        </div>
                    </Tooltip>
                </NavbarContent>
            </Navbar>

            <main className="max-w-6xl mx-auto px-6 pt-32">
                <div className="mb-10 bg-white border-2 border-black p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-3 mb-6">
                        <Filter size={20} className="text-retro-secondary" />
                        <span className="text-sm font-black uppercase tracking-widest italic text-black/40">
                            Filter by Student Cohort
                        </span>
                        {selectedYears.length <
                            Object.keys(studentCounts).length && (
                            <button
                                onClick={() =>
                                    setSelectedYears(Object.keys(studentCounts))
                                }
                                className="ml-auto text-sm font-black uppercase underline hover:text-retro-primary transition-colors tracking-tight"
                            >
                                Reset All Filters
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4">
                        {Object.entries(studentCounts).map(([year, count]) => {
                            const isSelected = selectedYears.includes(year);
                            const color = getStudentColor(year);

                            return (
                                <label
                                    key={year}
                                    className={`group relative flex items-center gap-3 px-4 py-2 border-2 cursor-pointer transition-all duration-200 ${
                                        isSelected
                                            ? "border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] translate-x-0.5 translate-y-0.5"
                                            : "border-black/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:border-black/30"
                                    }`}
                                    style={{
                                        backgroundColor: isSelected
                                            ? `${color}20`
                                            : "transparent",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isSelected}
                                        onChange={() => {
                                            if (isSelected) {
                                                setSelectedYears(
                                                    selectedYears.filter(
                                                        (y) => y !== year,
                                                    ),
                                                );
                                            } else {
                                                setSelectedYears([
                                                    ...selectedYears,
                                                    year,
                                                ]);
                                            }
                                        }}
                                    />
                                    <div
                                        className="w-4 h-4 border-2 border-black transition-colors"
                                        style={{
                                            backgroundColor: isSelected
                                                ? color
                                                : "transparent",
                                        }}
                                    />
                                    <span
                                        className={`text-sm font-black uppercase ${isSelected ? "text-black" : "text-black/40"}`}
                                    >
                                        {year}{" "}
                                        <span className="ml-1 text-[10px] opacity-60">
                                            ({count})
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {searchResult && (
                    <div className="mb-12 space-y-8">
                        {isConsolidatedView ? (
                            /* Consolidated Search Result (Student, Teacher, Logical) */
                            <div className="bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-black">
                                {/* Left Side: Primary Entity or Logical Query */}
                                <div
                                    className={`p-8 md:w-1/2 flex flex-col justify-center relative ${
                                        searchMode === "student"
                                            ? ""
                                            : searchMode === "teacher"
                                              ? "bg-retro-secondary/5"
                                              : "bg-retro-accent1/5"
                                    }`}
                                    style={
                                        searchMode === "student" &&
                                        searchResult.entities[0]
                                            ? {
                                                  backgroundColor: `${getStudentColor(searchResult.entities[0].id)}15`,
                                              }
                                            : {}
                                    }
                                >
                                    <div className="absolute top-0 left-0 px-6 py-1.5 bg-black text-white text-xs font-black italic tracking-widest uppercase">
                                        {searchMode === "student"
                                            ? "Student Profile"
                                            : searchMode === "teacher"
                                              ? "Teacher Profile"
                                              : "Logical Search"}
                                    </div>

                                    <div className="mt-4">
                                        {searchMode !== "general" &&
                                        searchResult.entities[0] ? (
                                            <>
                                                <p className="text-xl font-black text-black/40 uppercase tracking-tighter mb-2">
                                                    &nbsp;&nbsp;
                                                    {searchMode === "student"
                                                        ? searchResult
                                                              .entities[0].id
                                                        : "Position: Faculty"}
                                                </p>
                                                <h2
                                                    className="text-6xl font-black italic tracking-tighter"
                                                    style={{
                                                        color:
                                                            searchMode ===
                                                            "student"
                                                                ? getStudentColor(
                                                                      searchResult
                                                                          .entities[0]
                                                                          .id,
                                                                  )
                                                                : "#7828c8",
                                                    }}
                                                >
                                                    {
                                                        searchResult.entities[0]
                                                            .name
                                                    }
                                                </h2>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm font-black text-black/30 uppercase tracking-tighter mb-1">
                                                    Active Query
                                                </p>
                                                <h2 className="text-5xl font-black italic tracking-tighter text-black uppercase break-all">
                                                    {searchResult.prefix
                                                        ? `${searchResult.prefix}:`
                                                        : ""}
                                                    {searchResult.keyword}
                                                </h2>
                                            </>
                                        )}
                                    </div>

                                    {/* Logical Search Entity List (Compact) */}
                                    {isLogicalSearch &&
                                        searchResult.entities.length > 0 && (
                                            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                                                {searchResult.entities.map(
                                                    (entity, i) => {
                                                        const color =
                                                            entity.type ===
                                                            "student"
                                                                ? getStudentColor(
                                                                      entity.id,
                                                                  )
                                                                : "#7828c8";
                                                        const entityKey = `logical-${entity.id}-${entity.name}-${i}`;

                                                        if (
                                                            entity.type ===
                                                            "teacher"
                                                        ) {
                                                            return (
                                                                <Tooltip
                                                                    key={i}
                                                                    isOpen={
                                                                        isModifierPressed &&
                                                                        hoveredEntityId ===
                                                                            entityKey
                                                                    }
                                                                    placement="top"
                                                                    offset={15}
                                                                    delay={0}
                                                                    closeDelay={
                                                                        0
                                                                    }
                                                                    motionProps={
                                                                        tooltipMotionProps
                                                                    }
                                                                    classNames={{
                                                                        base: "!transition-none",
                                                                        content:
                                                                            "p-0 rounded-none border border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                                                    }}
                                                                    content={
                                                                        <div className="flex divide-x-2 divide-black min-w-[320px] max-w-112.5 text-left">
                                                                            <div className="p-4 bg-retro-secondary/10 flex flex-col justify-center min-w-30">
                                                                                <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                                                    Teacher
                                                                                </p>
                                                                                <p className="text-xl font-black text-retro-secondary italic tracking-tight">
                                                                                    {
                                                                                        entity.name
                                                                                    }
                                                                                </p>
                                                                            </div>
                                                                            <div className="p-4 flex-1 bg-white">
                                                                                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                                    <BookOpen
                                                                                        size={
                                                                                            12
                                                                                        }
                                                                                    />{" "}
                                                                                    Assigned
                                                                                    Classes
                                                                                </p>
                                                                                <div className="space-y-1.5">
                                                                                    {entity.subjects
                                                                                        .slice(
                                                                                            0,
                                                                                            5,
                                                                                        )
                                                                                        .map(
                                                                                            (
                                                                                                sub,
                                                                                                idx,
                                                                                            ) => (
                                                                                                <div
                                                                                                    key={
                                                                                                        idx
                                                                                                    }
                                                                                                    className="text-[10px] font-bold text-black border-l-2 border-retro-secondary pl-1.5"
                                                                                                >
                                                                                                    {
                                                                                                        sub
                                                                                                    }
                                                                                                </div>
                                                                                            ),
                                                                                        )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    }
                                                                >
                                                                    <div
                                                                        className="student-badge cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
                                                                        style={{
                                                                            borderColor:
                                                                                "#7828c8",
                                                                            backgroundColor:
                                                                                "#7828c820",
                                                                            color: "#7828c8",
                                                                        }}
                                                                        onMouseEnter={() =>
                                                                            setHoveredEntityId(
                                                                                entityKey,
                                                                            )
                                                                        }
                                                                        onMouseLeave={() =>
                                                                            setHoveredEntityId(
                                                                                null,
                                                                            )
                                                                        }
                                                                        onClick={() =>
                                                                            handleSearchToggle(
                                                                                entity.name,
                                                                                true,
                                                                            )
                                                                        }
                                                                    >
                                                                        {
                                                                            entity.name
                                                                        }{" "}
                                                                        T
                                                                    </div>
                                                                </Tooltip>
                                                            );
                                                        }

                                                        // Student Badge (Existing Style)
                                                        return (
                                                            <Tooltip
                                                                key={i}
                                                                isOpen={
                                                                    isModifierPressed &&
                                                                    hoveredEntityId ===
                                                                        entityKey
                                                                }
                                                                placement="top"
                                                                offset={15}
                                                                delay={0}
                                                                closeDelay={0}
                                                                motionProps={
                                                                    tooltipMotionProps
                                                                }
                                                                classNames={{
                                                                    base: "!transition-none",
                                                                    content:
                                                                        "p-0 rounded-none border border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                                                }}
                                                                content={
                                                                    <div className="flex divide-x-2 divide-black min-w-[320px] max-w-112.5 text-left">
                                                                        <div
                                                                            className="p-4 flex flex-col justify-center min-w-30"
                                                                            style={{
                                                                                backgroundColor: `${color}26`,
                                                                            }}
                                                                        >
                                                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                                                Student
                                                                                ID
                                                                            </p>
                                                                            <p className="text-xs font-black text-black leading-none mb-3">
                                                                                {
                                                                                    entity.id
                                                                                }
                                                                            </p>
                                                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                                                Name
                                                                            </p>
                                                                            <p
                                                                                className="text-xl font-black italic tracking-tight"
                                                                                style={{
                                                                                    color: color,
                                                                                }}
                                                                            >
                                                                                {
                                                                                    entity.name
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                        <div className="p-4 flex-1 bg-white">
                                                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                                <BookOpen
                                                                                    size={
                                                                                        12
                                                                                    }
                                                                                />{" "}
                                                                                Enrolled
                                                                                Classes
                                                                            </p>
                                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                                                {entity.subjects
                                                                                    .slice(
                                                                                        0,
                                                                                        8,
                                                                                    )
                                                                                    .map(
                                                                                        (
                                                                                            sub,
                                                                                            idx,
                                                                                        ) => (
                                                                                            <div
                                                                                                key={
                                                                                                    idx
                                                                                                }
                                                                                                className="text-[10px] font-bold text-black border-l-2 pl-1.5 truncate"
                                                                                                style={{
                                                                                                    borderColor:
                                                                                                        color,
                                                                                                }}
                                                                                            >
                                                                                                {
                                                                                                    sub.split(
                                                                                                        "(",
                                                                                                    )[0]
                                                                                                }
                                                                                            </div>
                                                                                        ),
                                                                                    )}
                                                                                {entity
                                                                                    .subjects
                                                                                    .length >
                                                                                    8 && (
                                                                                    <p className="text-[9px] font-black text-black/30 pl-1.5">
                                                                                        +{" "}
                                                                                        {entity
                                                                                            .subjects
                                                                                            .length -
                                                                                            8}{" "}
                                                                                        more
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                }
                                                            >
                                                                <div
                                                                    className="student-badge cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
                                                                    style={{
                                                                        borderColor:
                                                                            color,
                                                                        backgroundColor: `${color}20`,
                                                                        color: color,
                                                                    }}
                                                                    onMouseEnter={() =>
                                                                        setHoveredEntityId(
                                                                            entityKey,
                                                                        )
                                                                    }
                                                                    onMouseLeave={() =>
                                                                        setHoveredEntityId(
                                                                            null,
                                                                        )
                                                                    }
                                                                    onClick={() =>
                                                                        handleSearchToggle(
                                                                            entity.id,
                                                                        )
                                                                    }
                                                                >
                                                                    {
                                                                        entity.id.split(
                                                                            "-",
                                                                        )[0]
                                                                    }{" "}
                                                                    {
                                                                        entity.name
                                                                    }
                                                                </div>
                                                            </Tooltip>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        )}
                                </div>

                                {/* Right Side: Search Stats & Overview */}
                                <div className="p-10 md:w-1/2 bg-white flex flex-col justify-center">
                                    <div className="grid grid-cols-2 gap-10">
                                        <div>
                                            <p className="text-sm font-black text-black/40 uppercase tracking-widest mb-2">
                                                Matched Subjects
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-5xl font-black text-black tracking-tighter">
                                                    {
                                                        searchResult.total_subjects
                                                    }
                                                </span>
                                                <span className="text-xs font-black text-black/30 uppercase">
                                                    Items
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-black/40 uppercase tracking-widest mb-2">
                                                Total Sections
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-5xl font-black text-black tracking-tighter">
                                                    {
                                                        searchResult.total_sections
                                                    }
                                                </span>
                                                <span className="text-xs font-black text-black/30 uppercase">
                                                    Classes
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary or mini-list of subjects if single person */}
                                    {searchMode !== "general" &&
                                    searchResult.entities[0] ? (
                                        <div className="mt-10 pt-8 border-t-2 border-black/10">
                                            <p className="text-sm font-black text-black/40 uppercase tracking-widest mb-5 flex items-center gap-2">
                                                <BookOpen size={18} /> Total{" "}
                                                {searchMode === "student"
                                                    ? "Enrollment"
                                                    : "Teaching"}{" "}
                                                (
                                                {
                                                    searchResult.entities[0]
                                                        .subject_count
                                                }
                                                )
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                                                {searchResult.entities[0].subjects.map(
                                                    (sub, i) => (
                                                        <div
                                                            key={i}
                                                            className="text-sm font-bold text-black border-l-4 border-black/20 pl-3 truncate py-0.5"
                                                        >
                                                            {searchMode ===
                                                            "teacher"
                                                                ? (() => {
                                                                      const match =
                                                                          sub.match(
                                                                              /^(.*)\(([^)]+)\)$/,
                                                                          );
                                                                      if (
                                                                          match
                                                                      ) {
                                                                          const name =
                                                                              match[1]
                                                                                  .split(
                                                                                      "(",
                                                                                  )[0]
                                                                                  .trim();
                                                                          const sections =
                                                                              match[2];
                                                                          return `${name}(${sections})`;
                                                                      }
                                                                      return sub;
                                                                  })()
                                                                : sub.split(
                                                                      "(",
                                                                  )[0]}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-8 bg-retro-bg/30 p-4 border border-black/10">
                                            <p className="text-xs font-bold leading-tight text-black/50 italic">
                                                {isLogicalSearch
                                                    ? "논리 연산이 적용된 결과입니다. 매칭되는 상세 분반 리스트는 아래 아코디언에서 확인하세요."
                                                    : "검색 결과에 대한 요약 통계입니다."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Standard Search Result (General) */
                            <>
                                <div className="bg-white border border-black p-8 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 px-6 py-1.5 bg-black text-white text-xs font-black italic tracking-widest uppercase">
                                        Search Status
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                                        <div>
                                            <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-2">
                                                Current Keyword
                                            </p>
                                            <div className="flex items-center gap-4">
                                                <span className="text-4xl font-black italic text-black uppercase tracking-tighter">
                                                    {searchResult.prefix
                                                        ? `${searchResult.prefix}:`
                                                        : ""}
                                                    {searchResult.keyword}
                                                </span>
                                                <Chip className="bg-black text-white border border-black rounded-none font-black text-xs py-1 px-3">
                                                    {
                                                        searchResult.total_subjects
                                                    }{" "}
                                                    SUBJECTS MATCHED
                                                </Chip>
                                            </div>
                                        </div>
                                        <div className="flex gap-10 border-t-2 md:border-t-0 md:border-l-2 border-black/10 pt-6 md:pt-0 md:pl-10">
                                            <div>
                                                <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">
                                                    Identified
                                                </p>
                                                <p className="text-xl font-black text-black">
                                                    {(() => {
                                                        const sCount =
                                                            searchResult.entities.filter(
                                                                (e) =>
                                                                    e.type ===
                                                                    "student",
                                                            ).length;
                                                        const tCount =
                                                            searchResult.entities.filter(
                                                                (e) =>
                                                                    e.type ===
                                                                    "teacher",
                                                            ).length;
                                                        const parts = [];
                                                        if (sCount > 0)
                                                            parts.push(
                                                                `${sCount} Student${sCount > 1 ? "s" : ""}`,
                                                            );
                                                        if (tCount > 0)
                                                            parts.push(
                                                                `${tCount} Teacher${tCount > 1 ? "s" : ""}`,
                                                            );
                                                        return parts.length > 0
                                                            ? parts.join(
                                                                  " & ",
                                                              ) + " Matched"
                                                            : "No People Matched";
                                                    })()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">
                                                    Match Scope
                                                </p>
                                                <p className="text-xl font-black text-black">
                                                    {
                                                        searchResult.total_sections
                                                    }{" "}
                                                    Sections
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {searchResult.entities.length > 0 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {searchResult.entities.map(
                                            (entity, idx) => {
                                                const entityColor =
                                                    entity.type === "student"
                                                        ? getStudentColor(
                                                              entity.id,
                                                          )
                                                        : "#7828c8";

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="bg-white border border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] flex divide-x divide-black overflow-hidden cursor-pointer hover:-translate-y-1.5 transition-transform group"
                                                        onClick={() =>
                                                            handleSearchSelect(
                                                                entity.type ===
                                                                    "student"
                                                                    ? entity.id
                                                                    : entity.name,
                                                                entity.type ===
                                                                    "teacher",
                                                            )
                                                        }
                                                    >
                                                        {/* Profile Page (Left) */}
                                                        <div
                                                            className="p-6 min-w-44 flex flex-col justify-center relative"
                                                            style={{
                                                                backgroundColor: `${entityColor}15`,
                                                            }}
                                                        >
                                                            <span
                                                                className={`absolute top-3 left-3 px-3 py-1 text-[10px] font-black uppercase border border-black/20 ${entity.type === "student" ? "bg-white text-black" : "bg-retro-secondary text-white border-none"}`}
                                                            >
                                                                {entity.type}
                                                            </span>
                                                            <p className="text-[10px] font-black text-black/30 uppercase tracking-tighter mt-4 mb-1">
                                                                {entity.type ===
                                                                "student"
                                                                    ? "Student ID"
                                                                    : "Position"}
                                                            </p>
                                                            <p className="text-sm font-black text-black mb-3">
                                                                {entity.id}
                                                            </p>
                                                            <p
                                                                className="text-3xl font-black italic tracking-tighter group-hover:scale-105 transition-transform"
                                                                style={{
                                                                    color: entityColor,
                                                                }}
                                                            >
                                                                {entity.name}
                                                            </p>
                                                        </div>

                                                        {/* Classes Page (Right) */}
                                                        <div className="p-6 flex-1 bg-white overflow-hidden">
                                                            <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <BookOpen
                                                                    size={14}
                                                                />{" "}
                                                                {entity.type ===
                                                                "student"
                                                                    ? "Enrollment"
                                                                    : "Teaching"}{" "}
                                                                (
                                                                {
                                                                    entity.subject_count
                                                                }
                                                                )
                                                            </p>
                                                            <div
                                                                className={`grid ${
                                                                    searchResult
                                                                        .entities
                                                                        .length ===
                                                                    1
                                                                        ? "grid-cols-2 gap-x-6 gap-y-2"
                                                                        : "grid-cols-1 gap-2"
                                                                }`}
                                                            >
                                                                {(searchResult
                                                                    .entities
                                                                    .length ===
                                                                1
                                                                    ? entity.subjects
                                                                    : entity.subjects.slice(
                                                                          0,
                                                                          4,
                                                                      )
                                                                ).map(
                                                                    (
                                                                        sub,
                                                                        i,
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                i
                                                                            }
                                                                            className="text-xs font-bold text-black border-l-2 pl-3 truncate"
                                                                            style={{
                                                                                borderColor:
                                                                                    entityColor,
                                                                            }}
                                                                        >
                                                                            {entity.type ===
                                                                            "teacher"
                                                                                ? (() => {
                                                                                      const match =
                                                                                          sub.match(
                                                                                              /^(.*)\(([^)]+)\)$/,
                                                                                          );
                                                                                      if (
                                                                                          match
                                                                                      ) {
                                                                                          const name =
                                                                                              match[1]
                                                                                                  .split(
                                                                                                      "(",
                                                                                                  )[0]
                                                                                                  .trim();
                                                                                          const sections =
                                                                                              match[2];
                                                                                          return `${name}(${sections})`;
                                                                                      }
                                                                                      return sub;
                                                                                  })()
                                                                                : sub.split(
                                                                                      "(",
                                                                                  )[0]}
                                                                        </div>
                                                                    ),
                                                                )}
                                                                {searchResult
                                                                    .entities
                                                                    .length >
                                                                    1 &&
                                                                    entity
                                                                        .subjects
                                                                        .length >
                                                                        4 && (
                                                                        <p className="text-[10px] font-black text-black/30 pl-3 pt-1">
                                                                            +{" "}
                                                                            {entity
                                                                                .subjects
                                                                                .length -
                                                                                4}{" "}
                                                                            MORE
                                                                            CLASSES
                                                                        </p>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {[
                            {
                                label: "Total Subjects",
                                value: stats.total_subjects,
                                icon: BookOpen,
                                color: "bg-retro-accent1",
                            },
                            {
                                label: "Total Sections",
                                value: stats.total_sections,
                                icon: Users,
                                color: "bg-retro-accent2",
                            },
                            {
                                label: "Active Students",
                                value: stats.total_active_students,
                                icon: User,
                                color: "bg-retro-accent3",
                            },
                        ].map((stat, i) => (
                            <Card
                                key={i}
                                className={`border-2 border-black rounded-none shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] ${stat.color}`}
                            >
                                <CardBody className="flex flex-row items-center gap-5 p-6">
                                    <stat.icon
                                        size={32}
                                        className="text-black"
                                    />
                                    <div>
                                        <p className="text-xs font-black uppercase text-black/60 tracking-wider">
                                            {stat.label}
                                        </p>
                                        <p className="text-3xl font-black text-black">
                                            {stat.value}
                                        </p>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="relative">
                    {/* Persistent Loading Overlay */}
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
                        {data.length > 0
                            ? data.map((subject: SubjectData) => (
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
                                      isOpen={expandedSubjects.includes(
                                          subject.subject,
                                      )}
                                      onToggle={() =>
                                          toggleSubject(subject.subject)
                                      }
                                      isSingleStudentSearch={
                                          searchMode === "student" &&
                                          searchResult?.entities.length === 1
                                      }
                                  />
                              ))
                            : !loading && (
                                  <div className="py-28 flex flex-col items-center justify-center text-black/20">
                                      <p className="text-2xl font-black uppercase italic tracking-widest">
                                          No Data Found
                                      </p>
                                  </div>
                              )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;

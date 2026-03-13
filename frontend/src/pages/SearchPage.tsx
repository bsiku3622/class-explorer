import React from "react";
import { Search, X, HelpCircle } from "lucide-react";
import { Input, Tooltip, Spinner } from "@heroui/react";
import type { SubjectData, Stats, SearchResultStats } from "../types";
import FilterSection from "../components/FilterSection";
import SearchResultDisplay from "../components/SearchResultDisplay";
import StatsCards from "../components/StatsCards";
import SubjectAccordionItem from "../components/SubjectAccordionItem";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import { tooltipMotionProps } from "../constants/motion";

interface SearchPageProps {
    searchInput: string;
    setSearchInput: (v: string) => void;
    searchTerm: string;
    studentCounts: Record<string, number>;
    selectedYears: string[];
    setSelectedYears: (years: string[]) => void;
    lastUpdated: number | null;
    fetchInitialData: (force?: boolean) => void;
    searchResult: SearchResultStats | null;
    searchMode: "general" | "student" | "teacher" | "room";
    isLogicalSearch: boolean;
    isConsolidatedView: boolean;
    isModifierPressed: boolean;
    hoveredEntityId: string | null;
    setHoveredEntityId: (id: string | null) => void;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    handleSearchSelect: (v: string, isT?: boolean, isR?: boolean) => void;
    stats: Stats | null;
    loading: boolean;
    displayData: SubjectData[];
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    hasStudentInSearch: boolean;
    expandedSubjects: string[];
    toggleSubject: (name: string) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({
    searchInput,
    setSearchInput,
    searchTerm,
    studentCounts,
    selectedYears,
    setSelectedYears,
    lastUpdated,
    fetchInitialData,
    searchResult,
    searchMode,
    isLogicalSearch,
    isConsolidatedView,
    isModifierPressed,
    hoveredEntityId,
    setHoveredEntityId,
    handleSearchToggle,
    handleSearchSelect,
    stats,
    loading,
    displayData,
    studentSubjectMap,
    teacherSubjectMap,
    hasStudentInSearch,
    expandedSubjects,
    toggleSubject,
}) => {
    return (
        <>
            {/* Header Section (ROOMS Style) */}
            <div className="bg-white border-2 border-black p-8 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] relative overflow-hidden mb-10 flex flex-col gap-8">
                <div className="absolute top-0 right-0 px-6 py-1.5 bg-black text-white text-xs font-black tracking-widest uppercase">
                    Feature: Search Engine
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter text-black uppercase mb-2">
                            Search
                        </h2>
                        <RetroSubTitle
                            title="Find subjects, students, teachers, or rooms"
                            icon={Search}
                            className="mb-0"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <Tooltip
                            placement="bottom-end"
                            content={
                                <div className="p-6 space-y-6 min-w-96 text-left">
                                    <p className="font-black text-lg border-b border-black pb-2 mb-4 uppercase">
                                        Search Guide
                                    </p>
                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-xs font-black text-retro-secondary uppercase mb-1.5 tracking-widest">
                                                Basic & Logic
                                            </p>
                                            <div className="space-y-2 text-sm font-bold text-black/70">
                                                <p>
                                                    <span className="bg-black text-white px-1 mr-2">
                                                        키워드
                                                    </span>{" "}
                                                    이름, 학번, 과목, 쌤,
                                                    강의실, 시간(월1)
                                                </p>
                                                <p>
                                                    <span className="bg-black text-white px-1 mr-2">
                                                        연산자
                                                    </span>{" "}
                                                    <span className="text-retro-primary font-black">
                                                        &
                                                    </span>{" "}
                                                    (AND),{" "}
                                                    <span className="text-retro-primary font-black">
                                                        +
                                                    </span>{" "}
                                                    (OR),{" "}
                                                    <span className="text-retro-primary font-black">
                                                        !
                                                    </span>{" "}
                                                    (NOT), ( )
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-retro-secondary uppercase mb-1.5 tracking-widest">
                                                Advanced
                                            </p>
                                            <div className="space-y-2 text-sm font-bold text-black/60">
                                                <p>
                                                    student:학번 / teacher:성함
                                                    / room:강의실
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            }
                            motionProps={tooltipMotionProps}
                            classNames={{
                                content:
                                    "p-0 rounded-none border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden",
                            }}
                        >
                            <RetroButton
                                icon={
                                    <HelpCircle size={18} strokeWidth={2.5} />
                                }
                                className="cursor-help"
                            >
                                Search Guide
                            </RetroButton>
                        </Tooltip>
                    </div>
                </div>

                <div className="relative flex">
                    <Input
                        classNames={{
                            base: "w-full",
                            innerWrapper: "flex flex-row items-center gap-2",
                            input: "text-xl font-semibold outline-none px-2",
                            inputWrapper:
                                "h-16 bg-white border-2 border-black rounded-none shadow-[6px_6px_0_0_rgba(0,0,0,0.1)] data-[hover=true]:border-black group-data-[focus=true]:border-black",
                        }}
                        placeholder="Enter student name, subject, or logic query..."
                        startContent={
                            <Search className="text-black/40 ml-2" size={24} />
                        }
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                    {searchInput && (
                        <button
                            onClick={() => setSearchInput("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-black/20 hover:text-black transition-colors"
                        >
                            <X size={20} strokeWidth={3} />
                        </button>
                    )}
                </div>
            </div>

            <FilterSection
                studentCounts={studentCounts}
                selectedYears={selectedYears}
                setSelectedYears={setSelectedYears}
                lastUpdated={lastUpdated}
                onRefresh={() => fetchInitialData(true)}
            />

            {searchResult && (
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
            )}

            {stats && <StatsCards stats={stats} />}

            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-start pt-40 gap-4 bg-retro-bg/40 backdrop-blur-[2px]">
                        <Spinner color="primary" size="lg" />
                        <p className="text-lg font-black uppercase animate-pulse">
                            Scanning Grid...
                        </p>
                    </div>
                )}
                <div
                    className={`space-y-0 transition-opacity duration-300 ${loading ? "opacity-30 pointer-events-none" : "opacity-100"}`}
                >
                    {displayData.length > 0
                        ? displayData.map((subject: SubjectData) => (
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
                                  <p className="text-2xl font-black uppercase tracking-widest">
                                      No Data Found
                                  </p>
                              </div>
                          )}
                </div>
            </div>
        </>
    );
};

export default SearchPage;

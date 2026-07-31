import React, { useState } from "react";
import { Search, Link } from "lucide-react";
import { Spinner } from "@heroui/react";
import SearchInput from "../components/atoms/SearchInput";
import type { SubjectData, Stats, SearchResultStats } from "../types";
import FilterSection from "../components/FilterSection";
import SearchResultDisplay from "../components/SearchResultDisplay";
import StatsCards from "../components/StatsCards";
import SubjectAccordionItem from "../components/SubjectAccordionItem";
import PageHeader from "../components/molecules/PageHeader";

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
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader
                title="Search"
                subtitle="Class Finder"
                icon={Search}
                action={searchTerm ? (
                    <button
                        onClick={handleCopyLink}
                        className="flex items-center gap-2 text-xs font-black uppercase px-3 py-2 border-2 border-black/30 hover:border-black transition-all duration-100 text-black/50 hover:text-black"
                    >
                        <Link size={13} strokeWidth={2.5} />
                        {copied ? "Copied!" : "Share"}
                    </button>
                ) : undefined}
            />

            <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Enter student name, subject, or logic query..."
                enableHistory
                committedTerm={searchTerm}
            />

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
        </div>
    );
};

export default SearchPage;

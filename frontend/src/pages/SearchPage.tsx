import React, { useState } from "react";
import { Search, Link } from "lucide-react";
import SearchInput from "../components/atoms/SearchInput";
import type { SubjectData, Stats, SearchResultStats, Term } from "../types";
import FilterSection from "../components/FilterSection";
import SearchResultDisplay from "../components/SearchResultDisplay";
import StatsCards from "../components/StatsCards";
import SubjectAccordionItem from "../components/SubjectAccordionItem";
import { Busy, Button, EmptyState, PageHeader } from "@studio-baeks/funky-ui";

interface SearchPageProps {
    term: Term | null;
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
    expandedSubjects: string[];
    toggleSubject: (name: string) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({
    term,
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
                    <Button
                        size="sm"
                        variant="muted"
                        icon={Link}
                        onClick={handleCopyLink}
                    >
                        {copied ? "Copied!" : "Share"}
                    </Button>
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

            <Busy active={loading} label="Scanning Grid...">
                <div className="space-y-0">
                    {displayData.length > 0
                        ? displayData.map((subject: SubjectData) => (
                              <SubjectAccordionItem
                                  key={subject.subject}
                                  subject={subject}
                                  term={term}
                                  searchTerm={searchTerm}
                                  handleSearchToggle={handleSearchToggle}
                                  studentSubjectMap={studentSubjectMap}
                                  teacherSubjectMap={teacherSubjectMap}
                                  isModifierPressed={isModifierPressed}
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
                              <EmptyState title="No Data Found" className="py-28" />
                          )}
                </div>
            </Busy>
        </div>
    );
};

export default SearchPage;

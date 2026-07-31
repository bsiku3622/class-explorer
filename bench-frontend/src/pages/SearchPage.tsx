import React, { useState } from "react";
import { Search, Link } from "lucide-react";
import { Spinner } from "@heroui/react";
import SearchInput from "../components/atoms/SearchInput";
import type {
    SubjectData,
    Stats,
    SearchResultStats,
    StudentTimetable,
} from "../types";
import type { StudentSearchResponse } from "../lib/benchApi";
import SearchResultDisplay from "../components/SearchResultDisplay";
import StatsCards from "../components/StatsCards";
import StudentLookup from "../components/StudentLookup";
import SubjectAccordionItem from "../components/SubjectAccordionItem";
import PageHeader from "../components/molecules/PageHeader";

interface SearchPageProps {
    searchInput: string;
    setSearchInput: (v: string) => void;
    searchTerm: string;
    lastUpdated: number | null;
    fetchInitialData: (force?: boolean) => void;
    searchResult: SearchResultStats | null;
    searchMode: "general" | "teacher" | "room";
    isConsolidatedView: boolean;
    isModifierPressed: boolean;
    hoveredEntityId: string | null;
    setHoveredEntityId: (id: string | null) => void;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    handleSearchSelect: (v: string, isT?: boolean, isR?: boolean) => void;
    stats: Stats | null;
    loading: boolean;
    displayData: SubjectData[];
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    expandedSubjects: string[];
    toggleSubject: (name: string) => void;

    /** `student:` 질의일 때만 문자열. null 이면 과목 검색 화면입니다 */
    studentQuery: string | null;
    studentSearch: StudentSearchResponse | null;
    studentTimetable: StudentTimetable | null;
    studentLoading: boolean;
    studentError: string | null;
    onSelectStudent: (stuId: string) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({
    searchInput,
    setSearchInput,
    searchTerm,
    searchResult,
    searchMode,
    isConsolidatedView,
    isModifierPressed,
    hoveredEntityId,
    setHoveredEntityId,
    handleSearchToggle,
    handleSearchSelect,
    stats,
    loading,
    displayData,
    teacherSubjectMap,
    expandedSubjects,
    toggleSubject,
    studentQuery,
    studentSearch,
    studentTimetable,
    studentLoading,
    studentError,
    onSelectStudent,
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // 사람 찾기는 서버가 하고 결과 모양도 달라서, 화면을 통째로 갈아 끼웁니다
    const isStudentLookup = studentQuery !== null;

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
                placeholder="과목·교사·강의실 — 사람은 student:이름"
                enableHistory
                committedTerm={searchTerm}
            />

            {isStudentLookup ? (
                <StudentLookup
                    query={studentQuery}
                    search={studentSearch}
                    timetable={studentTimetable}
                    loading={studentLoading}
                    error={studentError}
                    onSelect={onSelectStudent}
                    onSearchToggle={handleSearchToggle}
                />
            ) : (
                <>
                    {searchResult && (
                        <SearchResultDisplay
                            searchResult={searchResult}
                            searchMode={searchMode}
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
                                          teacherSubjectMap={teacherSubjectMap}
                                          isModifierPressed={isModifierPressed}
                                          searchMode={searchMode}
                                          isOpen={expandedSubjects.includes(
                                              subject.subject,
                                          )}
                                          onToggle={() =>
                                              toggleSubject(subject.subject)
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
            )}
        </div>
    );
};

export default SearchPage;

import React, { useState, useEffect } from "react";
import { Tooltip, Chip } from "@heroui/react";
import { BookOpen, AlertCircle, ChevronDown } from "lucide-react";
import type { SearchResultStats } from "../types";
import { getStudentColor } from "../lib/utils";
import { tooltipMotionProps } from "../constants/motion";
import TimetableGrid from "./TimetableGrid";
import EntityCard from "./EntityCard";

interface SearchResultDisplayProps {
    searchResult: SearchResultStats;
    searchMode: "general" | "student" | "teacher" | "room";
    isLogicalSearch: boolean;
    isConsolidatedView: boolean;
    isModifierPressed: boolean;
    hoveredEntityId: string | null;
    setHoveredEntityId: (id: string | null) => void;
    handleSearchToggle: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
    handleSearchSelect: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const getEntityColor = (entity: any) => {
    if (entity.type === "student") return getStudentColor(entity.id);
    if (entity.type === "teacher") return "#7828c8";
    if (entity.type === "room") return "#00B5E7"; // Cyan for rooms
    return "#000000";
};

const SearchResultDisplay: React.FC<SearchResultDisplayProps> = ({
    searchResult,
    searchMode,
    isLogicalSearch,
    isConsolidatedView,
    isModifierPressed,
    hoveredEntityId,
    setHoveredEntityId,
    handleSearchToggle,
    handleSearchSelect,
}) => {
    const [visibleCount, setVisibleCount] = useState(6);

    // 검색 결과가 바뀌면 다시 6개로 리셋
    useEffect(() => {
        setVisibleCount(6);
    }, [searchResult.keyword, searchResult.entities.length]);

    const renderWarning = () => {
        if (!searchResult.warning) return null;
        return (
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0_0_rgba(255,165,0,0.4)] flex items-start gap-3 mb-8">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <p className="text-xs font-black uppercase text-orange-600 tracking-widest mb-1">
                        Search Warning
                    </p>
                    <p className="text-sm font-bold text-black leading-tight">
                        {searchResult.warning}
                    </p>
                </div>
            </div>
        );
    };

    if (isConsolidatedView) {
        return (
            <div className="flex flex-col">
                {renderWarning()}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-black">
                    {/* Left Side: Profile & Subject List (1/3 Width) */}
                    <div
                        className={`p-8 md:w-1/3 flex flex-col relative ${
                            searchMode === "student"
                                ? ""
                                : searchMode === "teacher"
                                  ? "bg-retro-secondary/5"
                                  : searchMode === "room"
                                    ? "bg-retro-accent4/5"
                                    : "bg-retro-accent1/5"
                        }`}
                        style={
                            searchMode === "student" && searchResult.entities[0]
                                ? {
                                      backgroundColor: `${getStudentColor(searchResult.entities[0].id)}15`,
                                  }
                                : searchMode === "room"
                                  ? { backgroundColor: "rgba(0, 181, 231, 0.1)" }
                                  : {}
                        }
                    >
                        <div className="absolute top-0 left-0 px-6 py-1.5 bg-black text-white text-xs font-black italic tracking-widest uppercase">
                            {searchMode === "student"
                                ? "Student Profile"
                                : searchMode === "teacher"
                                  ? "Teacher Profile"
                                  : searchMode === "room"
                                    ? "Classroom Profile"
                                    : "Logical Search"}
                        </div>

                        <div className="mt-8 mb-10">
                            {searchMode !== "general" && searchResult.entities[0] ? (
                                <>
                                    {searchMode === "student" && (
                                        <p className="text-sm font-black text-black/40 uppercase tracking-tighter mb-1">
                                            {searchResult.entities[0].id}
                                        </p>
                                    )}
                                    <h2
                                        className="text-5xl font-black italic tracking-tighter leading-none"
                                        style={{
                                            color: getEntityColor(searchResult.entities[0]),
                                        }}
                                    >
                                        {searchResult.entities[0].name}
                                    </h2>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-black text-black/30 uppercase tracking-tighter mb-1">
                                        Active Query
                                    </p>
                                    <h2 className="text-4xl font-black italic tracking-tighter text-black uppercase break-all">
                                        {searchResult.prefix ? `${searchResult.prefix}:` : ""}
                                        {searchResult.keyword}
                                    </h2>
                                </>
                            )}
                        </div>

                        {/* Stats and Subject List on the Left Side */}
                        {searchMode !== "general" && searchResult.entities[0] && (
                            <div className="pt-8 border-t-2 border-black/10 flex-1 flex flex-col gap-10">
                                {/* Compact stats at the top of left side content */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-1">
                                            Matched Subjects
                                        </p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-3xl font-black text-black tracking-tighter">
                                                {searchResult.total_subjects}
                                            </span>
                                            <span className="text-[10px] font-black text-black/20 uppercase">
                                                Items
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-1">
                                            Total Sections
                                        </p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-3xl font-black text-black tracking-tighter">
                                                {searchResult.total_sections}
                                            </span>
                                            <span className="text-[10px] font-black text-black/20 uppercase">
                                                Classes
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <BookOpen size={14} />{" "}
                                        {searchMode === "student"
                                            ? "Enrollment"
                                            : searchMode === "teacher"
                                              ? "Teaching"
                                              : "Scheduled"}{" "}
                                        ({searchResult.entities[0].subject_count})
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                        {searchResult.entities[0].subjects.map((sub, i) => {
                                            // 이제 subjects는 이미 "Prefix - Subject(Section)" 형식으로 포맷팅되어 있음
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        // 검색을 위해 한글 과목명만 추출
                                                        const parts = sub.split(" - ");
                                                        const mainPart = parts.length > 1 ? parts[1] : parts[0];
                                                        const baseName = mainPart.split("(")[0].trim();
                                                        handleSearchToggle(baseName);
                                                    }}
                                                    className="text-left text-xs font-bold text-black border-l-4 border-black/10 pl-3 py-1 hover:border-black hover:bg-black/5 transition-all truncate"
                                                    style={{ borderLeftColor: `${getEntityColor(searchResult.entities[0])}40` }}
                                                >
                                                    {sub}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isLogicalSearch && searchResult.entities.length > 0 && (
                            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                                {searchResult.entities.map((entity, i) => {
                                    const color = getEntityColor(entity);
                                    const entityKey = `logical-${entity.id}-${entity.name}-${i}`;

                                    return (
                                        <Tooltip
                                            key={i}
                                            isOpen={isModifierPressed && hoveredEntityId === entityKey}
                                            placement="top"
                                            offset={15}
                                            delay={0}
                                            closeDelay={0}
                                            motionProps={tooltipMotionProps}
                                            classNames={{
                                                base: "!transition-none",
                                                content:
                                                    "p-0 rounded-none border border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                            }}
                                            content={
                                                <div className="flex divide-x-2 divide-black min-w-[320px] max-w-112.5 text-left">
                                                    <div
                                                        className="p-4 flex flex-col justify-center min-w-30"
                                                        style={{ backgroundColor: `${color}26` }}
                                                    >
                                                        <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                            {entity.type === "student"
                                                                ? "Student ID"
                                                                : entity.type === "teacher"
                                                                  ? "Teacher"
                                                                  : "Facility"}
                                                        </p>
                                                        {entity.type === "student" && (
                                                            <p className="text-xs font-black text-black leading-none mb-3">
                                                                {entity.id}
                                                            </p>
                                                        )}
                                                        <p
                                                            className="text-xl font-black italic tracking-tight"
                                                            style={{ color: color }}
                                                        >
                                                            {entity.name}
                                                        </p>
                                                    </div>
                                                    <div className="p-4 flex-1 bg-white">
                                                        <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            <BookOpen size={12} /> Assigned Classes
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                            {entity.subjects.slice(0, 8).map((sub, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="text-[10px] font-bold text-black border-l-2 pl-1.5 truncate"
                                                                    style={{ borderColor: color }}
                                                                >
                                                                    {sub}
                                                                </div>
                                                            ))}
                                                            {entity.subjects.length > 8 && (
                                                                <p className="text-[9px] font-black text-black/30 pl-1.5">
                                                                    + {entity.subjects.length - 8} more
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
                                                    borderColor: color,
                                                    backgroundColor: `${color}20`,
                                                    color: color,
                                                }}
                                                onMouseEnter={() => setHoveredEntityId(entityKey)}
                                                onMouseLeave={() => setHoveredEntityId(null)}
                                                onClick={() =>
                                                    handleSearchToggle(
                                                        entity.type === "student"
                                                            ? entity.id
                                                            : entity.name,
                                                        entity.type === "teacher",
                                                        entity.type === "room",
                                                    )
                                                }
                                            >
                                                {entity.type === "student"
                                                    ? `${entity.id.split("-")[0]} ${entity.name}`
                                                    : entity.type === "teacher"
                                                      ? `${entity.name} T`
                                                      : `${entity.name}`}
                                            </div>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Side: Timetable (2/3 Width) */}
                    <div className="p-10 md:w-2/3 bg-white flex flex-col justify-center">
                        {searchMode !== "general" && searchResult.entities[0] ? (
                            <div className="flex flex-col">
                                <TimetableGrid
                                    times={searchResult.entities[0].times}
                                    color={getEntityColor(searchResult.entities[0])}
                                    mode={searchMode}
                                    className="w-full"
                                    onCellClick={(subject) => {
                                        handleSearchToggle(subject);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <div className="grid grid-cols-2 gap-10 mb-10">
                                    <div>
                                        <p className="text-sm font-black text-black/40 uppercase tracking-widest mb-2">
                                            Matched Subjects
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-black text-black tracking-tighter">
                                                {searchResult.total_subjects}
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
                                                {searchResult.total_sections}
                                            </span>
                                            <span className="text-xs font-black text-black/30 uppercase">
                                                Classes
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-retro-bg/30 p-6 border border-black/10">
                                    <p className="text-xs font-bold leading-tight text-black/50 italic text-center">
                                        {isLogicalSearch
                                            ? "논리 연산이 적용된 결과입니다. 매칭되는 상세 분반 리스트는 아래 아코디언에서 확인하세요."
                                            : "검색 결과에 대한 요약 통계입니다."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            {renderWarning()}
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
                                {searchResult.prefix ? `${searchResult.prefix}:` : ""}
                                {searchResult.keyword}
                            </span>
                            <Chip className="bg-black text-white border border-black rounded-none font-black text-xs py-1 px-3">
                                {searchResult.total_subjects} SUBJECTS MATCHED
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
                                    const timeRegex = /^([월화수목금])(\d+)$/;
                                    const match = searchResult.keyword.match(timeRegex);
                                    if (match) {
                                        return `${searchResult.total_matched_students} Student${searchResult.total_matched_students !== 1 ? "s" : ""} Matched`;
                                    }

                                    const sCount = searchResult.entities.filter(
                                        (e) => e.type === "student",
                                    ).length;
                                    const tCount = searchResult.entities.filter(
                                        (e) => e.type === "teacher",
                                    ).length;
                                    const rCount = searchResult.entities.filter(
                                        (e) => e.type === "room",
                                    ).length;
                                    
                                    const parts = [];
                                    if (sCount > 0)
                                        parts.push(`${sCount} Student${sCount > 1 ? "s" : ""}`);
                                    if (tCount > 0)
                                        parts.push(`${tCount} Teacher${tCount > 1 ? "s" : ""}`);
                                    if (rCount > 0)
                                        parts.push(`${rCount} Room${rCount > 1 ? "s" : ""}`);
                                        
                                    return parts.length > 0
                                        ? parts.join(" & ") + " Matched"
                                        : "No Matches";
                                })()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">
                                Match Scope
                            </p>
                            <p className="text-xl font-black text-black">
                                {searchResult.total_sections} Sections
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {searchResult.entities.length > 0 && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {searchResult.entities.slice(0, visibleCount).map((entity, idx) => (
                            <EntityCard
                                key={idx}
                                entity={entity}
                                entityColor={getEntityColor(entity)}
                                isSingleEntity={searchResult.entities.length === 1}
                                onClick={() =>
                                    handleSearchSelect(
                                        entity.type === "student" ? entity.id : entity.name,
                                        entity.type === "teacher",
                                        entity.type === "room"
                                    )
                                }
                            />
                        ))}
                    </div>

                    {searchResult.entities.length > visibleCount && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={() => setVisibleCount((prev) => prev + 6)}
                                className="group relative px-8 py-3 bg-white border-2 border-black font-black uppercase italic tracking-tighter hover:-translate-x-1 hover:-translate-y-1 transition-transform active:translate-x-0 active:translate-y-0"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Show More Items <ChevronDown size={20} strokeWidth={3} />
                                </span>
                                <div className="absolute inset-0 bg-black translate-x-1.5 translate-y-1.5 -z-10 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchResultDisplay;

import React, { useState, useEffect, useMemo } from "react";
import { Tooltip, Chip } from "@heroui/react";
import { BookOpen, AlertCircle, ChevronDown, CalendarDays, LayoutList } from "lucide-react";
import type { SearchResultStats, SearchEntity } from "../types";
import { getStudentColor, getKoreanName, getSectionNumber } from "../lib/utils";
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
    handleSearchToggle: (
        value: string,
        isTeacher?: boolean,
        isRoom?: boolean,
    ) => void;
    handleSearchSelect: (
        value: string,
        isTeacher?: boolean,
        isRoom?: boolean,
    ) => void;
}

const getEntityColor = (entity: SearchEntity) => {
    if (entity.type === "student") return getStudentColor(entity.id);
    if (entity.type === "teacher") return "#7828c8";
    if (entity.type === "room") return "#00B5E7";
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
    const [viewType, setViewType] = useState<"timetable" | "list">("timetable");

    useEffect(() => {
        setVisibleCount(6);
    }, [searchResult.keyword, searchResult.entities.length]);

    // 검색 쿼리를 하이라이트하고 클릭 가능한 링크로 변환하는 컴포넌트
    const QueryHighlighter = ({ query, prefix }: { query: string; prefix?: string }) => {
        if (!query) return null;

        const parts = query.split(/([\(\)&+!])/g).filter(p => p !== "");
        
        return (
            <div className="flex flex-wrap items-center gap-x-0.5">
                {prefix && (
                    <span className="text-black/40 mr-1">{prefix}:</span>
                )}
                {parts.map((part, i) => {
                    const isOperator = /[\(\)&+!]/.test(part);
                    if (isOperator) {
                        return (
                            <span key={i} className="text-retro-primary font-black px-0.5">
                                {part}
                            </span>
                        );
                    }
                    return (
                        <button
                            key={i}
                            onClick={() => handleSearchToggle(part.trim())}
                            className="hover:underline decoration-2 underline-offset-4 hover:text-retro-primary transition-all cursor-pointer font-black"
                        >
                            {part}
                        </button>
                    );
                })}
            </div>
        );
    };

    const matchSummary = useMemo(() => {
        const entities = searchResult.entities;
        const counts = {
            student: entities.filter(e => e.type === "student").length,
            teacher: entities.filter(e => e.type === "teacher").length,
            room: entities.filter(e => e.type === "room").length,
            subject: searchResult.total_subjects
        };

        const parts = [];
        if (counts.subject > 0) parts.push(`${counts.subject} Subject${counts.subject > 1 ? "s" : ""}`);
        if (counts.student > 0) parts.push(`${counts.student} Student${counts.student > 1 ? "s" : ""}`);
        if (counts.teacher > 0) parts.push(`${counts.teacher} Teacher${counts.teacher > 1 ? "s" : ""}`);
        if (counts.room > 0) parts.push(`${counts.room} Room${counts.room > 1 ? "s" : ""}`);

        return parts.length > 0 ? parts.join(" & ") + " Matched" : "No Matches";
    }, [searchResult]);

    const renderWarning = () => {
        if (!searchResult.warning) return null;
        return (
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0_0_rgba(255,165,0,0.4)] flex items-start gap-3 mb-8">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <p className="text-xs font-black uppercase text-orange-600 tracking-widest mb-1">Search Warning</p>
                    <p className="text-sm font-bold text-black leading-tight">{searchResult.warning}</p>
                </div>
            </div>
        );
    };

    const handleSubjectClick = (sub: string, mode: string) => {
        const parts = sub.split(" - ");
        let subjectFull = "", extraInfo = "";
        
        if (parts.length < 2) {
            subjectFull = sub;
        } else {
            if (mode === "room") {
                extraInfo = parts[0].trim();
                subjectFull = parts[1].trim();
            } else {
                subjectFull = parts[0].trim();
                extraInfo = parts[1].trim();
            }
        }

        const koreanName = getKoreanName(subjectFull);
        const sectionNum = getSectionNumber(subjectFull);

        if (koreanName && sectionNum) {
            handleSearchToggle(`${koreanName}/${sectionNum}`);
        } else {
            handleSearchToggle(koreanName || subjectFull.split("(")[0].trim());
        }
    };

    if (isConsolidatedView) {
        const primaryEntity = searchResult.entities[0];
        const bgColor = searchMode === "student" && primaryEntity 
            ? `${getStudentColor(primaryEntity.id)}15` 
            : searchMode === "room" 
                ? "rgba(0, 181, 231, 0.1)" 
                : searchMode === "teacher" 
                    ? "rgba(120, 40, 200, 0.05)"
                    : "rgba(0, 0, 0, 0.03)";

        return (
            <div className="flex flex-col">
                {renderWarning()}
                <div className="bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-black">
                    <div className={`p-8 flex flex-col relative ${searchMode === "general" ? "md:w-2/3" : "md:w-1/3"}`} style={{ backgroundColor: bgColor }}>
                        <div className="absolute top-0 left-0 px-6 py-1.5 bg-black text-white text-xs font-black tracking-widest uppercase">
                            {searchMode === "student" ? "Student Profile" : searchMode === "teacher" ? "Teacher Profile" : searchMode === "room" ? "Classroom Profile" : "Logical Search"}
                        </div>

                        <div className="mt-8 mb-10">
                            {searchMode !== "general" && primaryEntity ? (
                                <>
                                    {searchMode === "student" && <p className="text-xl font-black text-black/40 uppercase tracking-tighter mb-2">&nbsp;&nbsp;{primaryEntity.id}</p>}
                                    <h2 className="text-6xl font-black tracking-tighter" style={{ color: getEntityColor(primaryEntity) }}>
                                        {primaryEntity.name}
                                    </h2>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-black text-black/30 uppercase tracking-tighter mb-1">Active Query</p>
                                    <div className="text-5xl font-black tracking-tighter text-black uppercase break-all">
                                        <QueryHighlighter query={searchResult.keyword} prefix={searchResult.prefix} />
                                    </div>
                                </>
                            )}
                        </div>

                        {searchMode !== "general" && primaryEntity && (
                            <div className="pt-8 border-t-2 border-black/10 flex-1 flex flex-col gap-10">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-1">Matched Subjects</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-black text-black tracking-tighter">{searchResult.total_subjects}</span>
                                            <span className="text-[10px] font-black text-black/20 uppercase">Items</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-1">Total Sections</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-black text-black tracking-tighter">{searchResult.total_sections}</span>
                                            <span className="text-[10px] font-black text-black/20 uppercase">Classes</span>
                                        </div>
                                    </div>
                                </div>

                                {viewType === "timetable" && (
                                    <div className="flex flex-col gap-2">
                                        <div className="text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <BookOpen size={18} className="text-black/40" />
                                            <span>
                                                {searchMode === "student" ? "Enrollment" : searchMode === "teacher" ? "Teaching" : "Scheduled"} ({primaryEntity.subject_count})
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            {primaryEntity.subjects.map((sub, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSubjectClick(sub, searchMode)}
                                                    className="text-left text-xs font-bold text-black border-l-4 border-black/10 pl-3 py-1 hover:border-black hover:bg-black/5 transition-all truncate"
                                                    style={{ borderLeftColor: `${getEntityColor(primaryEntity)}40` }}
                                                >
                                                    {sub}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isLogicalSearch && searchResult.entities.length > 0 && (
                            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
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
                                                content: "p-0 rounded-none border border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                            }}
                                            content={
                                                <div className="flex divide-x-2 divide-black min-w-[320px] max-w-112.5 text-left">
                                                    <div className="p-4 flex flex-col justify-center min-w-30" style={{ backgroundColor: `${color}26` }}>
                                                        <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                            {entity.type === "student" ? "Student ID" : entity.type === "teacher" ? "Teacher" : "Room"}
                                                        </p>
                                                        {entity.type === "student" && <p className="text-xs font-black text-black leading-none mb-3">{entity.id}</p>}
                                                        <p className="text-xl font-black tracking-tight" style={{ color: color }}>{entity.name}</p>
                                                    </div>
                                                    <div className="p-4 flex-1 bg-white">
                                                        <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2"><BookOpen size={12} /> Assigned Classes</p>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                            {entity.subjects.slice(0, 8).map((sub, idx) => (
                                                                <div key={idx} className="text-[10px] font-bold text-black border-l-2 pl-1.5 truncate" style={{ borderColor: color }}>{sub.split("(")[0]}</div>
                                                            ))}
                                                            {entity.subjects.length > 8 && <p className="text-[9px] font-black text-black/30 pl-1.5">+ {entity.subjects.length - 8} more</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            }>
                                            <div
                                                className="student-badge cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
                                                style={{ borderColor: color, backgroundColor: `${color}20`, color: color }}
                                                onMouseEnter={() => setHoveredEntityId(entityKey)}
                                                onMouseLeave={() => setHoveredEntityId(null)}
                                                onClick={() => handleSearchToggle(entity.type === "student" ? entity.id : entity.name, entity.type === "teacher", entity.type === "room")}
                                            >
                                                {entity.type === "student" ? `${entity.id.split("-")[0]} ${entity.name}` : entity.type === "teacher" ? `${entity.name} T` : `${entity.name}`}
                                            </div>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className={`p-10 bg-white flex flex-col relative ${searchMode === "general" ? "md:w-1/3" : "md:w-2/3"}`}>
                        {searchMode !== "general" && primaryEntity && (
                            <div className="absolute top-3 right-4 flex bg-white border-2 border-black p-1 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] z-10">
                                <button
                                    onClick={() => setViewType("timetable")}
                                    className={`px-3 py-1.5 flex items-center gap-2 transition-all duration-200 ${viewType === "timetable" ? "text-white" : "bg-white text-black/30 hover:text-black hover:bg-retro-accent-light"}`}
                                    style={viewType === "timetable" ? { backgroundColor: getEntityColor(primaryEntity) } : {}}
                                >
                                    <CalendarDays size={14} strokeWidth={3} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Grid</span>
                                </button>
                                <button
                                    onClick={() => setViewType("list")}
                                    className={`px-3 py-1.5 flex items-center gap-2 transition-all duration-200 ${viewType === "list" ? "text-white" : "bg-white text-black/30 hover:text-black hover:bg-retro-accent-light"}`}
                                    style={viewType === "list" ? { backgroundColor: getEntityColor(primaryEntity) } : {}}
                                >
                                    <LayoutList size={14} strokeWidth={3} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">List</span>
                                </button>
                            </div>
                        )}

                        {searchMode !== "general" && primaryEntity ? (
                            viewType === "timetable" ? (
                                <div className="flex-1 flex flex-col">
                                    <div className="text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2 mb-3 pt-4">
                                        <CalendarDays size={18} className="text-black/40" />
                                        <span>Visual Schedule</span>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <TimetableGrid
                                            times={primaryEntity.times}
                                            color={getEntityColor(primaryEntity)}
                                            mode={searchMode}
                                            className="w-full"
                                            showTitle={false}
                                            onCellClick={(subject) => handleSearchToggle(subject)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col">
                                    <div className="text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2 mb-3 pt-4">
                                        <BookOpen size={18} className="text-black/40" />
                                        <span>
                                            {searchMode === "student" ? "Enrollment" : searchMode === "teacher" ? "Teaching" : "Scheduled"} ({primaryEntity.subject_count})
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 overflow-y-auto pr-2 custom-scrollbar">
                                        {primaryEntity.subjects.map((sub, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSubjectClick(sub, searchMode)}
                                                className="text-left text-sm font-bold text-black border-l-4 border-black/20 pl-3 truncate py-1.5 hover:border-black hover:bg-black/5 transition-all"
                                                style={{ borderLeftColor: `${getEntityColor(primaryEntity)}40` }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <div className="grid grid-cols-2 gap-10 mb-10">
                                    <div>
                                        <p className="text-sm font-black text-black/40 uppercase tracking-widest mb-2">Matched Subjects</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-black text-black tracking-tighter">{searchResult.total_subjects}</span>
                                            <span className="text-xs font-black text-black/30 uppercase">Items</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-black/40 uppercase tracking-widest mb-2">Total Sections</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-black text-black tracking-tighter">{searchResult.total_sections}</span>
                                            <span className="text-xs font-black text-black/30 uppercase">Classes</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-retro-bg/30 p-6 border border-black/10">
                                    <p className="text-xs font-bold leading-tight text-black/50 text-center">
                                        {isLogicalSearch ? "논리 연산이 적용된 결과입니다. 매칭되는 상세 분반 리스트는 아래 아코디언에서 확인하세요." : "검색 결과에 대한 요약 통계입니다."}
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
                <div className="absolute top-0 right-0 px-6 py-1.5 bg-black text-white text-xs font-black tracking-widest uppercase">Search Status</div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <div className="text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <BookOpen size={18} className="text-black/40" />
                            <span>Current Keyword</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-4xl font-black text-black uppercase tracking-tighter">
                                <QueryHighlighter query={searchResult.keyword} prefix={searchResult.prefix} />
                            </div>
                            <Chip className="bg-black text-white border border-black rounded-none font-black text-xs py-1 px-3">{searchResult.total_subjects} SUBJECTS MATCHED</Chip>
                        </div>
                    </div>
                    <div className="flex gap-10 border-t-2 md:border-t-0 md:border-l-2 border-black/10 pt-6 md:pt-0 md:pl-10">
                        <div>
                            <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">Identified</p>
                            <p className="text-xl font-black text-black">{matchSummary}</p>
                        </div>
                        <div>
                            <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">Match Scope</p>
                            <p className="text-xl font-black text-black">{searchResult.total_sections} Sections</p>
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
                                onClick={() => handleSearchSelect(entity.type === "student" ? entity.id : entity.name, entity.type === "teacher", entity.type === "room")}
                            />
                        ))}
                    </div>
                    {searchResult.entities.length > visibleCount && (
                        <div className="flex justify-center pt-10">
                            <button
                                onClick={() => setVisibleCount((prev) => prev + 6)}
                                className="px-10 py-4 bg-white border-2 border-black font-black uppercase tracking-tighter text-lg shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] hover:bg-retro-accent-light transition-colors active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-3"
                            >
                                Show More Items <ChevronDown size={24} strokeWidth={3} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchResultDisplay;

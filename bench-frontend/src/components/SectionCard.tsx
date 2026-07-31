import React, { useState, useMemo } from "react";
import { Tooltip } from "@heroui/react";
import { User, MapPin, Users, Clock } from "lucide-react";
import { getKoreanName, getStudentColor, DAY_MAP, DAYS_ORDER, extractSearchTerms } from "../lib/utils";
import type { Section } from "../types";
import { tooltipMotionProps } from "../constants/motion";
import TeacherCard from "./atoms/TeacherCard";

interface SectionCardProps {
    section: Section;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    selectedYears: string[];
    searchMode: "general" | "teacher" | "room";
}

const SectionCard: React.FC<SectionCardProps> = ({
    section,
    searchTerm,
    handleSearchToggle,
    teacherSubjectMap,
    isModifierPressed,
    selectedYears,
    searchMode,
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    const effectiveSearchTerms = useMemo(
        () => extractSearchTerms(searchTerm),
        [searchTerm],
    );

    const isTeacherSearching = useMemo(() => {
        return effectiveSearchTerms.some((term) =>
            section.teacher.toLowerCase().includes(term),
        );
    }, [effectiveSearchTerms, section.teacher]);

    const isRoomSearching = useMemo(() => {
        if (searchMode !== "room") return false;
        const searchRoom = effectiveSearchTerms[0]; // room 모드에서는 보통 단일 검색어
        if (!searchRoom) return false;

        const primaryMatch = section.room.toLowerCase().includes(searchRoom);
        const timesMatch = (section.times || []).some((t) =>
            t.room.toLowerCase().includes(searchRoom),
        );
        return primaryMatch || timesMatch;
    }, [effectiveSearchTerms, section.room, section.times, searchMode]);

    const teacherInfo = teacherSubjectMap[section.teacher] || {};
    const teacherClasses = Object.entries(teacherInfo).map(
        ([subject, sections]) => {
            const cleanSubject = getKoreanName(subject);
            const sectionNums = sections
                .map((s) => s.replace(/[^0-9]/g, ""))
                .sort()
                .join(",");
            return `${cleanSubject}(${sectionNums})`;
        },
    );

    return (
        // 원래는 12칸 격자였고 오른쪽 8칸이 통째로 수강생 배지였습니다.
        // ksa-bench 는 명단을 받지 않으므로 그 칸이 사라졌습니다 — 사람을 찾으려면
        // `student:` 검색으로 한 명씩 물어봅니다.
        <div>
            <div className="space-y-2.5">
                <h3 className="text-base font-black bg-retro-accent1 border-2 border-black px-3 py-1 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] inline-block uppercase">
                    {section.section}
                </h3>
                <div className="space-y-1.5">
                    <Tooltip
                        isOpen={
                            isModifierPressed &&
                            hoveredItemId === `teacher-${section.id}`
                        }
                        placement="top"
                        offset={15}
                        delay={0}
                        closeDelay={0}
                        motionProps={tooltipMotionProps}
                        classNames={{
                            base: "!transition-none",
                            content:
                                "p-0 rounded-none border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                        }}
                        content={
                            <TeacherCard
                                name={section.teacher}
                                subjects={teacherClasses}
                            />
                        }
                    >
                        <div
                            className={`flex items-center gap-3 text-sm font-black cursor-pointer transition-all h-8 px-3 py-0 -ml-2 border ${
                                isTeacherSearching
                                    ? "bg-retro-secondary text-white border-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] scale-105"
                                    : "hover:text-retro-secondary border-transparent"
                            }`}
                            onMouseEnter={() =>
                                setHoveredItemId(`teacher-${section.id}`)
                            }
                            onMouseLeave={() => setHoveredItemId(null)}
                            onClick={() =>
                                handleSearchToggle(section.teacher, true)
                            }
                        >
                            <User
                                size={20}
                                className={
                                    isTeacherSearching
                                        ? "text-white"
                                        : "text-retro-secondary"
                                }
                            />
                            <span>{section.teacher}</span>
                        </div>
                    </Tooltip>

                    <div
                        className={`flex items-center gap-3 text-sm font-black h-8 px-3 py-0 -ml-2 border transition-all cursor-pointer ${
                            isRoomSearching
                                ? "bg-retro-primary text-white border-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] scale-105"
                                : "text-black/70 border-transparent hover:text-retro-primary"
                        }`}
                        onClick={() => handleSearchToggle(section.room, false, true)}
                    >
                        <MapPin
                            size={20}
                            className={
                                isRoomSearching
                                    ? "text-white"
                                    : "text-retro-primary"
                            }
                        />
                        <span>{section.room}</span>
                    </div>
                    {/* 인원과 학번 분포. **이름은 없습니다** — 사람은 `student:` 검색으로
                        한 명씩 찾습니다 */}
                    <div className="flex items-center gap-3 text-sm font-black text-black/70 min-h-8 px-3 py-0 -ml-2 border-2 border-transparent">
                        <Users size={20} className="text-retro-accent4 shrink-0" />
                        <span>{section.student_count} Students</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                            {Object.entries(section.year_counts ?? {})
                                .filter(([year]) =>
                                    selectedYears.length === 0 ||
                                    selectedYears.includes(year),
                                )
                                .map(([year, count]) => (
                                    <span
                                        key={year}
                                        className="border px-1.5 py-0.5 text-[11px] font-black tabular-nums"
                                        style={{
                                            color: getStudentColor(`${year}-000`),
                                            borderColor: getStudentColor(`${year}-000`),
                                            backgroundColor: `${getStudentColor(`${year}-000`)}15`,
                                        }}
                                    >
                                        {year} {count}
                                    </span>
                                ))}
                        </span>
                    </div>

                    {section.times && section.times.length > 0 && (
                        <div className="flex items-center gap-3 text-sm font-black text-black/70 h-8 px-3 py-0 -ml-2 border-2 border-transparent">
                            <Clock size={20} className="text-retro-accent5" />
                            <div className="flex flex-wrap gap-x-2">
                                {(() => {
                                    const grouped: Record<string, number[]> = {};
                                    section.times.forEach((t) => {
                                        if (!grouped[t.day]) grouped[t.day] = [];
                                        grouped[t.day].push(t.period);
                                    });
                                    return DAYS_ORDER.filter((day) => grouped[day]).map((day) => {
                                        const periods = grouped[day].sort((a, b) => a - b);
                                        const isAnyPeriodMatch = periods.some((p) =>
                                            effectiveSearchTerms.some(
                                                (term) =>
                                                    term === `${DAY_MAP[day]}${p}` ||
                                                    term === `${day.toLowerCase()}${p}`,
                                            ),
                                        );
                                        return (
                                            <span key={day} className="flex gap-0.5 items-center mr-2">
                                                <span className={`transition-colors ${isAnyPeriodMatch ? "font-black text-retro-accent5" : "text-black/60"}`}>
                                                    {DAY_MAP[day]}
                                                </span>
                                                {periods.map((p, idx) => {
                                                    const isThisMatch = effectiveSearchTerms.some(
                                                        (term) =>
                                                            term === `${DAY_MAP[day]}${p}` ||
                                                            term === `${day.toLowerCase()}${p}`,
                                                    );
                                                    return (
                                                        <React.Fragment key={p}>
                                                            <span
                                                                className={`hover:text-retro-accent5 cursor-pointer transition-colors ${isThisMatch ? "font-black" : ""}`}
                                                                style={{ color: isThisMatch ? "#00c8ff" : "inherit" }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSearchToggle(`${DAY_MAP[day]}${p}`);
                                                                }}
                                                            >
                                                                {p}
                                                            </span>
                                                            {idx < periods.length - 1 && <span className="text-black/30">,</span>}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </span>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SectionCard;

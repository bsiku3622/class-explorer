import React, { useState, useMemo } from "react";
import { Tooltip } from "@heroui/react";
import { User, MapPin, Users, BookOpen, Clock } from "lucide-react";
import { getStudentColor } from "../lib/utils";
import type { Section } from "../types";
import { tooltipMotionProps } from "../constants/motion";

interface SectionCardProps {
    section: Section;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    hasStudentInSearch: boolean;
    selectedYears: string[];
    searchMode: "general" | "student" | "teacher" | "room";
}

const SectionCard: React.FC<SectionCardProps> = ({
    section,
    searchTerm,
    handleSearchToggle,
    studentSubjectMap,
    teacherSubjectMap,
    isModifierPressed,
    hasStudentInSearch,
    selectedYears,
    searchMode,
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    const effectiveSearchTerms = useMemo(() => {
        if (!searchTerm) return [];
        const clean = searchTerm.trim();
        let query = clean;
        if (clean.includes(":")) {
            const parts = clean.split(":", 2);
            query = parts[1].trim();
        }
        // +, &, /, (, ) 등의 연산자를 제외하고 순수 검색어들만 추출
        return query
            .split(/[\+&\/\(\)]/)
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k !== "");
    }, [searchTerm]);

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
            const cleanSubject = subject.split("(")[0];
            const sectionNums = sections
                .map((s) => s.replace(/[^0-9]/g, ""))
                .sort()
                .join(",");
            return `${cleanSubject}(${sectionNums})`;
        },
    );

    const filteredStudents = section.students.filter((s) =>
        selectedYears.includes(s.stuId.split("-")[0]),
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4 space-y-4">
                <h3 className="text-lg font-black bg-retro-accent1 border-2 border-black px-4 py-1.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] inline-block uppercase">
                    {section.section}
                </h3>
                <div className="space-y-3 pt-1">
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
                            <div className="flex divide-x-2 divide-black min-w-75">
                                <div className="p-4 bg-retro-secondary/10 flex flex-col justify-center min-w-25">
                                    <p className="text-xl font-black text-retro-secondary tracking-tight">
                                        {section.teacher}
                                    </p>
                                </div>
                                <div className="p-4 flex-1 bg-white">
                                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <BookOpen size={12} /> Assigned Classes
                                    </p>
                                    <div className="space-y-1.5">
                                        {teacherClasses.map((cls, i) => (
                                            <div
                                                key={i}
                                                className="text-[10px] font-bold text-black border-l-2 border-retro-secondary pl-1.5"
                                            >
                                                {cls}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
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
                    <div className="flex items-center gap-3 text-sm font-black text-black/70 h-8 px-3 py-0 -ml-2 border-2 border-transparent">
                        <Users size={20} className="text-retro-accent4" />
                        <span>{section.student_count} Students</span>
                    </div>

                    {section.times && section.times.length > 0 && (
                        <div className="flex items-center gap-3 text-sm font-black text-black/70 h-8 px-3 py-0 -ml-2 border-2 border-transparent">
                            <Clock size={20} className="text-retro-accent5" />
                            <div className="flex flex-wrap gap-x-2">
                                {(() => {
                                    const dayMap: Record<string, string> = {
                                        MON: "월",
                                        TUE: "화",
                                        WED: "수",
                                        THU: "목",
                                        FRI: "금",
                                    };
                                    const grouped: Record<string, number[]> =
                                        {};
                                    section.times.forEach((t) => {
                                        if (!grouped[t.day])
                                            grouped[t.day] = [];
                                        grouped[t.day].push(t.period);
                                    });
                                    const daysOrder = [
                                        "MON",
                                        "TUE",
                                        "WED",
                                        "THU",
                                        "FRI",
                                    ];
                                    return daysOrder
                                        .filter((day) => grouped[day])
                                        .map((day) => {
                                            const periods = grouped[day].sort(
                                                (a, b) => a - b,
                                            );
                                            const isAnyPeriodMatch = periods.some(p => 
                                                effectiveSearchTerms.some(term => 
                                                    term === `${dayMap[day]}${p}` || 
                                                    term === `${day.toLowerCase()}${p}`
                                                )
                                            );
                                            return (
                                                <span
                                                    key={day}
                                                    className="flex gap-0.5 items-center mr-2"
                                                >
                                                    <span className={`transition-colors ${isAnyPeriodMatch ? "font-black text-retro-accent5" : "text-black/60"}`}>
                                                        {dayMap[day]}
                                                    </span>
                                                    {periods.map((p, idx) => {
                                                        const isThisMatch = effectiveSearchTerms.some(term => 
                                                            term === `${dayMap[day]}${p}` || 
                                                            term === `${day.toLowerCase()}${p}`
                                                        );
                                                        return (
                                                            <React.Fragment key={p}>
                                                                <span
                                                                    className={`hover:text-retro-accent5 cursor-pointer transition-colors ${
                                                                        isThisMatch
                                                                        ? "font-black"
                                                                        : ""
                                                                    }`}
                                                                    style={{
                                                                        color: isThisMatch ? '#00c8ff' : 'inherit'
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSearchToggle(
                                                                            `${dayMap[day]}${p}`,
                                                                        );
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
            <div className="md:col-span-8">
                <div className="flex flex-wrap gap-2.5">
                    {filteredStudents.map((student) => {
                        const color = getStudentColor(student.stuId);

                        // 하이라이트는 일치하는 검색어가 있으면 항상 표시 (일반 검색 포함)
                        const isMatch = effectiveSearchTerms.some(
                            (term) =>
                                student.stuId.toLowerCase().includes(term) ||
                                student.name.toLowerCase().includes(term),
                        );

                        const shouldGrayOut = hasStudentInSearch && !isMatch;

                        const mySubjects =
                            studentSubjectMap[student.stuId] || [];

                        return (
                            <Tooltip
                                key={student.stuId}
                                isOpen={
                                    isModifierPressed &&
                                    hoveredItemId === student.stuId
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
                                    <div className="flex divide-x-2 divide-black min-w-[320px] max-w-112.5">
                                        <div
                                            className="p-4 flex flex-col justify-center min-w-30"
                                            style={{
                                                backgroundColor: `${color}26`,
                                            }}
                                        >
                                            <p className="text-xs font-black text-black leading-none mb-3">
                                                {student.stuId}
                                            </p>
                                            <p
                                                className="text-xl font-black tracking-tight"
                                                style={{ color: color }}
                                            >
                                                {student.name}
                                            </p>
                                        </div>
                                        <div className="p-4 flex-1 bg-white">
                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <BookOpen size={12} /> Enrolled
                                                Classes
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                {mySubjects.map((sub, i) => (
                                                    <div
                                                        key={i}
                                                        className="text-[10px] font-bold text-black border-l-2 pl-1.5 truncate"
                                                        style={{
                                                            borderColor: color,
                                                        }}
                                                    >
                                                        {sub.split("(")[0]}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                }
                            >
                                <div
                                    className={`student-badge cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                                        shouldGrayOut
                                            ? "grayscale opacity-30 scale-100 border-black/10 shadow-none"
                                            : isMatch
                                              ? "z-10 shadow-[3px_3px_0_0_rgba(0,0,0,0.1)]"
                                              : ""
                                    }`}
                                    style={{
                                        borderColor: shouldGrayOut
                                            ? "#00000020"
                                            : color,
                                        backgroundColor: shouldGrayOut
                                            ? "transparent"
                                            : `${color}20`,
                                        color: shouldGrayOut
                                            ? "rgba(0,0,0,0.6)"
                                            : color,
                                    }}
                                    onMouseEnter={() =>
                                        setHoveredItemId(student.stuId)
                                    }
                                    onMouseLeave={() => setHoveredItemId(null)}
                                    onClick={() =>
                                        handleSearchToggle(student.stuId)
                                    }
                                >
                                    {student.stuId.split("-")[0]} {student.name}
                                </div>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SectionCard;

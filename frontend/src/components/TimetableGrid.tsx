import React, { useMemo } from "react";
import type { SectionTime } from "../types";
import { getKoreanName, getSectionNumber, DAYS_ORDER, PERIODS } from "../lib/utils";

interface TimetableGridProps {
    times: SectionTime[];
    color?: string;
    className?: string;
    showTitle?: boolean;
    onCellClick?: (subject: string) => void;
    mode?: "student" | "teacher" | "room" | "general";
}

const DAYS = DAYS_ORDER;

const TimetableGrid: React.FC<TimetableGridProps> = ({
    times,
    color = "#7828c8",
    className = "",
    showTitle = true,
    onCellClick,
    mode = "general",
}) => {
    // 맵 생성을 useMemo로 최적화
    const timeMap = useMemo(() => {
        const map = new Map<string, SectionTime>();
        times.forEach((t) => {
            map.set(`${t.day}-${t.period}`, t);
        });
        return map;
    }, [times]);

    const getCellContent = (info: SectionTime) => {
        const koreanSubject = getKoreanName(info.subject || "");
        const sectionNum = getSectionNumber(info.section || "");
        const teacher = info.teacher || "";
        const room = info.room || "";

        if (!koreanSubject) {
            return { display: room, keyword: room };
        }

        const sectionPart = sectionNum ? `(${sectionNum})` : "";
        const subjectWithSection = `${koreanSubject}${sectionPart}`;

        let display = "";
        switch (mode) {
            case "teacher":
                display = `${subjectWithSection} - ${room}`;
                break;
            case "student":
                display = `${subjectWithSection} - ${teacher}`;
                break;
            case "room":
                display = `${teacher} - ${subjectWithSection}`;
                break;
            default:
                display = `${teacher} - ${subjectWithSection}`;
        }

        return { display, keyword: koreanSubject };
    };

    return (
        <div className={`flex flex-col ${className}`}>
            {showTitle && (
                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                    Visual Schedule
                </p>
            )}
            <div className="border border-black bg-white overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] divide-x divide-black border-b border-black bg-black text-white">
                    <div className="p-1 text-[9px] font-black text-center uppercase tracking-tighter flex items-center justify-center bg-black/50">
                        Pd
                    </div>
                    {DAYS.map((day) => (
                        <div
                            key={day}
                            className="p-1 text-[10px] font-black text-center uppercase flex items-center justify-center">
                            {day}
                        </div>
                    ))}
                </div>
                {PERIODS.map((period) => (
                    <div
                        key={period}
                        className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] h-16">
                        <div className="bg-black/5 flex items-center justify-center text-[10px] font-black">
                            {period}
                        </div>
                        {DAYS.map((day) => {
                            const info = timeMap.get(`${day}-${period}`);
                            const { display, keyword } = info ? getCellContent(info) : { display: "", keyword: "" };

                            return (
                                <div
                                    key={`${day}-${period}`}
                                    className={`relative group transition-all duration-200 border-b border-l border-black/10 ${display ? "cursor-pointer hover:border-transparent hover:z-30 hover:shadow-[0_0_15px_rgba(0,0,0,0.2)] active:scale-[0.98]" : ""}`}
                                    onClick={() => display && onCellClick?.(keyword)}>
                                    {display && (
                                        <>
                                            {/* Hover Overlay */}
                                            <div
                                                className="absolute border-2 transition-all duration-200 pointer-events-none z-30 opacity-0 group-hover:opacity-100"
                                                style={{
                                                    borderColor: color,
                                                    backgroundColor: `${color}15`,
                                                    top: "-1px",
                                                    left: "-2px",
                                                    right: "-1px",
                                                    bottom: "-2px",
                                                }}
                                            />
                                            {/* Cell Background & Content */}
                                            <div
                                                className="absolute inset-0 flex items-center p-1.5 pl-2.5 z-10"
                                                style={{ backgroundColor: `${color}10` }}
                                                title={display}>
                                                <span className="text-[11px] font-black text-black leading-[1.1] text-left break-all line-clamp-3 pointer-events-none">
                                                    {display}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimetableGrid;

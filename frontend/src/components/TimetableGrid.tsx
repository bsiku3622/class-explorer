import React from "react";
import type { SectionTime } from "../types";

import { getKoreanName, getSectionNumber } from "../lib/utils";

interface TimetableGridProps {
    times: SectionTime[];
    color?: string;
    className?: string;
    showTitle?: boolean;
    onCellClick?: (subject: string) => void;
    mode?: "student" | "teacher" | "room" | "general";
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const PERIODS = Array.from({ length: 11 }, (_, i) => i + 1);

const TimetableGrid: React.FC<TimetableGridProps> = ({
    times,
    color = "#7828c8",
    className = "",
    showTitle = true,
    onCellClick,
    mode = "general",
}) => {
    // 맵 생성: "DAY-PERIOD" -> { room, subject, section, teacher }
    const timeMap = new Map<string, SectionTime>();
    times.forEach((t) => {
        timeMap.set(`${t.day}-${t.period}`, t);
    });

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
                            className="p-1 text-[10px] font-black text-center uppercase italic flex items-center justify-center"
                        >
                            {day}
                        </div>
                    ))}
                </div>
                {PERIODS.map((period) => (
                    <div
                        key={period}
                        className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] divide-x divide-black border-b border-black/10 last:border-0 h-16"
                    >
                        <div className="bg-black/5 flex items-center justify-center text-[10px] font-black">
                            {period}
                        </div>
                        {DAYS.map((day) => {
                            const info = timeMap.get(`${day}-${period}`);
                            
                            let displayText = "";
                            let searchKeyword = "";
                            
                            if (info) {
                                const koreanSubject = getKoreanName(info.subject || "");
                                const sectionNum = getSectionNumber(info.section || "");
                                const teacher = info.teacher || "";
                                const room = info.room || "";
                                
                                if (koreanSubject) {
                                    const sectionPart = sectionNum ? `(${sectionNum})` : "";
                                    const subjectWithSection = `${koreanSubject}${sectionPart}`;
                                    
                                    if (mode === "teacher") {
                                        // 선생님 시간표: 과목(분반) - 교실
                                        displayText = `${subjectWithSection} - ${room}`;
                                    } else if (mode === "student") {
                                        // 학생 시간표: 과목(분반) - 선생님
                                        displayText = `${subjectWithSection} - ${teacher}`;
                                    } else if (mode === "room") {
                                        // 교실 시간표: 선생님 - 과목(분반)
                                        displayText = `${teacher} - ${subjectWithSection}`;
                                    } else {
                                        // 일반 모드: 선생님 - 과목(분반)
                                        displayText = `${teacher} - ${subjectWithSection}`;
                                    }
                                    searchKeyword = koreanSubject;
                                } else {
                                    displayText = room;
                                    searchKeyword = room;
                                }
                            }
                            
                            return (
                                <div
                                    key={`${day}-${period}`}
                                    className={`relative group transition-all duration-200 ${displayText ? "cursor-pointer hover:scale-[1.05] hover:z-30 hover:shadow-[0_0_15px_rgba(0,0,0,0.2)] active:scale-[0.98] hover:border-l-transparent" : ""}`}
                                    style={{
                                        backgroundColor: "transparent",
                                    }}
                                    onClick={() => displayText && onCellClick?.(searchKeyword)}
                                >
                                    {/* Hover Overlay: Background + Border (Only visible on hover) */}
                                    {displayText && (
                                        <div 
                                            className="absolute -inset-[1px] border-2 transition-all duration-200 pointer-events-none z-30 opacity-0 group-hover:opacity-100"
                                            style={{ 
                                                borderColor: color,
                                                backgroundColor: `${color}15`
                                            }}
                                        />
                                    )}
                                    {displayText && (
                                        <div
                                            className="absolute inset-0 flex items-center p-1.5 pl-2.5 z-10"
                                            title={displayText}
                                        >
                                            <span className="text-[11px] font-black text-black leading-[1.1] text-left break-all line-clamp-3 pointer-events-none">
                                                {displayText}
                                            </span>
                                        </div>
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

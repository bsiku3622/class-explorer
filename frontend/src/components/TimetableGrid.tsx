import React, { useMemo } from "react";
import type { SectionTime } from "../types";
import { getKoreanName, getSectionNumber, DAYS_ORDER, PERIODS } from "../lib/utils";
import {
    Text,
    TimetableGrid as FunkyTimetableGrid,
    ToneBox,
} from "@studio-baeks/funky-ui";

interface TimetableGridProps {
    times: SectionTime[];
    color?: string;
    /** 칸마다 다른 색을 쓰고 싶을 때. 반환값이 없으면 `color`로 떨어집니다 */
    colorFor?: (time: SectionTime) => string | undefined;
    /**
     * 이 과목만 남기고 나머지를 흐리게 합니다 — 목록에서 과목에 호버할 때 씁니다.
     * 색을 덧칠하지 않는 이유는 칸 색이 이미 상태(이동·충돌·들어옴)를 뜻하고 있어서입니다.
     */
    highlightSubject?: string | null;
    className?: string;
    showTitle?: boolean;
    onCellClick?: (subject: string) => void;
    mode?: "student" | "teacher" | "room" | "general";
}

const DAYS = DAYS_ORDER;

const TimetableGrid: React.FC<TimetableGridProps> = ({
    times,
    color = "#7828c8",
    colorFor,
    highlightSubject = null,
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
                <Text as="p" variant="overline" className="mb-3 flex items-center gap-2">
                    Visual Schedule
                </Text>
            )}
            <div className="overflow-x-auto">
                <FunkyTimetableGrid
                    flush
                    className="min-w-[300px] overflow-hidden"
                    days={DAYS.map((day) => ({ key: day, label: day }))}
                    periods={PERIODS.map((period) => ({
                        key: String(period),
                        label: period,
                    }))}
                    renderCell={(day, periodKey) => {
                        const period = Number(periodKey);
                        const info = timeMap.get(`${day}-${period}`);
                        const { display, keyword } = info ? getCellContent(info) : { display: "", keyword: "" };
                        // colorFor가 색을 지정한 칸은 강조 대상 — 배경을 진하게 깔아 눈에 띄게 합니다
                        const accent = info ? colorFor?.(info) : undefined;
                        const cellColor = accent || color;
                        const cellBg = accent ? `${accent}59` : `${color}10`;
                        const marked = !!highlightSubject && !!display;
                        const highlighted =
                            marked && info?.subject === highlightSubject;
                        const dimmed = marked && !highlighted;

                        return (
                            <div
                                className={`relative group h-16 transition-opacity duration-200 ${dimmed ? "opacity-20" : ""} ${highlighted ? "z-30" : ""} ${display ? "cursor-pointer hover:z-30 active:scale-[0.98]" : ""}`}
                                onClick={() => display && onCellClick?.(keyword)}>
                                {display && (
                                    <>
                                        {/* 마우스를 올렸을 때와, 밖에서 지목됐을 때 같은 테두리 */}
                                        <ToneBox
                                            tone={cellColor}
                                            className={`absolute pointer-events-none z-30 group-hover:opacity-100 ${highlighted ? "opacity-100" : "opacity-0"}`}
                                            style={{
                                                top: "-1px",
                                                left: "-2px",
                                                right: "-1px",
                                                bottom: "-2px",
                                            }}
                                        />
                                        {/* Cell Background & Content */}
                                        <div
                                            className="absolute inset-0 flex items-center p-1.5 pl-2.5 z-10"
                                            style={{
                                                backgroundColor: cellBg,
                                                // 강조 칸은 테두리까지 둘러 배경색만으로 헷갈리지 않게 합니다
                                                boxShadow: accent
                                                    ? `inset 0 0 0 2px ${accent}`
                                                    : undefined,
                                            }}
                                            title={display}>
                                            <Text
                                                variant="label"
                                                className="text-left break-all line-clamp-3 pointer-events-none">
                                                {display}
                                            </Text>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default TimetableGrid;

import React from "react";
import type { CalendarEvent } from "../types";
import {
    CATEGORY_STYLE,
    WEEKDAY_LABEL,
    inMonth,
    isSameDay,
    monthGrid,
    timeLabel,
    toKey,
    weekOf,
    type WeekMarker,
} from "../lib/calendar";

interface CalendarGridProps {
    year: number;
    month: number;
    byDate: Record<string, CalendarEvent[]>;
    markers: WeekMarker[];
    selected: string | null;
    onSelect: (key: string) => void;
}

/** 한 칸에 이만큼만 적고 나머지는 숫자로 접습니다 */
const MAX_CHIPS = 3;

/**
 * 월 달력 격자.
 *
 * 하루에 서너 건이 겹치는 날이 흔해서, 칸에는 **제목만 작게** 쌓고 자세한 건 날짜를
 * 눌렀을 때 보여 줍니다. 격자는 항상 6주로 그립니다 — 달마다 높이가 널뛰지 않게요.
 */
const CalendarGrid: React.FC<CalendarGridProps> = ({
    year,
    month,
    byDate,
    markers,
    selected,
    onSelect,
}) => {
    const days = monthGrid(year, month);
    const today = new Date();

    return (
        <div className="border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
            <div className="grid grid-cols-7 border-b-2 border-black">
                {WEEKDAY_LABEL.map((label, i) => (
                    <div
                        key={label}
                        className={`py-2 text-center text-[11px] font-black uppercase tracking-widest ${
                            i === 0
                                ? "text-retro-primary"
                                : i === 6
                                  ? "text-retro-accent5"
                                  : "text-black/40"
                        }`}
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {days.map((date, index) => {
                    const key = toKey(date);
                    const all = byDate[key] ?? [];
                    // 격자에는 **그날 시작하는** 일정만 적습니다. 걸치는 날마다 다 적으면
                    // `교직원 건강검진(~11.30)` 하나가 열 달을 도배해 달력이 못 쓰게 됩니다.
                    // 이어지는 중인 건 개수로만 알리고, 자세한 건 날짜를 누르면 나옵니다
                    const events = all.filter((e) => e.start_date === key);
                    const ongoing = all.length - events.length;
                    const outside = !inMonth(date, year, month);
                    const week = weekOf(date, markers);
                    const isToday = isSameDay(date, today);
                    const isSelected = selected === key;
                    const holiday = events.some((e) => e.category === "holiday");

                    return (
                        <button
                            key={key}
                            onClick={() => onSelect(key)}
                            className={`relative min-h-[92px] border-black/10 border-b border-r p-1.5 text-left align-top transition-colors duration-100 ${
                                index % 7 === 6 ? "border-r-0" : ""
                            } ${index >= 35 ? "border-b-0" : ""} ${
                                outside ? "bg-black/[0.02]" : "hover:bg-retro-accent-light"
                            } ${isSelected ? "bg-retro-accent-light" : ""}`}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={`inline-flex h-6 min-w-6 items-center justify-center px-1 text-[13px] font-black ${
                                        isToday ? "bg-black text-white" : ""
                                    } ${
                                        outside
                                            ? "text-black/20"
                                            : holiday || date.getDay() === 0
                                              ? "text-retro-primary"
                                              : date.getDay() === 6
                                                ? "text-retro-accent5"
                                                : "text-black"
                                    }`}
                                >
                                    {date.getDate()}
                                </span>
                                {/* 주차는 그 주의 첫 칸에만 — 매 칸에 적으면 격자가 시끄러워집니다 */}
                                {week !== null && index % 7 === 0 && (
                                    <span className="text-[10px] font-black text-black/25">
                                        {week}주
                                    </span>
                                )}
                            </div>

                            <div className="mt-1 space-y-0.5">
                                {events.slice(0, MAX_CHIPS).map((event) => {
                                    const time = timeLabel(event);
                                    return (
                                        <div
                                            key={`${event.id}-${key}`}
                                            className={`flex items-center gap-1 px-1 py-0.5 text-[11px] font-bold leading-tight ${
                                                CATEGORY_STYLE[event.category].chip
                                            } ${outside ? "opacity-40" : ""}`}
                                        >
                                            {event.is_personal && (
                                                <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-retro-green" />
                                            )}
                                            <span className="truncate">
                                                {time && (
                                                    <span className="mr-1 opacity-60">{time}</span>
                                                )}
                                                {event.title}
                                            </span>
                                        </div>
                                    );
                                })}
                                {events.length > MAX_CHIPS && (
                                    <div className="px-1 text-[11px] font-black text-black/35">
                                        +{events.length - MAX_CHIPS}
                                    </div>
                                )}
                                {ongoing > 0 && (
                                    <div className="px-1 text-[11px] font-bold text-black/25">
                                        ⋯ {ongoing}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarGrid;

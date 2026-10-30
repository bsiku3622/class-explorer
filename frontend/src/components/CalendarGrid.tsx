import React, { type ElementType } from "react";
import {
    Card,
    Paint,
    Pressable,
    Surface,
    Swatch,
    Text,
} from "@studio-baeks/funky-ui";
import type { CalendarEvent } from "../types";
import { CATEGORY_ACCENT } from "./calendarAccent";
import {
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

const SurfaceRoot = Surface as ElementType;

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
        <Card padding="0">
            <Surface border="line" borderSide="bottom" className="grid grid-cols-7">
                {WEEKDAY_LABEL.map((label, i) => (
                    <Text
                        key={label}
                        variant="overline"
                        tone={i === 0 ? "pink" : i === 6 ? "sky" : undefined}
                        align="center"
                        className="py-2"
                    >
                        {label}
                    </Text>
                ))}
            </Surface>

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
                        <SurfaceRoot
                            as={Pressable}
                            key={key}
                            fill={isSelected || outside ? "well" : "none"}
                            hoverable={!outside}
                            onClick={() => onSelect(key)}
                            className={`relative min-h-[92px] border-b-2 border-r-2 border-[var(--fk-line-subtle)] p-1.5 text-left align-top ${
                                index % 7 === 6 ? "border-r-0" : ""
                            } ${index >= 35 ? "border-b-0" : ""}`}
                        >
                            <div className="flex items-center justify-between">
                                <Surface
                                    as="span"
                                    fill={isToday ? "inverse" : "none"}
                                    className="inline-flex h-6 min-w-6 items-center justify-center px-1"
                                >
                                    <Text
                                        weight="black"
                                        tone={
                                            isToday
                                                ? "inverse"
                                                : outside
                                                  ? "faint"
                                                  : holiday || date.getDay() === 0
                                                    ? "pink"
                                                    : date.getDay() === 6
                                                      ? "sky"
                                                      : undefined
                                        }
                                    >
                                        {date.getDate()}
                                    </Text>
                                </Surface>
                                {/* 주차는 그 주의 첫 칸에만 — 매 칸에 적으면 격자가 시끄러워집니다 */}
                                {week !== null && index % 7 === 0 && (
                                    <Text variant="micro" tone="faint">
                                        {week}주
                                    </Text>
                                )}
                            </div>

                            <div className="mt-1 space-y-0.5">
                                {events.slice(0, MAX_CHIPS).map((event) => {
                                    const time = timeLabel(event);
                                    return (
                                        <Paint
                                            key={`${event.id}-${key}`}
                                            accent={CATEGORY_ACCENT[event.category]}
                                            variant="wash"
                                            className={`flex items-center gap-1 px-1 py-0.5 ${
                                                outside ? "opacity-40" : ""
                                            }`}
                                        >
                                            {event.is_personal && (
                                                <Swatch accent="green" className="shrink-0 rotate-45" />
                                            )}
                                            <Text
                                                variant="label"
                                                weight="bold"
                                                tone="inherit"
                                                truncate
                                            >
                                                {time && (
                                                    <span className="mr-1 opacity-60">{time}</span>
                                                )}
                                                {event.title}
                                            </Text>
                                        </Paint>
                                    );
                                })}
                                {events.length > MAX_CHIPS && (
                                    <Text as="div" variant="label" tone="muted" className="px-1">
                                        +{events.length - MAX_CHIPS}
                                    </Text>
                                )}
                                {ongoing > 0 && (
                                    <Text as="div" variant="label" weight="bold" tone="muted" className="px-1">
                                        ⋯ {ongoing}
                                    </Text>
                                )}
                            </div>
                        </SurfaceRoot>
                    );
                })}
            </div>
        </Card>
    );
};

export default CalendarGrid;

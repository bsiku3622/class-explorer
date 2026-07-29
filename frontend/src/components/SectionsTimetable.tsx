import React, { useMemo } from "react";
import type { SectionInfo, SlotKey } from "../lib/tradeEngine";
import { DAYS_ORDER, PERIODS, getSectionNumber } from "../lib/utils";

interface SectionsTimetableProps {
    /** 한 과목의 전체 분반 */
    sections: SectionInfo[];
    /** 현재 듣고 있는 분반 id */
    currentSectionId?: number;
    /** 다른 과목이 이미 차지한 슬롯 — 충돌 판정용 */
    busySlots?: Set<SlotKey>;
    /** 강조할 분반 id (호버·선택) */
    highlightSectionId?: number;
    onSectionHover?: (id: number | null) => void;
    onSectionClick?: (section: SectionInfo) => void;
}

type CellState = "current" | "free" | "blocked";

interface CellEntry {
    section: SectionInfo;
    state: CellState;
}

const STATE_STYLE: Record<CellState, string> = {
    current: "bg-black text-white border-black",
    free: "bg-retro-green/25 text-black border-black/40",
    blocked: "bg-black/[0.07] text-black/40 border-black/10 grayscale",
};

/**
 * 한 과목의 모든 분반을 하나의 주간 그리드에 겹쳐 보여줍니다.
 * 각 칸에는 그 시간에 수업이 있는 분반 번호가 들어가고,
 * 내 시간표와 겹치는 분반은 흐리게 처리해 이동 가능 여부를 한눈에 보여줍니다.
 */
const SectionsTimetable: React.FC<SectionsTimetableProps> = ({
    sections,
    currentSectionId,
    busySlots,
    highlightSectionId,
    onSectionHover,
    onSectionClick,
}) => {
    // 분반별 충돌 여부를 먼저 확정한 뒤 슬롯에 배치합니다
    const { cells, maxPeriod } = useMemo(() => {
        const stateById = new Map<number, CellState>();
        sections.forEach((sec) => {
            if (sec.id === currentSectionId) {
                stateById.set(sec.id, "current");
                return;
            }
            const blocked = busySlots
                ? sec.slots.some((slot) => busySlots.has(slot))
                : false;
            stateById.set(sec.id, blocked ? "blocked" : "free");
        });

        const map = new Map<SlotKey, CellEntry[]>();
        let highest = 0;
        sections.forEach((sec) => {
            sec.times.forEach((t) => {
                const key = `${t.day}-${t.period}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push({
                    section: sec,
                    state: stateById.get(sec.id) ?? "free",
                });
                if (t.period > highest) highest = t.period;
            });
        });
        return { cells: map, maxPeriod: highest };
    }, [sections, currentSectionId, busySlots]);

    const periods = useMemo(() => {
        const limit = Math.max(maxPeriod, PERIODS.length);
        return Array.from({ length: limit }, (_, i) => i + 1);
    }, [maxPeriod]);

    return (
        <div className="overflow-x-auto">
            <div className="border-2 border-black bg-white min-w-[320px] shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                <div className="grid grid-cols-[36px_repeat(5,1fr)] border-b-2 border-black bg-black text-white">
                    <div className="p-1 text-[9px] font-black text-center bg-black/50">
                        Pd
                    </div>
                    {DAYS_ORDER.map((day) => (
                        <div
                            key={day}
                            className="p-1 text-[10px] font-black text-center uppercase"
                        >
                            {day}
                        </div>
                    ))}
                </div>
                {periods.map((period) => (
                    <div
                        key={period}
                        className="grid grid-cols-[36px_repeat(5,1fr)] border-b border-black/10 last:border-b-0 min-h-[38px]"
                    >
                        <div className="bg-black/5 flex items-center justify-center text-[10px] font-black border-r border-black/10">
                            {period}
                        </div>
                        {DAYS_ORDER.map((day) => {
                            const entries = cells.get(`${day}-${period}`) ?? [];
                            return (
                                <div
                                    key={day}
                                    className="border-l border-black/10 p-1 flex flex-wrap gap-0.5 items-start content-start"
                                >
                                    {entries.map(({ section, state }) => {
                                        const dimmed =
                                            highlightSectionId !== undefined &&
                                            highlightSectionId !== section.id;
                                        return (
                                            <button
                                                key={section.id}
                                                onMouseEnter={() =>
                                                    onSectionHover?.(section.id)
                                                }
                                                onMouseLeave={() =>
                                                    onSectionHover?.(null)
                                                }
                                                onClick={() =>
                                                    onSectionClick?.(section)
                                                }
                                                title={`${getSectionNumber(section.section)}분반 · ${section.teacher} · ${section.room}`}
                                                className={`min-w-[20px] px-1 py-0.5 border text-[10px] font-black leading-none transition-all duration-100 ${STATE_STYLE[state]} ${dimmed ? "opacity-25" : ""}`}
                                            >
                                                {getSectionNumber(section.section)}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SectionsTimetable;

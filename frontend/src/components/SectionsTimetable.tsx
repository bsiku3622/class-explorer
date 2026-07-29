import React, { useMemo, useState } from "react";
import type { SectionInfo, SlotKey } from "../lib/tradeEngine";
import {
    DAYS_ORDER,
    PERIODS,
    getSectionNumber,
    formatSectionTimes,
} from "../lib/utils";

interface SectionsTimetableProps {
    /** 한 과목의 전체 분반 */
    sections: SectionInfo[];
    /** 현재 듣고 있는 분반 id */
    currentSectionId?: number;
    /** 다른 과목이 이미 차지한 슬롯 — 충돌 판정용 */
    busySlots?: Set<SlotKey>;
    onSectionClick?: (section: SectionInfo) => void;
}

type CellState = "current" | "free" | "blocked";

interface CellEntry {
    section: SectionInfo;
    state: CellState;
}

/** 내 분반만 진하게, 나머지는 연하게. 충돌은 주황으로 구분합니다 */
const STATE_STYLE: Record<CellState, string> = {
    current: "bg-retro-accent1 border-black text-black",
    free: "bg-retro-green/25 border-retro-green text-black",
    blocked: "bg-retro-accent4/25 border-retro-accent4 text-retro-accent4",
};

const STATE_LABEL: Record<CellState, string> = {
    current: "현재 수강 중",
    free: "이동 가능",
    blocked: "시간 충돌",
};

/**
 * 한 과목의 모든 분반을 하나의 주간 그리드에 겹쳐 보여줍니다.
 * 칸에는 분반 번호만 넣고, 자세한 내용은 마우스를 올렸을 때 그리드 아래에 띄웁니다.
 * (칸 위에 띄우면 가로 스크롤 컨테이너에 잘립니다)
 */
const SectionsTimetable: React.FC<SectionsTimetableProps> = ({
    sections,
    currentSectionId,
    busySlots,
    onSectionClick,
}) => {
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    const { cells, stateById, maxPeriod } = useMemo(() => {
        const states = new Map<number, CellState>();
        sections.forEach((sec) => {
            if (sec.id === currentSectionId) {
                states.set(sec.id, "current");
                return;
            }
            const blocked = busySlots
                ? sec.slots.some((slot) => busySlots.has(slot))
                : false;
            states.set(sec.id, blocked ? "blocked" : "free");
        });

        const map = new Map<SlotKey, CellEntry[]>();
        let highest = 0;
        sections.forEach((sec) => {
            sec.times.forEach((t) => {
                const key = `${t.day}-${t.period}`;
                const entry = { section: sec, state: states.get(sec.id) ?? "free" };
                const list = map.get(key);
                if (list) list.push(entry);
                else map.set(key, [entry]);
                if (t.period > highest) highest = t.period;
            });
        });
        return { cells: map, stateById: states, maxPeriod: highest };
    }, [sections, currentSectionId, busySlots]);

    const periods = useMemo(() => {
        const limit = Math.max(maxPeriod, PERIODS.length);
        return Array.from({ length: limit }, (_, i) => i + 1);
    }, [maxPeriod]);

    const hovered = sections.find((s) => s.id === hoveredId);
    const hoveredState = hovered ? stateById.get(hovered.id) : undefined;

    return (
        <div className="space-y-2">
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
                                                hoveredId !== null &&
                                                hoveredId !== section.id;
                                            return (
                                                <button
                                                    key={section.id}
                                                    onMouseEnter={() =>
                                                        setHoveredId(section.id)
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredId(null)
                                                    }
                                                    onClick={() =>
                                                        onSectionClick?.(section)
                                                    }
                                                    className={`min-w-[20px] px-1 py-0.5 border-2 text-[10px] font-black leading-none transition-all duration-100 ${STATE_STYLE[state]} ${dimmed ? "opacity-25" : ""}`}
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

            {/* 호버한 분반의 상세 — 자리를 항상 차지해 레이아웃이 흔들리지 않게 합니다 */}
            <div className="border-2 border-black bg-white px-2 py-1.5 min-h-[34px] flex items-center">
                {hovered ? (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-bold">
                        <span className="font-black text-xs">
                            {getSectionNumber(hovered.section)}분반
                        </span>
                        <span>{hovered.teacher}</span>
                        <span className="text-black/50">{hovered.room}</span>
                        <span className="text-black/50">
                            {formatSectionTimes(hovered.times)}
                        </span>
                        <span className="text-black/50">{hovered.studentCount}명</span>
                        {hoveredState && (
                            <span
                                className={`border-2 border-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                    hoveredState === "current"
                                        ? "bg-retro-accent1"
                                        : hoveredState === "free"
                                          ? "bg-retro-green/25"
                                          : "bg-retro-accent4/30"
                                }`}
                            >
                                {STATE_LABEL[hoveredState]}
                            </span>
                        )}
                    </div>
                ) : (
                    <p className="text-[10px] font-bold text-black/35">
                        칸에 마우스를 올리면 분반 정보가 나옵니다
                    </p>
                )}
            </div>
        </div>
    );
};

export default SectionsTimetable;

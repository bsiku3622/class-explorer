import React, { useMemo, useState, type ComponentProps } from "react";
import type { SectionInfo, SlotKey } from "../lib/tradeEngine";
import {
    DAYS_ORDER,
    PERIODS,
    getSectionNumber,
    formatSectionTimes,
} from "../lib/utils";
import {
    Badge,
    Button,
    Surface,
    Text,
    TimetableGrid as FunkyTimetableGrid,
} from "@studio-baeks/funky-ui";

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
const STATE_BUTTON: Record<CellState, ComponentProps<typeof Button>> = {
    current: { accent: "cyan", variant: "solid" },
    free: { accent: "green", variant: "outline" },
    blocked: { accent: "orange", variant: "plain" },
};

const STATE_BADGE: Record<CellState, ComponentProps<typeof Badge>> = {
    current: { accent: "cyan", variant: "solid" },
    free: { accent: "green", variant: "solidMuted" },
    blocked: { accent: "orange", variant: "solidMuted" },
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
                <FunkyTimetableGrid
                    className="min-w-[320px]"
                    days={DAYS_ORDER.map((day) => ({ key: day, label: day }))}
                    periods={periods.map((period) => ({
                        key: String(period),
                        label: period,
                    }))}
                    renderCell={(day, periodKey) => {
                        const entries = cells.get(`${day}-${Number(periodKey)}`) ?? [];
                        return (
                            <div className="flex flex-wrap items-start content-start gap-0.5">
                                {entries.map(({ section, state }) => {
                                    const dimmed =
                                        hoveredId !== null &&
                                        hoveredId !== section.id;
                                    return (
                                        <Button
                                            key={section.id}
                                            size="xs"
                                            {...STATE_BUTTON[state]}
                                            onMouseEnter={() =>
                                                setHoveredId(section.id)
                                            }
                                            onMouseLeave={() =>
                                                setHoveredId(null)
                                            }
                                            onClick={() =>
                                                onSectionClick?.(section)
                                            }
                                            className={`min-w-[20px] px-1 ${dimmed ? "opacity-25" : ""}`}
                                        >
                                            {getSectionNumber(section.section)}
                                        </Button>
                                    );
                                })}
                            </div>
                        );
                    }}
                />
            </div>

            {/* 호버한 분반의 상세 — 자리를 항상 차지해 레이아웃이 흔들리지 않게 합니다 */}
            <Surface border="line" className="flex min-h-[34px] items-center px-2 py-1.5">
                {hovered ? (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Text variant="caption" weight="black">
                            {getSectionNumber(hovered.section)}분반
                        </Text>
                        <Text variant="micro" weight="bold">{hovered.teacher}</Text>
                        <Text variant="micro" weight="bold" tone="muted">{hovered.room}</Text>
                        <Text variant="micro" weight="bold" tone="muted">
                            {formatSectionTimes(hovered.times)}
                        </Text>
                        <Text variant="micro" weight="bold" tone="muted">{hovered.studentCount}명</Text>
                        {hoveredState && (
                            <Badge size="sm" {...STATE_BADGE[hoveredState]}>
                                {STATE_LABEL[hoveredState]}
                            </Badge>
                        )}
                    </div>
                ) : (
                    <Text as="p" variant="micro" weight="bold" tone="muted">
                        칸에 마우스를 올리면 분반 정보가 나옵니다
                    </Text>
                )}
            </Surface>
        </div>
    );
};

export default SectionsTimetable;

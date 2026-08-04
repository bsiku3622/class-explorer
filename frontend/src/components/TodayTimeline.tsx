/**
 * 오늘 수업 — **줄 사이를 가는 선으로 나눈 목록**.
 *
 * 한때 줄마다 `border-2` 를 둘러 카드로 만들었는데, 카드 안에 카드가 여덟 개 든 꼴이라
 * 전부 같은 무게로 떠들고 정작 "지금" 이 묻혔습니다. `design-guide.md` 에도 내부는
 * `black/10` 구분선으로 나누라고 적혀 있습니다 — **테두리는 바깥 카드 하나면 됩니다.**
 *
 * 그래서 이 목록에서 면을 가진 건 **진행 중인 줄 하나뿐**입니다. 그 줄만 카드 좌우
 * 여백까지 꽉 채워(`-mx-5`) 핑크로 흐르고, 나머지는 흰 바탕에 글자만 있습니다.
 *
 * **빈 시간을 건너뛰지 않습니다.** 수업만 늘어놓으면 2교시 다음이 5교시인 게 안 보이고,
 * 정작 알고 싶은 건 "그 사이가 몇 분인가" 입니다.
 */

import React from "react";
import type { PeriodTime, TodayClass } from "../lib/friendsApi";
import { getKoreanName } from "../lib/utils";
import { duration } from "../lib/homeView";

type Row =
    | { kind: "class"; key: string; item: TodayClass; time: PeriodTime }
    | { kind: "free"; key: string; time: PeriodTime }
    | { kind: "gap"; key: string; periods: number[]; minutes: number };

/**
 * **공강을 한 교시씩** 늘어놓습니다. 묶어서 "3–4교시 비어 있음" 한 줄로 두면 줄 높이가
 * 제각각이라 훑을 때 리듬이 끊기고, 그 시간에 뭘 할지 정하려면 어차피 교시 단위로
 * 보게 됩니다.
 */
const buildAllPeriods = (today: TodayClass[], periods: PeriodTime[]): Row[] => {
    const byPeriod = new Map(today.map((c) => [c.period, c]));
    return periods.map((time) => {
        const item = byPeriod.get(time.period);
        return item
            ? { kind: "class" as const, key: `${time.period}-${item.subject}`, item, time }
            : { kind: "free" as const, key: `free-${time.period}`, time };
    });
};

const buildRows = (today: TodayClass[], periods: PeriodTime[]): Row[] => {
    const byPeriod = new Map(periods.map((p) => [p.period, p]));
    const mine = [...today].sort((a, b) => a.period - b.period);
    const rows: Row[] = [];

    mine.forEach((item, index) => {
        const time = byPeriod.get(item.period);
        if (!time) return;

        const prev = index > 0 ? mine[index - 1] : null;
        const prevTime = prev ? byPeriod.get(prev.period) : null;
        if (prev && prevTime && item.period - prev.period > 1) {
            rows.push({
                kind: "gap",
                key: `gap-${prev.period}`,
                periods: periods
                    .filter((p) => p.period > prev.period && p.period < item.period)
                    .map((p) => p.period),
                minutes: time.start_minute - prevTime.end_minute,
            });
        }
        rows.push({ kind: "class", key: `${item.period}-${item.subject}`, item, time });
    });

    return rows;
};

interface TodayTimelineProps {
    today: TodayClass[];
    periods: PeriodTime[];
    /**
     * 공강을 **한 교시씩** 줄로 그릴지. `false` 면 연속된 공강을 "3–4교시 비어 있음"
     * 한 줄로 묶습니다 — 하루 전체를 한 화면에 담아야 하는 V1 용입니다
     */
    showFree?: boolean;
    /** 자정 기준 분. `null` 이면 지난 수업을 흐리지 않습니다 */
    nowMinute: number | null;
    /**
     * 진행 중인 줄이 카드 여백까지 넘쳐 흐를지. 카드에 바로 얹을 때만 `true` 입니다 —
     * 스크롤 상자 안에서는 넘친 부분이 잘리거나 가로 스크롤을 만듭니다
     */
    bleed?: boolean;
    /** 이 교시 줄에 `focusRef` 를 붙입니다 — 스크롤 상자가 여기로 스크롤합니다 */
    focusPeriod?: number | null;
    focusRef?: React.Ref<HTMLLIElement>;
}

const TodayTimeline: React.FC<TodayTimelineProps> = ({
    today,
    periods,
    nowMinute,
    showFree = false,
    bleed = true,
    focusPeriod = null,
    focusRef,
}) => {
    const rows = showFree
        ? buildAllPeriods(today, periods)
        : buildRows(today, periods);

    return (
        <ul className="divide-y divide-black/10 border-y border-black/10">
            {rows.map((row) => {
                if (row.kind === "free") {
                    const past = nowMinute !== null && nowMinute >= row.time.end_minute;
                    const live =
                        nowMinute !== null &&
                        nowMinute >= row.time.start_minute &&
                        nowMinute < row.time.end_minute;
                    return (
                        <li
                            key={row.key}
                            className={`flex items-center gap-4 py-3 ${
                                past ? "opacity-40" : ""
                            } ${bleed ? "" : "px-3"}`}
                        >
                            <span className="w-12 shrink-0 leading-none">
                                <span className="block text-[15px] font-black tabular-nums text-black/35">
                                    {row.time.start}
                                </span>
                                <span className="mt-1 block text-[10px] font-bold tabular-nums text-black/25">
                                    {row.time.period}교시
                                </span>
                            </span>
                            <span className="min-w-0 flex-1 text-[15px] font-black text-black/25">
                                공강
                            </span>
                            {live && (
                                <span className="shrink-0 border-2 border-black bg-retro-primary px-1.5 py-0.5 text-[10px] font-black">
                                    지금
                                </span>
                            )}
                        </li>
                    );
                }

                if (row.kind === "gap") {
                    return (
                        <li
                            key={row.key}
                            className="flex items-center gap-2 py-2.5 pl-16 text-[11px] font-bold text-black/30"
                        >
                            <span className="h-px w-4 bg-black/20" />
                            {row.periods.length === 0
                                ? "비어 있음"
                                : row.periods.length === 1
                                  ? `${row.periods[0]}교시 비어 있음`
                                  : `${row.periods[0]}–${row.periods[row.periods.length - 1]}교시 비어 있음`}
                            <span className="tabular-nums text-black/25">
                                {duration(row.minutes)}
                            </span>
                        </li>
                    );
                }

                const { item, time } = row;
                const past = nowMinute !== null && nowMinute >= time.end_minute;
                const live =
                    nowMinute !== null &&
                    nowMinute >= time.start_minute &&
                    nowMinute < time.end_minute;
                const unassigned = item.room === "배정중";

                return (
                    <li
                        key={row.key}
                        ref={item.period === focusPeriod ? focusRef : undefined}
                        // 진행 중인 줄만 면을 갖습니다. 카드 여백까지 꽉 채워 흘러야
                        // 목록 안의 한 칸이 아니라 **지금 지나가는 구간**으로 읽힙니다
                        className={`flex items-center gap-4 py-3 ${
                            live
                                ? `border-y-2 border-black bg-retro-primary ${
                                      bleed ? "-mx-5 px-5 md:-mx-6 md:px-6" : "px-3"
                                  }`
                                : past
                                  ? "opacity-40"
                                  : ""
                        } ${!live && !bleed ? "px-3" : ""}`}
                    >
                        <span className="w-12 shrink-0 leading-none">
                            <span className="block text-[15px] font-black tabular-nums">
                                {time.start}
                            </span>
                            <span className="mt-1 block text-[10px] font-bold tabular-nums text-black/35">
                                {item.period}교시
                            </span>
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[17px] font-black leading-tight tracking-tight">
                                {getKoreanName(item.subject)}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] font-bold text-black/40">
                                {item.teacher} · {item.section.replace(/[^0-9]/g, "")}분반
                            </span>
                        </span>

                        {/* "배정중" 은 교실이 아니라 **아직 정해지지 않았다는 표시**라,
                            정해진 교실과 같은 무게로 그리면 안 읽고 지나칩니다 */}
                        <span
                            className={`shrink-0 text-[13px] font-black tabular-nums ${
                                unassigned ? "text-black/25" : ""
                            }`}
                        >
                            {item.room}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

export default TodayTimeline;

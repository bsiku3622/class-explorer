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
import { Link } from "react-router-dom";
import type { PeriodTime, TodayClass } from "../lib/friendsApi";
import { getDepartmentColor, getKoreanName } from "../lib/utils";
import { duration } from "../lib/homeView";
import { continuesClass } from "../lib/schedule";
import {
    searchHref,
    sectionQuery,
    subjectQuery,
    teacherQuery,
} from "../lib/searchEngine";

/** 연강이면 `periods` 가 둘 이상이고 `endTime` 이 마지막 교시입니다 */
/**
 * **한 교시가 차지하는 높이.** 줄 높이는 여기에 교시 수를 곱해서 나옵니다 — 목록도
 * 자(`DayRuler`)와 같은 시간 축이라, 100분짜리 연강이 50분 수업과 같은 높이면
 * 훑을 때 하루의 모양이 왜곡됩니다.
 *
 * ⚠️ 공강도 같은 값을 씁니다. 같은 50분인데 칸 높이가 다르면 목록이 시간을 재는
 * 물건이 아니게 됩니다.
 */
/**
 * 한 교시가 차지하는 높이. 줄 높이는 여기에 교시 수를 곱해서 나옵니다.
 *
 * ⚠️ **글자는 12px 아래로 내려가지 않습니다.** `김정은 · 1분반` 같은 부연을 10px 로
 * 줄였더니 화면에서 그냥 안 읽혔습니다 — 줄이 답답하면 글자 대신 **이 여백**을
 * 건드리세요.
 */
const ROW_REM = 3.25;

/** "지금" 을 뜻하는 핑크 — 면·띠·글자가 모두 같은 값을 씁니다 */
const NOW_PINK = "#ff4eba";

type Row =
    | {
          kind: "class";
          key: string;
          item: TodayClass;
          time: PeriodTime;
          endTime: PeriodTime;
          periods: number[];
      }
    | { kind: "free"; key: string; time: PeriodTime }
    | { kind: "gap"; key: string; periods: number[]; minutes: number };

/**
 * **공강을 한 교시씩** 늘어놓습니다. 묶어서 "3–4교시 비어 있음" 한 줄로 두면 줄 높이가
 * 제각각이라 훑을 때 리듬이 끊기고, 그 시간에 뭘 할지 정하려면 어차피 교시 단위로
 * 보게 됩니다.
 */
/**
 * 앞 줄에 잇는가 — 판정은 `lib/schedule.ts` 가 합니다. 주간 격자·자·히어로가 같은
 * 함수를 씁니다.
 */
const joins = (last: Row | undefined, item: TodayClass, time: PeriodTime): boolean =>
    last?.kind === "class" &&
    continuesClass(
        { klass: last.item, period: last.endTime.period, end_minute: last.endTime.end_minute },
        { klass: item, period: time.period, start_minute: time.start_minute },
    );

const buildAllPeriods = (today: TodayClass[], periods: PeriodTime[]): Row[] => {
    const byPeriod = new Map(today.map((c) => [c.period, c]));
    const rows: Row[] = [];
    periods.forEach((time) => {
        const item = byPeriod.get(time.period);
        if (!item) {
            rows.push({ kind: "free", key: `free-${time.period}`, time });
            return;
        }
        const last = rows[rows.length - 1];
        if (joins(last, item, time) && last.kind === "class") {
            last.endTime = time;
            last.periods.push(time.period);
            return;
        }
        rows.push({
            kind: "class",
            key: `${time.period}-${item.subject}`,
            item,
            time,
            endTime: time,
            periods: [time.period],
        });
    });
    return rows;
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
        const last = rows[rows.length - 1];
        if (joins(last, item, time) && last.kind === "class") {
            last.endTime = time;
            last.periods.push(item.period);
            return;
        }
        rows.push({
            kind: "class",
            key: `${item.period}-${item.subject}`,
            item,
            time,
            endTime: time,
            periods: [item.period],
        });
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
                    // **공강에도 "지금" 을 붙입니다.** 한동안 안 붙였는데(핑크는 "뭘
                    // 하고 있다" 는 뜻이니 빈 자리를 세게 만들지 말자는 것이었습니다),
                    // 목록에는 자와 달리 **캐럿이 없어서** 공강 시간에는 어디가 지금인지
                    // 짚어 주는 게 하나도 없었습니다.
                    //
                    // ⚠️ 대신 **수업 줄보다 옅게**(8% vs 12%) 칠하고 글자만 핑크로
                    // 둡니다 — 진행 중인 수업이 화면에서 여전히 더 무거워야 합니다
                    return (
                        <li
                            key={row.key}
                            // ⚠️ **공강도 수업과 같은 높이입니다.** 한때 낮게 눌러
                            // 놨는데(`py-1.5` · 12px), 같은 50분인데 칸 높이가 다르면
                            // 목록이 시간을 재는 물건이 아니게 됩니다 — 5교시 공강과
                            // 5교시 수업은 화면에서 같은 길이를 차지해야 합니다
                            style={{ minHeight: `${ROW_REM}rem` }}
                            className={`flex items-center gap-3 py-2 ${
                                live
                                    ? `border-y-2 border-retro-primary bg-retro-primary/[0.08] ${
                                          bleed ? "-mx-5 px-5 md:-mx-6 md:px-6" : "px-3"
                                      }`
                                    : past
                                      ? "opacity-55"
                                      : ""
                            } ${!live && !bleed ? "px-3" : ""}`}
                        >
                            {/* 수업 줄의 학과색 띠와 **자리를 맞춥니다** — 색만 없고
                                폭은 같아야 시각 숫자가 세로로 정렬됩니다 */}
                            <span
                                className="-mb-2 -mt-2 w-1 shrink-0 self-stretch"
                                style={live ? { backgroundColor: NOW_PINK } : undefined}
                            />
                            <span className="w-16 shrink-0 whitespace-nowrap leading-none">
                                <span
                                    className={`block text-[13px] font-black tabular-nums ${
                                        live ? "text-black" : "text-black/35"
                                    }`}
                                >
                                    {row.time.start}
                                </span>
                                <span
                                    className={`mt-1 block text-[12px] font-bold tabular-nums ${
                                        live ? "text-black/45" : "text-black/25"
                                    }`}
                                >
                                    {row.time.period}교시
                                </span>
                            </span>
                            <span
                                className="min-w-0 flex-1 text-[13px] font-black"
                                style={{ color: live ? NOW_PINK : undefined }}
                            >
                                <span className={live ? "" : "text-black/25"}>공강</span>
                            </span>

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
                // ⚠️ 연강은 **덩어리 전체**가 한 줄입니다 — 끝 시각은 `endTime` 에서
                // 봐야 10교시에 걸친 10–11교시 연강이 "지났다" 로 그려지지 않습니다
                const past = nowMinute !== null && nowMinute >= row.endTime.end_minute;
                const live =
                    nowMinute !== null &&
                    nowMinute >= time.start_minute &&
                    nowMinute < row.endTime.end_minute;
                const unassigned = item.room === "배정중";
                const color = getDepartmentColor(item.department);

                return (
                    <li
                        key={row.key}
                        ref={
                            focusPeriod !== null && row.periods.includes(focusPeriod)
                                ? focusRef
                                : undefined
                        }
                        // 진행 중인 줄만 면을 갖습니다. 카드 여백까지 꽉 채워 흘러야
                        // 목록 안의 한 칸이 아니라 **지금 지나가는 구간**으로 읽힙니다
                        // ⚠️ **진행 중인 줄을 형광 핑크로 꽉 채우지 않습니다.** 폭이
                        // 넓은 목록에서 한 줄이 통째로 형광이면 화면에서 제일 센
                        // 물건이 되어 다음 수업을 읽는 걸 방해했습니다. 옅은 면
                        // (12%)에 위아래 핑크 선으로 구간만 표시합니다
                        // 높이는 **교시 수에 비례**하고, 내용은 **위에 붙습니다** —
                        // 시작 시각이 덩어리 맨 위에 있어야 "19:30 에 시작해서 두
                        // 교시" 로 읽힙니다 (자·주간 격자의 위쪽 정렬과 같은 규칙)
                        style={{ minHeight: `${ROW_REM * row.periods.length}rem` }}
                        className={`flex items-center gap-3 py-2 ${
                            live
                                ? `border-y-2 border-retro-primary bg-retro-primary/[0.12] ${
                                      bleed ? "-mx-5 px-5 md:-mx-6 md:px-6" : "px-3"
                                  }`
                                : past
                                  ? "opacity-55"
                                  : ""
                        } ${!live && !bleed ? "px-3" : ""}`}
                    >
                        {/* 학과색 띠 — 주간 격자·자와 같은 색이라 세 자리에서
                            같은 과목이 같은 색으로 보입니다. 진행 중인 줄은 이미
                            핑크로 꽉 차 있어 띠를 얹지 않습니다 */}
                        <span
                            className="-mb-2 -mt-2 w-1 shrink-0 self-stretch"
                            style={{ backgroundColor: live ? NOW_PINK : color }}
                        />
                        <span className="w-16 shrink-0 whitespace-nowrap leading-none">
                            <span className="block text-[13px] font-black tabular-nums">
                                {time.start}
                            </span>
                            <span className="mt-1 block text-[12px] font-bold tabular-nums text-black/35">
                                {row.periods.length > 1
                                    ? `${row.periods[0]}–${row.periods[row.periods.length - 1]}교시`
                                    : `${item.period}교시`}
                            </span>
                        </span>

                        <span className="min-w-0 flex-1">
                            {/* 자·주간 격자와 같은 학과색 — 왼쪽 띠와 같은 색이라
                                띠가 무슨 뜻인지 따로 설명할 필요가 없습니다.
                                **진행 중이면 이름도 핑크**입니다 — 그 줄에서는 면·
                                띠·글자가 한 색으로 모입니다 */}
                            {/* 이름·교사·분반은 **검색으로 가는 문**입니다 —
                                여기서 궁금해지는 건 대개 "이 수업 누가 또 듣지",
                                "이 선생님 다른 수업은" 이고, 그건 검색 화면의 일입니다.
                                검색어는 `searchEngine` 이 자기 문법에 맞게 만듭니다 */}
                            <Link
                                to={searchHref(subjectQuery(item.subject))}
                                title={`${getKoreanName(item.subject)} 검색`}
                                className="block truncate text-[15px] font-black leading-tight tracking-tight hover:underline"
                                style={{ color: live ? NOW_PINK : color }}
                            >
                                {getKoreanName(item.subject)}
                            </Link>
                            <span className="mt-0.5 block truncate text-[12px] font-bold text-black/40">
                                <Link
                                    to={searchHref(teacherQuery(item.teacher))}
                                    title={`${item.teacher} 검색`}
                                    className="hover:underline"
                                >
                                    {item.teacher}
                                </Link>{" "}
                                ·{" "}
                                <Link
                                    to={searchHref(
                                        sectionQuery(item.subject, item.section),
                                    )}
                                    title={`${getKoreanName(item.subject)} ${item.section.replace(/[^0-9]/g, "")}분반 검색`}
                                    className="hover:underline"
                                >
                                    {item.section.replace(/[^0-9]/g, "")}분반
                                </Link>
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

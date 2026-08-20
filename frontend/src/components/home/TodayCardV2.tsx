/**
 * 홈 레이아웃 **버전 2** — 홈 전체가 낮은 카드 **하나**.
 *
 * V1 은 하루를 처음부터 끝까지 늘어놓느라 수업이 일곱이면 600px 을 넘어갑니다.
 * 여기서는 화면에서 세로를 아낍니다 — 하루 전체 대신 지금 언저리만 보여 주고 나머지는
 * 스크롤로 넘깁니다.
 *
 * ```
 * ┌ 지금 (18rem) ─────┬ 오늘 수업 (1fr) ──────┬ 급식 (17rem) ─┐
 * │ 8월 4일     6교시  │ TODAY                 │ MEAL   ‹ 오늘 › │
 * │ 일반지구과학       │  13:40 일반물리학1     │ 아침 점심 저녁  │
 * │ 과학관 204 · 이도현│ ▓14:40 일반지구과학▓   │ 아비꼬함박…    │
 * │ ───────────────── │  15:40 일반지구과학    │ 수제통살치킨… │
 * │ 오늘 일정          │  16:40 공강            │ …             │
 * └───────────────────┴───────────────────────┴───────────────┘
 * ```
 *
 * **왼쪽은 진술, 오른쪽 둘은 흐름입니다.** 가운데와 오른쪽은 생김새가 같은 우물
 * (소제목 + 스크롤 영역)이라 형제로 읽히고, 왼쪽만 고정된 상태를 말합니다. 세 칸을
 * 같은 무게로 나열하면 무엇이 주인공인지 안 보입니다.
 *
 * **너비는 내용이 정합니다.** 왼쪽 18rem 은 과목명 한 줄이 안 접히는 폭, 오른쪽 17rem 은
 * 급식 메뉴 한 줄이 안 접히는 폭입니다. 남는 건 전부 시간표가 가져갑니다.
 *
 * ⚠️ **시간표가 없는 날은 그 칸을 아예 없앱니다.** 방학에 `2fr` 을 빈 채로 두면 600px
 * 짜리 빈 상자가 남습니다 — 2열로 줄이고 남는 폭은 `VacationBar` 가 씁니다(가로로 재는
 * 물건이라 원래 폭이 필요했습니다).
 *
 * **목록은 지금을 가운데 두고 엽니다.** 위에서부터 열면 아침 수업이 보이는데, 이
 * 화면을 켜는 이유는 대개 "다음이 뭐였지" 입니다. 공강이면 다음 수업을 가운데 둡니다.
 */

import React, { useLayoutEffect, useRef } from "react";
import { CalendarDays, CalendarOff, MapPin } from "lucide-react";
import type { HomeData } from "../../lib/friendsApi";
import { dateLabel, deriveHomeView } from "../../lib/homeView";
import { getKoreanName } from "../../lib/utils";
import { CATEGORY_STYLE, timeLabel } from "../../lib/calendar";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";
import MealCard from "../MealCard";
import TodayTimeline from "../TodayTimeline";
import VacationBar from "../VacationBar";

/** 왼쪽 칸이 낮아야 카드도 낮습니다 — 넘치면 스크롤로 넘깁니다 */
const EVENT_LIMIT = 5;

interface TodayCardV2Props {
    home: HomeData;
    liveMinute: number;
    quip: string | null;
}

const TodayCardV2: React.FC<TodayCardV2Props> = ({ home, liveMinute, quip }) => {
    const { now, session, today, events, meal } = home;
    const periods = home.periods ?? [];
    const { isSchoolDay, livePeriod, current, next, periodLabel } = deriveHomeView(
        home,
        liveMinute,
    );

    const boxRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLLIElement>(null);
    /**
     * 목록을 어디에 맞춰 열지 — 지금 수업 → 다음 수업 → **마지막 수업**.
     * 하루가 다 끝났는데 맨 위(1교시)를 보여 주면 오늘 뭘 했는지가 안 보입니다.
     */
    const focusPeriod =
        livePeriod ?? next?.period ?? today[today.length - 1]?.period ?? null;
    const hasTimetable = today.length > 0;

    /**
     * 지금 줄이 가운데 오게 **스크롤 상자만** 움직입니다 — `scrollIntoView` 는 페이지
     * 까지 끌고 내려갑니다.
     *
     * `useLayoutEffect` + `requestAnimationFrame` 인 이유는 **높이가 아직 안 정해진
     * 채로 재면 0 이 나와서**입니다. 카드 높이가 `lg:h-[19rem]` 로 잡히기 전에 세면
     * 목록이 맨 위에 그대로 남습니다.
     */
    useLayoutEffect(() => {
        const place = () => {
            const box = boxRef.current;
            const row = rowRef.current;
            if (!box || !row || box.clientHeight === 0) return;
            box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2;
        };
        place();
        const frame = requestAnimationFrame(place);
        return () => cancelAnimationFrame(frame);
    }, [focusPeriod, hasTimetable, today]);

    const columns = hasTimetable
        ? "lg:grid-cols-[18rem_minmax(0,1fr)_17rem]"
        : "lg:grid-cols-[minmax(0,1fr)_17rem]";

    // **카드 높이는 지금 칸과 급식 칸 중 큰 쪽이 정합니다.** 시간표는 열한 줄이라
    // 높이 계산에 끼면 카드가 700px 이 되므로, 그 칸만 `absolute` 로 띄워 높이 계산에서
    // 빼고 남는 자리를 채우게 둡니다 (아래 `relative` + `absolute inset-0`).
    return (
        <RetroCard
            className={`grid overflow-hidden bg-white lg:min-h-[15rem] ${columns}`}
        >
            {/* ── 지금 ─────────────────────────────────────────────── */}
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden p-4 md:p-5">
                <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[11px] font-black tracking-wide text-black/40">
                        {dateLabel(now.date)}
                    </span>
                    {/* 시계는 두지 않습니다 — 지금이 몇 교시인지가 이 화면의 단위이고,
                        시각은 옆 목록의 줄마다 이미 붙어 있습니다 */}
                    {periodLabel && (
                        <span
                            className={`shrink-0 text-[11px] font-black ${
                                current
                                    ? "border-2 border-black bg-retro-primary px-1.5 py-0.5"
                                    : "text-black/40"
                            }`}
                        >
                            {periodLabel}
                        </span>
                    )}
                </div>

                <div className="mt-3">
                    {current ? (
                        <>
                            <p className="text-[22px] font-black leading-tight tracking-tight">
                                {getKoreanName(current.subject)}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] font-bold text-black/45">
                                <MapPin size={13} strokeWidth={2.75} className="shrink-0" />
                                <span className="font-black text-black">{current.room}</span>
                                <span>· {current.teacher}</span>
                                <span>· {current.section.replace(/[^0-9]/g, "")}분반</span>
                            </p>
                        </>
                    ) : (
                        <>
                            <p
                                className={`text-[22px] font-black leading-tight tracking-tight ${
                                    isSchoolDay ? "text-black/25" : "text-black"
                                }`}
                            >
                                {!isSchoolDay
                                    ? (session.off_label ?? "휴일")
                                    : today.length === 0
                                      ? "수업 없는 날"
                                      : next
                                        ? "공강"
                                        : "일과 종료"}
                            </p>
                            <p className="mt-1 text-[12px] font-bold text-black/45">
                                {next
                                    ? `다음 ${next.period}교시 ${getKoreanName(next.subject)} · ${next.room}`
                                    : (quip ?? "오늘 수업은 모두 끝났습니다.")}
                            </p>
                        </>
                    )}
                </div>

                {session.off_reason === "vacation" && session.resumes_on && (
                    <VacationBar
                        label={session.label}
                        since={session.since}
                        resumesOn={session.resumes_on}
                        daysLeft={session.days_left}
                    />
                )}

                {/* ── 오늘 학사일정 ─────────────────────────────────
                    ⚠️ 여기까지 **flex 사슬이 이어져야** 합니다. 중간에 그냥 `div` 를
                    끼우면 높이 제약이 안 내려가서 `overflow-y-auto` 가 무시되고 목록이
                    카드 밖으로 흘러넘칩니다 */}
                <div className="mt-4 flex min-h-0 flex-1 flex-col border-t-2 border-black/10 pt-3">
                    <RetroSubTitle title="Events" icon={CalendarDays} iconSize={14} />
                    {events.length === 0 ? (
                        <p className="mt-2 text-[12px] font-bold text-black/30">
                            등록된 일정이 없습니다
                        </p>
                    ) : (
                        <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                            {events.slice(0, EVENT_LIMIT).map((event) => (
                                <li key={event.id} className="flex items-center gap-2">
                                    <span
                                        className={`h-2 w-2 shrink-0 ${CATEGORY_STYLE[event.category].dot}`}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[12px] font-black">
                                        {event.title}
                                    </span>
                                    {timeLabel(event) && (
                                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-black/35">
                                            {timeLabel(event)}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    {events.length > EVENT_LIMIT && (
                        <p className="mt-1.5 text-[10px] font-bold text-black/25">
                            외 {events.length - EVENT_LIMIT}개
                        </p>
                    )}
                </div>
            </div>

            {/* ── 오늘 수업 — 지금을 가운데 두고 스크롤 ─────────────────
                수업이 없는 날엔 이 칸을 아예 그리지 않습니다. 빈 채로 두면 화면
                한가운데에 600px 짜리 빈 상자가 남습니다 */}
            {hasTimetable && (
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t-2 border-black/10 p-4 md:p-5 lg:border-l-2 lg:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                        <RetroSubTitle title="Today" icon={CalendarDays} iconSize={15} />
                        <span className="text-[11px] font-bold tabular-nums text-black/35">
                            수업 {today.length}개
                        </span>
                    </div>
                    {/* 좁은 화면에선 세로로 쌓이므로 `flex-1` 이 0 이 됩니다 — 그때만
                        높이를 직접 줍니다 */}
                    <div className="relative mt-2 h-64 min-h-0 lg:h-auto lg:flex-1">
                        <div
                            ref={boxRef}
                            className="absolute inset-0 overflow-y-auto"
                        >
                            <TodayTimeline
                                today={today}
                                periods={periods}
                                nowMinute={isSchoolDay ? liveMinute : null}
                                showFree
                                bleed={false}
                                focusPeriod={focusPeriod}
                                focusRef={rowRef}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── 급식 ─────────────────────────────────────────────
                테두리 없이 카드 안의 한 칸으로 들어갑니다 — 따로 카드를 두면 한 행이
                아니라 "큰 상자 + 작은 상자" 로 읽힙니다 */}
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t-2 border-black/10 lg:border-l-2 lg:border-t-0">
                {meal ? (
                    <MealCard meal={meal} bare fill />
                ) : (
                    <div className="flex flex-1 items-center justify-center p-5">
                        <p className="flex items-center gap-2 text-[12px] font-bold text-black/25">
                            <CalendarOff size={16} className="shrink-0" />
                            급식 정보가 없습니다
                        </p>
                    </div>
                )}
            </div>
        </RetroCard>
    );
};

export default TodayCardV2;

/**
 * 홈 레이아웃 **버전 1** — 세로로 긴 카드 하나에 자와 목록을 쌓습니다.
 *
 * 머리에 날짜·시계, 그 아래 하루 전체를 담은 가로 자(`DayRuler`), 그다음 오늘 수업을
 * 처음부터 끝까지 늘어놓은 목록(`TodayTimeline`).
 *
 * **하루가 다 보이는 대신 화면을 길게 씁니다.** 수업이 일곱이면 카드가 600px 을
 * 넘어갑니다 — 그 점이 불편해서 낮게 누른 판본이 `TodayCardV2` 입니다.
 */

import React from "react";
import { CalendarDays, CalendarOff } from "lucide-react";
import type { HomeData } from "../../lib/friendsApi";
import { dateLabel, deriveHomeView } from "../../lib/homeView";
import { hhmm } from "../../lib/utils";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";
import DayRuler from "../DayRuler";
import TodayTimeline from "../TodayTimeline";
import VacationBar from "../VacationBar";

interface TodayCardV1Props {
    home: HomeData;
    liveMinute: number;
    /** 수업 없는 날에 덧붙이는 한마디 */
    quip: string | null;
}

const TodayCardV1: React.FC<TodayCardV1Props> = ({ home, liveMinute, quip }) => {
    const { now, session, today } = home;
    const periods = home.periods ?? [];
    const breaks = home.breaks ?? [];
    const { isSchoolDay, current, periodLabel, freeMinutes } = deriveHomeView(
        home,
        liveMinute,
    );

    return (
        <RetroCard className="flex flex-col bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 border-b-2 border-black/10 pb-3">
                <span className="min-w-0">
                    <RetroSubTitle title="Today" icon={CalendarDays} />
                    <span className="mt-1 block truncate text-[11px] font-black tracking-wide text-black/40">
                        {dateLabel(now.date)}
                    </span>
                </span>

                <span className="shrink-0 text-right">
                    <span className="flex items-center justify-end gap-2">
                        <span className="text-2xl font-black leading-none tracking-tight tabular-nums">
                            {hhmm(liveMinute)}
                        </span>
                        {/* 수업 중이면 이 칩 하나가 "지금" 을 답니다 */}
                        {periodLabel && (
                            <span
                                className={`text-[11px] font-black ${
                                    current
                                        ? "border-2 border-black bg-retro-primary px-1.5 py-0.5"
                                        : "text-black/40"
                                }`}
                            >
                                {periodLabel}
                            </span>
                        )}
                    </span>
                    {today.length > 0 && (
                        <span className="mt-1 block text-[11px] font-bold tabular-nums text-black/35">
                            수업 {today.length}개
                            {freeMinutes > 0 &&
                                ` · 빈 시간 ${Math.floor(freeMinutes / 60)}시간 ${freeMinutes % 60}분`}
                        </span>
                    )}
                </span>
            </div>

            {/* 하루를 가로로 한 번 훑고(자), 그다음 줄로 읽습니다(목록) */}
            {today.length > 0 && (
                <DayRuler
                    periods={periods}
                    breaks={breaks}
                    today={today}
                    nowMinute={isSchoolDay ? liveMinute : null}
                />
            )}

            <div className="mt-5 flex-1">
                {today.length > 0 ? (
                    <TodayTimeline
                        today={today}
                        periods={periods}
                        nowMinute={isSchoolDay ? liveMinute : null}
                    />
                ) : (
                    <div className="py-2">
                        <p className="flex items-center gap-2.5 text-2xl font-black tracking-tighter">
                            <CalendarOff size={22} className="shrink-0 text-black/25" />
                            {isSchoolDay
                                ? "오늘은 수업이 없습니다"
                                : (session.off_label ?? "휴일")}
                        </p>
                        {quip && (
                            <p className="mt-1.5 text-[13px] font-bold text-black/35">
                                {quip}
                            </p>
                        )}

                        {session.off_reason === "vacation" && session.resumes_on && (
                            <VacationBar
                                label={session.label}
                                since={session.since}
                                resumesOn={session.resumes_on}
                                daysLeft={session.days_left}
                            />
                        )}
                    </div>
                )}
            </div>
        </RetroCard>
    );
};

export default TodayCardV1;

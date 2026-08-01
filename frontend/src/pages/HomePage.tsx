/**
 * 홈 — "지금 뭘 해야 하는가" 한 화면.
 *
 * 켜자마자 보이는 자리라 **한 요청(`GET /home`)으로 다 받습니다.** 여러 번 물어보면
 * 화면이 조각조각 채워지는 게 그대로 보입니다. (급식만 예외 — `MealCard` 참고)
 *
 * **방학·주말도 학기 중과 같은 레이아웃입니다.** 화면을 통째로 바꾸면 방학 안내가
 * 홈의 주인공이 되어 버립니다 — 자리는 그대로 두고 연한 한 줄로만 알립니다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, MapPin, Repeat } from "lucide-react";
import type { Term } from "../types";
import { fetchHome, type HomeData, type TodayClass } from "../lib/friendsApi";
import { isTradeAvailable } from "../lib/features";
import { getKoreanName } from "../lib/utils";
import RetroCard from "../components/atoms/RetroCard";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import RetroSpinner from "../components/atoms/RetroSpinner";
import MealCard from "../components/MealCard";

interface HomePageProps {
    term: Term | null;
}

/** 방학에 띄울 한마디. 날짜로 골라서 하루 안에는 안 바뀝니다 */
const VACATION_LINES = [
    "학교 생각은 접어두세요.",
    "시간표가 없다는 게 이렇게 좋습니다.",
    "오늘 1교시는 없습니다. 2교시도 없습니다.",
    "기상 시각은 본인이 정하는 겁니다.",
    "빈 강의실을 찾을 필요가 없는 날들.",
    "지금은 아무 데도 안 가도 됩니다.",
];

const DAY_LABEL: Record<string, string> = {
    MON: "월요일",
    TUE: "화요일",
    WED: "수요일",
    THU: "목요일",
    FRI: "금요일",
};

const ClassLine: React.FC<{ item: TodayClass; dim?: boolean }> = ({ item, dim }) => (
    <div
        className={`flex items-center justify-between gap-3 border-2 px-3 py-2 ${
            dim ? "border-black/15" : "border-black"
        }`}
    >
        <span className="flex min-w-0 items-center gap-2.5">
            <span className="w-8 shrink-0 text-xs font-black tabular-nums text-black/40">
                {item.period}교시
            </span>
            <span className="truncate text-sm font-black">
                {getKoreanName(item.subject)}
            </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-black/40">{item.room}</span>
    </div>
);

const HomePage: React.FC<HomePageProps> = ({ term }) => {
    const [home, setHome] = useState<HomeData | null>(null);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            setHome(await fetchHome(term));
        } catch {
            setHome(null);
        } finally {
            setLoading(false);
        }
    }, [term]);

    useEffect(() => {
        void reload();
    }, [reload]);

    // 1분마다 새로 받습니다 — "지금 몇 교시" 가 화면에 떠 있는 값이라 멈춰 있으면 틀립니다
    useEffect(() => {
        const timer = setInterval(() => void reload(), 60_000);
        return () => clearInterval(timer);
    }, [reload]);

    const vacationLine = useMemo(() => {
        if (!home?.now.date) return VACATION_LINES[0];
        const seed = Number(home.now.date.replaceAll("-", ""));
        return VACATION_LINES[seed % VACATION_LINES.length];
    }, [home?.now.date]);

    if (loading) {
        return (
            <div className="flex flex-col items-center gap-3 py-32">
                <RetroSpinner size="lg" />
            </div>
        );
    }

    if (!home) {
        return (
            <div className="border-2 border-black bg-white px-5 py-12 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                <p className="text-sm font-bold text-black/50">
                    지금 화면을 불러오지 못했습니다.
                </p>
            </div>
        );
    }

    const { now, session, today, current, next, meal } = home;
    const onVacation = !session.in_session;
    const isWeekend = now.day === null;

    /** 수업이 없을 때 Now 자리에 들어가는 한 줄 */
    const idleLine = onVacation
        ? `${session.label ?? "방학"}입니다`
        : isWeekend
          ? "주말입니다"
          : now.period
            ? "공강입니다"
            : "수업 시간이 아닙니다";

    /** Now 카드 오른쪽 위 — 오늘이 무슨 날이고 지금이 언제인지 */
    const whenLabel = onVacation
        ? session.label
        : isWeekend
          ? "주말"
          : DAY_LABEL[now.day!];
    const whenDetail =
        onVacation || isWeekend
            ? now.date
            : `${now.period ? `${now.period}교시` : "쉬는시간"}${
                  now.break_name ? ` · ${now.break_name}` : ""
              }`;

    return (
        <div className="flex flex-col gap-4 pb-20 md:gap-6">
            {/* ── 수강 변경 기간에만 ───────────────────────────────────── */}
            {isTradeAvailable(term) && (
                <Link
                    to="/trade"
                    className="flex items-center justify-between gap-4 border-2 border-black bg-retro-accent3 px-5 py-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <Repeat size={18} strokeWidth={2.5} className="shrink-0" />
                        <span className="truncate text-sm font-black">
                            트레이드 기능을 사용해 보세요
                        </span>
                    </span>
                    <ArrowRight size={18} strokeWidth={2.5} className="shrink-0" />
                </Link>
            )}

            {/* ── 지금 가야 하는 곳 · 급식 ─────────────────────────────── */}
            {/* 두 카드는 높이를 맞춥니다 — 나란히 놓고 한쪽만 짧으면 어긋나 보입니다 */}
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                <RetroCard
                    className={`flex h-full flex-col p-5 md:p-6 ${
                        current ? "bg-retro-accent1" : "bg-white"
                    }`}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <RetroSubTitle title="Now" icon={MapPin} />
                        <span className="text-right">
                            <span className="block text-xs font-black">{whenLabel}</span>
                            <span className="block text-xs font-bold text-black/40">
                                {whenDetail}
                            </span>
                        </span>
                    </div>

                    {/* 카드가 옆 칸 높이만큼 늘어나면 남는 자리를 여기가 먹습니다 —
                        아래 줄(다음 수업·개학까지)이 바닥에 붙게 */}
                    <div className="mt-3 flex-1">
                        {current ? (
                            <>
                                <p className="text-2xl font-black tracking-tighter">
                                    {getKoreanName(current.subject)}
                                </p>
                                <p className="mt-1 text-sm font-bold text-black/60">
                                    {current.room} · {current.teacher} ·{" "}
                                    {current.section.replace(/[^0-9]/g, "")}분반
                                </p>
                            </>
                        ) : (
                            <p className="text-2xl font-black tracking-tighter text-black/30">
                                {idleLine}
                            </p>
                        )}
                    </div>

                    {next && (
                        <div className="mt-4 flex items-center gap-2 border-t-2 border-black/10 pt-3 text-sm font-bold text-black/50">
                            <Clock size={14} strokeWidth={2.5} />
                            다음 {next.period}교시
                            <span className="font-black text-black">
                                {getKoreanName(next.subject)}
                            </span>
                            <span>{next.room}</span>
                        </div>
                    )}

                    {onVacation && session.days_left !== null && (
                        <div className="mt-4 flex items-center gap-2 border-t-2 border-black/10 pt-3 text-sm font-bold text-black/50">
                            <CalendarDays size={14} strokeWidth={2.5} />
                            개학까지
                            <span className="font-black tabular-nums text-black">
                                {session.days_left}일
                            </span>
                            <span>{session.resumes_on}</span>
                        </div>
                    )}
                </RetroCard>

                {meal && <MealCard meal={meal} />}
            </div>

            {/* ── 오늘 시간표 ──────────────────────────────────────────── */}
            <RetroCard className="bg-white p-5 md:p-6">
                <RetroSubTitle title="Today" icon={CalendarDays} />
                {today.length === 0 ? (
                    <div className="mt-3">
                        <p className="text-sm font-bold text-black/40">
                            {onVacation
                                ? "방학이라 시간표가 비어 있습니다."
                                : "오늘은 수업이 없습니다."}
                        </p>
                        {onVacation && (
                            <p className="mt-1 text-sm font-bold text-black/25">
                                {vacationLine}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="mt-3 space-y-1.5">
                        {today.map((item) => (
                            <ClassLine
                                key={`${item.period}-${item.subject}`}
                                item={item}
                                dim={now.period !== null && item.period < now.period}
                            />
                        ))}
                    </div>
                )}
            </RetroCard>
        </div>
    );
};

export default HomePage;

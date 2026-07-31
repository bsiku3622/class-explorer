/**
 * 홈 — "지금 뭘 해야 하는가" 한 화면.
 *
 * 켜자마자 보이는 자리라 **한 요청(`GET /home`)으로 다 받습니다.** 여러 번 물어보면
 * 화면이 조각조각 채워지는 게 그대로 보입니다.
 *
 * 방학이면 시간표 대신 남은 날짜와 한마디를 띄웁니다 — 학기 중 화면을 그대로 두면
 * 빈 칸만 잔뜩 남습니다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import { CalendarDays, Clock, MapPin, Users, UtensilsCrossed } from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    fetchFriends,
    fetchHome,
    type Friend,
    type HomeData,
    type TodayClass,
} from "../lib/friendsApi";
import { getKoreanName } from "../lib/utils";
import RetroCard from "../components/atoms/RetroCard";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import FriendsModal from "../components/FriendsModal";

interface HomePageProps {
    term: Term | null;
    myStuId: string | null;
    studentName: string | null;
    allClassesData: SubjectData[];
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

const MEAL_LABEL: Record<string, string> = {
    breakfast: "아침",
    lunch: "점심",
    dinner: "저녁",
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

const HomePage: React.FC<HomePageProps> = ({
    term,
    myStuId,
    studentName,
    allClassesData,
}) => {
    const [home, setHome] = useState<HomeData | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    const reload = useCallback(async () => {
        try {
            const [homeData, friendList] = await Promise.all([
                fetchHome(term),
                fetchFriends(),
            ]);
            setHome(homeData);
            setFriends(friendList);
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
                <Spinner color="primary" size="lg" />
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

    const { now, session, today, current, next, friends: friendInfo, meal } = home;
    const onVacation = !session.in_session;
    const isWeekend = now.day === null;

    return (
        <div className="flex flex-col gap-4 pb-20 md:gap-6">
            {/* 지금 */}
            <RetroCard className="bg-white p-6 md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-black/40">
                            {studentName ? `${studentName} 님` : "오늘"}
                        </p>
                        <p className="mt-1 text-4xl font-black tracking-tighter tabular-nums md:text-5xl">
                            {now.time}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-black">
                            {onVacation
                                ? session.label
                                : isWeekend
                                  ? "주말"
                                  : `${DAY_LABEL[now.day!]}`}
                        </p>
                        {!onVacation && !isWeekend && (
                            <p className="text-xs font-bold text-black/40">
                                {now.period ? `${now.period}교시` : "쉬는시간"}
                                {now.break_name && ` · ${now.break_name}`}
                            </p>
                        )}
                    </div>
                </div>
            </RetroCard>

            {onVacation ? (
                /* ── 방학 ─────────────────────────────────────────────── */
                <RetroCard className="bg-retro-accent3 p-8 text-center md:p-12">
                    <p className="text-3xl font-black tracking-tighter md:text-4xl">
                        {session.label}입니다
                    </p>
                    <p className="mt-3 text-sm font-bold text-black/60">{vacationLine}</p>
                    {session.days_left !== null && (
                        <p className="mt-6 inline-block border-2 border-black bg-white px-4 py-2 text-sm font-black">
                            개학까지 <span className="tabular-nums">{session.days_left}</span>일
                            <span className="ml-2 font-bold text-black/40">
                                {session.resumes_on}
                            </span>
                        </p>
                    )}
                </RetroCard>
            ) : isWeekend ? (
                <RetroCard className="bg-white p-8 text-center">
                    <p className="text-xl font-black">주말입니다</p>
                    <p className="mt-2 text-sm font-bold text-black/40">
                        오늘은 시간표가 없습니다.
                    </p>
                </RetroCard>
            ) : (
                <>
                    {/* ── 지금 가야 하는 곳 ────────────────────────────── */}
                    <RetroCard className={`p-6 ${current ? "bg-retro-accent1" : "bg-white"}`}>
                        <RetroSubTitle title="Now" icon={MapPin} />
                        {current ? (
                            <div className="mt-3">
                                <p className="text-2xl font-black tracking-tighter">
                                    {getKoreanName(current.subject)}
                                </p>
                                <p className="mt-1 text-sm font-bold text-black/60">
                                    {current.room} · {current.teacher} ·{" "}
                                    {current.section.replace(/[^0-9]/g, "")}분반
                                </p>
                            </div>
                        ) : (
                            <p className="mt-3 text-2xl font-black tracking-tighter text-black/30">
                                {now.period ? "공강입니다" : "수업 시간이 아닙니다"}
                            </p>
                        )}

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
                    </RetroCard>

                    {/* ── 오늘 시간표 ──────────────────────────────────── */}
                    <RetroCard className="bg-white p-5 md:p-6">
                        <RetroSubTitle title="Today" icon={CalendarDays} />
                        {today.length === 0 ? (
                            <p className="mt-3 text-sm font-bold text-black/40">
                                오늘은 수업이 없습니다.
                            </p>
                        ) : (
                            <div className="mt-3 space-y-1.5">
                                {today.map((item) => (
                                    <ClassLine
                                        key={`${item.period}-${item.subject}`}
                                        item={item}
                                        dim={
                                            now.period !== null && item.period < now.period
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </RetroCard>
                </>
            )}

            {/* ── 급식 ─────────────────────────────────────────────────── */}
            {meal.menu && (
                <RetroCard className="bg-white p-5 md:p-6">
                    <RetroSubTitle title="Meal" icon={UtensilsCrossed} />
                    <div className="mt-3 space-y-2">
                        {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
                            <div
                                key={slot}
                                className={`border-2 px-3 py-2 ${
                                    meal.slot === slot
                                        ? "border-black bg-retro-accent2"
                                        : "border-black/15"
                                }`}
                            >
                                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                    {MEAL_LABEL[slot]}
                                </p>
                                <p className="mt-0.5 text-sm font-bold leading-snug">
                                    {meal.menu?.[slot] || "—"}
                                </p>
                            </div>
                        ))}
                    </div>
                </RetroCard>
            )}

            {/* ── 친구 ─────────────────────────────────────────────────── */}
            <button
                onClick={() => setModalOpen(true)}
                className="flex items-center justify-between gap-4 border-2 border-black bg-white px-5 py-4 text-left shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
                <span className="flex items-center gap-2.5">
                    <Users size={18} strokeWidth={2.5} className="text-black/40" />
                    <span className="text-sm font-black">
                        {friendInfo.total === 0
                            ? "친구 등록하기"
                            : friendInfo.counted
                              ? `지금 공강인 친구 ${friendInfo.free.length}명`
                              : `등록한 친구 ${friendInfo.total}명`}
                    </span>
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                    {friendInfo.free.slice(0, 4).map((friend) => (
                        <span
                            key={friend.stuId}
                            className="border-2 border-black bg-retro-accent3 px-2 py-0.5 text-xs font-black"
                        >
                            {friend.name}
                        </span>
                    ))}
                    {friendInfo.free.length > 4 && (
                        <span className="px-1 text-xs font-bold text-black/40">
                            +{friendInfo.free.length - 4}
                        </span>
                    )}
                </span>
            </button>

            <FriendsModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                free={friendInfo.free}
                counted={friendInfo.counted}
                myStuId={myStuId}
                allClassesData={allClassesData}
                friends={friends}
                onChanged={reload}
            />
        </div>
    );
};

export default HomePage;

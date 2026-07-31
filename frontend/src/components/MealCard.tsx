/**
 * 급식 — 날짜를 앞뒤로 넘겨 봅니다.
 *
 * **오늘 것은 다시 부르지 않습니다.** `GET /home` 에 이미 들어 있어서, 오늘을 보고 있는
 * 동안에는 홈이 주는 값을 그대로 씁니다. 날짜를 옮겼을 때만 `GET /meal` 을 부릅니다.
 *
 * 홈은 1분마다 다시 받지만 **보고 있던 날짜는 그대로 둡니다** — 어제 급식을 읽는 중에
 * 화면이 오늘로 튀면 안 됩니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import {
    fetchMeal,
    type MealMenu,
    type MealSlot,
    type HomeData,
} from "../lib/friendsApi";
import RetroCard from "./atoms/RetroCard";
import RetroSubTitle from "./atoms/RetroSubTitle";

/** 서버가 여는 범위와 같습니다 (`MEAL_RANGE_DAYS`) */
const RANGE_DAYS = 31;

const SLOTS: { key: MealSlot; label: string }[] = [
    { key: "breakfast", label: "아침" },
    { key: "lunch", label: "점심" },
    { key: "dinner", label: "저녁" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** `"2026-08-01"` 에서 며칠 옮긴 날짜. 로컬 시간대로 셉니다 */
const shift = (iso: string, days: number): Date => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day + days);
};

const toIso = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
    ).padStart(2, "0")}`;

interface MealCardProps {
    /** `GET /home` 이 준 급식. 서버 기준 오늘과 그날 메뉴 */
    meal: NonNullable<HomeData["meal"]>;
}

const MealCard: React.FC<MealCardProps> = ({ meal }) => {
    const [offset, setOffset] = useState(0);
    const [fetched, setFetched] = useState<MealMenu | null>(null);
    const [loading, setLoading] = useState(false);

    const date = useMemo(() => shift(meal.date, offset), [meal.date, offset]);
    const iso = toIso(date);

    // 날짜를 옮길 때 켜고, 받아 오면 끕니다. effect 본문에서 켜면 렌더가 한 번 더 돕니다
    const move = (next: number) => {
        setOffset(next);
        setLoading(next !== 0);
    };

    useEffect(() => {
        if (offset === 0) return;
        let alive = true;
        fetchMeal(iso)
            .then((res) => alive && setFetched(res.menu))
            .catch(() => alive && setFetched(null))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, [iso, offset]);

    const menu = offset === 0 ? meal.menu : fetched;

    const label =
        offset === 0
            ? "오늘"
            : offset === -1
              ? "어제"
              : offset === 1
                ? "내일"
                : `${date.getMonth() + 1}월 ${date.getDate()}일`;

    return (
        <RetroCard className="bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <RetroSubTitle title="Meal" icon={UtensilsCrossed} />
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => move(offset - 1)}
                        disabled={offset <= -RANGE_DAYS}
                        aria-label="하루 전"
                        className="border-2 border-black bg-white p-1 transition-all duration-100 hover:bg-retro-accent-light active:scale-95 disabled:opacity-25"
                    >
                        <ChevronLeft size={16} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => move(0)}
                        disabled={offset === 0}
                        className="min-w-[7.5rem] px-2 text-center text-xs font-black tabular-nums disabled:cursor-default"
                    >
                        {label}
                        <span className="ml-1.5 font-bold text-black/40">
                            {date.getMonth() + 1}/{date.getDate()} (
                            {WEEKDAYS[date.getDay()]})
                        </span>
                    </button>
                    <button
                        onClick={() => move(offset + 1)}
                        disabled={offset >= RANGE_DAYS}
                        aria-label="하루 뒤"
                        className="border-2 border-black bg-white p-1 transition-all duration-100 hover:bg-retro-accent-light active:scale-95 disabled:opacity-25"
                    >
                        <ChevronRight size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {menu === null ? (
                <p className="mt-3 text-sm font-bold text-black/30">
                    {loading ? "불러오는 중…" : "이날은 급식이 없습니다."}
                </p>
            ) : (
                <div
                    className={`mt-3 grid gap-2 transition-opacity duration-100 md:grid-cols-3 ${
                        loading ? "opacity-40" : ""
                    }`}
                >
                    {SLOTS.map(({ key, label: slotLabel }) => {
                        const items = menu[key] ?? [];
                        // 시안은 이 화면에서 "지금" 을 뜻합니다 — 오늘을 보고 있을 때만
                        const isNow = offset === 0 && meal.slot === key;
                        return (
                            <div
                                key={key}
                                className={`border-2 px-3 py-2 ${
                                    isNow
                                        ? "border-black bg-retro-accent1"
                                        : "border-black/15"
                                }`}
                            >
                                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                    {slotLabel}
                                </p>
                                {items.length === 0 ? (
                                    <p className="mt-1 text-sm font-bold text-black/25">
                                        —
                                    </p>
                                ) : (
                                    <ul className="mt-1 space-y-0.5">
                                        {items.map((item) => (
                                            <li
                                                key={item}
                                                className="text-sm font-bold leading-snug"
                                            >
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </RetroCard>
    );
};

export default MealCard;

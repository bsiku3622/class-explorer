/**
 * 급식 — 끼니를 골라 보고, 날짜를 앞뒤로 넘깁니다.
 *
 * **세 끼를 한꺼번에 늘어놓지 않습니다.** 한 끼가 예닐곱 줄이라 셋을 펼치면 카드 혼자
 * 화면을 차지합니다. 지금 시간대의 끼니를 골라 두고 나머지는 버튼으로 둡니다.
 *
 * **메뉴는 이 카드가 직접 받습니다** (`GET /meal`). 홈 응답에 묶으면 학교 API 가 3~5초씩
 * 걸리는 동안 홈 전체가 비어 있게 됩니다 — 여기서 받으면 급식 칸만 기다립니다. 그날 첫
 * 조회만 느리고, 서버가 DB 에 쌓아 두므로 다음부터는 바로 옵니다.
 *
 * 홈은 1분마다 다시 받지만 **보고 있던 날짜는 그대로 둡니다** — 어제 급식을 읽는 중에
 * 화면이 오늘로 튀면 안 됩니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import {
    fetchMeal,
    type HomeData,
    type MealMenu,
    type MealSlot,
} from "../lib/friendsApi";
import RetroButton from "./atoms/RetroButton";
import RetroCard from "./atoms/RetroCard";
import RetroSubTitle from "./atoms/RetroSubTitle";
import RetroSpinner from "./atoms/RetroSpinner";

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
    /** `GET /home` 이 준 급식 정보. 서버 기준 오늘과 지금 끼니 */
    meal: NonNullable<HomeData["meal"]>;
}

const MealCard: React.FC<MealCardProps> = ({ meal }) => {
    const [offset, setOffset] = useState(0);
    const [menu, setMenu] = useState<MealMenu | null>(null);
    const [loading, setLoading] = useState(true);
    // 지금 시간대의 끼니로 열어 둡니다. 식사 시간이 아니면 점심 — 가장 자주 찾습니다
    const [slot, setSlot] = useState<MealSlot>(meal.slot ?? "lunch");

    const date = useMemo(() => shift(meal.date, offset), [meal.date, offset]);
    const iso = toIso(date);

    // 날짜를 옮길 때 켜고, 받아 오면 끕니다. effect 본문에서 켜면 렌더가 한 번 더 돕니다
    const move = (next: number) => {
        setOffset(next);
        setLoading(true);
    };

    useEffect(() => {
        let alive = true;
        fetchMeal(iso)
            .then((res) => alive && setMenu(res.menu))
            .catch(() => alive && setMenu(null))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, [iso]);

    const label =
        offset === 0
            ? "오늘"
            : offset === -1
              ? "어제"
              : offset === 1
                ? "내일"
                : `${date.getMonth() + 1}월 ${date.getDate()}일`;

    const items = menu?.[slot] ?? [];

    return (
        <RetroCard className="flex h-full flex-col bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                        className="px-2 text-center text-xs font-black tabular-nums disabled:cursor-default"
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

            <div className="mt-3 flex gap-2">
                {SLOTS.map(({ key, label: slotLabel }) => (
                    <RetroButton
                        key={key}
                        size="sm"
                        isSelected={slot === key}
                        onClick={() => setSlot(key)}
                        className="flex-1"
                    >
                        {slotLabel}
                    </RetroButton>
                ))}
            </div>

            {/* 학교 API 가 3~5초 걸리는 날이 있어서 빈 칸으로 두면 고장난 것처럼 보입니다 */}
            <div className="mt-4 flex-1">
                {loading ? (
                    <div className="flex h-full min-h-24 items-center justify-center">
                        <RetroSpinner />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex h-full min-h-24 items-center justify-center">
                        <p className="text-xs font-black uppercase tracking-widest text-black/25">
                            No Data Found
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {items.map((item) => (
                            <li key={item} className="text-sm font-bold leading-snug">
                                {item}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </RetroCard>
    );
};

export default MealCard;

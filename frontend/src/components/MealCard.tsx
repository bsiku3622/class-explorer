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

/**
 * 끼니 색은 **하루의 시간대**입니다 — 아침 노랑에서 저녁 보라로 해가 지듯 넘어갑니다.
 * 고른 것만 꽉 채우고 나머지는 흰색이라, 한 화면에 색은 언제나 하나뿐입니다.
 */
const SLOTS: { key: MealSlot; label: string; color: string }[] = [
    { key: "breakfast", label: "아침", color: "#ffd500" },
    { key: "lunch", label: "점심", color: "#ff9100" },
    { key: "dinner", label: "저녁", color: "#7828c8" },
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
    /**
     * 옆 카드 높이에 맞춰 늘어날지. **한 행에 나란히 놓을 때만 `true`** 입니다 —
     * 아래에 따로 두면서 켜면 grid 행 높이만큼 늘어나 아래가 빈 상자가 됩니다
     */
    fill?: boolean;
    /**
     * 테두리 없이 그릴지. **다른 카드 안에 한 칸으로 들어갈 때** 켭니다 — 카드 안에
     * 카드를 넣으면 테두리가 겹쳐 두 물건처럼 보입니다 (V2 배치가 이걸 씁니다)
     */
    bare?: boolean;
}

const MealCard: React.FC<MealCardProps> = ({ meal, fill = false, bare = false }) => {
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

    // ⚠️ `fill` 없이 `h-full` 을 걸면 안 됩니다 — grid item 이라 100% 가 **행 높이**
    // 로 풀려서, 아래에 따로 놓았을 때 옆 카드만큼 늘어나 아래가 빈 상자가 됩니다
    const Frame = bare ? "div" : RetroCard;

    return (
        <Frame
            className={`flex min-h-0 flex-col p-4 ${bare ? "" : "bg-white"} ${
                fill ? "h-full" : ""
            }`}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <RetroSubTitle title="Meal" icon={UtensilsCrossed} iconSize={15} />
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => move(offset - 1)}
                        disabled={offset <= -RANGE_DAYS}
                        aria-label="하루 전"
                        className="border-2 border-black bg-white p-0.5 transition-all duration-100 hover:bg-retro-accent-light active:scale-95 disabled:opacity-25"
                    >
                        <ChevronLeft size={14} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => move(0)}
                        disabled={offset === 0}
                        className="px-1.5 text-center text-[11px] font-black tabular-nums disabled:cursor-default"
                    >
                        {label}
                        <span className="ml-1 font-bold text-black/40">
                            {date.getMonth() + 1}/{date.getDate()} (
                            {WEEKDAYS[date.getDay()]})
                        </span>
                    </button>
                    <button
                        onClick={() => move(offset + 1)}
                        disabled={offset >= RANGE_DAYS}
                        aria-label="하루 뒤"
                        className="border-2 border-black bg-white p-0.5 transition-all duration-100 hover:bg-retro-accent-light active:scale-95 disabled:opacity-25"
                    >
                        <ChevronRight size={14} strokeWidth={3} />
                    </button>
                </div>
            </div>

            <div className="mt-2.5 flex gap-1.5">
                {SLOTS.map(({ key, label: slotLabel, color }) => (
                    <RetroButton
                        key={key}
                        size="sm"
                        color={color}
                        isSelected={slot === key}
                        onClick={() => setSlot(key)}
                        className="flex-1"
                    >
                        {slotLabel}
                    </RetroButton>
                ))}
            </div>

            {/* 학교 API 가 3~5초 걸리는 날이 있어서 빈 칸으로 두면 고장난 것처럼 보입니다.
                메뉴가 길면 **스크롤하지 않고 그냥 늘어납니다** — 열 줄짜리 목록을 좁은
                창으로 들여다보게 하는 것보다 카드가 그만큼 길어지는 편이 낫습니다 */}
            <div className="mt-3 flex-1">
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
                    /* 글자 크기는 옆 칸(홈의 `오늘 일정`, 옛 12px)과 **딱 가운데**서
                       만납니다 — 한 행에 나란히 선 두 칸이 3px 씩 차이 나면 같은 층의
                       정보인데 무게가 달라 보입니다 */
                    <ul className="space-y-1">
                        {items.map((item) => (
                            <li key={item} className="text-[13.5px] font-bold leading-snug">
                                {item}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Frame>
    );
};

export default MealCard;

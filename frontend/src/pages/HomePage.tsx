/**
 * 홈 — "지금 뭘 해야 하는가" 한 화면.
 *
 * 켜자마자 보이는 자리라 **한 요청(`GET /home`)으로 다 받습니다.** 여러 번 물어보면
 * 화면이 조각조각 채워지는 게 그대로 보입니다. (급식만 예외 — `MealCard` 참고)
 *
 * 이 파일은 **껍데기**입니다 — 받아 오고, 시계를 굴리고, 어느 배치를 그릴지만
 * 정합니다. 실제 화면은 두 판본이 있고 비교하려고 둘 다 남겨 뒀습니다.
 *
 * | | 생김새 | |
 * |---|---|---|
 * | `TodayCardV2` | 낮고 가로로 긴 카드 하나 (지금·학사일정 \| 스크롤 목록 \| 급식) | **이게 배포되는 화면입니다** |
 * | `TodayCardV1` | 세로로 긴 카드 (자 + 하루 전체 목록) | 개발에서만 — 되돌아볼 자리로 남겨 뒀습니다 |
 *
 * **모든 시각은 하나의 시계에서 나옵니다.** 서버가 준 `now.minute` 에 그 뒤로 흐른
 * 시간을 더해 씁니다 — 판본마다 따로 계산하면 비교하다 어긋난 걸 배치 탓으로
 * 오해하게 됩니다 (`lib/homeView.ts` 가 파생값을 한 곳에서 셉니다).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Repeat } from "lucide-react";
import type { Term } from "../types";
import { fetchHome, type HomeData } from "../lib/friendsApi";
import { isTradeAvailable } from "../lib/features";
import { applyHomeDemo, HOME_DEMOS, type HomeDemoKey } from "../lib/homeDemo";
import RetroSpinner from "../components/atoms/RetroSpinner";
import MealCard from "../components/MealCard";
import TodayCardV1 from "../components/home/TodayCardV1";
import TodayCardV2 from "../components/home/TodayCardV2";

/**
 * 수업 없는 날에 덧붙이는 한마디. 날짜로 골라서 **하루 안에는 안 바뀝니다** —
 * 1분마다 새로 받는 화면이라 무작위로 뽑으면 읽는 중에 문장이 갈아치워집니다.
 */
const OFF_LINES: Record<"vacation" | "weekend" | "holiday", string[]> = {
    vacation: [
        "오늘 1교시는 없습니다. 2교시도 없습니다.",
        "방학이라고 놀지 말고 공부하세요.",
        "시간표가 쉬는 중입니다.",
        "404 - 시간표를 찾을 수 없습니다.",
    ],
    weekend: [
        "404 - 시간표를 찾을 수 없습니다.",
        "주말이 천천히 지나가길 바라요.",
        "주말이라고 놀지 말고 공부하세요.",
    ],
    holiday: [
        "404 - 시간표를 찾을 수 없습니다.",
        "달력이 하루를 비워 줬네요.",
        "신에게 감사를.",
    ],
};

type Layout = "v1" | "v2";

interface HomePageProps {
    term: Term | null;
}

const HomePage: React.FC<HomePageProps> = ({ term }) => {
    /** 응답과 **받은 시각**을 같이 듭니다 — 그 뒤로 흐른 시간을 더해 시계를 굴립니다 */
    const [state, setState] = useState<{ home: HomeData; at: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [nowMs, setNowMs] = useState(() => Date.now());
    /** 개발 전용 — 오늘이 방학이어도 수업 중 화면을 볼 수 있게 (`homeDemo.ts`) */
    const [demo, setDemo] = useState<HomeDemoKey | null>(null);
    /** V2 가 배포되는 화면이고, V1 은 개발에서만 되돌아볼 수 있습니다 */
    const [layout, setLayout] = useState<Layout>("v2");

    const reload = useCallback(async () => {
        try {
            setState({ home: await fetchHome(term), at: Date.now() });
        } catch {
            setState(null);
        } finally {
            setLoading(false);
        }
    }, [term]);

    useEffect(() => {
        void reload();
    }, [reload]);

    // 1분마다 다시 받습니다 — "지금 몇 교시" 가 화면에 떠 있는 값이라 멈춰 있으면 틀립니다
    useEffect(() => {
        const timer = setInterval(() => void reload(), 60_000);
        return () => clearInterval(timer);
    }, [reload]);

    // 요청 사이에도 시계는 움직여야 합니다. 응답을 기다리는 동안 멈춰 보이면
    // 화면이 죽은 것처럼 읽힙니다
    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 15_000);
        return () => clearInterval(timer);
    }, []);

    const home = useMemo(() => {
        if (!state) return null;
        return import.meta.env.DEV && demo
            ? applyHomeDemo(demo, state.home)
            : state.home;
    }, [state, demo]);

    /** 지금(자정 기준 분). 서버 시계가 기준이고 그 뒤로 흐른 시간만 더합니다 */
    const liveMinute = useMemo(() => {
        if (!state || !home) return null;
        const elapsed = Math.max(0, Math.floor((nowMs - state.at) / 60_000));
        return Math.min(1439, home.now.minute + elapsed);
    }, [state, home, nowMs]);

    const quip = useMemo(() => {
        const reason = home?.session.off_reason;
        if (!reason || !home) return null;
        const pool = OFF_LINES[reason];
        const seed = Number(home.now.date.replaceAll("-", ""));
        return pool[seed % pool.length];
    }, [home]);

    if (loading) {
        return (
            <div className="flex flex-col items-center gap-3 py-32">
                <RetroSpinner size="lg" />
            </div>
        );
    }

    if (!home || liveMinute === null) {
        return (
            <div className="border-2 border-black bg-white px-5 py-12 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                <p className="text-sm font-bold text-black/50">
                    화면을 불러오지 못했습니다.
                </p>
            </div>
        );
    }

    const meal = home.meal;

    return (
        <div className="flex flex-col gap-4 pb-20 md:gap-6">
            {/* ── 개발 전용 ────────────────────────────────────────────
                홈은 대부분이 "오늘이 무슨 날인가" 에 달려 있어서, 방학에 붙잡혀 있으면
                수업 중 화면을 확인할 방법이 없습니다. 배치 스위치로 옛 판본(V1)도
                되돌아볼 수 있고, 이 바와 V1 은 프로덕션 번들에 안 남습니다 */}
            {import.meta.env.DEV && (
                <div className="flex flex-col gap-2 border-2 border-dashed border-black/25 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 w-8 text-[10px] font-black uppercase tracking-widest text-black/30">
                            상태
                        </span>
                        {[{ key: null, label: "실제" }, ...HOME_DEMOS].map(
                            ({ key, label }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setDemo(key as HomeDemoKey | null)}
                                    className={`border-2 border-black px-2 py-0.5 text-[11px] font-black transition-all duration-100 ${
                                        demo === key
                                            ? "bg-black text-white"
                                            : "bg-white hover:bg-retro-accent-light"
                                    }`}
                                >
                                    {label}
                                </button>
                            ),
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 w-8 text-[10px] font-black uppercase tracking-widest text-black/30">
                            배치
                        </span>
                        {(
                            [
                                { key: "v2", label: "V2 (배포)" },
                                { key: "v1", label: "V1 (구)" },
                            ] as const
                        ).map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setLayout(key)}
                                className={`border-2 border-black px-2 py-0.5 text-[11px] font-black transition-all duration-100 ${
                                    layout === key
                                        ? "bg-black text-white"
                                        : "bg-white hover:bg-retro-accent-light"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 수강 변경 기간에만 ─────────────────────────────────────
                핑크가 "지금" 으로 옮겨 가면서 배너는 시안을 씁니다 — 한 화면에서 같은
                색이 두 뜻을 가지면 안 됩니다 */}
            {isTradeAvailable(term) && (
                <Link
                    to="/trade"
                    className="group flex items-center justify-between gap-3 border-2 border-black bg-retro-accent1 px-4 py-2.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                    <span className="flex min-w-0 items-center gap-2.5">
                        <Repeat size={16} strokeWidth={2.75} className="shrink-0" />
                        <span className="truncate text-[13px] font-black">
                            지금은 수강 정정 기간입니다. Class Explorer와 함께 트레이드 조합을 찾아보세요
                        </span>
                    </span>
                    <ArrowRight
                        size={16}
                        strokeWidth={2.75}
                        className="shrink-0 transition-transform duration-100 group-hover:translate-x-0.5"
                    />
                </Link>
            )}

            {/* `import.meta.env.DEV &&` 를 앞에 두는 이유는 **V2 를 프로덕션 번들에서
                빼기 위해서**입니다 — 이게 없으면 rollup 이 `layout` 이 절대 "v2" 가 안
                된다는 걸 증명할 수 없어 두 판본을 다 실어 보냅니다 */}
            {/* `import.meta.env.DEV &&` 를 앞에 두는 이유는 **V1 을 프로덕션 번들에서
                빼기 위해서**입니다 — 이게 없으면 rollup 이 `layout` 이 절대 "v1" 이 안
                된다는 걸 증명할 수 없어 두 판본을 다 실어 보냅니다 */}
            {import.meta.env.DEV && layout === "v1" ? (
                <>
                    <TodayCardV1 home={home} liveMinute={liveMinute} quip={quip} />
                    {/* V1 은 급식이 카드 밖입니다. 메뉴는 늘 예닐곱 줄짜리 짧은 목록이라
                        전폭으로 두면 글자 오른쪽이 통째로 빈 상자가 됩니다 */}
                    {meal && (
                        <div className="lg:max-w-md">
                            <MealCard meal={meal} />
                        </div>
                    )}
                </>
            ) : (
                /* V2 는 **급식까지 한 카드 안**입니다 — 따로 두면 한 행이 아니라
                   "큰 상자 + 작은 상자" 로 읽힙니다 */
                <TodayCardV2 home={home} liveMinute={liveMinute} quip={quip} />
            )}
        </div>
    );
};

export default HomePage;

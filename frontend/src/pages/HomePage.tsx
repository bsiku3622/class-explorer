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
 * | `TodayCardV3` | 행 둘 — 지금(히어로 \| 일정) 위, 하루(자 + 목록 \| 급식) 아래 | **이게 배포되는 화면입니다** |
 * | `TodayCardV2` | 낮고 가로로 긴 카드 하나 (지금·학사일정 \| 스크롤 목록 \| 급식) | 개발에서만 |
 * | `TodayCardV1` | 세로로 긴 카드 (자 + 하루 전체 목록) | 개발에서만 |
 *
 * 그 아래 `WeekTimetable` 이 **한 주**를 격자로 붙습니다 — 위가 오늘이면 아래는 이
 * 학기라, 배치 판본과 상관없이 같은 자리입니다.
 *
 * **모든 시각은 하나의 시계에서 나옵니다.** 서버가 준 `now.minute` 에 그 뒤로 흐른
 * 시간을 더해 씁니다 — 판본마다 따로 계산하면 비교하다 어긋난 걸 배치 탓으로
 * 오해하게 됩니다 (`lib/homeView.ts` 가 파생값을 한 곳에서 셉니다).
 *
 * ## 수강 정정 기간에는 시간표가 두 벌입니다
 *
 * `/trade` 에 계획을 짜 뒀다면 홈 위에 **[기존 시간표 | 트레이드 계획]** 이 붙습니다.
 * 고르면 **화면 전체**가 갈립니다 — 히어로의 "지금 가야 할 교실" 까지 계획 것으로
 * 바뀝니다.
 *
 * 화면을 두 벌 만들지 않고 **응답만 갈아 끼웁니다** (`lib/plannedHome.ts`). 그래야
 * 히어로·자·목록·주간 격자가 각자 "계획일 때는 이렇게" 를 따로 알 필요가 없습니다.
 *
 * ⚠️ **계획은 아직 등록된 시간표가 아닙니다.** 어느 쪽을 보고 있는지 헷갈리면 엉뚱한
 * 교실로 가게 되므로, 고른 쪽이 시안으로 켜지고 카드에도 표식이 붙습니다 (`planned`).
 *
 * **고른 쪽은 이 기기에 남습니다** — 계획을 짜 놓고 정정 기간 내내 그걸 보는 사람이
 * 홈을 열 때마다 같은 버튼을 누르게 되면, 그건 기본값을 잘못 잡은 것입니다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Repeat } from "lucide-react";
import type { SubjectData, Term } from "../types";
import { fetchHome, type HomeData } from "../lib/friendsApi";
import { isTradeAvailable } from "../lib/features";
import { applyHomeDemo, HOME_DEMOS, type HomeDemoKey } from "../lib/homeDemo";
import { applyPlanToHome, buildDepartmentMap } from "../lib/plannedHome";
import { useTradePlan } from "../hooks/useTradePlan";
import RetroSpinner from "../components/atoms/RetroSpinner";
import MarqueeText from "../components/atoms/MarqueeText";
import MealCard from "../components/MealCard";
import TodayCardV1 from "../components/home/TodayCardV1";
import TodayCardV2 from "../components/home/TodayCardV2";
import TodayCardV3 from "../components/home/TodayCardV3";
import WeekTimetable from "../components/home/WeekTimetable";
import MySubjects from "../components/home/MySubjects";

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

type Layout = "v1" | "v2" | "v3";

/** 수강 정정 기간에만 갈리는 두 시간표 */
type View = "current" | "trade";

/**
 * 마지막에 고른 쪽을 **이 기기에** 기억합니다 (학기 선택 `ksa_selected_term` 과 같은
 * 방식). 계획을 짜 놓고 정정 기간 내내 그걸 보는 사람은 홈을 열 때마다 같은 버튼을
 * 누르게 되는데, 그게 곧 "기본값을 잘못 잡았다" 는 뜻입니다.
 *
 * ⚠️ **누른 순간에만 적습니다.** 계획이 사라져 화면이 기존으로 돌아가는 건 사용자가
 * 고른 게 아니므로, 그걸로 기억을 덮으면 계획이 돌아왔을 때 다시 눌러야 합니다.
 */
const VIEW_KEY = "ksa_home_view";

const loadSavedView = (): View => {
    try {
        return localStorage.getItem(VIEW_KEY) === "trade" ? "trade" : "current";
    } catch {
        return "current";
    }
};

interface HomePageProps {
    term: Term | null;
    /** 계획 시간표를 짜고, 맨 아래 과목 아코디언을 채우는 데 씁니다 */
    allClassesData: SubjectData[];
    myStuId: string | null;
    /**
     * 아래 넷은 **맨 아래 과목 아코디언이 검색 화면과 같은 물건**이라 필요합니다
     * (`components/home/MySubjects.tsx`). 홈이 쓰는 값은 아니고 그대로 넘깁니다.
     */
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    selectedYears: string[];
    isModifierPressed: boolean;
    handleSearchToggle: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const HomePage: React.FC<HomePageProps> = ({
    term,
    allClassesData,
    myStuId,
    studentSubjectMap,
    teacherSubjectMap,
    selectedYears,
    isModifierPressed,
    handleSearchToggle,
}) => {
    /** 응답과 **받은 시각**을 같이 듭니다 — 그 뒤로 흐른 시간을 더해 시계를 굴립니다 */
    const [state, setState] = useState<{ home: HomeData; at: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [nowMs, setNowMs] = useState(() => Date.now());
    /** 개발 전용 — 오늘이 방학이어도 수업 중 화면을 볼 수 있게 (`homeDemo.ts`) */
    const [demo, setDemo] = useState<HomeDemoKey | null>(null);
    /** V3 가 배포되는 화면이고, 옛 판본은 개발에서만 되돌아볼 수 있습니다 */
    const [layout, setLayout] = useState<Layout>("v3");
    /** 기존 시간표 ↔ 트레이드 계획. 지난번에 고른 쪽으로 엽니다 */
    const [view, setView] = useState<View>(loadSavedView);

    const tradeAvailable = isTradeAvailable(term);
    /** `/trade` 에 저장해 둔 계획. 볼 게 없으면 null 이고 전환도 안 뜹니다 */
    const plannedSections = useTradePlan(tradeAvailable, allClassesData, myStuId);

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

    const received = useMemo(() => {
        if (!state) return null;
        return import.meta.env.DEV && demo
            ? applyHomeDemo(demo, state.home)
            : state.home;
    }, [state, demo]);

    const departments = useMemo(
        () => buildDepartmentMap(allClassesData),
        [allClassesData],
    );

    /**
     * 화면이 그리는 응답. 계획을 보는 중이면 **시간표만 갈아 끼운** 사본입니다
     * (`plannedHome.ts`) — 급식·학사일정·방학 여부는 계획과 상관이 없습니다.
     */
    const home = useMemo(() => {
        if (!received) return null;
        if (view !== "trade" || !plannedSections) return received;
        return applyPlanToHome(received, plannedSections, departments);
    }, [received, view, plannedSections, departments]);

    /**
     * 계획을 보는 중인가. **`view` 만으로 정하지 않습니다** — 계획이 없으면(정정 기간
     * 종료·계획 비움·아직 못 받음) `view` 가 `trade` 여도 기존 시간표를 그립니다.
     *
     * ⚠️ 예전에는 계획이 없을 때 `view` 를 되돌리는 효과를 뒀는데, 기억한 값으로 열게
     * 되면서 **계획을 받아 오는 동안 그게 먼저 돌아** 기본값이 매번 지워졌습니다.
     * 상태를 고치지 말고 여기서 파생시키면 그 경합이 없습니다.
     */
    const planned = view === "trade" && plannedSections !== null;

    const chooseView = useCallback((next: View) => {
        setView(next);
        try {
            localStorage.setItem(VIEW_KEY, next);
        } catch {
            // 사파리 프라이빗 모드 등 — 기억만 못 할 뿐 이번 화면은 그대로 됩니다
        }
    }, []);

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
                                { key: "v3", label: "V3 (배포)" },
                                { key: "v2", label: "V2 (구)" },
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
            {tradeAvailable && (
                <Link
                    to="/trade"
                    className="group flex items-center justify-between gap-3 border-2 border-black bg-retro-accent1 px-4 py-2.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                    <span className="flex min-w-0 items-center gap-2.5">
                        <Repeat size={16} strokeWidth={2.75} className="shrink-0" />
                        {/* 문장 전체가 곧 내용이라 자르지 않습니다 — 좁으면 훑고 돌아옵니다 */}
                        <MarqueeText className="text-[13px] font-black">
                            지금은 수강 정정 기간입니다. Class Explorer와 함께 트레이드 조합을 찾아보세요
                        </MarqueeText>
                    </span>

                    <ArrowRight
                        size={16}
                        strokeWidth={2.75}
                        className="shrink-0 transition-transform duration-100 group-hover:translate-x-0.5"
                    />
                </Link>
            )}

            {/* ── 어느 시간표를 볼 것인가 ──────────────────────────────────
                **저장해 둔 계획이 실제로 뭔가 바꿀 때만** 뜹니다 (`useTradePlan`).
                계획이 없거나 남의 계획이면 고를 게 없어서 버튼도 없습니다.

                ⚠️ 홈 전체가 한꺼번에 갈립니다 — 위 히어로가 말하는 "지금 가야 할 교실"
                까지 계획 것으로 바뀝니다. 그래서 **고른 쪽이 시안(= Trade 색)으로
                켜지고**, 카드마다 `계획` 표식이 붙습니다. 계획은 아직 등록된 시간표가
                아니라서, 어느 쪽을 보고 있는지 헷갈리면 엉뚱한 교실로 갑니다.

                고른 쪽은 이 기기에 남아서 **다음에도 그대로 열립니다** (`VIEW_KEY`) */}
            {plannedSections && (
                <div className="flex flex-wrap items-center gap-2">
                    {(
                        [
                            { key: "current", label: "기존 시간표" },
                            { key: "trade", label: "트레이드 계획" },
                        ] as const
                    ).map(({ key, label }) => {
                        const on = view === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => chooseView(key)}
                                aria-pressed={on}
                                className={`border-2 border-black px-3 py-1.5 text-[12px] font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${
                                    on
                                        ? key === "trade"
                                            ? "bg-retro-accent1 text-black"
                                            : "bg-black text-white"
                                        : "bg-white hover:bg-retro-accent-light"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 옛 판본 분기 앞에 `import.meta.env.DEV &&` 를 두는 이유는 **V1·V2 를
                프로덕션 번들에서 빼기 위해서**입니다 — 이게 없으면 rollup 이 `layout`
                이 절대 "v1"·"v2" 가 안 된다는 걸 증명할 수 없어 세 판본을 다 실어
                보냅니다. 배포되는 V3 만 무조건 남습니다 */}
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
            ) : import.meta.env.DEV && layout === "v2" ? (
                /* V2 는 **급식까지 한 카드 안**입니다 — 따로 두면 한 행이 아니라
                   "큰 상자 + 작은 상자" 로 읽힙니다 */
                <TodayCardV2 home={home} liveMinute={liveMinute} quip={quip} />
            ) : (
                /* V3 — "지금" 이 머리로 올라가고 그 자리에 자가 돌아왔습니다.
                   ⚠️ **주간 격자를 V3 가 직접 그립니다** — 오늘(왼쪽)과 나란히
                   놓아야 해서, 아래에 따로 붙이면 자리가 어긋납니다 */
                <TodayCardV3
                    home={home}
                    liveMinute={liveMinute}
                    quip={quip}
                    planned={planned}
                />
            )}

            {/* 옛 판본은 격자가 **아래**에 붙습니다 (V3 는 자기가 그립니다) */}
            {import.meta.env.DEV && layout !== "v3" && (
                <WeekTimetable home={home} liveMinute={liveMinute} planned={planned} />
            )}

            {/* 맨 아래 — "언제" 를 다 본 다음의 **"무엇을"** 입니다. 격자 위로 올리면
                하루·한 주를 보러 온 사람이 목록부터 지나가게 됩니다 */}
            <MySubjects
                week={home.week ?? {}}
                allClassesData={allClassesData}
                myStuId={myStuId}
                studentSubjectMap={studentSubjectMap}
                teacherSubjectMap={teacherSubjectMap}
                selectedYears={selectedYears}
                isModifierPressed={isModifierPressed}
                handleSearchToggle={handleSearchToggle}
            />
        </div>
    );
};

export default HomePage;

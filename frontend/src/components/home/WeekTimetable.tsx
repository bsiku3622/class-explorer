/**
 * 내 시간표 — 한 주를 격자 하나로.
 *
 * ```
 * ┌ 내 시간표 ──────────────────────────── 주 27교시 ┐
 * ├────┬──────┬──────┬──────┬──────┬──────┤
 * │    │  월  │[ 화 ]│  수  │  목  │  금  │  ← 오늘만 검은 바에서 흰 칸으로 반전
 * ├────┼──────┼──────┼──────┼──────┼──────┤
 * │ 1  │      │      │      │      │┌────┐│
 * │    │      │      │      │      ││미적││  ← 수업은 테두리 있는 칩
 * │ 2  │┌────┐│┏━━━━┓│┌────┐│┌────┐│└────┘│
 * │    ││미적│││선형│││미적│││선형││      │
 * │ 3  │└────┘│┃(지금)┃│└────┘│└────┘│      │  ← 지금만 채웁니다
 * ├╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┤  ← 점심 (빗금)
 * │ 5  │┌────┐│      │┌────┐│┌────┐│      │
 * └────┴──────┴──────┴──────┴──────┴──────┘
 * ```
 *
 * 홈의 위 카드가 **오늘**을 말하는 자리라면 여기는 **이 학기**를 말합니다 — 그래서
 * `today` 와 달리 방학·주말에도 그대로 그립니다 (`week` 는 서버가 안 비웁니다).
 * 방학에 시간표가 사라지면 다음 학기 계획을 세울 때 볼 데가 없어집니다.
 *
 * ## 표가 아니라 **지도**입니다
 *
 * 한동안 이걸 스프레드시트처럼 그렸습니다 — 칸마다 옅은 회색(`black/[0.05]`)을 깔고
 * 머리카락 같은 선(`black/10`)으로 격자를 쳤는데, 두 가지가 한꺼번에 망가졌습니다.
 *
 * 1. **주의 모양이 안 보였습니다.** 5% 회색은 흰 배경과 거의 구별되지 않아서, 한 주가
 *    통째로 옅은 회색 얼룩으로 읽혔습니다. 어디가 비었는지 세어야 알 수 있었습니다
 * 2. **어느 교시인지 못 읽었습니다.** 글자를 칸 **가운데**에 뒀더니 연강 덩어리의
 *    이름이 두 교시 번호 사이에 걸쳐서, 6교시인지 7교시인지 알 방법이 없었습니다
 *
 * 그래서 `design-guide.md` 가 자(`DayRuler`)에서 쓰는 언어를 그대로 가져왔습니다 —
 * **테두리는 칸마다 두르고, 빈 자리는 진짜 비웁니다.** 검은 덩어리가 있는 곳이 수업,
 * 흰 곳이 공강입니다. 칸 사이의 1px 틈이 곧 쉬는시간이고요.
 *
 * ⚠️ 이게 "카드 안에 카드를 넣지 마세요" 와 부딪히지 않는 이유는 자와 같습니다 —
 * **이건 목록이 아니라 눈금이고, 칸 하나하나가 데이터입니다.** 대신 하드 쉐도우는
 * 안 씁니다. 스물일곱 개가 저마다 그림자를 지면 카드가 자갈밭이 됩니다.
 *
 * ## 칩은 **위쪽**에 붙습니다
 *
 * 이름도 교시 번호도 행 위에 맞춥니다. 연강이면 이름이 덩어리 맨 위에 붙어서
 * **시작 교시 번호와 일직선**이 됩니다 — 가운데 정렬이 못 하던 일입니다.
 *
 * ## 점심·저녁은 격자에 새깁니다
 *
 * 4교시(~12:30)와 5교시(13:40~) 사이는 70분, 9교시와 10교시 사이는 60분입니다. 그냥
 * 붙여 두면 5교시가 점심 뒤라는 게 안 보이고, 무엇보다 **연강으로 잘못 묶입니다.**
 * 교시 시각표에서 구멍을 찾아 빗금 띠를 넣고, 그 위로는 덩어리를 잇지 않습니다.
 *
 * ⚠️ **면을 채우는 건 "지금" 하나뿐입니다** (`design-guide.md`). 오늘 표시조차 색을
 * 안 씁니다 — 검은 요일 바에서 그 칸만 흰색으로 뒤집습니다. 핑크가 머리(오늘)와
 * 칩(지금) 두 군데에 있으면 같은 색이 두 뜻을 갖습니다.
 */

import React, { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import type {
    BreakTime,
    HomeData,
    PeriodTime,
    TodayClass,
} from "../../lib/friendsApi";
import { deriveHomeView } from "../../lib/homeView";
import { DAY_MAP, DAYS_ORDER, getKoreanName } from "../../lib/utils";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";

type Day = (typeof DAYS_ORDER)[number];

/**
 * 교시 사이가 이보다 벌어지면 쉬는시간이 아니라 **구멍**입니다.
 *
 * 평소 쉬는시간은 10분이고, 점심(70분)·저녁(60분)만 크게 벌어집니다. 20분이면 둘
 * 사이 어디를 잘라도 같은 답이 나옵니다 — 교시 시각표가 조금 바뀌어도 안 흔들립니다.
 */
const GAP_MINUTES = 20;

/** 자에서 쓰는 것과 같은 빗금 — **수업이 놓일 수 없는 구간**의 무늬입니다 */
const HATCH: React.CSSProperties = {
    backgroundImage:
        "repeating-linear-gradient(-45deg, rgba(0,0,0,0.13) 0 3px, transparent 3px 7px)",
};

/**
 * 칸에 들어갈 만큼 이름을 줄입니다 — **꼬리 괄호를 통째로 뗍니다.**
 *
 * ```
 * 미적분학2(EC)              → 미적분학2
 * 융합특강(AI시대의인간기술)  → 융합특강
 * ```
 *
 * `getKoreanName()` 은 **영문 설명만** 뗍니다(`(Basic Analytical Chemistry)`). 한글이
 * 든 괄호는 그대로 남는데, 격자 한 칸은 좁은 화면에서 60px 남짓이라 그대로 두면
 * `융합특강(AI시대의인…` 처럼 **이름이 아니라 괄호가 잘립니다.**
 *
 * ⚠️ **`(EC)` 도 뗍니다.** 한때 작은 꼬리표로 남겼는데, 그 8px 이 `미적분학2` 를
 * `미적분학…` 으로 밀어냈습니다. **여긴 내 시간표라 (EC) 가 가리는 게 없습니다** —
 * 같은 과목의 한국어반과 영어반을 동시에 듣는 사람은 없으니까요. 구별이 필요한
 * 화면(검색·트레이드)에서는 `getKoreanName()` 이 그대로 남겨 둡니다.
 */
const tighten = (subject: string): string =>
    getKoreanName(subject).replace(/\s*\([^()]*\)$/, "");

/** 격자에 놓이는 덩어리 하나 — 연강이면 `span` 이 2 이상입니다 */
interface Block {
    day: Day;
    /** 시작 교시 */
    period: number;
    /** 몇 교시짜리인가 */
    span: number;
    klass: TodayClass;
}

/** 격자의 가로 한 줄 — 교시이거나, 교시 사이의 구멍입니다 */
type Slot =
    | { kind: "period"; period: number }
    | { kind: "gap"; name: string; after: number };

/**
 * 요일별 수업 목록 → 격자 덩어리.
 *
 * 이으려면 셋이 다 맞아야 합니다.
 *
 * - **교실까지 같아야 합니다.** 같은 과목이라도 교실이 바뀌면 사이에 이동이 있어서,
 *   한 덩어리로 묶으면 옮겨야 하는 걸 놓칩니다
 * - **시간이 붙어 있어야 합니다.** 4교시와 5교시는 번호가 이어지지만 사이에 점심이
 *   70분 있습니다 — 번호만 보고 이으면 **점심을 가로지르는 연강**이 생깁니다
 */
const buildBlocks = (
    week: Record<string, TodayClass[]>,
    byPeriod: Map<number, PeriodTime>,
): Block[] => {
    const blocks: Block[] = [];
    DAYS_ORDER.forEach((day) => {
        const classes = [...(week[day] ?? [])].sort((a, b) => a.period - b.period);
        classes.forEach((klass) => {
            const last = blocks[blocks.length - 1];
            const prevEnd = last
                ? byPeriod.get(last.period + last.span - 1)?.end_minute
                : undefined;
            const hereStart = byPeriod.get(klass.period)?.start_minute;
            // 교시 시각표를 못 받았으면 번호만 보고 잇습니다 — 예전처럼이라도 도는 게
            // 낫습니다 (`periods` 는 홈 응답에 실려 오므로 보통은 있습니다)
            const touching =
                prevEnd === undefined || hereStart === undefined
                    ? true
                    : hereStart - prevEnd <= GAP_MINUTES;
            const continues =
                last !== undefined &&
                last.day === day &&
                last.period + last.span === klass.period &&
                touching &&
                last.klass.subject === klass.subject &&
                last.klass.section === klass.section &&
                last.klass.room === klass.room;
            if (continues) last.span += 1;
            else blocks.push({ day, period: klass.period, span: 1, klass });
        });
    });
    return blocks;
};

/**
 * 구멍에 이름을 붙입니다 — `breaks` 중 **가장 많이 겹치는** 것을 고릅니다.
 *
 * 점심 구멍(12:30~13:40)에는 `점심`(40분)과 `학급모임`(20분)이 둘 다 걸칩니다.
 * 처음 찾은 걸 쓰면 순서에 따라 답이 달라지므로 긴 쪽을 고릅니다.
 */
const gapName = (from: number, to: number, breaks: BreakTime[]): string => {
    let name = "";
    let longest = 0;
    for (const item of breaks) {
        const overlap =
            Math.min(to, item.end_minute) - Math.max(from, item.start_minute);
        if (overlap > longest) {
            longest = overlap;
            name = item.name;
        }
    }
    return name;
};

interface WeekTimetableProps {
    home: HomeData;
    /** 홈이 굴리는 시계 (서버 시각 + 그 뒤로 흐른 시간) */
    liveMinute: number;
}

const WeekTimetable: React.FC<WeekTimetableProps> = ({ home, liveMinute }) => {
    // `?? {}` 는 배포 중 한쪽만 새 버전일 때를 버팁니다 — 옛 서버는 `week` 를 안 보냅니다.
    // `useMemo` 로 감싸는 건 그 빈 객체가 매 렌더 새로 만들어지지 않게 하려는 것입니다
    const week = useMemo(() => home.week ?? {}, [home.week]);
    const periods = useMemo(() => home.periods ?? [], [home.periods]);
    const breaks = useMemo(() => home.breaks ?? [], [home.breaks]);
    const byPeriod = useMemo(
        () => new Map(periods.map((item) => [item.period, item])),
        [periods],
    );

    /** 파생값은 홈 전체가 한 곳에서 셉니다 — 여기서 따로 계산하면 위 카드와 어긋납니다 */
    const { isSchoolDay, livePeriod } = deriveHomeView(home, liveMinute);
    const today = isSchoolDay ? home.now.day : null;

    const blocks = useMemo(() => buildBlocks(week, byPeriod), [week, byPeriod]);

    /**
     * 그릴 교시 범위 — **수업이 있는 데까지만** 그립니다.
     *
     * 1~11교시를 늘 다 그리면 10·11교시(자습)가 비어 있는 사람에게는 격자 아래
     * 5분의 1이 통째로 빈 칸이 됩니다. 반대로 수업이 있는 교시만 골라 뽑으면 2교시
     * 다음이 5교시인 게 안 보이므로, **처음부터 끝까지 이어서** 그립니다.
     */
    const rows = useMemo(() => {
        if (blocks.length === 0) return [];
        const first = Math.min(...blocks.map((b) => b.period));
        const last = Math.max(...blocks.map((b) => b.period + b.span - 1));
        return Array.from({ length: last - first + 1 }, (_, i) => first + i);
    }, [blocks]);

    /**
     * 교시 줄 사이에 구멍 줄을 끼웁니다. 격자 행이 곧 이 배열이라, 칩을 놓을 때
     * **교시 번호가 아니라 여기서의 자리**를 봐야 합니다.
     */
    const slots = useMemo(() => {
        const out: Slot[] = [];
        rows.forEach((period, index) => {
            if (index > 0) {
                const before = byPeriod.get(rows[index - 1]);
                const here = byPeriod.get(period);
                if (
                    before &&
                    here &&
                    here.start_minute - before.end_minute > GAP_MINUTES
                ) {
                    out.push({
                        kind: "gap",
                        name: gapName(before.end_minute, here.start_minute, breaks),
                        after: rows[index - 1],
                    });
                }
            }
            out.push({ kind: "period", period });
        });
        return out;
    }, [rows, byPeriod, breaks]);

    /** 교시 → 격자 행 번호 (1행은 요일 머리라 +2) */
    const rowOf = useMemo(() => {
        const map = new Map<number, number>();
        slots.forEach((slot, index) => {
            if (slot.kind === "period") map.set(slot.period, index + 2);
        });
        return map;
    }, [slots]);

    const total = useMemo(
        () => DAYS_ORDER.reduce((sum, day) => sum + (week[day]?.length ?? 0), 0),
        [week],
    );

    // 학번이 아직 안 붙었거나 이 학기에 수업이 없는 계정 — 빈 격자를 그려 봐야
    // 알려 주는 게 없습니다
    if (rows.length === 0) return null;

    return (
        <RetroCard className="overflow-hidden bg-white">
            <div className="flex items-baseline justify-between gap-3 p-4 pb-3 md:px-5 md:pt-5">
                <RetroSubTitle title="내 시간표" icon={CalendarRange} iconSize={15} />
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-black/35">
                    주 {total}교시
                </span>
            </div>

            {/* 격자는 카드 **끝까지** 붙습니다 — 여백을 두면 검은 요일 머리가 카드 안의
                또 다른 카드로 읽힙니다 (`design-guide.md` 의 "카드 안에 카드") */}
            <div
                className="grid border-t-2 border-black"
                style={{ gridTemplateColumns: "1.75rem repeat(5, minmax(0, 1fr))" }}
            >
                {/* ── 요일 머리 ───────────────────────────────────────
                    오늘은 **검은 바에서 흰 칸으로 뒤집습니다.** 핑크로 칠하면 아래
                    "지금" 칩과 같은 색이 되어 한 화면에서 뜻이 둘로 갈립니다 */}
                <div className="bg-black" style={{ gridColumn: 1, gridRow: 1 }} />
                {DAYS_ORDER.map((day, index) => (
                    <div
                        key={day}
                        style={{ gridColumn: index + 2, gridRow: 1 }}
                        className={`flex items-center justify-center py-1.5 text-[11px] font-black ${
                            day === today ? "bg-white text-black" : "bg-black text-white"
                        }`}
                    >
                        {DAY_MAP[day]}
                    </div>
                ))}

                {/* ── 바탕 ─────────────────────────────────────────
                    수업 칩이 이 위에 얹히므로 **행 높이는 늘 여기서 나옵니다** — 한
                    행이 통째로 덮여도 높이가 무너지지 않습니다.

                    ⚠️ 가로선은 칸의 **위쪽**에 긋습니다. 아래쪽이면 마지막 줄의 선이
                    카드 테두리와 겹쳐 두 겹이 됩니다 */}
                {slots.map((slot, index) => {
                    const row = index + 2;
                    const line = index === 0 ? "" : "border-t border-black/[0.07]";

                    if (slot.kind === "gap") {
                        return (
                            <React.Fragment key={`gap-${slot.after}`}>
                                {/* 구멍의 이름은 교시 번호와 같은 열에 답니다 — 왼쪽
                                    열이 이 격자의 **시간 이름표** 자리입니다 */}
                                <div
                                    style={{ gridColumn: 1, gridRow: row }}
                                    className={`flex items-center justify-center text-[9px] font-black leading-none text-black/35 ${line}`}
                                >
                                    {slot.name}
                                </div>
                                <div
                                    style={{ ...HATCH, gridColumn: "2 / -1", gridRow: row }}
                                    className={`h-4 ${line}`}
                                />
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment key={slot.period}>
                            {/* 번호도 **위쪽 정렬**입니다 — 칩의 이름과 눈높이가 맞아야
                                어느 교시에 시작하는지가 한 줄로 읽힙니다 */}
                            <div
                                style={{ gridColumn: 1, gridRow: row }}
                                className={`flex justify-center pt-1.5 text-[10px] font-black tabular-nums leading-none text-black/25 ${line}`}
                            >
                                {slot.period}
                            </div>
                            {/* ⚠️ **좁은 화면이 더 높습니다** (52px vs 44px). 거꾸로
                                같지만 맞습니다 — 폰에서는 한 칸이 60px 남짓이라 이름이
                                두 줄로 펴져야 하고, 데스크톱은 칸이 200px 이라 어떤
                                과목명도 한 줄에 들어갑니다. 폭이 없으면 높이로 갚습니다 */}
                            {/* 세로선도 같은 무게로 긋습니다. 처음엔 칩의 검은 테두리가
                                요일을 가른다고 보고 뺐는데, **수업이 없는 행에서는 가를
                                게 없어서** 8교시 목요일을 찾으려면 머리부터 짚어 내려와야
                                했습니다. 격자는 여기서 장식이 아니라 좌표입니다 */}
                            {DAYS_ORDER.map((day, dayIndex) => (
                                <div
                                    key={day}
                                    style={{ gridColumn: dayIndex + 2, gridRow: row }}
                                    className={`h-[3.25rem] border-l border-black/[0.07] md:h-11 ${line}`}
                                />
                            ))}
                        </React.Fragment>
                    );
                })}

                {/* ── 수업 ─────────────────────────────────────────
                    바탕 **뒤에** 그려서 그 위에 얹힙니다. `m-px` 로 1px 씩 물러나
                    붙어 있는 칩끼리 테두리가 겹쳐 4px 로 뭉치지 않게 합니다 — 그
                    틈이 곧 쉬는시간입니다 */}
                {blocks.map((block) => {
                    const now =
                        block.day === today &&
                        livePeriod !== null &&
                        livePeriod >= block.period &&
                        livePeriod < block.period + block.span;
                    return (
                        <div
                            key={`${block.day}-${block.period}`}
                            style={{
                                gridColumn: DAYS_ORDER.indexOf(block.day) + 2,
                                gridRow: `${rowOf.get(block.period)} / span ${block.span}`,
                            }}
                            title={`${getKoreanName(block.klass.subject)} · ${block.klass.room} · ${block.klass.teacher}`}
                            className={`m-px flex min-w-0 flex-col overflow-hidden border-2 border-black px-1 py-1 md:px-1.5 ${
                                now ? "bg-retro-primary" : "bg-white"
                            }`}
                        >
                            {/* 두 줄까지 폅니다 — 한 줄로 자르면 `일반지구과학` 이
                                `일반지구…` 가 되어 무슨 과목인지 알 수 없습니다.
                                행 높이(위)가 두 줄 + 교실을 담도록 잡혀 있습니다 */}
                            <span className="line-clamp-2 text-[11px] font-black leading-[1.15]">
                                {tighten(block.klass.subject)}
                            </span>
                            {/* 교실은 **이름 바로 아래**에 붙습니다. 한때 `mt-auto` 로
                                칩 바닥에 밀어 뒀는데, 두 교시짜리에서는 그게 **아래
                                교시 자리**여서 `일반지구과학`(6–7교시)의 교실이 7교시
                                수업의 교실처럼 읽혔습니다.

                                좁은 화면에서도 남깁니다 — 시간표를 여는 이유의 절반이
                                "어디로 가지" 인데, 한동안 `md:` 아래에서 통째로 숨겨
                                두어 폰에서는 과목명만 보였습니다 */}
                            <span className="shrink-0 truncate text-[9px] font-bold leading-tight text-black/40">
                                {block.klass.room}
                            </span>
                        </div>
                    );
                })}
            </div>
        </RetroCard>
    );
};

export default WeekTimetable;

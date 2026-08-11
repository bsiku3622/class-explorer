/**
 * 내 시간표 — 한 주를 격자 하나로.
 *
 * ```
 * ┌ 내 시간표 ──────────────────────────── 주 24교시 ┐
 * ├────┬──────┬──────┬──────┬──────┬──────┤
 * │    │  월  │  화  │  수  │ [목] │  금  │  ← 오늘만 핑크
 * ├────┼──────┼──────┼──────┼──────┼──────┤
 * │ 1  │ 영어2│      │ 영어2│      │      │
 * │ 2  │ 미적2│ 물리1│ 미적2│▓지구▓│      │  ← 지금만 채웁니다
 * │ 3  │ 미적2│ 물리1│      │ 지구 │ 화학1│  ← 연강은 한 덩어리
 * └────┴──────┴──────┴──────┴──────┴──────┘
 * ```
 *
 * 홈의 위 카드가 **오늘**을 말하는 자리라면 여기는 **이 학기**를 말합니다 — 그래서
 * `today` 와 달리 방학·주말에도 그대로 그립니다 (`week` 는 서버가 안 비웁니다).
 * 방학에 시간표가 사라지면 다음 학기 계획을 세울 때 볼 데가 없어집니다.
 *
 * **연강은 한 칸으로 잇습니다.** 같은 과목·분반·교실이 이어지면 행을 걸쳐 한 덩어리로
 * 놓습니다 — 2교시짜리 실험이 두 칸으로 갈려 있으면 매번 같은 이름을 두 번 읽게 됩니다.
 *
 * ⚠️ **면을 채우는 건 "지금" 하나뿐입니다** (`design-guide.md`). 수업 칸은 아주 옅은
 * 회색이라 한 주의 **모양**(어디가 비었는지)만 보이고, 색을 가진 칸은 진행 중인 수업
 * 하나입니다. 과목마다 학과색을 입히면 격자가 색표가 되고 "지금" 이 묻힙니다.
 */

import React, { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import type { HomeData, TodayClass } from "../../lib/friendsApi";
import { deriveHomeView } from "../../lib/homeView";
import { DAY_MAP, DAYS_ORDER, getKoreanName } from "../../lib/utils";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";

type Day = (typeof DAYS_ORDER)[number];

/** 격자에 놓이는 덩어리 하나 — 연강이면 `span` 이 2 이상입니다 */
interface Block {
    day: Day;
    /** 시작 교시 */
    period: number;
    /** 몇 교시짜리인가 */
    span: number;
    klass: TodayClass;
}

/**
 * 요일별 수업 목록 → 격자 덩어리.
 *
 * **교실까지 같아야 잇습니다.** 같은 과목이라도 교실이 바뀌면 사이에 이동이 있어서,
 * 한 덩어리로 묶으면 옮겨야 하는 걸 놓칩니다.
 */
const buildBlocks = (week: Record<string, TodayClass[]>): Block[] => {
    const blocks: Block[] = [];
    DAYS_ORDER.forEach((day) => {
        const classes = [...(week[day] ?? [])].sort((a, b) => a.period - b.period);
        classes.forEach((klass) => {
            const last = blocks[blocks.length - 1];
            const continues =
                last !== undefined &&
                last.day === day &&
                last.period + last.span === klass.period &&
                last.klass.subject === klass.subject &&
                last.klass.section === klass.section &&
                last.klass.room === klass.room;
            if (continues) last.span += 1;
            else blocks.push({ day, period: klass.period, span: 1, klass });
        });
    });
    return blocks;
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
    /** 파생값은 홈 전체가 한 곳에서 셉니다 — 여기서 따로 계산하면 위 카드와 어긋납니다 */
    const { isSchoolDay, livePeriod } = deriveHomeView(home, liveMinute);
    const today = isSchoolDay ? home.now.day : null;

    const blocks = useMemo(() => buildBlocks(week), [week]);

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

    const total = useMemo(
        () => DAYS_ORDER.reduce((sum, day) => sum + (week[day]?.length ?? 0), 0),
        [week],
    );

    // 학번이 아직 안 붙었거나 이 학기에 수업이 없는 계정 — 빈 격자를 그려 봐야
    // 알려 주는 게 없습니다
    if (rows.length === 0) return null;

    /**
     * 가로선은 **칸의 위쪽**에 긋습니다. 아래쪽에 그으면 마지막 줄의 선이 카드 테두리와
     * 겹쳐 두 겹이 되고, 격자 맨 아래까지 이어진 수업 칸마다 예외를 둬야 합니다.
     */
    const topLine = (period: number) => (period === rows[0] ? "" : "border-t");

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
                style={{ gridTemplateColumns: "2rem repeat(5, minmax(0, 1fr))" }}
            >
                {/* ── 요일 머리 ─────────────────────────────────────── */}
                <div className="bg-black" style={{ gridColumn: 1, gridRow: 1 }} />
                {DAYS_ORDER.map((day, index) => (
                    <div
                        key={day}
                        style={{ gridColumn: index + 2, gridRow: 1 }}
                        className={`flex items-center justify-center py-1 text-[11px] font-black ${
                            day === today
                                ? "bg-retro-primary text-black"
                                : "bg-black text-white"
                        }`}
                    >
                        {DAY_MAP[day]}
                    </div>
                ))}

                {/* ── 빈 격자 ───────────────────────────────────────
                    수업 칸도 이 위에 얹히므로 **행 높이는 늘 여기서 나옵니다** —
                    한 행이 통째로 수업으로 덮여도 높이가 무너지지 않습니다 */}
                {rows.map((period, row) => (
                    <React.Fragment key={period}>
                        <div
                            style={{ gridColumn: 1, gridRow: row + 2 }}
                            className={`flex items-center justify-center border-black/10 text-[10px] font-black tabular-nums text-black/30 ${topLine(period)}`}
                        >
                            {period}
                        </div>
                        {DAYS_ORDER.map((day, index) => (
                            <div
                                key={day}
                                style={{ gridColumn: index + 2, gridRow: row + 2 }}
                                className={`h-10 border-l border-black/10 md:h-11 ${topLine(period)}`}
                            />
                        ))}
                    </React.Fragment>
                ))}

                {/* ── 수업 ─────────────────────────────────────────
                    빈 격자 **뒤에** 그려서 그 위에 얹힙니다. 연강은 행을 걸쳐 가운데
                    선을 덮으므로 한 덩어리로 보입니다 */}
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
                                gridRow: `${rows.indexOf(block.period) + 2} / span ${block.span}`,
                            }}
                            title={`${getKoreanName(block.klass.subject)} · ${block.klass.room} · ${block.klass.teacher}`}
                            className={`flex min-w-0 flex-col justify-center overflow-hidden px-1.5 py-1 md:px-2 ${
                                now
                                    ? "border-2 border-black bg-retro-primary"
                                    : // ⚠️ 수업 칸의 **윗선만 진합니다**(`/25`). 빈 칸과 같은 `/10` 으로
                                      // 뒀더니 세로로 붙은 다른 수업들이 옅은 회색 한 덩어리로
                                      // 읽혀서, 연강을 이어 놓은 게 아무 뜻이 없어졌습니다 —
                                      // 이어 붙인 칸 안에는 선이 아예 없으므로 둘이 구별됩니다.
                                      // 색을 방향별로 주는 건 `border-black/10` 같은 shorthand 와
                                      // 어느 쪽이 이기는지 순서 싸움을 하지 않으려는 것입니다
                                      `border-l border-l-black/10 border-t-black/25 bg-black/[0.05] ${topLine(block.period)}`
                            }`}
                        >
                            <span className="line-clamp-2 text-[10px] font-black leading-[1.15] md:text-[11px]">
                                {getKoreanName(block.klass.subject)}
                            </span>
                            {/* 교실은 좁은 화면에서 접습니다 — 390px 에서 한 칸이 70px 이라
                                과목명 두 줄이 먼저입니다 */}
                            <span className="mt-0.5 hidden truncate text-[9px] font-bold text-black/40 md:block">
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

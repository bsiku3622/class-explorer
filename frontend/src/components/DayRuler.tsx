/**
 * 하루를 한 줄로 — **교시 칸 열한 개를 실제 시각에 비례해서** 늘어놓은 자.
 *
 * 08:40 에 시작해 21:20 에 끝나는 길이가 정해진 물건 위에 수업이 놓이고 나머지가
 * 공강입니다. 등간격이 아니라 시각에 비례하기 때문에 점심(12:30~13:40)과
 * 저녁·퇴실(18:30~19:30)이 눈에 보이는 구멍으로 남고, 9교시 다음이 곧바로 10교시가
 * 아니라는 사실이 그림 하나로 읽힙니다.
 *
 * ⚠️ **칸마다 교시 번호를 답니다.** 번호를 빼고 막대만 두면 그게 몇 교시인지 알
 * 방법이 없어 아래 목록과 연결이 끊깁니다. 그때 밋밋해 보이길래 무늬(빗금 두 종류)를
 * 얹어 봤는데 더 안 읽혔습니다 — **부족한 건 장식이 아니라 이름표였습니다.**
 *
 * ⚠️ **테두리는 칸마다.** 바깥을 하나로 감싸면 교시 사이 쉬는시간(10분)이 칸 안쪽의
 * 여백처럼 보여 칸을 세어야 알 수 있습니다.
 *
 * 색은 "지금" 하나만 뜻합니다. 과목마다 색을 달리해 봤는데 어느 크기로 줄여도
 * (면 → 띠 → 점) 하루가 색표처럼 보이고 정작 "지금" 이 묻혔습니다.
 *
 * 교시 시각은 **`GET /home` 이 실어 보낸 값을 그대로 씁니다.** 화면이 상수를 따로
 * 들면 `backend/periods.py` 만 고쳤을 때 조용히 어긋납니다.
 */

import React, { useLayoutEffect, useRef } from "react";
import type { BreakTime, PeriodTime, TodayClass } from "../lib/friendsApi";
import { getDepartmentColor, hhmm, withAlpha } from "../lib/utils";
import { continuesClass, gapName, mergeSpans } from "../lib/schedule";

/** 자 위에서 뭔가를 가리킬 때. 양 끝은 카드 밖으로 삐져나가지 않게 붙입니다 */
const anchor = (percent: number): React.CSSProperties =>
    percent <= 8
        ? { left: 0 }
        : percent >= 92
          ? { right: 0 }
          : { left: `${percent}%`, transform: "translateX(-50%)" };

interface DayRulerProps {
    periods: PeriodTime[];
    /** 수업 외 시간대. 교시 덩어리 사이의 큰 구멍에 이름을 답니다 */
    breaks?: BreakTime[];
    today: TodayClass[];
    /** 자정 기준 분. `null` 이면 캐럿을 안 그립니다 */
    nowMinute: number | null;
}

const DayRuler: React.FC<DayRulerProps> = ({
    periods,
    breaks = [],
    today,
    nowMinute,
}) => {
    const boxRef = useRef<HTMLDivElement>(null);

    /**
     * **지금을 가운데 두고 엽니다.** 자를 카드 폭에 욱여넣으면 한 칸이 40px 이 되어
     * 교시 번호와 눈금 글자가 서로 겹칩니다 — 대신 트랙에 최소 폭을 주고 가로로
     * 흐르게 두면 칸이 숨을 쉽니다. 하루 전체를 한눈에 보는 건 포기하지만, 이
     * 화면을 켜는 이유는 대개 "지금 언저리" 입니다.
     */
    useLayoutEffect(() => {
        const box = boxRef.current;
        const track = box?.firstElementChild as HTMLElement | undefined;
        if (!box || !track || nowMinute === null) return;
        const first = periods[0]?.start_minute;
        const last = periods[periods.length - 1]?.end_minute;
        if (first === undefined || last === undefined || last === first) return;
        const ratio = (nowMinute - first) / (last - first);
        box.scrollLeft = track.clientWidth * ratio - box.clientWidth / 2;
    }, [nowMinute, periods]);

    if (periods.length === 0) return null;

    const first = periods[0].start_minute;
    const last = periods[periods.length - 1].end_minute;
    const span = last - first;
    const pct = (minute: number) => ((minute - first) / span) * 100;

    // 교시 → 그 시간의 내 수업. 색을 학과에서 가져오려면 칸이 어느 과목인지
    // 알아야 합니다 (예전엔 `has` 여부만 알면 됐습니다)
    const mine = new Map(today.map((c) => [c.period, c]));

    // 축 눈금은 **덩어리의 양 끝**에만. 교시마다 시각을 달면 열한 개가 겹칩니다
    const blocks = mergeSpans(periods);

    // 덩어리 사이의 큰 구멍이 무엇인지. 한 구멍에 여러 시간대가 걸치므로
    // (점심 + 학급모임) **가장 많이 겹치는 것**을 씁니다
    const voids = blocks.slice(0, -1).map((block, index) => {
        const gap = { start: block.end, end: blocks[index + 1].start };
        return { ...gap, name: gapName(gap.start, gap.end, breaks) || null };
    });

    // 교시 사이 쉬는시간(10분). 빗금을 이만큼 안쪽으로 물려서 칸과 칸 사이 간격과
    // 같은 리듬을 만듭니다 — 끝에서 끝까지 채우면 빗금만 혼자 붙어 있어 보입니다
    const restGap =
        periods.length > 1 ? periods[1].start_minute - periods[0].end_minute : 10;

    /**
     * **연강은 한 칸입니다** — 판정은 `lib/schedule.ts` 가 합니다. 10·11교시가 같은
     * 생활음악인데 칸이 둘이면, 자에서만 하루가 다르게 세어집니다.
     *
     * 사이의 쉬는시간 10분까지 덮습니다. 이동이 없는 연속 수업이라 그 틈이 곧
     * 수업의 일부입니다 — 교실이 다르면 애초에 안 묶입니다.
     */
    const classBlocks: {
        start: PeriodTime;
        end: PeriodTime;
        klass: TodayClass;
        periods: number[];
    }[] = [];
    periods.forEach((time) => {
        const klass = mine.get(time.period);
        if (!klass) return;
        const last = classBlocks[classBlocks.length - 1];
        if (
            last &&
            continuesClass(
                { klass: last.klass, period: last.end.period, end_minute: last.end.end_minute },
                { klass, period: time.period, start_minute: time.start_minute },
            )
        ) {
            last.end = time;
            last.periods.push(time.period);
            return;
        }
        classBlocks.push({ start: time, end: time, klass, periods: [time.period] });
    });

    const caret =
        nowMinute !== null && nowMinute >= first && nowMinute <= last
            ? pct(nowMinute)
            : null;

    return (
        <div
            ref={boxRef}
            className="mt-5 overflow-x-auto overflow-y-hidden py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-hidden="true"
        >
            {/* 트랙 폭은 **칸이 4:3 이 되는 값**입니다. 하루가 08:40~21:20(760분)이고
                    한 교시가 50분이니, 칸 하나가 높이(md 48px)의 4/3 인 64px 이 되려면
                    760/50 × 64 ≈ 60rem 이 필요합니다 — 카드가 좁으면 가로로 흐릅니다 */}
            <div className="min-w-[60rem]">
            {/* ⚠️ **칸마다 교시 번호를 답니다.** 번호 없이 검은 막대만 두면 그게 몇
                교시인지 알 방법이 없어 아래 목록과 연결이 안 됩니다 — 무늬를 늘려도
                해결되지 않았습니다(빗금 두 종류까지 써 봤습니다). 칸이 곧 이름표입니다.

                테두리는 **칸마다** 두릅니다. 하나로 감싸면 교시 사이 쉬는시간(10분)이
                칸 안쪽의 여백처럼 보여서, 칸이 몇 개인지 세어야 알 수 있습니다 —
                칸마다 두르면 쉬는시간이 칸 사이의 **틈**으로 그냥 보입니다. */}
            <div className="relative h-10 md:h-12">
                {/* 점심·저녁은 빗금으로. 방학 막대의 "지나간 쪽" 과 같은 무늬라, 이 앱에서
                    빗금은 늘 **수업이 놓일 수 없는 구간**을 뜻합니다 — 교시 사이 10분
                    쉬는시간(칸과 칸 사이의 빈틈)과 구별됩니다 */}
                {voids.map((v) => (
                    <span
                        key={`void-${v.start}`}
                        className="absolute inset-y-0 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.13)_0_3px,transparent_3px_7px)]"
                        style={{
                            left: `${pct(v.start + restGap)}%`,
                            width: `${Math.max(0, v.end - v.start - restGap * 2) / span * 100}%`,
                        }}
                    />
                ))}

                {/* 공강 — 점선 칸. 내 수업이 없는 교시만 그립니다 */}
                {periods
                    .filter((p) => !mine.has(p.period))
                    .map((p) => (
                        <span
                            key={`free-${p.period}`}
                            style={{
                                left: `${pct(p.start_minute)}%`,
                                width: `${((p.end_minute - p.start_minute) / span) * 100}%`,
                            }}
                            className="absolute inset-y-0 flex items-center justify-center border-2 border-dashed border-black/20 text-[11px] font-black tabular-nums text-black/25"
                        >
                            {p.period}
                        </span>
                    ))}

                {/* 내 수업 — 연강이면 한 칸으로 이어집니다 */}
                {classBlocks.map((b) => {
                    const color = getDepartmentColor(b.klass.department);
                    const past = nowMinute !== null && nowMinute >= b.end.end_minute;
                    const live =
                        nowMinute !== null &&
                        nowMinute >= b.start.start_minute &&
                        nowMinute < b.end.end_minute;

                    // **면을 채우는 건 "지금" 하나뿐** — 남은 수업까지 칠했더니 하루가
                    // 통째로 쨍했습니다.
                    //
                    // ⚠️ **지난 수업도 회색으로 덮지 않습니다.** `bg-black/15` 로 칠했을
                    // 때 저녁에 열면 지나간 칸이 예닐곱이라 자가 잿빛 덩어리였습니다 —
                    // 같은 학과색을 **투명도**로 낮추면 뭘 들었는지가 남습니다.
                    //
                    // ⚠️ **"지금" 도 꽉 채우지 않습니다.** 형광 핑크 100% 는 칸 하나가
                    // 자 전체를 눌렀습니다 — 다른 칸과 같은 문법(옅은 채움 + 진한
                    // 테두리)에 색만 핑크입니다.
                    return (
                        <span
                            key={`class-${b.start.period}`}
                            style={{
                                left: `${pct(b.start.start_minute)}%`,
                                width: `${((b.end.end_minute - b.start.start_minute) / span) * 100}%`,
                                borderColor: live ? "#ff4eba" : color,
                                backgroundColor: live
                                    ? "rgba(255, 78, 186, 0.22)"
                                    : withAlpha(color, 0.14),
                                opacity: !live && past ? 0.4 : 1,
                            }}
                            className={`absolute inset-y-0 flex items-center justify-center border-2 text-[11px] font-black tabular-nums ${
                                live
                                    ? "text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.18)]"
                                    : past
                                      ? "text-black/70"
                                      : "text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
                            }`}
                        >
                            {b.periods.length > 1
                                ? `${b.periods[0]}–${b.periods[b.periods.length - 1]}`
                                : b.start.period}
                        </span>
                    );
                })}

                {/* 지금 — 하루 어디쯤 와 있는지. 분이 바뀌면 미끄러집니다.
                    마름모는 이 앱이 시간표에서 쓰는 표식과 같은 모양입니다 */}
                {caret !== null && (
                    <span
                        className="absolute -top-2.5 -bottom-2.5 z-10 w-0.5 bg-black transition-[left] duration-700 ease-out"
                        style={{ left: `${caret}%` }}
                    >
                        <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-black" />
                    </span>
                )}
            </div>

            {/* 눈금 — 덩어리의 양 끝과 그 사이 구멍의 이름.
                좁은 화면에서는 하루의 **양 끝만** 남깁니다 (안쪽 눈금이 겹칩니다) */}
            <div className="relative mt-1.5 h-3">
                {blocks
                    .flatMap((b, index) => [
                        { minute: b.start, edge: index === 0 },
                        { minute: b.end, edge: index === blocks.length - 1 },
                    ])
                    .map(({ minute, edge }) => (
                        <span
                            key={minute}
                            className={`absolute text-[9px] font-bold tabular-nums text-black/30 ${
                                edge ? "" : "hidden sm:block"
                            }`}
                            style={anchor(pct(minute))}
                        >
                            {hhmm(minute)}
                        </span>
                    ))}

                {voids.map(
                    (v) =>
                        v.name && (
                            <span
                                key={v.start}
                                className="absolute hidden text-center text-[9px] font-bold text-black/25 sm:block"
                                style={{
                                    left: `${pct(v.start)}%`,
                                    width: `${((v.end - v.start) / span) * 100}%`,
                                }}
                            >
                                {v.name}
                            </span>
                        ),
                )}
                </div>
            </div>
        </div>
    );
};

export default DayRuler;

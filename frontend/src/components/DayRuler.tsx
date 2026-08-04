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

import React from "react";
import type { BreakTime, PeriodTime, TodayClass } from "../lib/friendsApi";
import { hhmm } from "../lib/utils";

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
    if (periods.length === 0) return null;

    const first = periods[0].start_minute;
    const last = periods[periods.length - 1].end_minute;
    const span = last - first;
    const pct = (minute: number) => ((minute - first) / span) * 100;

    const mine = new Set(today.map((c) => c.period));

    // 축 눈금은 **덩어리의 양 끝**에만. 교시마다 시각을 달면 열한 개가 겹칩니다
    const blocks: { start: number; end: number }[] = [];
    for (const p of periods) {
        const tail = blocks[blocks.length - 1];
        if (tail && p.start_minute - tail.end <= 15) tail.end = p.end_minute;
        else blocks.push({ start: p.start_minute, end: p.end_minute });
    }

    // 덩어리 사이의 큰 구멍이 무엇인지. 한 구멍에 여러 시간대가 걸치므로
    // (점심 + 학급모임) **가장 많이 겹치는 것**을 씁니다
    const voids = blocks.slice(0, -1).map((block, index) => {
        const gap = { start: block.end, end: blocks[index + 1].start };
        const best = breaks
            .map((b) => ({
                name: b.name,
                overlap:
                    Math.min(gap.end, b.end_minute) - Math.max(gap.start, b.start_minute),
            }))
            .filter((b) => b.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap)[0];
        return { ...gap, name: best?.name ?? null };
    });

    // 교시 사이 쉬는시간(10분). 빗금을 이만큼 안쪽으로 물려서 칸과 칸 사이 간격과
    // 같은 리듬을 만듭니다 — 끝에서 끝까지 채우면 빗금만 혼자 붙어 있어 보입니다
    const restGap =
        periods.length > 1 ? periods[1].start_minute - periods[0].end_minute : 10;

    const caret =
        nowMinute !== null && nowMinute >= first && nowMinute <= last
            ? pct(nowMinute)
            : null;

    return (
        <div className="mt-6" aria-hidden="true">
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

                {periods.map((p) => {
                    const has = mine.has(p.period);
                    const past = nowMinute !== null && nowMinute >= p.end_minute;
                    const live =
                        nowMinute !== null &&
                        nowMinute >= p.start_minute &&
                        nowMinute < p.end_minute;

                    // 검은 테두리 = 내 수업, 점선 = 공강. **면을 채우는 건 "지금" 하나뿐**
                    // 입니다 — 남은 수업까지 검게 칠했더니 하루가 통째로 쨍했습니다
                    return (
                        <span
                            key={p.period}
                            style={{
                                left: `${pct(p.start_minute)}%`,
                                width: `${((p.end_minute - p.start_minute) / span) * 100}%`,
                            }}
                            className={`absolute inset-y-0 flex items-center justify-center border-2 text-[11px] font-black tabular-nums ${
                                !has
                                    ? "border-dashed border-black/20 text-black/25"
                                    : live
                                      ? "border-black bg-retro-primary text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.25)]"
                                      : past
                                        ? "border-black/15 bg-black/15 text-black/40"
                                        : "border-black bg-white text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
                            }`}
                        >
                            {p.period}
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
    );
};

export default DayRuler;

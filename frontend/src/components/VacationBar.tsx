/**
 * 방학을 재는 막대 — 종업부터 개학까지를 한 줄로 놓고 오늘을 그 위에 찍습니다.
 *
 * 방학에 하루 시간표를 그려 봐야 열한 칸이 전부 비어 있을 뿐입니다. 그래서 **재는
 * 대상을 바꿉니다** — 눈금이 시각에서 날짜로 바뀌고, 주 단위로 끊깁니다.
 *
 * **색이 칠해지는 쪽은 남은 방학입니다.** 지나간 날을 칠하면 "얼마나 썼나" 를 말하게
 * 되는데, 방학 화면이 할 말은 그쪽이 아닙니다. 색은 계절에서 가져옵니다.
 */

import React from "react";

/** `YYYY-MM-DD` → `8/18` */
const md = (iso: string) => {
    const [, month, day] = iso.split("-");
    return `${Number(month)}/${Number(day)}`;
};

const dayCount = (from: string, to: string) =>
    Math.round(
        (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
            86_400_000,
    );

/** 여름은 볕, 겨울은 하늘. `session.label` 이 그대로 키입니다 */
const SEASON_FILL: Record<string, string> = {
    여름방학: "#ffd500",
    겨울방학: "#00c8ff",
};

interface VacationBarProps {
    /** `"여름방학"` · `"겨울방학"`. 막대 색이 여기서 나옵니다 */
    label: string | null;
    /** 방학이 시작된 날 (`YYYY-MM-DD`). 없으면 막대 대신 남은 날짜만 */
    since: string | null;
    resumesOn: string | null;
    daysLeft: number | null;
}

const VacationBar: React.FC<VacationBarProps> = ({
    label,
    since,
    resumesOn,
    daysLeft,
}) => {
    if (!resumesOn || daysLeft === null) return null;

    const total = since ? dayCount(since, resumesOn) : 0;
    const done = since ? total - daysLeft : 0;
    const percent = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : null;
    const fill = SEASON_FILL[label ?? ""] ?? "#ffd500";

    // 주 단위 눈금. 눈금이 없으면 막대가 그냥 긴 상자라서 "얼마나 남았나" 가 비율로만
    // 읽히고 감이 안 옵니다
    const weeks =
        total > 0
            ? Array.from({ length: Math.max(0, Math.ceil(total / 7) - 1) }, (_, i) =>
                  ((i + 1) * 7 * 100) / total,
              ).filter((p) => p < 100)
            : [];

    return (
        <div className="mt-8">
            <div className="relative h-10 md:h-11" aria-hidden="true">
                <div className="absolute inset-0 overflow-hidden border-2 border-black bg-white">
                    {percent !== null && (
                        <>
                            {/* 남은 방학 — 칠하는 쪽 */}
                            <span
                                className="absolute inset-y-0 right-0 transition-[left] duration-700 ease-out"
                                style={{ left: `${percent}%`, backgroundColor: fill }}
                            />
                            {/* 지나간 날 — 빗금만 */}
                            <span
                                className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.13)_0_4px,transparent_4px_9px)] transition-[width] duration-700 ease-out"
                                style={{ width: `${percent}%` }}
                            />
                        </>
                    )}
                    {weeks.map((p) => (
                        <span
                            key={p}
                            className="absolute inset-y-0 w-px bg-black/15"
                            style={{ left: `${p}%` }}
                        />
                    ))}
                </div>

                {percent !== null && percent < 78 && (
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-black tabular-nums text-black/55">
                        {daysLeft}일 남음
                    </span>
                )}

                {/* 캐럿은 막대 **안에만** 있습니다. 위아래로 삐져나오게 뒀더니 막대가
                    깔끔하게 안 끝나고 선이 걸쳐 있는 것처럼 보였습니다 — 칩이 막대 위에
                    얹힌 꼬리표가 되면 같은 말을 하면서 훨씬 조용합니다 */}
                {percent !== null && (
                    <div
                        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-black transition-[left] duration-700 ease-out"
                        style={{ left: `${percent}%` }}
                    >
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap bg-black px-1.5 py-px text-[10px] font-black tabular-nums text-white">
                            D-{daysLeft}
                        </span>
                    </div>
                )}

                {percent === null && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-black tabular-nums">
                        개학까지 {daysLeft}일
                    </span>
                )}
            </div>

            <div className="relative mt-2 h-3">
                {since && (
                    <span className="absolute left-0 text-[9px] font-bold tabular-nums text-black/30">
                        종업 {md(since)}
                    </span>
                )}
                <span className="absolute right-0 text-[9px] font-bold tabular-nums text-black/30">
                    개학 {md(resumesOn)}
                </span>
            </div>
        </div>
    );
};

export default VacationBar;

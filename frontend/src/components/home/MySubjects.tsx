/**
 * 이 학기에 듣는 **과목 목록** — 홈의 맨 아래.
 *
 * 위의 격자(`WeekTimetable`)가 "언제" 를 묻는 물건이라면 여기는 **"무엇을"** 입니다.
 * 같은 과목이 요일마다 흩어져 있는 격자에서는 몇 과목인지·몇 학점인지 세려면 눈으로
 * 훑어야 하는데, 그건 목록이 훨씬 잘하는 일입니다.
 *
 * ```
 * ┌ Subjects ───────────────────── 12과목 · 26학점 ┐
 * │ ▸ ▍세계사의이해        5분반 · 박인숙    3학점  │
 * │ ▾ ▍미적분학2           1분반 · 김정은    4학점  │
 * │      형3205 · 월 5–6교시 · 목 3교시             │
 * └────────────────────────────────────────────────┘
 * ```
 *
 * **줄마다 테두리를 두르지 않습니다** — 카드 안에 카드가 열두 개 든 꼴이 되고, 그건
 * 오늘 목록에서 이미 한 번 실패한 길입니다 (`design-guide.md`). 나누는 건 `black/10`
 * 구분선이고, 색은 왼쪽 학과색 띠 하나뿐입니다.
 *
 * ⚠️ **접힌 줄에도 분반·교사가 보입니다.** 펼쳐야 알 수 있게 두면 "내가 몇 분반이지"
 * 를 확인하려고 열두 줄을 다 열게 됩니다 — 펼침은 **교실과 시간**을 위한 자리입니다.
 */

import React, { useMemo, useState } from "react";
import { BookMarked, ChevronDown } from "lucide-react";
import type { TodayClass } from "../../lib/friendsApi";
import { collectSubjects, periodLabel } from "../../lib/homeView";
import { DAY_MAP, getDepartmentColor, getKoreanName } from "../../lib/utils";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";

interface MySubjectsProps {
    /** 주간 시간표. **계획을 보는 중이면 계획의 과목이 옵니다** */
    week: Record<string, TodayClass[]>;
    /** 과목명 → 학점. 교육과정에 없는 과목(외국인 전형 등)은 `null` */
    credits: Map<string, number | null>;
}

const MySubjects: React.FC<MySubjectsProps> = ({ week, credits }) => {
    const subjects = useMemo(() => collectSubjects(week), [week]);
    const [open, setOpen] = useState<string | null>(null);

    /**
     * 학점 합계. **학점을 모르는 과목이 있으면 `+` 를 붙입니다** — 모르는 걸 0으로
     * 세고 조용히 더하면 합계가 틀린 채로 확신에 차 보입니다.
     */
    const total = useMemo(() => {
        let sum = 0;
        let unknown = false;
        subjects.forEach((s) => {
            const credit = credits.get(s.subject);
            if (credit == null) unknown = true;
            else sum += credit;
        });
        return { sum, unknown };
    }, [subjects, credits]);

    if (subjects.length === 0) return null;

    return (
        <RetroCard className="overflow-hidden bg-white">
            <div className="flex items-baseline justify-between gap-3 px-4 py-3 md:px-5">
                <RetroSubTitle title="Subjects" icon={BookMarked} iconSize={15} />
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-black/35">
                    {subjects.length}과목 · {total.sum}
                    {total.unknown ? "+" : ""}학점
                </span>
            </div>

            <ul className="divide-y divide-black/10 border-t border-black/10">
                {subjects.map((item) => {
                    const key = `${item.subject}-${item.section}`;
                    const isOpen = open === key;
                    const color = getDepartmentColor(item.department);
                    const credit = credits.get(item.subject);
                    return (
                        <li key={key}>
                            <button
                                type="button"
                                onClick={() => setOpen(isOpen ? null : key)}
                                aria-expanded={isOpen}
                                className="flex w-full items-center gap-3 py-3 pr-4 text-left transition-colors duration-100 hover:bg-retro-accent-light md:pr-5"
                            >
                                {/* 학과색 띠 — 자·목록·격자와 같은 색이라 같은 과목이
                                    네 자리에서 같은 색으로 보입니다 */}
                                <span
                                    className="-my-3 w-1 shrink-0 self-stretch"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="min-w-0 flex-1">
                                    <span
                                        className="block truncate text-[15px] font-black leading-tight tracking-tight"
                                        style={{ color }}
                                    >
                                        {getKoreanName(item.subject)}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[12px] font-bold text-black/40">
                                        {item.section.replace(/[^0-9]/g, "")}분반 ·{" "}
                                        {item.teacher}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[12px] font-bold tabular-nums text-black/35">
                                    {credit == null ? "—" : `${credit}학점`}
                                </span>
                                <ChevronDown
                                    size={16}
                                    strokeWidth={3}
                                    className={`shrink-0 text-black/30 transition-transform duration-100 ${
                                        isOpen ? "rotate-180" : ""
                                    }`}
                                />
                            </button>

                            {isOpen && (
                                /* 펼친 자리는 **교실과 시간**입니다. 왼쪽 여백을 띠
                                   너비만큼 맞춰서 접힌 줄의 글자와 세로로 이어집니다 */
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3 pl-4 pr-4 text-[12px] font-bold text-black/45 md:pr-5">
                                    <span className="font-black text-black">
                                        {item.rooms.join(" · ") || "배정중"}
                                    </span>
                                    {item.times.map((slot) => (
                                        <span key={slot.day} className="tabular-nums">
                                            {DAY_MAP[slot.day]} {periodLabel(slot.periods)}
                                        </span>
                                    ))}
                                    <span className="tabular-nums text-black/30">
                                        주 {item.periodCount}교시
                                    </span>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </RetroCard>
    );
};

export default MySubjects;

/**
 * Admin 의 `Major Survey` — 전공을 묻는 창(`MajorPrompt`)에 얼마나 답했는지와 트랙별 인원.
 *
 * ```
 * 학번을 확인한 계정 212명 기준 …                                 [Refetch]
 * RESPONSE 62%   DECIDED 118   UNDECIDED 14   NO ANSWER 80
 * 수리정보과학부
 *   수학      ████████░░░░░░  18명
 *   정보과학  ██████████████  31명
 * …
 * ```
 *
 * **인원 수만 봅니다.** 누가 무엇을 골랐는지는 서버도 내보내지 않습니다(`GET /majors/stats`) —
 * 조사가 얼마나 됐는지 알려면 그거면 충분합니다. 세는 대상은 학번을 확인한 계정이라 교사·관리자
 * 계정과 시연 계정은 빠집니다. 접혀 있으면 내려가고 펼칠 때마다 새로 받습니다(`AccordionSection`).
 */

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchMajorStats, type MajorStats } from "../../lib/majors";
import RetroSpinner from "../atoms/RetroSpinner";
import RetroStatItem from "../atoms/RetroStatItem";
import BarChartRow from "../molecules/BarChartRow";

/** `FactsPanel` 의 `Refetch` 와 같은 모양 — 아코디언 안의 작은 단추입니다 */
const toolClass =
    "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-2 border-black/30 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-black/50 transition-all duration-100 hover:border-black hover:text-black disabled:pointer-events-none disabled:opacity-40";

const MajorSurveyPanel: React.FC = () => {
    const [stats, setStats] = useState<MajorStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setStats(await fetchMajorStats());
            setError(null);
        } catch {
            setError("조사 현황을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const refetch = () => {
        setLoading(true);
        void load();
    };

    if (!stats) {
        return loading ? (
            <div className="flex justify-center py-6">
                <RetroSpinner />
            </div>
        ) : (
            <p className="text-sm font-bold text-black/40">{error}</p>
        );
    }

    const answered = stats.students - stats.unanswered;
    const rate = stats.students ? Math.round((answered / stats.students) * 100) : 0;
    const top = Math.max(1, ...stats.divisions.flatMap((d) => d.majors.map((m) => m.count)));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 basis-64 text-xs font-bold leading-relaxed text-black/40">
                    학번을 확인한 계정 {stats.students}명 기준입니다. 누가 무엇을 골랐는지는 보이지
                    않고 트랙별 인원만 셉니다. "아직 정하지 않았어요" 를 고른 사람은 미정입니다.
                </p>
                <button type="button" disabled={loading} onClick={refetch} className={toolClass}>
                    <RefreshCw size={11} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
                    Refetch
                </button>
            </div>

            {error && <p className="text-xs font-bold text-red-600">{error}</p>}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <RetroStatItem size="sm" label="Response" value={rate} unit="%" />
                <RetroStatItem size="sm" label="Decided" value={answered - stats.undecided} unit="Students" />
                <RetroStatItem size="sm" label="Undecided" value={stats.undecided} unit="Students" />
                <RetroStatItem size="sm" label="No Answer" value={stats.unanswered} unit="Students" />
            </div>

            <div className="space-y-5">
                {stats.divisions.map(({ division, majors }) => (
                    <div key={division} className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                            {division}
                        </p>
                        {majors.map((m) => (
                            <BarChartRow
                                key={m.name}
                                label={m.name}
                                value={m.count}
                                maxValue={top}
                                caption={`${m.count}명`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MajorSurveyPanel;

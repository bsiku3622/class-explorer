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
 * 계정과 시연 계정은 빠집니다. 접혀 있으면 내려가고 펼칠 때마다 새로 받습니다(`Accordion`).
 */

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchMajorStats, type MajorStats } from "../../lib/majors";
import BarChartRow from "../molecules/BarChartRow";
import { Button, Spinner, Stat, Text } from "@studio-baeks/funky-ui";

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
                <Spinner />
            </div>
        ) : (
            <Text as="p" tone="muted">{error}</Text>
        );
    }

    const answered = stats.students - stats.unanswered;
    const rate = stats.students ? Math.round((answered / stats.students) * 100) : 0;
    const top = Math.max(1, ...stats.divisions.flatMap((d) => d.majors.map((m) => m.count)));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <Text as="p" variant="caption" tone="muted" leading="relaxed" className="min-w-0 flex-1 basis-64">
                    학번을 확인한 계정 {stats.students}명 기준입니다. 누가 무엇을 골랐는지는 보이지
                    않고 트랙별 인원만 셉니다. "아직 정하지 않았어요" 를 고른 사람은 미정입니다.
                </Text>
                <Button
                    size="xs"
                    variant="muted"
                    icon={RefreshCw}
                    iconSpin={loading}
                    disabled={loading}
                    onClick={refetch}
                    className="shrink-0 whitespace-nowrap"
                >
                    Refetch
                </Button>
            </div>

            {error && <Text as="p" variant="caption" tone="red">{error}</Text>}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat size="sm" label="Response" value={rate} unit="%" />
                <Stat size="sm" label="Decided" value={answered - stats.undecided} unit="Students" />
                <Stat size="sm" label="Undecided" value={stats.undecided} unit="Students" />
                <Stat size="sm" label="No Answer" value={stats.unanswered} unit="Students" />
            </div>

            <div className="space-y-5">
                {stats.divisions.map(({ division, majors }) => (
                    <div key={division} className="space-y-2">
                        <Text as="p" variant="overline">
                            {division}
                        </Text>
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

import { useState } from "react";

/**
 * 학년 거르개의 고른 값 — 처음에는 전부 켜 둡니다.
 *
 * 학생 수가 늦게 도착하면 그때 전부 켭니다. ⚠️ `studentCounts` 가 바뀐 순간에만 봅니다. 렌더마다 "비어 있으면
 * 전부 켜기" 로 두면 사용자가 일부러 다 끈 상태가 곧바로 되돌아갑니다.
 */
export function useSelectedYears(studentCounts: Record<string, number>) {
    const [selectedYears, setSelectedYears] = useState<string[]>(() => Object.keys(studentCounts));
    const [seenCounts, setSeenCounts] = useState(studentCounts);
    if (studentCounts !== seenCounts) {
        setSeenCounts(studentCounts);
        const years = Object.keys(studentCounts);
        if (years.length > 0 && selectedYears.length === 0) setSelectedYears(years);
    }
    return [selectedYears, setSelectedYears] as const;
}

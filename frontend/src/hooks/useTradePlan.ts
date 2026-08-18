/**
 * `/trade` 에 저장해 둔 계획을 **홈에서 읽습니다.**
 *
 * 홈은 계획을 고치지 않습니다 — 읽기 전용입니다. 저장된 값(`userState` 의 `trade` 키)을
 * 그대로 `tradeEngine.buildPlannedSchedule` 에 넘겨, 트레이드 화면이 보여 주는 것과
 * **같은 시간표**를 얻습니다.
 *
 * ⚠️ **남의 계획은 그리지 않습니다.** 트레이드 화면은 다른 학생을 열어 볼 수 있어서
 * (친구 계획을 봐주는 쓰임), 저장된 학번이 내 학번이 아니면 홈에는 아무것도 안 뜹니다 —
 * 안 그러면 남의 시간표가 "내 시간표" 자리에 앉습니다.
 */

import { useEffect, useMemo, useState } from "react";
import type { SubjectData } from "../types";
import {
    buildPlannedSchedule,
    buildSubjectIndex,
    findPlans,
    getStudentSchedule,
    hasAutoChoice,
    sameSections,
    TRADE_STATE_LEGACY_KEY,
    type PlanState,
    type SavedTradePlan,
    type SectionInfo,
} from "../lib/tradeEngine";
import { loadState } from "../lib/userState";

/**
 * 계획을 적용한 시간표. 아래 중 하나라도 걸리면 `null` 이고, 홈은 전환 자체를 감춥니다.
 *
 * - 수강 정정 기간이 아니거나(`enabled`) 학번이 없는 계정
 * - 저장된 계획이 없거나, 다른 학생의 계획
 * - 계획이 시간표를 하나도 바꾸지 않음 (같은 걸 두 번 보여 줄 이유가 없습니다)
 */
export const useTradePlan = (
    enabled: boolean,
    allClassesData: SubjectData[],
    myStuId: string | null,
): SectionInfo[] | null => {
    const [saved, setSaved] = useState<SavedTradePlan | null>(null);

    useEffect(() => {
        // 볼 이유가 없으면 아예 안 받습니다. 남은 값은 아래 `useMemo` 가 학번·기간으로
        // 다시 거르므로, 여기서 비우지 않아도 남의 계획이 새어 나가지 않습니다
        if (!enabled || !myStuId) return;
        let cancelled = false;
        loadState<SavedTradePlan>("trade", TRADE_STATE_LEGACY_KEY)
            .then((state) => {
                if (!cancelled) setSaved(state);
            })
            .catch(() => {
                // 못 받았으면 계획이 없는 것으로 둡니다. 홈은 읽기만 하므로 저장된
                // 값을 건드릴 위험이 없습니다 (트레이드 화면 쪽 ⚠️ 와 다른 점입니다)
                if (!cancelled) setSaved(null);
            });
        return () => {
            cancelled = true;
        };
    }, [enabled, myStuId]);

    return useMemo(() => {
        if (!enabled || !saved || !myStuId) return null;
        if (saved.stuId !== myStuId) return null;
        if (allClassesData.length === 0) return null;

        const state: PlanState = {
            actions: saved.actions ?? {},
            addSelections: Array.isArray(saved.addSelections)
                ? saved.addSelections
                : [],
            moveTargets: saved.moveTargets ?? {},
        };

        const schedule = getStudentSchedule(allClassesData, myStuId);
        if (schedule.length === 0) return null;

        const index = buildSubjectIndex(allClassesData);
        const auto = hasAutoChoice(schedule, state);

        /**
         * 조합 탐색은 **필요할 때만** 돌립니다. 분반을 전부 직접 골라 뒀다면 탐색 없이도
         * 결과가 정해지는데, 홈은 켜자마자 그려야 하는 화면이라 공짜 계산이 아닙니다.
         */
        let plan = null;
        if (saved.previewKey || auto) {
            const { results } = findPlans({ schedule, index, ...state });
            plan =
                (saved.previewKey
                    ? (results.find((p) => p.key === saved.previewKey) ?? null)
                    : null) ?? (auto ? (results[0] ?? null) : null);
        }

        const planned = buildPlannedSchedule(schedule, index, state, plan);
        return sameSections(schedule, planned.sections) ? null : planned.sections;
    }, [enabled, saved, myStuId, allClassesData]);
};

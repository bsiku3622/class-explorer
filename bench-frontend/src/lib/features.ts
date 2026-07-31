import type { Term } from "../types";

/**
 * 한시적으로 여는 기능의 노출 조건.
 *
 * 수강 변경 탐색(Trade)은 수강신청 정정 기간에만 의미가 있어서,
 * 기간이 끝나면 `enabled`를 false로 내려 통째로 감춥니다.
 */
export const TRADE_FEATURE = {
    enabled: true,
    /** 이 학기에서만 동작합니다 */
    year: 2026,
    semester: 2,
} as const;

export const isTradeAvailable = (term: Term | null): boolean =>
    TRADE_FEATURE.enabled &&
    term?.year === TRADE_FEATURE.year &&
    term?.semester === TRADE_FEATURE.semester;

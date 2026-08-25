import type { Term } from "../types";

/**
 * 한시적으로 여는 기능의 노출 조건.
 *
 * ⚠️ **여기에는 기간이 없습니다.** 언제까지 열지, 어느 학기 것인지는 전부 서버가
 * 정해서 `/auth/me` 의 `trade` 로 보내 줍니다(`backend/features.py`, 관리자 화면에서
 * 고칩니다). 기기 시계로 판정하면 시계가 틀어진 폰에서는 마감이 지나도 열려 있어서,
 * 마감이 있는 기능은 **한 시계**로 재야 합니다.
 */
export interface TradeConfig {
    /** 스위치와 마감을 서버 시계로 잰 결과 */
    open: boolean;
    year: number | null;
    semester: number | null;
}

/**
 * 지금 이 학기에서 Trade 를 열어도 되는가.
 *
 * 학기를 여기서 마저 보는 이유는, **서버는 그 사람이 어느 학기를 열어 두었는지 모르기**
 * 때문입니다. 2026-2 정정 기간이어도 2025-1 을 펴 놓고 있으면 뜨면 안 됩니다.
 *
 * ⚠️ **설정이 아직 안 왔으면 닫아 둡니다.** 잠깐 보였다 사라지는 편보다 늦게 나타나는
 * 편이 낫고, 마감이 지난 뒤 새로 연 사람에게 한 번 깜빡이는 일도 없습니다.
 */
export const isTradeAvailable = (
    term: Term | null,
    config: TradeConfig | undefined,
): boolean =>
    config?.open === true &&
    term?.year === config.year &&
    term?.semester === config.semester;

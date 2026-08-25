import type { Term } from "../types";

/**
 * 한시적으로 여는 기능의 노출 조건.
 *
 * 수강 변경 탐색(Trade)은 수강신청 정정 기간에만 의미가 있어서, 기간이 끝나면 통째로
 * 감춥니다 — 홈의 배너, 하단 네비·사이드바의 메뉴, `/trade` 라우트, 홈의
 * `[기존 시간표 | 트레이드 계획]` 전환이 **전부 이 하나로 갈립니다.**
 *
 * ⚠️ **마감 시각은 여기 없습니다.** 서버가 재서 `/auth/me` 의 `trade_open` 으로 보내
 * 줍니다(`backend/features.py`). 기기 시계로 판정하면 시계가 틀어진 폰에서는 마감이
 * 지나도 열려 있습니다 — 마감이 있는 기능은 한 시계로 재야 합니다.
 */
export const TRADE_FEATURE = {
    /** 이 학기에서만 동작합니다 */
    year: 2026,
    semester: 2,
} as const;

/**
 * 지금 이 학기에서 Trade 를 열어도 되는가.
 *
 * `serverOpen` 은 `/auth/me` 가 준 값입니다. **아직 안 왔으면(`undefined`) 닫아 둡니다** —
 * 잠깐 보였다 사라지는 편보다 늦게 나타나는 편이 낫고, 마감이 지난 뒤 새로 연 사람에게
 * 한 번 깜빡이는 일도 없습니다.
 *
 * ⚠️ 이 값은 앱을 열 때 한 번 받습니다. 화면을 켜 둔 채로 마감을 넘기면 다시 받을 때까지
 * 남아 있는데, Trade 는 계획을 세워 보는 화면일 뿐 학교에 무언가를 내는 곳이 아니라
 * 그대로 둡니다.
 */
export const isTradeAvailable = (
    term: Term | null,
    serverOpen: boolean | undefined,
): boolean =>
    serverOpen === true &&
    term?.year === TRADE_FEATURE.year &&
    term?.semester === TRADE_FEATURE.semester;

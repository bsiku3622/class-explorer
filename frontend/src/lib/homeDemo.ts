/**
 * 홈 화면 상태 미리보기 — **개발 전용**.
 *
 * 홈이 그리는 것은 대부분 "오늘이 무슨 날인가" 에 달려 있는데, 그건 학사일정과 시계가
 * 정합니다. 방학에 붙잡혀 있으면 수업 중 화면을 볼 방법이 없고, 볼 수 있는 유일한
 * 방법이 "8월 18일까지 기다리기" 가 되면 그동안 그 화면은 아무도 안 본 채로 배포됩니다.
 *
 * 그래서 **실제 응답 위에 상황만 덧씌웁니다.** 교시 시각표·급식·학기는 서버가 준
 * 진짜 값을 그대로 두고 `now`·`session`·`today` 만 갈아 끼웁니다 — 화면이 진짜
 * 데이터로 도는지 보려는 것이지 목업을 보려는 게 아닙니다.
 *
 * `import.meta.env.DEV` 안에서만 불립니다. 값과 함수뿐인 모듈이라 프로덕션 번들에는
 * 남지 않습니다.
 */

import type { HomeData, TodayClass } from "./friendsApi";

export const HOME_DEMOS = [
    { key: "class", label: "수업중" },
    { key: "gap", label: "공강" },
    { key: "before", label: "수업 전" },
    { key: "done", label: "수업 끝" },
    { key: "weekend", label: "주말" },
    { key: "holiday", label: "휴업" },
] as const;

export type HomeDemoKey = (typeof HOME_DEMOS)[number]["key"];

/** 학과가 골고루 섞인 하루. 색이 실제로 어떻게 보이는지가 이 표본의 목적입니다 */
const SAMPLE_DAY: TodayClass[] = [
    { period: 2, subject: "미적분학2(EC)", section: "3", teacher: "김효진", room: "배정중", department: "수학" },
    { period: 5, subject: "일반물리학1", section: "1", teacher: "박수현", room: "과학관 301", department: "물리학" },
    { period: 6, subject: "일반지구과학", section: "2", teacher: "이도현", room: "과학관 204", department: "지구과학" },
    { period: 7, subject: "일반지구과학", section: "2", teacher: "이도현", room: "과학관 204", department: "지구과학" },
    { period: 9, subject: "영어독해와작문", section: "4", teacher: "최지은", room: "어학관 102", department: "외국어" },
    { period: 10, subject: "일반지구과학실험", section: "2", teacher: "이도현", room: "배정중", department: "지구과학" },
    { period: 11, subject: "일반지구과학실험", section: "2", teacher: "이도현", room: "배정중", department: "지구과학" },
];

const hhmm = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** 자정 기준 분. 각 상황이 성립하는 시각을 골라 둡니다 */
const MINUTE: Record<HomeDemoKey, number> = {
    class: 909, // 15:09 — 6교시 한가운데
    gap: 660, // 11:00 — 3교시(수업 없음)
    before: 480, // 08:00 — 1교시 전
    done: 1320, // 22:00 — 11교시 뒤
    weekend: 660,
    holiday: 660,
};

const OFF: Partial<
    Record<HomeDemoKey, { reason: "weekend" | "holiday"; label: string; day: string | null }>
> = {
    weekend: { reason: "weekend", label: "주말", day: null },
    holiday: { reason: "holiday", label: "추석", day: "FRI" },
};

/** 실제 응답 위에 상황만 덧씌웁니다. `periods`·`breaks`·`meal` 은 진짜 값 그대로 */
export const applyHomeDemo = (key: HomeDemoKey, home: HomeData): HomeData => {
    const minute = MINUTE[key];
    const off = OFF[key];

    return {
        ...home,
        now: {
            ...home.now,
            time: hhmm(minute),
            minute,
            day: off ? off.day : "MON",
            period: null,
            break_name: null,
            next_period: null,
        },
        session: {
            ...home.session,
            in_session: true,
            label: null,
            since: null,
            resumes_on: null,
            days_left: null,
            has_class: !off,
            off_reason: off?.reason ?? null,
            off_label: off?.label ?? null,
        },
        today: off ? [] : SAMPLE_DAY,
        // 주간 격자에도 같은 하루를 심습니다 — 위 카드는 표본을, 아래 격자는 진짜
        // 시간표를 보여 주면 "지금" 이 서로 다른 칸을 가리켜 화면을 못 믿게 됩니다.
        // **`off` 여도 비우지 않습니다**: `week` 는 오늘이 아니라 학기를 말합니다
        week: { ...home.week, [off?.day ?? "MON"]: SAMPLE_DAY },
    };
};

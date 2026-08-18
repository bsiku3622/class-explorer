/**
 * 홈을 **계획 시간표로 갈아 끼웁니다.**
 *
 * 수강 정정 기간에 홈은 두 벌을 보여 줍니다 — 지금 등록된 시간표(기존)와, `/trade` 에서
 * 짜 둔 계획을 적용한 시간표(트레이드). 화면을 두 벌 만들지 않고 **응답만 바꿔 끼우는**
 * 이유는, 그래야 히어로·자·목록·주간 격자가 각자 "계획일 때는 이렇게" 를 따로 알 필요가
 * 없기 때문입니다. 파생값은 전부 `homeView.ts` 가 `today`/`week` 에서 다시 셉니다.
 *
 * ⚠️ **바꾸는 건 시간표뿐입니다.** 급식·학사일정·교시 시각표·방학 여부는 계획과 아무
 * 상관이 없어서 그대로 둡니다 — 계획을 보는 중이라고 오늘이 다른 날이 되지 않습니다.
 */

import type { HomeData, TodayClass } from "./friendsApi";
import type { SectionInfo } from "./tradeEngine";
import type { SubjectData } from "../types";

/** 과목명 → 학과. 계획 시간표의 칩에도 같은 학과색을 입히려면 이게 필요합니다 */
export const buildDepartmentMap = (
    allClassesData: SubjectData[],
): Map<string, string | null> =>
    new Map(allClassesData.map((s) => [s.subject, s.department ?? null]));

/** 계획을 적용한 홈 응답 */
export const applyPlanToHome = (
    home: HomeData,
    sections: SectionInfo[],
    departments: Map<string, string | null>,
): HomeData => {
    const week: Record<string, TodayClass[]> = {};
    sections.forEach((s) => {
        s.times.forEach((t) => {
            const list = week[t.day] ?? (week[t.day] = []);
            list.push({
                period: t.period,
                subject: s.subject,
                section: s.section,
                teacher: s.teacher,
                // ⚠️ 교시마다 교실이 다를 수 있습니다 (실험 분반). 서버의 `/home` 도
                // 같은 순서로 고릅니다 — 분반 교실을 먼저 쓰면 두 시간표가 어긋납니다
                room: t.room || s.room,
                department: departments.get(s.subject) ?? null,
            });
        });
    });
    Object.values(week).forEach((list) => list.sort((a, b) => a.period - b.period));

    /**
     * ⚠️ **수업 없는 날은 서버와 같은 규칙으로 비웁니다.** 계획은 요일 단위라 방학에도
     * "월요일 시간표" 가 그대로 나옵니다 — `today` 만 비우고 `week` 는 남깁니다.
     */
    const today =
        home.session.has_class && home.now.day ? (week[home.now.day] ?? []) : [];

    /**
     * 화면은 `homeView.deriveHomeView` 로 다시 세지만, 응답 자체가 기존 시간표의
     * 수업을 들고 있으면 안 됩니다 — 계획을 보는 중에 "지금" 이 옛 교실을 가리킵니다.
     */
    const current =
        home.now.period !== null
            ? (today.find((c) => c.period === home.now.period) ?? null)
            : null;
    const after =
        home.now.period ??
        (home.now.next_period ? home.now.next_period.period - 1 : null);
    const next =
        after === null ? null : (today.find((c) => c.period > after) ?? null);

    return { ...home, week, today, current, next };
};

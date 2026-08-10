/**
 * 교육과정 조회 — Zamong·Browse·Trade 가 같이 씁니다.
 *
 * ⚠️ **`api.get("/curriculum")` 을 직접 부르지 마세요.** 세 화면이 같은 것을 받는데
 * 응답이 145과목 + 선수관계 117개라 작지 않고, 학기와 무관한 정의라 자주 받을 이유도
 * 없습니다. 여기를 거치면 하루 동안 한 번만 나갑니다.
 */

import api from "./api";
import { DAY, cached } from "./cache";
import type { Curriculum, ProgressTerm } from "./curriculum";

const SESSION_TOKEN_KEY = "ksa_session_token";

const authHeader = () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/** 카탈로그·선수관계·졸업 요건. 교육과정 개편 때나 바뀝니다 */
export const fetchCurriculum = (): Promise<Curriculum> =>
    cached("curriculum", DAY, async () => {
        const { data } = await api.get("/curriculum", { headers: authHeader() });
        return data as Curriculum;
    });

/**
 * 한 학생의 실제 수강 이력.
 *
 * ⚠️ 자몽은 이걸 **첫 밑칠에만** 씁니다 (`lib/zamong.guide.md`). 캐시하지 않는 이유는
 * 부르는 자리가 드물고, 수집이 돌면 바뀌는 값이기 때문입니다.
 */
export const fetchProgress = async (stuId: string): Promise<ProgressTerm[]> => {
    const { data } = await api.get(`/curriculum/progress/${encodeURIComponent(stuId)}`, {
        headers: authHeader(),
    });
    return (data?.terms ?? []) as ProgressTerm[];
};

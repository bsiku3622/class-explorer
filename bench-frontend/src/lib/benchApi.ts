/**
 * ksa-bench 전용 서버 질의.
 *
 * 사람과 관련된 것은 전부 여기를 지납니다. class-explorer 는 학기 전체를 한 번 받아
 * 브라우저에서 검색하지만, 이 앱은 **사람만큼은 서버에 물어봅니다** — 명단이 응답에
 * 실려 오면 화면에서 가려도 캐시에 남기 때문입니다.
 *
 * 서버에는 계정 단위 rate limit 이 걸려 있습니다(검색 40회/분, 상세 30회/분).
 * 사람이 손으로 하는 조회는 안 걸리지만, 훑으려 들면 걸립니다.
 */

import api from "./api";
import type {
    EnrollmentStats,
    Friend,
    FriendsBusyResponse,
    FriendsNowResponse,
    PeriodTime,
    StudentCandidate,
    StudentTimetable,
    Term,
} from "../types";

export interface StudentSearchResponse {
    students: StudentCandidate[];
    /** 상한(20명)을 넘겼습니다 — "더 구체적으로" 를 띄우세요 */
    has_more: boolean;
    /** 두 글자 미만이라 아예 찾지 않았습니다 */
    too_short: boolean;
}

const authHeader = () => {
    const token = localStorage.getItem("ksa_session_token");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
};

/** 이름·학번 부분 일치. 후보 목록만 돌아오고 시간표는 없습니다. */
export const searchStudents = async (q: string): Promise<StudentSearchResponse> => {
    const { data } = await api.get("/students/search", {
        headers: authHeader(),
        params: { q },
    });
    return data;
};

/** 한 학생의 시간표. **한 번에 한 명만** 됩니다 — 여러 명을 받는 형태로 바꾸지 마세요. */
export const fetchStudentTimetable = async (
    stuId: string,
    term?: Term | null,
): Promise<StudentTimetable> => {
    const { data } = await api.get(`/students/${encodeURIComponent(stuId)}`, {
        headers: authHeader(),
        params: term ? { year: term.year, semester: term.semester } : undefined,
    });
    return data;
};

/** 주당 교시·수강 과목 수 분포. 집계만 나오고 누가 어디 있는지는 나오지 않습니다. */
export const fetchEnrollmentStats = async (
    term?: Term | null,
): Promise<EnrollmentStats> => {
    const { data } = await api.get("/stats/enrollment", {
        headers: authHeader(),
        params: term ? { year: term.year, semester: term.semester } : undefined,
    });
    return data;
};

/** 내가 등록한 친구 목록. 이름·학번만 옵니다. */
export const fetchFriends = async (): Promise<Friend[]> => {
    const { data } = await api.get("/friends", { headers: authHeader() });
    return data.friends;
};

/** 친구 추가. **단방향**이라 상대의 수락이 필요 없습니다. */
export const addFriend = async (stuId: string): Promise<Friend> => {
    const { data } = await api.post(
        "/friends",
        { stu_id: stuId },
        { headers: authHeader() },
    );
    return data;
};

export const removeFriend = async (stuId: string): Promise<void> => {
    await api.delete(`/friends/${encodeURIComponent(stuId)}`, {
        headers: authHeader(),
    });
};

/**
 * 친구들이 **언제 수업이 있는지**만. 무슨 수업인지는 오지 않습니다 — 공강을 맞춰 보는
 * 게 목적이라 요일·교시면 충분하고, 과목까지 주면 "누가 뭘 듣는지" 목록이 됩니다.
 */
export const fetchFriendsBusy = async (
    term?: Term | null,
): Promise<FriendsBusyResponse> => {
    const { data } = await api.get("/friends/busy", {
        headers: authHeader(),
        params: term ? { year: term.year, semester: term.semester } : undefined,
    });
    return data;
};

/**
 * **지금 공강인 친구.** "지금"은 서버 시계로 정합니다 — 클라이언트 시계는 틀어져
 * 있거나 손댈 수 있어서, 사람마다 다르게 보이면 안 됩니다.
 */
export const fetchFriendsNow = async (
    term?: Term | null,
): Promise<FriendsNowResponse> => {
    const { data } = await api.get("/friends/now", {
        headers: authHeader(),
        params: term ? { year: term.year, semester: term.semester } : undefined,
    });
    return data;
};

/** 교시 시각표. 화면이 상수를 따로 들면 한쪽만 고쳤을 때 어긋납니다. */
export const fetchPeriods = async (): Promise<PeriodTime[]> => {
    const { data } = await api.get("/periods", { headers: authHeader() });
    return data.periods;
};

/** 내 누적 이수 현황. class-explorer 와 달리 남의 것은 볼 수 없습니다. */
export const fetchMyProgress = async () => {
    const { data } = await api.get("/me/progress", { headers: authHeader() });
    return data;
};

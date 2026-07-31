/**
 * 친구 + 교시 시각표.
 *
 * 서버 쪽은 `backend/friends_router.py` 하나를 **두 앱이 같이 씁니다**
 * (class-explorer / ksa-bench). 그래서 여기서 부르는 경로는 ksa-bench 쪽과 같습니다.
 *
 * 등록은 **단방향**입니다 — 내가 추가하면 끝이고 상대의 수락이 없습니다. 이 앱은
 * 어차피 학기 전체 데이터를 들고 있어서 승인 절차를 붙여도 막아 주는 게 없습니다.
 */

import api from "./api";
import type { Term } from "../types";

export interface Friend {
    stuId: string;
    name: string;
}

/** `GET /friends/busy` — 언제 수업이 있는지만. **무슨 수업인지는 오지 않습니다** */
export interface FriendBusy extends Friend {
    is_me: boolean;
    /** `"MON-3"` 모양 */
    busy: string[];
}

export interface FriendsBusyResponse {
    term: Term;
    people: FriendBusy[];
}

export interface FriendNow extends Friend {
    is_me: boolean;
    /** null 이면 지금이 수업 시간이 아니라 판단하지 않았다는 뜻 */
    free: boolean | null;
}

export interface FriendsNowResponse {
    term: Term;
    /** 서버 시계 기준 — 클라이언트 시계는 틀어질 수 있어 서버가 정합니다 */
    now: string;
    /** 주말이면 null */
    day: string | null;
    /** 쉬는시간·점심이면 null */
    period: number | null;
    break_name: string | null;
    next_period: { period: number; start: string } | null;
    people: FriendNow[];
}

export interface PeriodTime {
    period: number;
    start: string;
    end: string;
    start_minute: number;
    end_minute: number;
}

const authHeader = () => {
    const token = localStorage.getItem("ksa_session_token");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export const fetchFriends = async (): Promise<Friend[]> => {
    const { data } = await api.get("/friends", { headers: authHeader() });
    return data.friends;
};

/** 친구 추가. 단방향이라 상대의 수락이 필요 없습니다. */
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

/** 주간 공강 격자용. 슬롯만 오고 과목명은 오지 않습니다. */
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

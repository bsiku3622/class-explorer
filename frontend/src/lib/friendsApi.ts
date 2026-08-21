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
import { authHeader } from "./session";
import { DAY, cached } from "./cache";

const MINUTE = 60 * 1000;
import type { CalendarEvent, Term } from "../types";

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

// ─── 홈 ──────────────────────────────────────────────────────────────────────
export type MealSlot = "breakfast" | "lunch" | "dinner";
export type MealMenu = Record<MealSlot, string[]>;

export interface TodayClass {
    period: number;
    subject: string;
    section: string;
    teacher: string;
    room: string;
    /** 이 과목의 학과. 교육과정에 없는 과목(외국인 전형 등)은 `null` */
    department: string | null;
}

export interface HomeData {
    term: Term;
    now: {
        time: string;
        /** 자정 기준 분. 하루를 시간 축으로 그릴 때 캐럿 위치가 여기서 나옵니다 */
        minute: number;
        date: string;
        /** 주말이면 null */
        day: string | null;
        /** 쉬는시간이면 null */
        period: number | null;
        /** "점심"·"저녁"·"자습" 등. 교시와 겹칠 수 있습니다 */
        break_name: string | null;
        next_period: { period: number; start: string } | null;
    };
    session: {
        in_session: boolean;
        /** 방학이면 "여름방학" 같은 이름 */
        label: string | null;
        /** 방학이 시작된 날(= 마지막 종업). 진행 막대의 왼쪽 끝 */
        since: string | null;
        resumes_on: string | null;
        days_left: number | null;
        /**
         * 오늘 수업이 있는 날인가. **false 면 `today` 는 항상 빈 배열입니다** —
         * 학기 데이터는 요일 단위라 방학에도 "월요일 시간표" 가 나오므로 서버가
         * 학사일정으로 한 번 걸러 줍니다
         */
        has_class: boolean;
        off_reason: "vacation" | "weekend" | "holiday" | null;
        /** "여름방학"·"주말"·"추석" — 화면에 그대로 씁니다 */
        off_label: string | null;
    };
    today: TodayClass[];
    /**
     * 요일별 내 수업 (`{ MON: [...], … }`) — 주간 격자가 씁니다.
     *
     * ⚠️ **`today` 와 달리 방학·휴업에도 그대로 옵니다.** 오늘이 아니라 **이 학기**를
     * 말하는 값이라, 비우면 방학에 자기 시간표를 볼 길이 없습니다.
     */
    week: Record<string, TodayClass[]>;
    /** 교시 시각표. 화면이 상수를 따로 들지 않게 홈 응답에 실려 옵니다 */
    periods: PeriodTime[];
    /** 점심·저녁·자습 등. **교시와 겹칩니다** — 배타적으로 보면 안 됩니다 */
    breaks: BreakTime[];
    /**
     * 오늘에 걸치는 학사일정 + 내 개인 일정. 화면이 `/calendar` 를 또 부르지 않게
     * 같이 옵니다 — 하루치라 몇 줄 안 됩니다
     */
    events: CalendarEvent[];
    /** 지금 있어야 할 수업. null 이면 공강입니다 */
    current: TodayClass | null;
    next: TodayClass | null;
    /**
     * 서버에 급식 키가 없으면 통째로 null — 화면이 급식 칸을 아예 안 그립니다.
     *
     * **메뉴는 여기 없습니다.** 학교 API 가 3~5초씩 걸려서 같이 기다리면 홈 전체가
     * 늦어집니다 — `MealCard` 가 `GET /meal` 로 따로 받습니다.
     */
    meal: {
        /** 서버 기준 오늘. 날짜를 넘길 때 여기서 셉니다 */
        date: string;
        /** 지금 시간대의 끼니. 식사 시간이 지나면 null */
        slot: MealSlot | null;
    } | null;
}

/** 홈 화면이 쓰는 것 전부. 켜자마자 보이는 자리라 한 요청으로 받습니다. */
export const fetchHome = async (term?: Term | null): Promise<HomeData> => {
    const { data } = await api.get("/home", {
        headers: authHeader(),
        params: term ? { year: term.year, semester: term.semester } : undefined,
    });
    return data;
};

/**
 * 하루치 급식. `MealCard` 가 오늘 것부터 여기서 받습니다 — `GET /home` 에는 키가
 * 있는지와 지금 끼니만 있고 메뉴는 없습니다.
 *
 * **날짜별로 캐시합니다.** 학교 API 가 3~5초씩 걸려서, 화살표로 앞뒤를 오가면 봤던
 * 날을 매번 다시 기다리게 됩니다.
 *
 * ⚠️ 지난 날짜만 오래 답니다. 오늘·앞날은 **아직 안 올라왔을 수 있어서** 짧게 잡습니다 —
 * 길게 잡으면 비어 있던 날이 하루 종일 빈 채로 굳습니다 (서버도 같은 이유로 빈 날은
 * 저장하지 않습니다).
 */
export const fetchMeal = (
    date: string,
): Promise<{ date: string; menu: MealMenu | null }> => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const ttl = date < todayKey ? 7 * DAY : 20 * MINUTE;
    return cached(`meal_${date}`, ttl, async () => {
        const { data } = await api.get("/meal", {
            headers: authHeader(),
            params: { date },
        });
        return data;
    });
};

export interface PeriodTime {
    period: number;
    start: string;
    end: string;
    start_minute: number;
    end_minute: number;
}

/** 수업 외 시간대. `저녁`·`자습`은 교시와 **겹칩니다** */
export interface BreakTime {
    name: string;
    start: string;
    end: string;
    start_minute: number;
    end_minute: number;
}

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

/**
 * 교시 시각표. 화면이 상수를 따로 들면 한쪽만 고쳤을 때 어긋납니다.
 *
 * 생활관 일과표에서 온 값이라 학기 중에는 안 바뀝니다 — 하루 캐시합니다.
 */
export const fetchPeriods = (): Promise<PeriodTime[]> =>
    cached("periods", DAY, async () => {
        const { data } = await api.get("/periods", { headers: authHeader() });
        return data.periods as PeriodTime[];
    });

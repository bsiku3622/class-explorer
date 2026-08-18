/**
 * 로그인해 둔 기기 — 목록·폐기.
 *
 * **한 계정이 여러 기기에 동시에 로그인합니다.** 예전엔 로그인할 때마다 서버가 기존
 * 세션을 통째로 지워서(1계정 1세션) 폰에서 들어오면 노트북이 튕겼습니다. 상한을 두고
 * 밀어내는 방식으로 바뀌면서, **밀려난 기기가 왜 튕겼는지 알려 줄 화면**이 필요해졌고
 * 그게 이 API 를 쓰는 `DeviceSessions` 입니다.
 */

import api from "./api";

const authHeader = () => {
    const token = localStorage.getItem("ksa_session_token");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export interface DeviceSession {
    id: number;
    /** `"web"` | `"mobile"` — 로그인할 때 클라이언트가 밝힌 종류 */
    device_type: string;
    /**
     * `"Chrome · Android"` — 서버가 User-Agent 에서 뽑습니다.
     *
     * **이 컬럼이 생기기 전에 만들어진 세션은 `null`** 입니다. 화면이 대신 표시할
     * 말을 준비해야 합니다 — 빈 줄로 두면 폐기할 대상을 고를 수가 없습니다.
     */
    device_label: string | null;
    /** 지금 이 화면을 보고 있는 기기인가. **이게 없으면 자기 자신을 폐기합니다** */
    current: boolean;
    created_at: string;
    last_used_at: string;
    expires_at: string;
}

export interface DeviceSessions {
    /** 동시에 로그인할 수 있는 기기 수 — 화면이 "5대 중 3대" 를 말할 수 있게 */
    max: number;
    sessions: DeviceSession[];
}

export const fetchSessions = async (): Promise<DeviceSessions> => {
    const { data } = await api.get("/auth/sessions", { headers: authHeader() });
    return data;
};

export const revokeSession = async (id: number): Promise<void> => {
    await api.delete(`/auth/sessions/${id}`, { headers: authHeader() });
};

/** 지금 이 기기만 남기고 나머지를 끊습니다 */
export const logoutOtherDevices = async (): Promise<number> => {
    const { data } = await api.post("/auth/logout-all", null, {
        headers: authHeader(),
    });
    return data.revoked ?? 0;
};

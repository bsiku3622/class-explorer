/**
 * 계정별 화면 상태 저장.
 *
 * 예전에는 localStorage에 담았는데, 기기를 옮기면 작업하던 계획이 사라졌습니다.
 * 이제 서버 계정에 붙여 두고, 예전 기기에 남은 데이터는 처음 한 번 옮겨 옵니다.
 */

import api from "./api";

const SESSION_TOKEN_KEY = "ksa_session_token";

export type StateKey = "plan" | "trade";

const authHeader = () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * 계정에 저장된 상태를 읽습니다.
 *
 * 계정에 아무것도 없고 예전 기기에 남은 값이 있으면 그걸 올린 뒤 돌려줍니다.
 * 옮기고 나면 로컬 사본은 지웁니다 — 두 곳에 남아 있으면 어느 쪽이 최신인지
 * 알 수 없게 됩니다.
 */
export const loadState = async <T>(key: StateKey, legacyKey: string): Promise<T | null> => {
    let remote: T | null = null;
    try {
        const res = await api.get(`/state/${key}`, { headers: authHeader() });
        remote = (res.data?.data as T) ?? null;
    } catch {
        // 서버에 닿지 못하면 로컬 값이라도 씁니다
        return readLegacy<T>(legacyKey);
    }

    if (remote) {
        localStorage.removeItem(legacyKey);
        return remote;
    }

    const legacy = readLegacy<T>(legacyKey);
    if (legacy) {
        const moved = await saveState(key, legacy);
        if (moved) localStorage.removeItem(legacyKey);
    }
    return legacy;
};

/** 저장 성공 여부 — 실패해도 화면은 계속 쓸 수 있어야 하므로 예외를 던지지 않습니다 */
export const saveState = async (key: StateKey, data: unknown): Promise<boolean> => {
    try {
        await api.put(`/state/${key}`, { data }, { headers: authHeader() });
        return true;
    } catch {
        return false;
    }
};

export const clearState = async (key: StateKey): Promise<void> => {
    try {
        await api.delete(`/state/${key}`, { headers: authHeader() });
    } catch {
        // 지우기 실패는 조용히 넘깁니다 — 다음 저장이 덮어씁니다
    }
};

const readLegacy = <T>(legacyKey: string): T | null => {
    try {
        const raw = localStorage.getItem(legacyKey);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
};

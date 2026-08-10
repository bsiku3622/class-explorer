/**
 * 응답 캐시 — 같은 것을 두 번 받지 않게 합니다.
 *
 * 학기 데이터 캐시(`ksa_class_finder_cache_*`, `App.tsx`)와 **다른 물건**입니다. 저쪽은
 * 화면 하나가 쓰는 큰 덩어리 하나고, 여기는 여러 화면이 같이 부르는 작은 것들
 * (교육과정·교시 시각표·급식)을 맡습니다.
 *
 * 두 가지를 합니다.
 *
 * 1. **localStorage 에 TTL 로 남깁니다** — 새로고침해도 다시 안 받습니다
 * 2. **같은 키의 요청을 하나로 묶습니다** — Zamong·Browse·Trade 가 동시에 열리면
 *    `/curriculum` 을 세 번 부르는데, 응답이 수십 KB 라 그게 그대로 로딩 시간입니다
 *
 * 두 번째가 없으면 첫 방문에는 캐시가 비어 있어 어차피 세 번 나갑니다.
 */

const PREFIX = "ksa_cache_";

/**
 * 스키마 버전. **응답에 필드를 추가하면 올리세요** — 안 올리면 예전 응답을 든
 * 브라우저가 TTL 이 끝날 때까지 새 필드를 못 받습니다.
 */
const VERSION = 1;

interface Entry<T> {
    v: number;
    at: number;
    data: T;
}

/** 지금 날아가고 있는 요청 — 같은 키면 이 약속을 나눠 씁니다 */
const inFlight = new Map<string, Promise<unknown>>();

const read = <T>(key: string, ttlMs: number): T | null => {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const entry = JSON.parse(raw) as Entry<T>;
        if (entry.v !== VERSION || Date.now() - entry.at > ttlMs) return null;
        return entry.data;
    } catch {
        // 깨진 값이 남아 있어도 화면은 돌아야 합니다 — 그냥 다시 받습니다
        return null;
    }
};

const write = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(
            PREFIX + key,
            JSON.stringify({ v: VERSION, at: Date.now(), data } satisfies Entry<T>),
        );
    } catch {
        // 용량이 찼으면 캐시를 포기합니다. 저장 실패로 화면이 죽으면 안 됩니다
    }
};

/**
 * 캐시에 있으면 그걸 주고, 없으면 받아서 넣어 둡니다.
 *
 * `ttlMs` 가 0 이면 저장하지 않고 **묶기만** 합니다 — 매번 새로 받아야 하지만 동시에
 * 여러 번 부르는 건 막고 싶을 때 씁니다.
 */
export const cached = async <T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
): Promise<T> => {
    if (ttlMs > 0) {
        const hit = read<T>(key, ttlMs);
        if (hit !== null) return hit;
    }

    const running = inFlight.get(key) as Promise<T> | undefined;
    if (running) return running;

    const promise = fetcher()
        .then((data) => {
            if (ttlMs > 0) write(key, data);
            return data;
        })
        .finally(() => inFlight.delete(key));

    inFlight.set(key, promise);
    return promise;
};

/** 한 항목을 버립니다 — 방금 바꾼 것을 다시 받아야 할 때 */
export const invalidate = (key: string): void => {
    inFlight.delete(key);
    try {
        localStorage.removeItem(PREFIX + key);
    } catch {
        /* 지우지 못해도 TTL 이 결국 정리합니다 */
    }
};

/** 로그아웃할 때 통째로 — 남의 계정에서 앞사람 데이터가 보이면 안 됩니다 */
export const clearCache = (): void => {
    inFlight.clear();
    try {
        Object.keys(localStorage)
            .filter((key) => key.startsWith(PREFIX))
            .forEach((key) => localStorage.removeItem(key));
    } catch {
        /* 지우지 못해도 TTL 이 결국 정리합니다 */
    }
};

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

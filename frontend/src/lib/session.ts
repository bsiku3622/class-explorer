/**
 * 세션 토큰이 사는 곳 — **읽기·쓰기·인증 헤더가 전부 여기를 거칩니다.**
 *
 * ⚠️ **키를 직접 쓰지 마세요.** 예전엔 `"ksa_session_token"` 이 열 곳에 박혀 있었고
 * (여섯 파일이 각자 상수로 다시 선언, 네 곳은 아예 인라인), `authHeader()` 는 여덟 번
 * 복붙돼 있었습니다. 그 사이 **토큰이 없을 때 돌려주는 값이 갈렸습니다** — 어떤 건
 * `undefined`, 어떤 건 `{}`. axios 는 둘 다 받아 줘서 아무도 못 알아챘지만, 키를 바꾸는
 * 날에는 열 곳을 다 찾아야 했습니다.
 */

const SESSION_TOKEN_KEY = "ksa_session_token";

/** 지금 로그인된 세션의 토큰. 없으면 `null` */
export const getSessionToken = (): string | null =>
    localStorage.getItem(SESSION_TOKEN_KEY);

/** 로그인 성공 뒤 토큰을 심습니다 */
export const setSessionToken = (token: string): void => {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
};

/** 로그아웃 — 토큰만 지웁니다. 캐시는 `lib/cache.ts` 가 따로 봅니다 */
export const clearSessionToken = (): void => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
};

/**
 * 요청에 붙일 인증 헤더. **토큰이 없으면 빈 객체**입니다.
 *
 * 빈 객체로 통일한 건 호출부가 `headers: authHeader()` 하나로 끝나게 하려는
 * 것입니다 — `undefined` 를 섞으면 스프레드(`{...authHeader()}`)를 쓰는 자리에서
 * 타입이 갈립니다.
 */
export const authHeader = (): Record<string, string> => {
    const token = getSessionToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

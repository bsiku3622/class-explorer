/**
 * 학교 구글 계정 확인 — **리다이렉트 방식**.
 *
 * 구글로 페이지를 통째로 넘겼다가, 주소 조각(`#id_token=…`)에 실려 돌아옵니다.
 * `iframe`도 팝업도 서드파티 쿠키도 쓰지 않습니다.
 *
 * ⚠️ **예전에는 구글이 그린 버튼(GSI)을 투명하게 겹쳐 뒀었습니다.** 그게 눌리면 구글
 * iframe 안에서 `window.open` 이 도는데, **iOS Safari 와 인앱 브라우저는 서드파티
 * iframe 이 연 팝업을 막습니다** — 눌러도 아무 일도 안 일어난 것처럼 보였고, 실제로
 * 그 상태로 배포돼 있었습니다. 데스크톱에서는 멀쩡해서 더 늦게 발견됐습니다.
 *
 * ```
 * [우리 버튼] ─→ accounts.google.com/o/oauth2/v2/auth?response_type=id_token&…
 *                                    ↓ 로그인
 *      /auth/google#id_token=…&state=…  ─→ GoogleLinkModal 이 받아서 POST
 * ```
 *
 * ⚠️ **구글 콘솔의 "승인된 리디렉션 URI" 에 아래 두 개가 있어야 합니다.** 없으면 구글이
 * `redirect_uri_mismatch` 화면을 띄우고 돌아오지 못합니다 — 한때 이 방식을 안 써서
 * 배포 가이드에 "리디렉션은 쓰지 않는다" 고 적혀 있었으니 같이 보세요.
 *
 * - `https://classes.bsiku.dev/auth/google`
 * - `https://localhost:5188/auth/google`
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/**
 * 이 빌드에 구글 확인이 들어 있는가.
 *
 * ⚠️ **빌드 시점에 정해집니다.** `VITE_*` 는 번들에 값이 박히는 것이라, 환경변수가 없으면
 * 버튼이 안 그려지는 정도가 아니라 관련 코드가 통째로 잘려 나갑니다. 그 상태로 배포되면
 * 닫을 수 없는 연결 창에 누를 것이 하나도 없으므로, **부르는 쪽이 이 값을 보고 막다른
 * 길을 알려야 합니다.**
 */
export const GOOGLE_LOGIN_READY = Boolean(CLIENT_ID);

if (!CLIENT_ID) {
    console.error(
        "[auth] VITE_GOOGLE_CLIENT_ID 가 이 빌드에 없습니다 — 학교 계정 연결 버튼이 그려지지 않습니다.",
    );
}

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
/** 돌아올 자리. 구글 콘솔에 등록된 값과 **글자 하나까지** 같아야 합니다 */
export const REDIRECT_PATH = "/auth/google";

const STATE_KEY = "ksa_google_state";
const NONCE_KEY = "ksa_google_nonce";

const random = (): string => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** 구글로 넘깁니다. 돌아오는 건 `takeGoogleRedirect()` 가 받습니다. */
export const startGoogleLogin = (): void => {
    const state = random();
    const nonce = random();
    // ⚠️ `sessionStorage` 입니다. 이 탭에서 시작한 흐름인지 확인하는 값이라 탭을 넘어
    // 살아 있으면 안 됩니다 (`localStorage` 로 두면 다른 탭의 흐름과 섞입니다)
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(NONCE_KEY, nonce);

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "id_token",
        scope: "openid email profile",
        redirect_uri: `${window.location.origin}${REDIRECT_PATH}`,
        nonce,
        state,
        // 학교 계정 목록만 보여 줍니다. **서버에서 다시 확인합니다** — 이건 편의일 뿐
        // 사용자가 주소를 고쳐 다른 도메인으로 넘어올 수 있습니다
        hd: "ksa.hs.kr",
        // 로그인된 계정이 여럿일 때 고르게 합니다. 학교 계정이 아닌 게 이미 붙어 있으면
        // 이게 없을 때 조용히 그걸로 넘어갑니다
        prompt: "select_account",
    });
    window.location.assign(`${AUTH_URL}?${params}`);
};

export type GoogleRedirect =
    | { ok: true; credential: string; nonce: string }
    | { ok: false; message: string };

/**
 * 돌아온 주소에서 토큰을 꺼냅니다.
 *
 * ⚠️ **모듈을 읽는 순간 딱 한 번 돕니다 — 화면이 그려지기 전입니다.** 효과(`useEffect`)
 * 안에서 주소를 읽으면 늦습니다: `/auth/google` 로 돌아왔을 때 `currentUser` 를 아직
 * 못 받은 찰나에는 연결 창 대신 **라우터가 먼저 그려지고**, 맞는 라우트가 없어
 * `<Navigate to="/">` 가 주소를 갈아치우면서 **토큰이 실린 조각을 통째로 날립니다.**
 * 그래서 아무도 못 건드리는 시점에 낚아채 메모리에 들고 있습니다.
 *
 * 그러면서 주소도 `/` 로 되돌립니다 — 토큰이 주소창과 방문 기록에 남을 이유가 없고,
 * 라우터가 뜨기 전이라 화면이 깜빡이지도 않습니다.
 */
const captureFromHash = (): GoogleRedirect | null => {
    const raw = window.location.hash.slice(1);
    if (!raw) return null;

    const params = new URLSearchParams(raw);
    const error = params.get("error");
    const token = params.get("id_token");
    if (!error && !token) return null; // 그냥 앵커였습니다

    window.history.replaceState(null, "", "/");

    const state = sessionStorage.getItem(STATE_KEY);
    const nonce = sessionStorage.getItem(NONCE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(NONCE_KEY);

    // 사용자가 구글 화면에서 취소한 경우가 대부분입니다
    if (error) {
        return {
            ok: false,
            message:
                error === "access_denied"
                    ? "취소했습니다. 다시 시도해주세요."
                    : "구글에서 로그인하지 못했습니다. 다시 시도해주세요.",
        };
    }

    // ⚠️ **여기가 이 흐름의 자물쇠입니다.** 이걸 빼면 남이 만든 주소
    // (`/auth/google#id_token=<남의 토큰>`)를 열게 해서 **내 계정에 남의 학번을 붙일**
    // 수 있습니다. 시작할 때 심어 둔 값과 같아야 내가 시작한 흐름입니다
    if (!state || state !== params.get("state")) {
        return { ok: false, message: "만료된 요청입니다. 다시 시도해주세요." };
    }

    return { ok: true, credential: token as string, nonce: nonce ?? "" };
};

let pending = captureFromHash();

/**
 * 낚아채 둔 결과를 넘깁니다. **한 번만 가져갈 수 있습니다** — 개발 모드가 효과를 두 번
 * 돌려도 요청이 겹치지 않고, 새로고침해도 같은 토큰으로 다시 시도하지 않습니다.
 *
 * 이 흐름과 무관한 방문이면 `null`.
 */
export const takeGoogleRedirect = (): GoogleRedirect | null => {
    const result = pending;
    pending = null;
    return result;
};

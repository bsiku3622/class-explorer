import React, { useEffect, useRef, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/**
 * 이 빌드에 구글 로그인이 들어 있는가.
 *
 * ⚠️ **빌드 시점에 정해집니다.** `VITE_*` 는 번들에 값이 박히는 것이라, 환경변수가
 * 없으면 아래 버튼은 그려지지 않는 정도가 아니라 **코드째 빠집니다**(rollup 이
 * `CLIENT_ID` 가 늘 빈 문자열임을 증명하고 죽은 가지를 잘라냅니다).
 *
 * 한 번 이것 때문에 배포본에서 학교 계정 연결이 통째로 사라진 적이 있습니다 — 화면에는
 * "연결 전에는 이용할 수 없습니다" 만 남고 연결할 방법이 없어서, 새 사용자가 로그아웃
 * 말고 할 수 있는 게 없었습니다. **부르는 쪽이 이 값을 보고 막다른 길을 알려야 합니다.**
 */
export const GOOGLE_LOGIN_READY = Boolean(CLIENT_ID);

if (!CLIENT_ID) {
    // 화면에 못 띄우는 자리(로그인 화면 등)도 있어서 콘솔에는 늘 남깁니다
    console.error(
        "[auth] VITE_GOOGLE_CLIENT_ID 가 이 빌드에 없습니다 — 학교 계정 연결 버튼이 그려지지 않습니다.",
    );
}

interface GoogleAccounts {
    accounts: {
        id: {
            initialize: (config: {
                client_id: string;
                callback: (response: { credential: string }) => void;
                hd?: string;
            }) => void;
            renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
    };
}

/** 구글 스크립트를 한 번만 불러오고, 이후에는 같은 약속을 돌려씁니다 */
let loader: Promise<void> | null = null;

const loadGoogleScript = (): Promise<void> => {
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("google script failed"));
        document.head.appendChild(script);
    });
    return loader;
};

/** 구글 공식 로고 */
const GoogleMark: React.FC = () => (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
        <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
    </svg>
);

interface GoogleLoginButtonProps {
    onCredential: (credential: string) => void;
    onError: (message: string) => void;
}

/**
 * 학교 구글 계정 로그인 버튼.
 *
 * 생김새는 우리가 그리고, **눌리는 건 구글이 그린 버튼**입니다. 구글 버튼은 iframe
 * 이라 안쪽을 손댈 수 없어서, 투명하게 만들어 우리 박스 위에 겹쳐 둡니다. 이렇게 하면
 * 화면은 나머지와 같은 결로 맞추면서 ID 토큰 흐름은 구글 것을 그대로 씁니다.
 *
 * 겹친 쪽을 `scale`로 늘리는 이유는 구글 버튼이 우리 박스를 다 덮지 못하기 때문입니다 —
 * 높이가 44px로 고정이고 `margin: -2px`로 위로 밀려 있으며, 폭도 400px에서 잘립니다.
 * 그냥 두면 그 바깥이 눌리지 않는 자리로 남습니다. CSS `transform`은 클릭 판정도 같이
 * 늘려 주므로, 넉넉히 늘린 뒤 박스 경계로 잘라내면(`overflow-hidden`) 박스 안은 전부
 * 눌리고 밖은 눌리지 않습니다.
 *
 * hover 때 그림자를 숨기는 다른 버튼들과 달리 여기는 **인풋과 같이 focus 때만** 눌립니다.
 * 포인터가 iframe 위에 있으면 부모 문서에 `:hover`가 아예 잡히지 않아서입니다 — 대신
 * 커서 모양은 구글 버튼이 직접 바꿔 줍니다. `:focus-within`은 iframe 안으로 초점이
 * 들어가도 잡히므로 키보드로 넘어올 때는 눌린 상태가 보입니다.
 *
 * `VITE_GOOGLE_CLIENT_ID`가 없으면 아무것도 그리지 않습니다 — 설정 전에도 기존
 * 로그인은 그대로 쓸 수 있어야 하니까요.
 */
const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onCredential, onError }) => {
    const holder = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!CLIENT_ID || !holder.current) return;
        let cancelled = false;

        loadGoogleScript()
            .then(() => {
                if (cancelled || !holder.current) return;
                const google = (window as unknown as { google?: GoogleAccounts }).google;
                if (!google) {
                    setFailed(true);
                    return;
                }
                google.accounts.id.initialize({
                    client_id: CLIENT_ID,
                    callback: (response) => onCredential(response.credential),
                    // 학교 계정 목록만 보여 줍니다. 서버에서도 다시 확인합니다
                    hd: "ksa.hs.kr",
                });
                // 폭은 우리 박스에 맞춰야 좌우에 눌리지 않는 자리가 남지 않습니다
                const width = Math.round(box.current?.clientWidth ?? 300);
                google.accounts.id.renderButton(holder.current, {
                    theme: "outline",
                    size: "large",
                    text: "signin_with",
                    shape: "rectangular",
                    locale: "ko",
                    width: Math.min(Math.max(width, 200), 400),
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setFailed(true);
                    onError("구글 로그인을 불러오지 못했습니다.");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [onCredential, onError]);

    if (!CLIENT_ID) return null;

    return (
        <div className="space-y-2">
            <div className="group relative">
                <div
                    ref={box}
                    className="flex items-center justify-center gap-2.5 border-2 border-black bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 group-focus-within:shadow-none"
                >
                    <GoogleMark />
                    <span className="text-sm font-bold text-black">
                        ksa.hs.kr 계정으로 로그인
                    </span>
                </div>
                {/* 실제로 눌리는 구글 버튼. 보이지 않게 덮어 둡니다 */}
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        ref={holder}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        style={{ transform: "translateY(2px) scale(1.05, 1.3)" }}
                    />
                </div>
            </div>
            {failed && (
                <p className="text-[10px] font-bold text-black/40">
                    구글 로그인을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                </p>
            )}
        </div>
    );
};

export default GoogleLoginButton;

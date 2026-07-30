import React, { useEffect, useRef, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

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

interface GoogleLoginButtonProps {
    onCredential: (credential: string) => void;
    onError: (message: string) => void;
}

/**
 * 학교 구글 계정 로그인 버튼.
 *
 * 구글이 그려 주는 버튼이라 생김새를 우리 마음대로 바꿀 수 없습니다. 대신 테두리를
 * 감싸 나머지 화면과 어긋나 보이지 않게 했습니다.
 *
 * `VITE_GOOGLE_CLIENT_ID`가 없으면 아무것도 그리지 않습니다 — 설정 전에도 기존
 * 로그인은 그대로 쓸 수 있어야 하니까요.
 */
const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onCredential, onError }) => {
    const holder = useRef<HTMLDivElement>(null);
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
                // 구글 버튼은 iframe 이라 생김새를 우리가 손댈 수 없습니다. 대신 검은
                // 버튼을 골라 감싼 테두리와 이어 붙여, 테두리가 두 겹으로 보이지 않게 합니다.
                // 폭도 부모에 맞춰야 안쪽에 빈 띠가 남지 않습니다
                const width = Math.round(
                    holder.current.parentElement?.clientWidth ?? holder.current.clientWidth,
                );
                google.accounts.id.renderButton(holder.current, {
                    theme: "filled_black",
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
            <div className="flex justify-center overflow-hidden border-2 border-black bg-black">
                <div ref={holder} />
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

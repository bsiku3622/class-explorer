import React from "react";
import { startGoogleLogin } from "../lib/googleAuth";

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

/**
 * 학교 구글 계정 확인 버튼.
 *
 * **그냥 버튼입니다.** 누르면 구글로 넘어갔다가 돌아옵니다 (`lib/googleAuth.ts`).
 *
 * ⚠️ **구글이 그린 버튼을 겹쳐 두지 마세요.** 예전엔 그렇게 했었습니다 — 생김새는 우리가
 * 그리고 구글의 `iframe` 버튼을 투명하게 위에 얹어 두는 방식이었는데, 그 버튼이 **구글
 * iframe 안에서 팝업을 엽니다.** iOS Safari 와 인앱 브라우저는 서드파티 iframe 이 연
 * 팝업을 막아서, 모바일에서는 눌러도 아무 일도 일어나지 않았습니다. 데스크톱에서만
 * 멀쩡해 한참 못 잡았습니다. 겹치기·투명도·`scale` 로 클릭 판정을 늘리던 요령도 그때
 * 같이 사라졌습니다.
 */
interface GoogleLoginButtonProps {
    /** 넘어가기 직전에 부릅니다 — 창을 잠그거나 오류를 지울 때 */
    onStart?: () => void;
    disabled?: boolean;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
    onStart,
    disabled = false,
}) => (
    <button
        type="button"
        disabled={disabled}
        onClick={() => {
            onStart?.();
            startGoogleLogin();
        }}
        className="flex w-full items-center justify-center gap-2.5 border-2 border-black bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:pointer-events-none disabled:opacity-50"
    >
        <GoogleMark />
        <span className="text-sm font-bold text-black">ksa.hs.kr 계정으로 로그인</span>
    </button>
);

export default GoogleLoginButton;

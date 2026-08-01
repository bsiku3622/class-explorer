/**
 * 로딩 표시 — 도는 원.
 *
 * 생김새는 **paper-ui 의 `Spinner`** 를 옮겼습니다: 옅은 링에 한 조각(위쪽)만 진해서
 * 회전이 읽히고, 주기는 900ms linear 입니다.
 *
 * **HeroUI 의 `<Spinner />` 를 쓰지 마세요.** 그 컴포넌트는 자기 클래스
 * (`animate-spinner-ease-spin`, `w-5` …)가 Tailwind 로 만들어져 있다고 가정하는데,
 * v4 는 소스를 훑어서 유틸리티를 만들기 때문에 `node_modules` 안의 클래스는 생성되지
 * 않습니다. 그래서 회전도 없고 폭이 4px 로 찌그러져 **세로선 하나**로 보였습니다.
 */

import React from "react";

const SIZES = {
    sm: "h-4 w-4 border-2",
    md: "h-5 w-5 border-2",
    lg: "h-7 w-7 border-[3px]",
} as const;

interface RetroSpinnerProps {
    size?: keyof typeof SIZES;
    className?: string;
    /** 스크린리더가 읽을 말 */
    label?: string;
}

const RetroSpinner: React.FC<RetroSpinnerProps> = ({
    size = "md",
    className = "",
    label = "불러오는 중",
}) => (
    <span
        role="status"
        aria-label={label}
        className={`inline-block shrink-0 animate-spin rounded-full border-black/15 border-t-black motion-reduce:animate-none ${SIZES[size]} ${className}`}
        style={{ animationDuration: "900ms" }}
    />
);

export default RetroSpinner;

/**
 * 로딩 표시.
 *
 * **HeroUI 의 `<Spinner />` 를 쓰지 마세요.** 그 컴포넌트는 자기 클래스
 * (`animate-spinner-ease-spin`, `w-5` …)가 Tailwind 로 만들어져 있다고 가정하는데,
 * v4 는 소스를 훑어서 유틸리티를 만들기 때문에 `node_modules` 안의 클래스는 생성되지
 * 않습니다. 그래서 회전도 없고 폭이 4px 로 찌그러져 **세로선 하나**로 보였습니다.
 *
 * 원형 스피너는 어차피 이 앱과 안 맞습니다 — 전역 `rounded-none!` 오버라이드와도
 * 싸웁니다. 직각 블록이 차례로 깜빡이는 쪽이 나머지 화면과 같은 말을 합니다.
 */

import React from "react";

const SIZES = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
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
        className={`inline-flex items-center gap-1.5 ${className}`}
    >
        {[0, 1, 2].map((i) => (
            <span
                key={i}
                className={`${SIZES[size]} bg-black animate-pulse motion-reduce:animate-none`}
                // 세 블록을 어긋나게 깜빡여 흐르는 것처럼 보이게 합니다
                style={{ animationDelay: `${i * 160}ms`, animationDuration: "900ms" }}
            />
        ))}
    </span>
);

export default RetroSpinner;

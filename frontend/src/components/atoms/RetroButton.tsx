import React from "react";
import { readableInk } from "../../lib/utils";

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "white" | "black";
    /**
     * 임의의 색 (hex). 주면 `variant` 대신 이 색이 면을 정합니다 — **고른 것만 꽉
     * 차고 나머지는 흰색입니다.** 다 칠하면 어느 게 골라진 것인지 색으로 못 가립니다.
     *
     * 값이 런타임에 정해지는(학과·끼니 등) 버튼용입니다. Tailwind 는 클래스 이름을
     * 빌드 때 훑어서 `bg-[${hex}]` 를 만들어 주지 않으므로 인라인 style 로 넣습니다.
     */
    color?: string;
    isSelected?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
    icon?: React.ReactNode;
}

const RetroButton: React.FC<RetroButtonProps> = ({
    children,
    variant = "white",
    color,
    isSelected = false,
    size = "md",
    className = "",
    icon,
    style,
    ...props
}) => {
    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-6 py-3 text-sm",
        lg: "px-10 py-4 text-lg",
    };

    const baseClasses = "border-2 border-black font-black uppercase transition-all duration-100 flex items-center justify-center gap-2";

    let variantClasses = "";
    if (isSelected) {
        // 선택된 상태: 검은색 배경, 제자리에서 그림자 숨김
        //
        // ⚠️ `color` 버튼에는 `scale-105` 를 걸지 않습니다. 확대하면 테두리도 같이
        // 2px → 2.1px 로 커져서 **선이 굵어진 것처럼** 보이는데, 나란히 붙은 버튼
        // 무리(급식 끼니 같은)에서는 그게 크기 차이가 아니라 굵기 차이로 읽힙니다.
        // 색이 이미 "골랐다" 를 충분히 말하므로 확대는 덧붙임일 뿐입니다.
        variantClasses = `${
            color ? "" : "bg-black text-white scale-105"
        } border-black z-10 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)] active:scale-100`;
    } else {
        // 일반 상태: 그림자 숨기며 이동
        // `color` 를 받아도 **안 골린 것은 흰색**입니다 — 셋을 다 칠하면 어느 게 지금
        // 보고 있는 것인지 색으로는 못 가립니다
        const bgColor = color
            ? "bg-white"
            : variant === "primary" ? "bg-retro-primary" : variant === "black" ? "bg-black text-white" : "bg-white";
        variantClasses = `${bgColor} shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)] hover:translate-x-1 hover:translate-y-1 active:scale-95`;
    }

    const colorStyle: React.CSSProperties | undefined =
        color && isSelected
            ? { backgroundColor: color, color: readableInk(color) }
            : undefined;

    return (
        <button
            className={`${baseClasses} ${sizeClasses[size]} ${variantClasses} ${className}`}
            style={{ ...colorStyle, ...style }}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
};

export default RetroButton;

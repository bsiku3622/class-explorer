import React from "react";

const shadows = {
    // 바깥에서 그림자를 따로 줄 때 (탭처럼 카드와 붙는 요소가 있는 경우)
    none: "",
    sm: "shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]",
    md: "shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]",
    lg: "shadow-[8px_8px_0_0_rgba(0,0,0,0.2)]",
} as const;

interface RetroCardProps {
    children: React.ReactNode;
    shadow?: keyof typeof shadows;
    className?: string;
}

const RetroCard: React.FC<RetroCardProps> = ({
    children,
    shadow = "md",
    className = "",
}) => (
    <div className={`border-2 border-black ${shadows[shadow]} ${className}`}>
        {children}
    </div>
);

export default RetroCard;

import React from "react";

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "white" | "black";
    isSelected?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
    icon?: React.ReactNode;
}

const RetroButton: React.FC<RetroButtonProps> = ({
    children,
    variant = "white",
    isSelected = false,
    size = "md",
    className = "",
    icon,
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
        variantClasses = "bg-black text-white border-black scale-105 z-10 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)] active:scale-100";
    } else {
        // 일반 상태: 그림자 숨기며 이동
        const bgColor = variant === "primary" ? "bg-retro-primary" : variant === "black" ? "bg-black text-white" : "bg-white";
        variantClasses = `${bgColor} shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)] hover:translate-x-1 hover:translate-y-1 active:scale-95`;
    }

    return (
        <button
            className={`${baseClasses} ${sizeClasses[size]} ${variantClasses} ${className}`}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
};

export default RetroButton;

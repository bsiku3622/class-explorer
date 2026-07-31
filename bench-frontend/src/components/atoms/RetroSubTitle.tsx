import React from "react";
import type { LucideIcon } from "lucide-react";

interface RetroSubTitleProps {
    title: string;
    icon?: LucideIcon;
    className?: string;
    iconSize?: number;
}

const RetroSubTitle: React.FC<RetroSubTitleProps> = ({
    title,
    icon: Icon,
    className = "",
    iconSize = 18,
}) => {
    return (
        <div
            className={`text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2 ${className}`}
        >
            {Icon && <Icon size={iconSize} className="text-black/40" />}
            <span>{title}</span>
        </div>
    );
};

export default RetroSubTitle;

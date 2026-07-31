import React from "react";
import type { LucideIcon } from "lucide-react";
import RetroCard from "../atoms/RetroCard";

interface PageHeaderProps {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    action?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    icon: Icon,
    action,
    children,
    className = "",
}) => (
    <RetroCard className={`bg-white p-6 md:p-8 overflow-hidden flex flex-col gap-6 md:gap-8 ${className}`}>
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-black flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">
                        {subtitle}
                    </p>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase leading-tight">
                        {title}
                    </h1>
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
    </RetroCard>
);

export default PageHeader;

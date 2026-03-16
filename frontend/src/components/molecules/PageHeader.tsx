import React from "react";
import type { LucideIcon } from "lucide-react";
import RetroCard from "../atoms/RetroCard";
import RetroFeatureTag from "../atoms/RetroFeatureTag";
import RetroSubTitle from "../atoms/RetroSubTitle";

interface PageHeaderProps {
    tag: string;
    title: string;
    subtitle: string;
    icon: LucideIcon;
    action?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    tag,
    title,
    subtitle,
    icon,
    action,
    children,
    className = "",
}) => (
    <RetroCard className={`bg-white p-8 relative overflow-hidden flex flex-col gap-8 ${className}`}>
        <RetroFeatureTag>{tag}</RetroFeatureTag>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <h2 className="text-4xl font-black tracking-tighter text-black uppercase mb-2">
                    {title}
                </h2>
                <RetroSubTitle title={subtitle} icon={icon} />
            </div>
            {action && <div className="flex items-center gap-4">{action}</div>}
        </div>
        {children}
    </RetroCard>
);

export default PageHeader;

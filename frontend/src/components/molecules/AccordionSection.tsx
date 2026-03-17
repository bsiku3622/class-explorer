import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RetroCard from "../atoms/RetroCard";

interface AccordionSectionProps {
    title: string;
    icon: LucideIcon;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    className?: string;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
    title,
    icon: Icon,
    isOpen,
    onToggle,
    children,
    className = "",
}) => (
    <RetroCard shadow="sm" className={`bg-white overflow-hidden h-fit ${className}`}>
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-4 md:p-5 bg-white hover:bg-retro-accent-light transition-all duration-100"
        >
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <Icon size={20} strokeWidth={3} className="text-black shrink-0" />
                <h3 className="text-sm md:text-xl font-black uppercase tracking-tighter text-black truncate">
                    {title}
                </h3>
            </div>
            {isOpen ? (
                <ChevronUp size={24} strokeWidth={3} />
            ) : (
                <ChevronDown size={24} strokeWidth={3} />
            )}
        </button>
        {isOpen && (
            <div className="p-4 md:p-5 border-t-2 border-black/10 animate-in fade-in duration-300">
                {children}
            </div>
        )}
    </RetroCard>
);

export default AccordionSection;

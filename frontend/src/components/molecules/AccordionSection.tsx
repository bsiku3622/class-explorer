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
            className="w-full flex items-center justify-between p-5 bg-white hover:bg-retro-accent-light transition-all duration-100"
        >
            <div className="flex items-center gap-4">
                <Icon size={22} strokeWidth={3} className="text-black" />
                <h3 className="text-xl font-black uppercase tracking-tighter text-black">
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
            <div className="p-6 border-t-2 border-black/10 animate-in fade-in duration-300">
                {children}
            </div>
        )}
    </RetroCard>
);

export default AccordionSection;

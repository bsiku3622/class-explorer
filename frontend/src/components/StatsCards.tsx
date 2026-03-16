import React from "react";
import { BookOpen, Users, User } from "lucide-react";
import type { Stats } from "../types";
import RetroCard from "./atoms/RetroCard";

interface StatsCardsProps {
    stats: Stats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
    const statItems = [
        { label: "Total Subjects", value: stats.total_subjects, icon: BookOpen, bg: "bg-retro-accent1" },
        { label: "Total Sections", value: stats.total_sections, icon: Users, bg: "bg-retro-accent2" },
        { label: "Active Students", value: stats.total_active_students, icon: User, bg: "bg-retro-accent3" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {statItems.map((stat, i) => (
                <RetroCard key={i} className={`${stat.bg}`}>
                    <div className="flex flex-row items-center gap-5 p-6">
                        <stat.icon size={32} className="text-black" />
                        <div>
                            <p className="text-xs font-black uppercase text-black/60 tracking-wider">{stat.label}</p>
                            <p className="text-3xl font-black text-black">{stat.value}</p>
                        </div>
                    </div>
                </RetroCard>
            ))}
        </div>
    );
};

export default StatsCards;

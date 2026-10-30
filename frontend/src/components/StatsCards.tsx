import React from "react";
import { BookOpen, Users, User } from "lucide-react";
import type { Stats } from "../types";
import { Paint, Stat, type Accent } from "@studio-baeks/funky-ui";

interface StatsCardsProps {
    stats: Stats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
    const statItems: { label: string; value: number; icon: typeof BookOpen; accent: Accent }[] = [
        { label: "Total Subjects", value: stats.total_subjects, icon: BookOpen, accent: "cyan" },
        { label: "Total Sections", value: stats.total_sections, icon: Users, accent: "yellow" },
        { label: "Active Students", value: stats.total_active_students, icon: User, accent: "pink" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statItems.map((stat, i) => (
                <Paint key={i} accent={stat.accent} variant="solid" shadow="floating">
                    <div className="flex flex-row items-center gap-5 p-6">
                        <stat.icon size={32} />
                        <Stat size="xs" label={stat.label} value={stat.value} />
                    </div>
                </Paint>
            ))}
        </div>
    );
};

export default StatsCards;

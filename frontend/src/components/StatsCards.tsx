import React from "react";
import { Card, CardBody } from "@heroui/react";
import { BookOpen, Users, User } from "lucide-react";
import type { Stats } from "../types";

interface StatsCardsProps {
    stats: Stats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
    const statItems = [
        {
            label: "Total Subjects",
            value: stats.total_subjects,
            icon: BookOpen,
            color: "bg-retro-accent1",
        },
        {
            label: "Total Sections",
            value: stats.total_sections,
            icon: Users,
            color: "bg-retro-accent2",
        },
        {
            label: "Active Students",
            value: stats.total_active_students,
            icon: User,
            color: "bg-retro-accent3",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {statItems.map((stat, i) => (
                <Card
                    key={i}
                    className={`border-2 border-black rounded-none shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] ${stat.color}`}
                >
                    <CardBody className="flex flex-row items-center gap-5 p-6">
                        <stat.icon size={32} className="text-black" />
                        <div>
                            <p className="text-xs font-black uppercase text-black/60 tracking-wider">
                                {stat.label}
                            </p>
                            <p className="text-3xl font-black text-black">
                                {stat.value}
                            </p>
                        </div>
                    </CardBody>
                </Card>
            ))}
        </div>
    );
};

export default StatsCards;

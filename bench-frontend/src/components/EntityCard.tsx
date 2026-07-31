import React from "react";
import { BookOpen } from "lucide-react";
import type { SearchEntity } from "../types";

interface EntityCardProps {
    entity: SearchEntity;
    entityColor: string;
    isSingleEntity: boolean;
    onClick: () => void;
}

const EntityCard: React.FC<EntityCardProps> = ({
    entity,
    entityColor,
    isSingleEntity,
    onClick,
}) => {
    return (
        <div
            className="bg-white border border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] flex divide-x divide-black overflow-hidden cursor-pointer hover:-translate-y-1.5 transition-transform group"
            onClick={onClick}
        >
            {/* Profile Page (Left) */}
            <div
                className="p-6 min-w-44 flex flex-col justify-center relative"
                style={{ backgroundColor: `${entityColor}15` }}
            >
                <span
                    className={`absolute top-3 left-3 px-3 py-1 text-[10px] font-black uppercase border border-black/20 ${
                        entity.type === "student"
                            ? "bg-white text-black"
                            : "text-white border-none"
                    }`}
                    style={entity.type !== "student" ? { backgroundColor: entityColor } : {}}
                >
                    {entity.type}
                </span>
                <p className="text-sm font-black text-black mt-4 mb-3">
                    {entity.id}
                </p>
                <p
                    className="text-3xl font-black tracking-tighter group-hover:scale-105 transition-transform"
                    style={{ color: entityColor }}
                >
                    {entity.name}
                </p>
            </div>

            {/* Classes Page (Right) */}
            <div className="p-6 flex-1 bg-white overflow-hidden">
                <div className="text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <BookOpen size={18} className="text-black/40" />
                    <span>
                        {entity.type === "student"
                            ? "Enrollment"
                            : entity.type === "teacher"
                            ? "Teaching"
                            : "Scheduled"}{" "}
                        ({entity.subject_count})
                    </span>
                </div>
                <div
                    className={`grid ${
                        isSingleEntity
                            ? "grid-cols-2 gap-x-6 gap-y-2"
                            : "grid-cols-1 gap-2"
                    }`}
                >
                    {(isSingleEntity
                        ? entity.subjects
                        : entity.subjects.slice(0, 4)
                    ).map((sub, i) => (
                        <div
                            key={i}
                            className="text-xs font-bold text-black border-l-2 pl-3 truncate"
                            style={{ borderColor: entityColor }}
                        >
                            {sub}
                        </div>
                    ))}
                    {!isSingleEntity && entity.subjects.length > 4 && (
                        <p className="text-[10px] font-black text-black/30 pl-3 pt-1">
                            + {entity.subjects.length - 4} MORE CLASSES
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EntityCard;

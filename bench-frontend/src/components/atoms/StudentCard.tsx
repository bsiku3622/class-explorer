import React from "react";
import { BookOpen } from "lucide-react";
import { getStudentColor, getKoreanName } from "../../lib/utils";

interface StudentCardProps {
    stuId: string;
    name: string;
    subjects: string[];
    onClick?: () => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ stuId, name, subjects, onClick }) => {
    const color = getStudentColor(stuId);

    const inner = (
        <div className="flex divide-x-2 divide-black w-full min-h-44">
            <div
                className="p-4 flex flex-col justify-center min-w-30"
                style={{ backgroundColor: `${color}26` }}
            >
                <p className="text-xs font-black text-black leading-none mb-3">{stuId}</p>
                <p className="text-xl font-black tracking-tight" style={{ color }}>
                    {name}
                </p>
            </div>
            <div className="p-4 flex-1 bg-white">
                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BookOpen size={12} /> Enrolled Classes
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {subjects.map((sub, i) => (
                        <div
                            key={i}
                            className="text-[10px] font-bold text-black border-l-2 pl-1.5 truncate"
                            style={{ borderColor: color }}
                        >
                            {getKoreanName(sub)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (onClick) {
        return (
            <button
                onClick={onClick}
                className="flex bg-white border-2 border-black text-left shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_0_rgba(0,0,0,0.15)] hover:translate-x-1 hover:translate-y-1 transition-all duration-100 overflow-hidden w-full"
            >
                {inner}
            </button>
        );
    }

    return (
        <div className="flex bg-white overflow-hidden">
            {inner}
        </div>
    );
};

export default StudentCard;

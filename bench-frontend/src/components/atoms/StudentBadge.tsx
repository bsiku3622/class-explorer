import React from "react";
import { getStudentColor } from "../../lib/utils";

interface StudentBadgeProps {
    studentId: string;
    studentName: string;
    size?: "xs" | "sm" | "md";
    className?: string;
    onClick?: () => void;
}

const StudentBadge: React.FC<StudentBadgeProps> = ({
    studentId,
    studentName,
    size = "xs",
    className = "",
    onClick,
}) => {
    const color = getStudentColor(studentId);
    const year = studentId.split("-")[0];

    const sizeClasses = {
        xs: "px-2 py-1 text-[10px]",
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-2 text-sm",
    };

    const isClickable = !!onClick;

    return (
        <div
            className={`flex items-center gap-2 border-2 font-black italic shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] transition-all ${
                isClickable ? "cursor-pointer hover:scale-105 active:scale-95" : "cursor-default"
            } ${sizeClasses[size]} ${className}`}
            style={{
                backgroundColor: `${color}15`,
                borderColor: color,
                color: color,
            }}
            onClick={onClick}
        >
            <span>{year} {studentName}</span>
        </div>
    );
};

export default StudentBadge;

import React from "react";
import { BookOpen } from "lucide-react";
import { PersonCard } from "@studio-baeks/funky-ui";
import { getStudentColor, getKoreanName } from "../../lib/utils";

interface StudentCardProps {
    stuId: string;
    name: string;
    subjects: string[];
    onClick?: () => void;
}

/** 학생 카드 — 누르는 카드는 틀이 있고, 누르지 않는 카드는 풍선 안에 들어가므로 틀을 뺍니다 */
const StudentCard: React.FC<StudentCardProps> = ({ stuId, name, subjects, onClick }) => (
    <PersonCard
        id={stuId}
        name={name}
        color={getStudentColor(stuId)}
        title={
            <span className="flex items-center gap-2">
                <BookOpen size={12} /> Enrolled Classes
            </span>
        }
        items={subjects.map(getKoreanName)}
        framed={Boolean(onClick)}
        onClick={onClick}
    />
);

export default StudentCard;

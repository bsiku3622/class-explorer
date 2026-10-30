import React from "react";
import { BookOpen } from "lucide-react";
import { PersonCard } from "@studio-baeks/funky-ui";
import { ACCENT_COLORS } from "@studio-baeks/funky-ui/tokens";

interface TeacherCardProps {
    name: string;
    subjects: string[];
    onClick?: () => void;
}

/** 교사 카드 — 번호가 없고 목록이 한 열입니다. 누르지 않는 카드는 풍선 안에 들어가므로 틀을 뺍니다 */
const TeacherCard: React.FC<TeacherCardProps> = ({ name, subjects, onClick }) => (
    <PersonCard
        name={name}
        color={ACCENT_COLORS.purple.solid}
        title={
            <span className="flex items-center gap-2">
                <BookOpen size={12} /> Assigned Classes
            </span>
        }
        items={subjects}
        columns={1}
        size="sm"
        framed={Boolean(onClick)}
        onClick={onClick}
    />
);

export default TeacherCard;

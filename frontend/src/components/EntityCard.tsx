import React from "react";
import { BookOpen } from "lucide-react";
import { Badge, PersonCard } from "@studio-baeks/funky-ui";
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
    const subjects = isSingleEntity ? entity.subjects : entity.subjects.slice(0, 4);
    const more = entity.subjects.length - 4;
    return (
        <PersonCard
            id={
                <>
                    <Badge size="sm" variant={entity.type === "student" ? "paper" : "filled"}>
                        {entity.type}
                    </Badge>
                    <span className="mt-3 block">{entity.id}</span>
                </>
            }
            name={entity.name}
            color={entityColor}
            title={
                <span className="flex items-center gap-2">
                    <BookOpen size={18} />
                    {entity.type === "student"
                        ? "Enrollment"
                        : entity.type === "teacher"
                        ? "Teaching"
                        : "Scheduled"}{" "}
                    ({entity.subject_count})
                </span>
            }
            items={subjects}
            columns={isSingleEntity ? 2 : 1}
            footer={!isSingleEntity && more > 0 ? `+ ${more} MORE CLASSES` : undefined}
            motion="lift"
            onClick={onClick}
            // 과목 목록은 좁은 화면에서 한 줄씩 — 열 수는 PersonCard 가 고정으로 갖기 때문에 여기서 접습니다
            className="max-sm:[&>div:last-child>div]:grid-cols-1"
        />
    );
};

export default EntityCard;

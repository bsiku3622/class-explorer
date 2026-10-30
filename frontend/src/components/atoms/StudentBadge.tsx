/**
 * 학번 배지 — `25 이름`. 학번을 기수와 색으로 풀어 funky-ui 의 `StudentBadge` 에 넘깁니다.
 *
 * ⚠️ **호버 효과를 두지 않습니다.** 배지는 늘어놓고 **읽는 물건**이라, 마우스가 지나가는
 * 자리마다 반응하면 정작 움직여야 할 것(검색어와 맞는 배지의 진동)이 묻힙니다.
 */
import React from "react";
import { StudentBadge as FunkyStudentBadge } from "@studio-baeks/funky-ui";
import { getStudentColor } from "../../lib/utils";

interface StudentBadgeProps {
    studentId: string;
    studentName: string;
    size?: "xs" | "sm" | "md";
    /** 기수(`25`) 대신 학번 전체(`25-059`)를 적습니다 — 동명이인을 가려야 하는 자리 (Trade 학생 고르기) */
    fullId?: boolean;
    /** 검색어와 맞는 사람만 잠깐 떱니다 */
    buzz?: boolean;
    className?: string;
    onClick?: () => void;
}

const StudentBadge: React.FC<StudentBadgeProps> = ({ studentId, studentName, size = "xs", fullId = false, buzz, className, onClick }) => (
    <FunkyStudentBadge
        cohort={fullId ? studentId : studentId.split("-")[0]}
        name={studentName}
        color={getStudentColor(studentId)}
        size={size}
        buzz={buzz}
        onClick={onClick}
        className={className}
    />
);

export default StudentBadge;

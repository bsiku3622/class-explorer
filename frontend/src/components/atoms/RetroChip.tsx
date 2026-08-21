import React from "react";

interface RetroChipProps {
    className?: string;
    children: React.ReactNode;
}

/**
 * 숫자·라벨을 담는 작은 배지.
 *
 * HeroUI `Chip` 자리에 들어왔습니다. 쓰던 쪽이 이미 색·테두리·그림자를 전부
 * `className` 으로 넘기고 있어서, 남는 건 "가운데 정렬된 인라인 상자" 뿐이었습니다.
 */
const RetroChip: React.FC<RetroChipProps> = ({ className = "", children }) => (
    <span className={`inline-flex items-center justify-center whitespace-nowrap ${className}`}>
        {children}
    </span>
);

export default RetroChip;

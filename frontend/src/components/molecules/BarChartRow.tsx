import React from "react";
import { Meter } from "@studio-baeks/funky-ui";

interface BarChartRowProps {
    label: string;
    value: number;
    maxValue: number;
    caption?: string;
    onLabelClick?: () => void;
    layout?: "horizontal" | "vertical";
    tooltipContent?: React.ReactNode;
}

/** 통계 막대 한 줄 — funky-ui 의 `Meter` 에 이 앱의 핑크와 대문자 이름을 얹습니다 */
const BarChartRow: React.FC<BarChartRowProps> = ({
    label,
    value,
    maxValue,
    caption,
    onLabelClick,
    layout = "vertical",
    tooltipContent,
}) => (
    <Meter
        accent="pink"
        label={<span className="uppercase">{label}</span>}
        value={value}
        max={Math.max(1, maxValue)}
        valueLabel={caption ?? ""}
        onSelect={onLabelClick}
        tooltip={tooltipContent}
        layout={layout === "horizontal" ? "row" : "stack"}
    />
);

export default BarChartRow;

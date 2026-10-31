import React from "react";
import { Meter, Text, type Tone } from "@studio-baeks/funky-ui";

interface BarChartRowProps {
    label: string;
    value: number;
    maxValue: number;
    caption?: string;
    /** 값 글자의 색 — Analysis 는 핑크입니다 */
    captionTone?: Tone;
    onLabelClick?: () => void;
    layout?: "horizontal" | "vertical";
    tooltipContent?: React.ReactNode;
}

const TEXT = { horizontal: "text-xs leading-5 sm:text-sm", vertical: "text-sm leading-5" } as const;

/** 통계 막대 한 줄 — funky-ui 의 `Meter` 에 이 앱의 핑크와 대문자 이름을 얹습니다 */
const BarChartRow: React.FC<BarChartRowProps> = ({
    label,
    value,
    maxValue,
    caption,
    captionTone,
    onLabelClick,
    layout = "vertical",
    tooltipContent,
}) => (
    <Meter
        accent="pink"
        label={<span className={`uppercase ${TEXT[layout]}`}>{label}</span>}
        value={value}
        max={Math.max(1, maxValue)}
        valueLabel={
            caption ? (
                <Text weight="black" tone={captionTone} className={layout === "horizontal" ? "text-[10px] sm:text-xs" : "text-sm"}>
                    {caption}
                </Text>
            ) : (
                ""
            )
        }
        onSelect={onLabelClick}
        tooltip={tooltipContent}
        layout={layout === "horizontal" ? "row" : "stack"}
    />
);

export default BarChartRow;

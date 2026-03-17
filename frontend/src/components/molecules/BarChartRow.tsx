import React, { useState } from "react";
import { createPortal } from "react-dom";

interface BarChartRowProps {
    label: string;
    value: number;
    maxValue: number;
    caption?: string;
    captionClassName?: string;
    onLabelClick?: () => void;
    layout?: "horizontal" | "vertical";
    tooltipContent?: React.ReactNode;
}

const BarChartRow: React.FC<BarChartRowProps> = ({
    label,
    value,
    maxValue,
    caption,
    captionClassName = "text-black/60",
    onLabelClick,
    layout = "vertical",
    tooltipContent,
}) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);

    const pct = (value / Math.max(1, maxValue)) * 100;

    const bar = (
        <div
            className={`h-5 min-h-5 border-2 border-black bg-black/5 relative overflow-hidden flex-1 ${onLabelClick ? "cursor-pointer" : ""}`}
            onClick={onLabelClick}
            onMouseMove={(e) => { if (tooltipContent) setMousePos({ x: e.clientX, y: e.clientY }); }}
            onMouseEnter={() => { if (tooltipContent) setHovered(true); }}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                className="absolute inset-y-0 left-0 bg-retro-primary transition-all duration-500 ease-out group-hover:bg-[#ff7e7e]"
                style={{ width: `${pct}%` }}
            />
        </div>
    );

    const tooltip = hovered && tooltipContent && createPortal(
        <div
            className="fixed z-[9999] pointer-events-none border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
            style={{ left: mousePos.x + 16, top: mousePos.y - 10 }}
        >
            {tooltipContent}
        </div>,
        document.body,
    );

    if (layout === "horizontal") {
        return (
            <>
                {tooltip}
                <div className="group flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                    <div className="sm:w-56 sm:shrink-0">
                        <button
                            onClick={onLabelClick}
                            className="text-xs sm:text-sm font-black uppercase truncate block hover:text-retro-primary hover:underline decoration-2 underline-offset-4 transition-all text-left"
                        >
                            {label}
                        </button>
                    </div>
                    <div className="flex-1 flex items-center gap-3 sm:gap-4">
                        {bar}
                        {caption && (
                            <span className={`w-20 sm:w-24 text-right text-[10px] sm:text-xs font-black shrink-0 ${captionClassName}`}>
                                {caption}
                            </span>
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {tooltip}
            <div className="group flex flex-col gap-1.5">
                <div className="flex justify-between items-end px-1">
                    <button
                        onClick={onLabelClick}
                        className="text-sm font-black uppercase hover:text-retro-primary hover:underline decoration-2 underline-offset-4 transition-all text-left"
                    >
                        {label}
                    </button>
                    {caption && (
                        <span className={`text-sm font-black shrink-0 ${captionClassName}`}>
                            {caption}
                        </span>
                    )}
                </div>
                {bar}
            </div>
        </>
    );
};

export default BarChartRow;

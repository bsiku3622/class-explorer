import React from "react";

type StatSize = "sm" | "lg";

interface RetroStatItemProps {
    label: string;
    value: string | number;
    unit?: string;
    size?: StatSize;
}

const styles: Record<StatSize, { label: string; value: string; unit: string; gap: string }> = {
    sm: {
        label: "text-[10px] font-black text-black/30 uppercase tracking-widest mb-1",
        value: "text-4xl font-black text-black tracking-tighter",
        unit: "text-[10px] font-black text-black/20 uppercase",
        gap: "gap-1.5",
    },
    lg: {
        label: "text-sm font-black text-black/40 uppercase tracking-widest mb-2",
        value: "text-5xl font-black text-black tracking-tighter",
        unit: "text-xs font-black text-black/30 uppercase",
        gap: "gap-2",
    },
};

const RetroStatItem: React.FC<RetroStatItemProps> = ({
    label,
    value,
    unit,
    size = "lg",
}) => {
    const s = styles[size];
    return (
        <div>
            <p className={s.label}>{label}</p>
            <div className={`flex items-baseline ${s.gap}`}>
                <span className={s.value}>{value}</span>
                {unit && <span className={s.unit}>{unit}</span>}
            </div>
        </div>
    );
};

export default RetroStatItem;

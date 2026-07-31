import React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { getStudentColor } from "../lib/utils";

interface FilterSectionProps {
    studentCounts: Record<string, number>;
    selectedYears: string[];
    setSelectedYears: (years: string[]) => void;
    lastUpdated: number | null;
    onRefresh: () => void;
    className?: string;
}

const FilterSection: React.FC<FilterSectionProps> = ({
    studentCounts,
    selectedYears,
    setSelectedYears,
    lastUpdated,
    onRefresh,
    className = "",
}) => {
    return (
        <div className={`bg-white border-2 border-black p-4 md:p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] ${className}`}>
            <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
                <div className="flex items-center gap-2 min-w-0">
                    <Filter size={16} className="text-black/40 shrink-0" />
                    <span className="text-xs md:text-sm font-bold text-black/40 uppercase tracking-widest truncate">
                        Filter by Cohort
                    </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {lastUpdated && (
                        <span className="hidden sm:inline text-[10px] font-bold uppercase text-black/30">
                            {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-1.5 text-xs font-black uppercase hover:text-retro-primary transition-colors group"
                        title="Force refresh data"
                    >
                        <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                        Refresh
                    </button>
                    {selectedYears.length < Object.keys(studentCounts).length && (
                        <button
                            onClick={() => setSelectedYears(Object.keys(studentCounts))}
                            className="text-xs font-black uppercase underline hover:text-retro-primary transition-colors tracking-tight"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* 모바일: 한 줄 가로 스크롤 / 데스크톱: flex-wrap */}
            <div className="flex gap-3 md:gap-4 overflow-x-auto md:flex-wrap md:overflow-visible pb-0.5 md:pb-0">
                {Object.entries(studentCounts).map(([year]) => {
                    const isSelected = selectedYears.includes(year);
                    const color = getStudentColor(year);

                    return (
                        <label
                            key={year}
                            className={`shrink-0 group relative flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 border-2 border-black cursor-pointer transition-all duration-100 ${
                                isSelected
                                    ? "bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                                    : "grayscale opacity-40 hover:grayscale-0 hover:opacity-100 bg-white shadow-none"
                            }`}
                            style={{
                                backgroundColor: isSelected ? `${color}20` : "",
                                borderColor: isSelected ? "black" : "#e5e7eb",
                            }}
                        >
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => {
                                    if (isSelected) {
                                        setSelectedYears(
                                            selectedYears.filter((y) => y !== year),
                                        );
                                    } else {
                                        setSelectedYears([...selectedYears, year]);
                                    }
                                }}
                            />
                            <div
                                className="w-3 h-3 md:w-4 md:h-4 border-2 border-black transition-colors shrink-0"
                                style={{
                                    backgroundColor: isSelected ? color : "transparent",
                                }}
                            />
                            <span
                                className={`text-xs md:text-sm font-black uppercase whitespace-nowrap ${isSelected ? "text-black" : "text-black/40"}`}
                            >
                                {year}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
};

export default FilterSection;

import React from "react";
import { Filter } from "lucide-react";
import { getStudentColor } from "../lib/utils";

interface FilterSectionProps {
    studentCounts: Record<string, number>;
    selectedYears: string[];
    setSelectedYears: (years: string[]) => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
    studentCounts,
    selectedYears,
    setSelectedYears,
}) => {
    return (
        <div className="mb-10 bg-white border-2 border-black p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-3 mb-6">
                <Filter size={20} className="text-retro-secondary" />
                <span className="text-sm font-black uppercase tracking-widest italic text-black/40">
                    Filter by Student Cohort
                </span>
                {selectedYears.length < Object.keys(studentCounts).length && (
                    <button
                        onClick={() => setSelectedYears(Object.keys(studentCounts))}
                        className="ml-auto text-sm font-black uppercase underline hover:text-retro-primary transition-colors tracking-tight"
                    >
                        Reset All Filters
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-4">
                {Object.entries(studentCounts).map(([year, count]) => {
                    const isSelected = selectedYears.includes(year);
                    const color = getStudentColor(year);

                    return (
                        <label
                            key={year}
                            className={`group relative flex items-center gap-3 px-4 py-2 border-2 cursor-pointer transition-all duration-200 ${
                                isSelected
                                    ? "border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] translate-x-0.5 translate-y-0.5"
                                    : "border-black/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:border-black/30"
                            }`}
                            style={{
                                backgroundColor: isSelected ? `${color}20` : "transparent",
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
                                className="w-4 h-4 border-2 border-black transition-colors"
                                style={{
                                    backgroundColor: isSelected ? color : "transparent",
                                }}
                            />
                            <span
                                className={`text-sm font-black uppercase ${isSelected ? "text-black" : "text-black/40"}`}
                            >
                                {year}{" "}
                                <span className="ml-1 text-[10px] opacity-60">
                                    ({count})
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
};

export default FilterSection;

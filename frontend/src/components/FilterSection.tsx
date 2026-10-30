import React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button, Card, Icon, Text, ToneChip } from "@studio-baeks/funky-ui";
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
        <Card padding="0" className={`p-4 md:p-6 ${className}`}>
            <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon icon={Filter} size="sm" tone="muted" className="shrink-0" />
                    <Text variant="subtitle" truncate>
                        Filter by Cohort
                    </Text>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {lastUpdated && (
                        <Text variant="micro" weight="bold" tone="faint" className="hidden sm:inline uppercase">
                            {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                    <Button
                        size="xs"
                        variant="ghost"
                        icon={RotateCcw}
                        iconMotion="turn"
                        onClick={onRefresh}
                        title="Force refresh data"
                    >
                        Refresh
                    </Button>
                    {selectedYears.length < Object.keys(studentCounts).length && (
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setSelectedYears(Object.keys(studentCounts))}
                        >
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* 모바일: 한 줄 가로 스크롤 / 데스크톱: flex-wrap */}
            <div className="flex gap-3 md:gap-4 overflow-x-auto md:flex-wrap md:overflow-visible pb-0.5 md:pb-0">
                {Object.entries(studentCounts).map(([year]) => {
                    const isSelected = selectedYears.includes(year);

                    return (
                        <ToneChip
                            key={year}
                            tone={getStudentColor(year)}
                            selected={isSelected}
                            onClick={() => {
                                if (isSelected) {
                                    setSelectedYears(
                                        selectedYears.filter((y) => y !== year),
                                    );
                                } else {
                                    setSelectedYears([...selectedYears, year]);
                                }
                            }}
                            className="shrink-0"
                        >
                            {year}
                        </ToneChip>
                    );
                })}
            </div>
        </Card>
    );
};

export default FilterSection;

import React, { useState, useMemo } from "react";
import { Chip, Divider, Tooltip } from "@heroui/react";
import { ChevronDown, Users } from "lucide-react";
import type { SubjectData, Section } from "../types";
import { tooltipMotionProps } from "../constants/motion";
import { extractSearchTerms } from "../lib/utils";
import SectionCard from "./SectionCard";
import TeacherCard from "./atoms/TeacherCard";

interface SubjectAccordionItemProps {
    subject: SubjectData;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    hasStudentInSearch: boolean;
    selectedYears: string[];
    searchMode: "general" | "student" | "teacher" | "room";
    isOpen: boolean;
    onToggle: () => void;
    isSingleStudentSearch?: boolean;
}

const SubjectAccordionItem: React.FC<SubjectAccordionItemProps> = ({
    subject,
    searchTerm,
    handleSearchToggle,
    studentSubjectMap,
    teacherSubjectMap,
    isModifierPressed,
    hasStudentInSearch,
    selectedYears,
    searchMode,
    isOpen,
    onToggle,
    isSingleStudentSearch,
}) => {
    const [hoveredTeacher, setHoveredTeacher] = useState<string | null>(null);

    const effectiveSearchTerms = useMemo(
        () => extractSearchTerms(searchTerm),
        [searchTerm],
    );

    const teacherSummary = useMemo(() => {
        const summary: Record<string, string[]> = {};
        subject.sections.forEach((s) => {
            if (!summary[s.teacher]) summary[s.teacher] = [];
            const num = s.section.replace(/[^0-9]/g, "");
            if (num && !summary[s.teacher].includes(num))
                summary[s.teacher].push(num);
        });
        return summary;
    }, [subject.sections]);

    const visibleStudentCount = useMemo(() => {
        const uniqueIds = new Set<string>();
        subject.sections.forEach((section) => {
            section.students.forEach((student) => {
                if (selectedYears.includes(student.stuId.split("-")[0])) {
                    uniqueIds.add(student.stuId);
                }
            });
        });
        return uniqueIds.size;
    }, [subject.sections, selectedYears]);

    const sectionDisplayText = isSingleStudentSearch
        ? `SECTION ${subject.sections.map((s) => s.section.replace(/[^0-9]/g, "")).join(",")}`
        : `${subject.section_count} SECTIONS`;

    return (
        <div className="border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] bg-white overflow-hidden rounded-none w-full mb-6 last:mb-0">
            <button
                onClick={onToggle}
                className="w-full px-6 py-6 flex items-center justify-between hover:bg-retro-accent1/10 focus:outline-none group transition-colors"
            >
                <div className="flex flex-row items-center justify-between gap-4 flex-1 mr-6 text-left overflow-hidden">
                    <span className="text-xl font-black text-black tracking-tight uppercase truncate flex-1">
                        {subject.subject}
                    </span>
                    <div className="flex gap-3 shrink-0">
                        <Chip
                            size="lg"
                            className={`${isSingleStudentSearch ? "bg-retro-accent1" : "bg-retro-accent2"} border-2 border-black text-sm font-black rounded-none shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] px-3 h-auto py-1.5 uppercase`}
                        >
                            {sectionDisplayText}
                        </Chip>
                        <Chip
                            size="lg"
                            className="bg-retro-accent3 border-2 border-black text-sm font-black rounded-none shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] px-3 h-auto py-1.5"
                        >
                            {visibleStudentCount} STUDENTS
                        </Chip>
                    </div>
                </div>
                <ChevronDown
                    size={20}
                    style={{ transition: "none" }}
                    className={`text-black shrink-0 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {isOpen && (
                <div className="overflow-hidden border-t-2 border-black bg-retro-bg/10">
                    <div className="px-6 pb-12 pt-10 space-y-12">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/50 border-2 border-black p-4 mb-12 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                            <span className="text-sm font-black uppercase text-black/50 flex items-center gap-2">
                                <Users size={16} /> Teachers :
                            </span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {Object.entries(teacherSummary).map(
                                    ([name, nums]) => {
                                        const isSearching =
                                            effectiveSearchTerms.some((term) =>
                                                name
                                                    .toLowerCase()
                                                    .includes(term),
                                            );
                                        const teacherInfo =
                                            teacherSubjectMap[name] || {};
                                        const teacherClasses = Object.entries(
                                            teacherInfo,
                                        ).map(([sub, sections]) => {
                                            const cleanSub = sub.split("(")[0];
                                            const secStr = sections
                                                .map((s) =>
                                                    s.replace(/[^0-9]/g, ""),
                                                )
                                                .sort()
                                                .join(",");
                                            return `${cleanSub}(${secStr})`;
                                        });

                                        return (
                                            <Tooltip
                                                key={name}
                                                isOpen={
                                                    isModifierPressed &&
                                                    hoveredTeacher === name
                                                }
                                                placement="top"
                                                motionProps={tooltipMotionProps}
                                                classNames={{
                                                    base: "!transition-none",
                                                    content:
                                                        "p-0 rounded-none border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                                }}
                                                content={
                                                    <TeacherCard
                                                        name={name}
                                                        subjects={teacherClasses}
                                                    />
                                                }
                                            >
                                                <button
                                                    className={`text-sm font-black transition-colors hover:text-retro-secondary cursor-pointer ${isSearching ? "text-retro-secondary underline decoration-2 underline-offset-4" : "text-black"}`}
                                                    onMouseEnter={() =>
                                                        setHoveredTeacher(name)
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredTeacher(null)
                                                    }
                                                    onClick={() =>
                                                        handleSearchToggle(
                                                            name,
                                                            true,
                                                        )
                                                    }
                                                >
                                                    {name}(
                                                    {nums.sort().join(",")})
                                                </button>
                                            </Tooltip>
                                        );
                                    },
                                )}
                            </div>
                        </div>

                        {subject.sections.map(
                            (section: Section, idx: number) => (
                                <React.Fragment key={section.id}>
                                    {idx > 0 && (
                                        <Divider className="mb-10 h-px bg-black opacity-20" />
                                    )}
                                    <SectionCard
                                        section={section}
                                        searchTerm={searchTerm}
                                        handleSearchToggle={handleSearchToggle}
                                        studentSubjectMap={studentSubjectMap}
                                        teacherSubjectMap={teacherSubjectMap}
                                        isModifierPressed={isModifierPressed}
                                        hasStudentInSearch={hasStudentInSearch}
                                        selectedYears={selectedYears}
                                        searchMode={searchMode}
                                    />
                                </React.Fragment>
                            ),
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectAccordionItem;

import React, { useState, useMemo } from "react";
import { Accordion, Badge, Button, Divider, Link, Popover, Surface, Text } from "@studio-baeks/funky-ui";
import { FolderOpen, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SubjectData, Section, Term } from "../types";
import { extractSearchTerms, getKoreanName } from "../lib/utils";
import SectionCard from "./SectionCard";
import TeacherCard from "./atoms/TeacherCard";
import SyllabusPanel from "./SyllabusPanel";

interface SubjectAccordionItemProps {
    subject: SubjectData;
    term: Term | null;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    selectedYears: string[];
    searchMode: "general" | "student" | "teacher" | "room";
    isOpen: boolean;
    onToggle: () => void;
    isSingleStudentSearch?: boolean;
}

const SubjectAccordionItem: React.FC<SubjectAccordionItemProps> = ({
    subject,
    term,
    searchTerm,
    handleSearchToggle,
    studentSubjectMap,
    teacherSubjectMap,
    isModifierPressed,
    selectedYears,
    searchMode,
    isOpen,
    onToggle,
    isSingleStudentSearch,
}) => {
    const navigate = useNavigate();
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
        <Accordion
            title={<span className="uppercase text-black max-sm:text-base">{getKoreanName(subject.subject)}</span>}
            size="lg"
            trailing={
                <div className="flex gap-2 sm:gap-3 shrink-0">
                    <Badge size="xl" shadow accent={isSingleStudentSearch ? "cyan" : "yellow"} variant="solid" className="max-sm:h-7 max-sm:px-2 max-sm:text-xs">
                        {sectionDisplayText}
                    </Badge>
                    <Badge size="xl" shadow accent="pink" variant="solid" className="max-sm:h-7 max-sm:px-2 max-sm:text-xs">
                        {visibleStudentCount} STUDENTS
                    </Badge>
                </div>
            }
            open={isOpen}
            onOpenChange={() => onToggle()}
            className="w-full mb-6 last:mb-0"
        >
            <div className="space-y-6">
                <SyllabusPanel subject={subject} term={term} />
                <Surface
                    border="line"
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 p-2.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]"
                >
                    <Text variant="subtitle" className="flex items-center gap-2">
                        <Users size={16} /> Teachers :
                    </Text>
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
                                    const cleanSub = getKoreanName(sub);
                                    const secStr = sections
                                        .map((s) =>
                                            s.replace(/[^0-9]/g, ""),
                                        )
                                        .sort()
                                        .join(",");
                                    return `${cleanSub}(${secStr})`;
                                });

                                return (
                                    <Popover
                                        key={name}
                                        trigger="manual"
                                        open={
                                            isModifierPressed &&
                                            hoveredTeacher === name
                                        }
                                        padding="0"
                                        content={
                                            <TeacherCard
                                                name={name}
                                                subjects={teacherClasses}
                                            />
                                        }
                                    >
                                        <Text
                                            weight="black"
                                            tone={isSearching ? "purple" : undefined}
                                            decoration={isSearching ? "underline" : undefined}
                                        >
                                            <Link
                                                as="button"
                                                type="button"
                                                underline="hover"
                                                accent="purple"
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
                                            </Link>
                                        </Text>
                                    </Popover>
                                );
                            },
                        )}
                    </div>
                    <Button
                        size="xs"
                        accent="cyan"
                        variant="solid"
                        shadow
                        icon={FolderOpen}
                        onClick={() => navigate(`/materials?subject=${subject.subject_id}`)}
                        className="ml-auto shrink-0"
                    >
                        자료실 가기
                    </Button>
                </Surface>

                {subject.sections.map(
                    (section: Section, idx: number) => (
                        <React.Fragment key={section.id}>
                            {idx > 0 && <Divider tone="soft" className="mb-4" />}
                            <SectionCard
                                section={section}
                                searchTerm={searchTerm}
                                handleSearchToggle={handleSearchToggle}
                                studentSubjectMap={studentSubjectMap}
                                teacherSubjectMap={teacherSubjectMap}
                                isModifierPressed={isModifierPressed}
                                selectedYears={selectedYears}
                                searchMode={searchMode}
                            />
                        </React.Fragment>
                    ),
                )}
            </div>
        </Accordion>
    );
};

export default SubjectAccordionItem;

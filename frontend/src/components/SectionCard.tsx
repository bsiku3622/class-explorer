import React, { useState, useMemo } from "react";
import { Button, Icon, Link, Paint, Popover, Text } from "@studio-baeks/funky-ui";
import { User, MapPin, Users, Clock } from "lucide-react";
import { getKoreanName, DAY_MAP, DAYS_ORDER, extractSearchTerms } from "../lib/utils";
import type { Section } from "../types";
import StudentCard from "./atoms/StudentCard";
import TeacherCard from "./atoms/TeacherCard";
import StudentBadge from "./atoms/StudentBadge";

interface SectionCardProps {
    section: Section;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean, isR?: boolean) => void;
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    selectedYears: string[];
    searchMode: "general" | "student" | "teacher" | "room";
}

const SectionCard: React.FC<SectionCardProps> = ({
    section,
    searchTerm,
    handleSearchToggle,
    studentSubjectMap,
    teacherSubjectMap,
    isModifierPressed,
    selectedYears,
    searchMode,
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    const effectiveSearchTerms = useMemo(
        () => extractSearchTerms(searchTerm),
        [searchTerm],
    );

    const isTeacherSearching = useMemo(() => {
        return effectiveSearchTerms.some((term) =>
            section.teacher.toLowerCase().includes(term),
        );
    }, [effectiveSearchTerms, section.teacher]);

    const isRoomSearching = useMemo(() => {
        if (searchMode !== "room") return false;
        const searchRoom = effectiveSearchTerms[0]; // room 모드에서는 보통 단일 검색어
        if (!searchRoom) return false;

        const primaryMatch = section.room.toLowerCase().includes(searchRoom);
        const timesMatch = (section.times || []).some((t) =>
            t.room.toLowerCase().includes(searchRoom),
        );
        return primaryMatch || timesMatch;
    }, [effectiveSearchTerms, section.room, section.times, searchMode]);

    const teacherInfo = teacherSubjectMap[section.teacher] || {};
    const teacherClasses = Object.entries(teacherInfo).map(
        ([subject, sections]) => {
            const cleanSubject = getKoreanName(subject);
            const sectionNums = sections
                .map((s) => s.replace(/[^0-9]/g, ""))
                .sort()
                .join(",");
            return `${cleanSubject}(${sectionNums})`;
        },
    );

    const filteredStudents = section.students.filter((s) =>
        selectedYears.includes(s.stuId.split("-")[0]),
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
            <div className="md:col-span-4 space-y-2.5">
                <Paint as="h3" accent="cyan" variant="solid" shadow className="inline-block px-3 py-1">
                    <Text variant="subheading" tone="inherit">
                        {section.section}
                    </Text>
                </Paint>
                <div className="space-y-1.5">
                    <Popover
                        trigger="manual"
                        open={
                            isModifierPressed &&
                            hoveredItemId === `teacher-${section.id}`
                        }
                        padding="0"
                        block
                        content={
                            <TeacherCard
                                name={section.teacher}
                                subjects={teacherClasses}
                            />
                        }
                    >
                        <Button
                            accent="purple"
                            variant="ghost"
                            size="sm"
                            uppercase={false}
                            icon={User}
                            selected={isTeacherSearching}
                            className="-ml-2 justify-start"
                            onMouseEnter={() =>
                                setHoveredItemId(`teacher-${section.id}`)
                            }
                            onMouseLeave={() => setHoveredItemId(null)}
                            onClick={() =>
                                handleSearchToggle(section.teacher, true)
                            }
                        >
                            {section.teacher}
                        </Button>
                    </Popover>

                    <div>
                        <Button
                            accent="pink"
                            variant="ghost"
                            size="sm"
                            uppercase={false}
                            icon={MapPin}
                            selected={isRoomSearching}
                            className="-ml-2 justify-start"
                            onClick={() => handleSearchToggle(section.room, false, true)}
                        >
                            {section.room}
                        </Button>
                    </div>
                    <Text as="div" weight="black" tone="secondary" className="flex items-center gap-3 h-8 px-3.5 -ml-2">
                        <Icon icon={Users} size="lg" tone="orange" />
                        <span>{section.student_count} Students</span>
                    </Text>

                    {section.times && section.times.length > 0 && (
                        <Text as="div" weight="black" tone="secondary" className="flex items-center gap-3 h-8 px-3.5 -ml-2">
                            <Icon icon={Clock} size="lg" tone="sky" />
                            <div className="flex flex-wrap gap-x-2">
                                {(() => {
                                    const grouped: Record<string, number[]> = {};
                                    section.times.forEach((t) => {
                                        if (!grouped[t.day]) grouped[t.day] = [];
                                        grouped[t.day].push(t.period);
                                    });
                                    return DAYS_ORDER.filter((day) => grouped[day]).map((day) => {
                                        const periods = grouped[day].sort((a, b) => a - b);
                                        const isAnyPeriodMatch = periods.some((p) =>
                                            effectiveSearchTerms.some(
                                                (term) =>
                                                    term === `${DAY_MAP[day]}${p}` ||
                                                    term === `${day.toLowerCase()}${p}`,
                                            ),
                                        );
                                        return (
                                            <span key={day} className="flex gap-0.5 items-center mr-2">
                                                <Text
                                                    tone={isAnyPeriodMatch ? "sky" : "secondary"}
                                                    weight="black"
                                                >
                                                    {DAY_MAP[day]}
                                                </Text>
                                                {periods.map((p, idx) => {
                                                    const isThisMatch = effectiveSearchTerms.some(
                                                        (term) =>
                                                            term === `${DAY_MAP[day]}${p}` ||
                                                            term === `${day.toLowerCase()}${p}`,
                                                    );
                                                    return (
                                                        <React.Fragment key={p}>
                                                            <Link
                                                                as="button"
                                                                type="button"
                                                                underline="hover"
                                                                accent={isThisMatch ? "sky" : undefined}
                                                                onClick={(e: React.MouseEvent) => {
                                                                    e.stopPropagation();
                                                                    handleSearchToggle(`${DAY_MAP[day]}${p}`);
                                                                }}
                                                            >
                                                                {p}
                                                            </Link>
                                                            {idx < periods.length - 1 && <Text tone="faint">,</Text>}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </span>
                                        );
                                    });
                                })()}
                            </div>
                        </Text>
                    )}
                </div>
            </div>
            <div className="md:col-span-8">
                <div className="flex flex-wrap gap-2.5">
                    {filteredStudents.map((student) => {
                        // 하이라이트는 일치하는 검색어가 있으면 항상 표시 (일반 검색 포함)
                        const isMatch = effectiveSearchTerms.some(
                            (term) =>
                                student.stuId.toLowerCase().includes(term) ||
                                student.name.toLowerCase().includes(term),
                        );

                        const mySubjects =
                            studentSubjectMap[student.stuId] || [];

                        return (
                            <Popover
                                key={student.stuId}
                                trigger="manual"
                                open={
                                    isModifierPressed &&
                                    hoveredItemId === student.stuId
                                }
                                padding="0"
                                content={
                                    <StudentCard
                                        stuId={student.stuId}
                                        name={student.name}
                                        subjects={mySubjects}
                                    />
                                }
                            >
                                {/* ⚠️ **안 맞는 사람을 흐리게 하지 않습니다.** 예전에는
                                    `grayscale opacity-30` 으로 지웠는데, 명단을 보는
                                    이유의 절반이 "누구랑 같이 듣나" 라서 나머지가 안
                                    보이면 화면이 반쯤 죽습니다. 전부 제 색으로 두고,
                                    찾는 사람만 **잠깐 진동하게** 합니다 (`buzz`) —
                                    움직임은 색을 뺏지 않고도 제일 먼저 눈에 띕니다.

                                    모션을 끈 환경(`prefers-reduced-motion`)에서도
                                    구분되도록 **면을 조금 더 채우고 그림자를 세게**
                                    둡니다(`StudentBadge` 가 `buzz` 와 함께 그립니다) —
                                    움직임 하나에만 기대면 안 됩니다.

                                    ⚠️ **호버 효과는 없습니다.** 마우스가 지나가는
                                    자리마다 배지가 커지면, 정작 움직여야 할 것(찾는
                                    사람의 진동)이 그 소음에 묻힙니다 */}
                                <span
                                    className="inline-flex"
                                    onMouseEnter={() =>
                                        setHoveredItemId(student.stuId)
                                    }
                                    onMouseLeave={() => setHoveredItemId(null)}
                                >
                                    <StudentBadge
                                        studentId={student.stuId}
                                        studentName={student.name}
                                        buzz={isMatch}
                                        onClick={() =>
                                            handleSearchToggle(student.stuId)
                                        }
                                    />
                                </span>
                            </Popover>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SectionCard;

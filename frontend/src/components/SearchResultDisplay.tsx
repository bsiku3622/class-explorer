import React, { useState, useEffect, useMemo } from "react";
import {
    BookOpen,
    AlertCircle,
    ChevronDown,
    CalendarDays,
    LayoutList,
} from "lucide-react";
import type { SearchResultStats, SearchEntity } from "../types";
import { getStudentColor, getKoreanName } from "../lib/utils";
import TimetableGrid from "./TimetableGrid";
import EntityCard from "./EntityCard";
import {
    Badge,
    Button,
    Card,
    Icon,
    Link,
    Notice,
    PersonCard,
    Popover,
    Pressable,
    Stat,
    StudentBadge,
    Surface,
    Text,
    ToneBox,
    ToneButton,
    ToneSwatch,
    ToneText,
    surfaceClass,
    type IconComponent,
} from "@studio-baeks/funky-ui";
import { ACCENT_COLORS } from "@studio-baeks/funky-ui/tokens";

interface SearchResultDisplayProps {
    searchResult: SearchResultStats;
    searchMode: "general" | "student" | "teacher" | "room";
    isLogicalSearch: boolean;
    isConsolidatedView: boolean;
    isModifierPressed: boolean;
    hoveredEntityId: string | null;
    setHoveredEntityId: (id: string | null) => void;
    handleSearchToggle: (
        value: string,
        isTeacher?: boolean,
        isRoom?: boolean,
    ) => void;
    handleSearchSelect: (
        value: string,
        isTeacher?: boolean,
        isRoom?: boolean,
    ) => void;
}

const getEntityColor = (entity: SearchEntity) => {
    if (entity.type === "student") return getStudentColor(entity.id);
    if (entity.type === "teacher") return "#7828c8";
    if (entity.type === "room") return "#00B5E7";
    return "#000000";
};

/** 칸 위의 작은 머리 — 아이콘 + 대문자 이름표 */
const SectionLabel: React.FC<{ icon: IconComponent; className?: string; children: React.ReactNode }> = ({
    icon,
    className = "",
    children,
}) => (
    <Text as="div" variant="subtitle" className={`flex items-center gap-2 ${className}`}>
        <Icon icon={icon} size="lg" tone="muted" />
        <span>{children}</span>
    </Text>
);

/** 과목 한 줄 — 왼쪽 띠는 엔티티 색, 누르면 그 과목으로 검색합니다 */
const SubjectRow: React.FC<{
    label: string;
    color: string;
    small?: boolean;
    onClick: () => void;
}> = ({ label, color, small, onClick }) => (
    <Pressable
        onClick={onClick}
        className={`${surfaceClass({ fill: "none", hoverable: true })} flex min-w-0 items-stretch gap-3 text-left`}
    >
        <ToneSwatch tone={color} shape="rail" />
        <Text variant={small ? "caption" : "body"} truncate className={small ? "min-w-0 py-1" : "min-w-0 py-1.5"}>
            {label}
        </Text>
    </Pressable>
);

const SearchResultDisplay: React.FC<SearchResultDisplayProps> = ({
    searchResult,
    searchMode,
    isLogicalSearch,
    isConsolidatedView,
    isModifierPressed,
    hoveredEntityId,
    setHoveredEntityId,
    handleSearchToggle,
    handleSearchSelect,
}) => {
    const [visibleCount, setVisibleCount] = useState(6);
    const [viewType, setViewType] = useState<"timetable" | "list">("timetable");

    useEffect(() => {
        setVisibleCount(6);
    }, [searchResult.keyword, searchResult.entities.length]);

    // 검색 쿼리를 하이라이트하고 클릭 가능한 링크로 변환하는 컴포넌트
    const QueryHighlighter = ({
        query,
        prefix,
    }: {
        query: string;
        prefix?: string;
    }) => {
        if (!query) return null;

        const parts = query.split(/([()&+!])/g).filter((p) => p !== "");

        return (
            <div className="flex flex-wrap items-center gap-x-0.5">
                {prefix && (
                    <span className="mr-1 text-[var(--fk-ink-muted)]">{prefix}:</span>
                )}
                {parts.map((part, i) => {
                    const isOperator = /[()&+!]/.test(part);
                    if (isOperator) {
                        return (
                            <span
                                key={i}
                                className="font-black px-0.5"
                                style={{ color: ACCENT_COLORS.pink.solidInk }}
                            >
                                {part}
                            </span>
                        );
                    }
                    return (
                        <Link
                            as="button"
                            type="button"
                            key={i}
                            underline="hover"
                            accent="pink"
                            onClick={() => handleSearchToggle(part.trim())}
                        >
                            {part}
                        </Link>
                    );
                })}
            </div>
        );
    };

    const conflictData = useMemo(() => {
        if (!isLogicalSearch) return null;
        const studentEntities = searchResult.entities.filter((e) => e.type === "student");
        if (studentEntities.length < 2) return null;
        const schedules = studentEntities.map((entity) => {
            const map: Record<string, string> = {};
            (entity.times || []).forEach((t) => {
                map[`${t.day}-${t.period}`] = t.subject || "";
            });
            return map;
        });
        let count = 0;
        ["MON", "TUE", "WED", "THU", "FRI"].forEach((day) =>
            Array.from({ length: 11 }, (_, i) => i + 1).forEach((period) => {
                const key = `${day}-${period}`;
                const occupied = schedules.filter((s) => !!s[key]);
                if (occupied.length < 2) return;
                const first = occupied[0][key];
                if (!occupied.every((s) => s[key] === first)) count++;
            }),
        );
        return count > 0 ? { count } : null;
    }, [searchResult.entities, isLogicalSearch]);

    const matchSummary = useMemo(() => {
        const entities = searchResult.entities;
        const counts = {
            student: entities.filter((e) => e.type === "student").length,
            teacher: entities.filter((e) => e.type === "teacher").length,
            room: entities.filter((e) => e.type === "room").length,
            subject: searchResult.total_subjects,
        };

        const parts = [];
        if (counts.subject > 0)
            parts.push(
                `${counts.subject} Subject${counts.subject > 1 ? "s" : ""}`,
            );
        if (counts.student > 0)
            parts.push(
                `${counts.student} Student${counts.student > 1 ? "s" : ""}`,
            );
        if (counts.teacher > 0)
            parts.push(
                `${counts.teacher} Teacher${counts.teacher > 1 ? "s" : ""}`,
            );
        if (counts.room > 0)
            parts.push(`${counts.room} Room${counts.room > 1 ? "s" : ""}`);

        return parts.length > 0 ? parts.join(" & ") + " Matched" : "No Matches";
    }, [searchResult]);

    const renderWarning = () => {
        if (!searchResult.warning) return null;
        return (
            <Notice accent="warning" shadow icon={AlertCircle} title="Search Warning" className="mb-8">
                {searchResult.warning}
            </Notice>
        );
    };

    const handleSubjectClick = (sub: string, mode: string) => {
        const parts = sub.split(" - ");
        let subjectFull = "";

        if (parts.length < 2) {
            subjectFull = sub;
        } else {
            subjectFull = mode === "room" ? parts[1].trim() : parts[0].trim();
        }

        // formatSubjectWithSection이 만든 "과목명(분반)" 형태에서 뒤쪽 괄호만 분반으로 떼어냅니다.
        // 과목명 자체에 숫자나 괄호가 있어도(체육4, 미적분학2(EC)) 그쪽을 분반으로 오인하지 않게.
        const parsed = subjectFull.match(/^(.*?)\(([\d,\s]+)\)$/);

        if (parsed) {
            const name = getKoreanName(parsed[1]).trim();
            // 분반이 여럿이면 "과목/1,4" — 검색 쪽에서 콤마 목록을 받습니다
            const sections = parsed[2].replace(/\s/g, "");
            if (name && sections) {
                handleSearchToggle(`${name}/${sections}`);
                return;
            }
        }

        const nameOnly = getKoreanName(parsed ? parsed[1] : subjectFull).trim();
        handleSearchToggle(nameOnly || subjectFull);
    };

    if (isConsolidatedView) {
        const primaryEntity = searchResult.entities[0];
        const profileTone =
            searchMode !== "general" && primaryEntity
                ? getEntityColor(primaryEntity)
                : null;
        const profileClass = `p-6 md:p-8 flex flex-col relative ${searchMode === "general" ? "md:w-2/3" : "md:w-1/3"}`;

        const profile = (
            <>
                <Surface fill="inverse" className="absolute top-0 left-0 px-6 py-1.5">
                    <Text variant="overline" tone="inverse">
                        {searchMode === "student"
                            ? "Student Profile"
                            : searchMode === "teacher"
                              ? "Teacher Profile"
                              : searchMode === "room"
                                ? "Classroom Profile"
                                : "Logical Search"}
                    </Text>
                </Surface>

                <div className="mt-8 mb-10">
                    {searchMode !== "general" && primaryEntity ? (
                        <>
                            {searchMode === "student" && (
                                <Text as="p" variant="heading" tone="muted" className="mb-2">
                                    &nbsp;&nbsp;{primaryEntity.id}
                                </Text>
                            )}
                            <ToneText
                                as="h2"
                                variant="hero"
                                tone={getEntityColor(primaryEntity)}
                            >
                                {primaryEntity.name}
                            </ToneText>
                        </>
                    ) : (
                        <>
                            <Text as="p" variant="subtitle" tone="faint" className="mb-1">
                                Active Query
                            </Text>
                            <Text as="div" variant="hero" className="text-3xl md:text-5xl break-all">
                                <QueryHighlighter
                                    query={searchResult.keyword}
                                    prefix={searchResult.prefix}
                                />
                            </Text>
                        </>
                    )}
                </div>

                {searchMode !== "general" && primaryEntity && (
                    <Surface
                        fill="none"
                        border="subtle"
                        borderSide="top"
                        className="pt-8 flex-1 flex flex-col gap-10"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <Stat
                                label="Matched Subjects"
                                value={searchResult.total_subjects}
                                unit="Items"
                                size="sm"
                            />
                            <Stat
                                label="Total Sections"
                                value={searchResult.total_sections}
                                unit="Classes"
                                size="sm"
                            />
                        </div>

                        {viewType === "timetable" && (
                            <div className="flex flex-col gap-2">
                                <SectionLabel icon={BookOpen} className="mb-2">
                                    {searchMode === "student"
                                        ? "Enrollment"
                                        : searchMode === "teacher"
                                          ? "Teaching"
                                          : "Scheduled"}{" "}
                                    ({primaryEntity.subject_count})
                                </SectionLabel>
                                <div className="flex flex-col gap-1.5">
                                    {primaryEntity.subjects.map(
                                        (sub, i) => (
                                            <SubjectRow
                                                key={i}
                                                label={sub}
                                                color={getEntityColor(primaryEntity)}
                                                small
                                                onClick={() =>
                                                    handleSubjectClick(
                                                        sub,
                                                        searchMode,
                                                    )
                                                }
                                            />
                                        ),
                                    )}
                                </div>
                            </div>
                        )}
                    </Surface>
                )}

                {isLogicalSearch &&
                    searchResult.entities.length > 0 && (
                        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                            {searchResult.entities.map((entity, i) => {
                                const color = getEntityColor(entity);
                                const entityKey = `logical-${entity.id}-${entity.name}-${i}`;
                                return (
                                    <Popover
                                        key={i}
                                        trigger="manual"
                                        open={
                                            isModifierPressed &&
                                            hoveredEntityId ===
                                                entityKey
                                        }
                                        padding="0"
                                        content={
                                            <PersonCard
                                                id={
                                                    entity.type === "student"
                                                        ? entity.id
                                                        : undefined
                                                }
                                                name={entity.name}
                                                color={color}
                                                title={
                                                    <span className="flex items-center gap-2">
                                                        <BookOpen size={12} /> Assigned Classes
                                                    </span>
                                                }
                                                items={entity.subjects
                                                    .slice(0, 8)
                                                    .map((sub) => sub.split("(")[0])}
                                                footer={
                                                    entity.subjects.length > 8
                                                        ? `+ ${entity.subjects.length - 8} more`
                                                        : undefined
                                                }
                                                size="sm"
                                                framed={false}
                                            />
                                        }
                                    >
                                        <span
                                            className="inline-flex"
                                            onMouseEnter={() =>
                                                setHoveredEntityId(
                                                    entityKey,
                                                )
                                            }
                                            onMouseLeave={() =>
                                                setHoveredEntityId(null)
                                            }
                                        >
                                            <StudentBadge
                                                cohort={
                                                    entity.type === "student"
                                                        ? entity.id.split("-")[0]
                                                        : ""
                                                }
                                                name={
                                                    entity.type === "teacher"
                                                        ? `${entity.name} T`
                                                        : entity.name
                                                }
                                                color={color}
                                                onClick={() =>
                                                    handleSearchToggle(
                                                        entity.type ===
                                                            "student"
                                                            ? entity.id
                                                            : entity.name,
                                                        entity.type ===
                                                            "teacher",
                                                        entity.type ===
                                                            "room",
                                                    )
                                                }
                                            />
                                        </span>
                                    </Popover>
                                );
                            })}
                        </div>
                    )}
            </>
        );

        return (
            <div className="flex flex-col">
                {renderWarning()}
                <Card padding="0" className="overflow-hidden flex flex-col md:flex-row">
                    {profileTone ? (
                        <ToneBox tone={profileTone} framed={false} className={profileClass}>
                            {profile}
                        </ToneBox>
                    ) : (
                        <Surface fill="well" className={profileClass}>
                            {profile}
                        </Surface>
                    )}

                    <Surface
                        border="line"
                        borderSide="top"
                        className={`p-6 md:p-10 flex flex-col relative md:border-t-0 md:border-l-2 ${searchMode === "general" ? "md:w-1/3" : "md:w-2/3"}`}
                    >
                        {searchMode !== "general" && primaryEntity && (
                            <Surface
                                border="line"
                                shadow="raised"
                                padding="xs"
                                className="absolute top-3 right-4 flex z-10"
                            >
                                <ToneButton
                                    tone={getEntityColor(primaryEntity)}
                                    size="sm"
                                    shadow={false}
                                    icon={CalendarDays}
                                    selected={viewType === "timetable"}
                                    onClick={() => setViewType("timetable")}
                                >
                                    Grid
                                </ToneButton>
                                <ToneButton
                                    tone={getEntityColor(primaryEntity)}
                                    size="sm"
                                    shadow={false}
                                    icon={LayoutList}
                                    selected={viewType === "list"}
                                    onClick={() => setViewType("list")}
                                >
                                    List
                                </ToneButton>
                            </Surface>
                        )}

                        {searchMode !== "general" && primaryEntity ? (
                            viewType === "timetable" ? (
                                <div className="flex-1 flex flex-col">
                                    <SectionLabel icon={CalendarDays} className="mb-3 pt-4">
                                        Visual Schedule
                                    </SectionLabel>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <TimetableGrid
                                            times={primaryEntity.times}
                                            color={getEntityColor(
                                                primaryEntity,
                                            )}
                                            mode={searchMode}
                                            className="w-full"
                                            showTitle={false}
                                            onCellClick={(subject) =>
                                                handleSearchToggle(subject)
                                            }
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col">
                                    <SectionLabel icon={BookOpen} className="mb-3 pt-4">
                                        {searchMode === "student"
                                            ? "Enrollment"
                                            : searchMode === "teacher"
                                              ? "Teaching"
                                              : "Scheduled"}{" "}
                                        ({primaryEntity.subject_count})
                                    </SectionLabel>
                                    <div className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 sm:gap-x-6 overflow-y-auto pr-2 custom-scrollbar">
                                        {primaryEntity.subjects.map(
                                            (sub, i) => (
                                                <SubjectRow
                                                    key={i}
                                                    label={sub}
                                                    color={getEntityColor(primaryEntity)}
                                                    onClick={() =>
                                                        handleSubjectClick(
                                                            sub,
                                                            searchMode,
                                                        )
                                                    }
                                                />
                                            ),
                                        )}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <div className="grid grid-cols-2 gap-10 mb-10">
                                    <Stat
                                        label="Matched Subjects"
                                        value={searchResult.total_subjects}
                                        unit="Items"
                                    />
                                    <Stat
                                        label="Total Sections"
                                        value={searchResult.total_sections}
                                        unit="Classes"
                                    />
                                </div>
                                {conflictData && (
                                    <Notice
                                        accent="warning"
                                        icon={AlertCircle}
                                        title={`${conflictData.count} Schedule Conflict${conflictData.count > 1 ? "s" : ""}`}
                                        className="mb-6"
                                    >
                                        동일 시간대에 서로 다른 수업 수강
                                    </Notice>
                                )}
                                <Surface fill="canvas" border="subtle" className="p-6">
                                    <Text as="p" variant="caption" tone="secondary" align="center">
                                        {isLogicalSearch
                                            ? "논리 연산이 적용된 결과입니다. 매칭되는 상세 분반 리스트는 아래 아코디언에서 확인하세요."
                                            : "검색 결과에 대한 요약 통계입니다."}
                                    </Text>
                                </Surface>
                            </div>
                        )}
                    </Surface>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            {renderWarning()}
            <Card padding="0" className="p-8 relative overflow-hidden">
                <Surface fill="inverse" className="absolute top-0 right-0 px-6 py-1.5">
                    <Text variant="overline" tone="inverse">
                        Search Status
                    </Text>
                </Surface>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <SectionLabel icon={BookOpen} className="mb-3">
                            Current Keyword
                        </SectionLabel>
                        <div className="flex items-center gap-4">
                            <Text as="div" variant="display" className="text-2xl md:text-4xl">
                                <QueryHighlighter
                                    query={searchResult.keyword}
                                    prefix={searchResult.prefix}
                                />
                            </Text>
                            <Badge variant="filled">
                                {searchResult.total_subjects} SUBJECTS MATCHED
                            </Badge>
                        </div>
                    </div>
                    <Surface
                        fill="none"
                        border="subtle"
                        borderSide="top"
                        className="flex gap-10 pt-6 md:pt-0 md:pl-10 md:border-t-0 md:border-l-2"
                    >
                        <div>
                            <Text as="p" variant="overline" className="mb-1">
                                Identified
                            </Text>
                            <Text as="p" variant="heading">
                                {matchSummary}
                            </Text>
                        </div>
                        <div>
                            <Text as="p" variant="overline" className="mb-1">
                                Match Scope
                            </Text>
                            <Text as="p" variant="heading">
                                {searchResult.total_sections} Sections
                            </Text>
                        </div>
                    </Surface>
                </div>
            </Card>

            {searchResult.entities.length > 0 && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {searchResult.entities
                            .slice(0, visibleCount)
                            .map((entity, idx) => (
                                <EntityCard
                                    key={idx}
                                    entity={entity}
                                    entityColor={getEntityColor(entity)}
                                    isSingleEntity={
                                        searchResult.entities.length === 1
                                    }
                                    onClick={() =>
                                        handleSearchSelect(
                                            entity.type === "student"
                                                ? entity.id
                                                : entity.name,
                                            entity.type === "teacher",
                                            entity.type === "room",
                                        )
                                    }
                                />
                            ))}
                    </div>
                    {searchResult.entities.length > visibleCount && (
                        <div className="flex justify-center pt-10">
                            <Button
                                variant="paper"
                                shadow
                                size="lg"
                                iconEnd={ChevronDown}
                                onClick={() =>
                                    setVisibleCount((prev) => prev + 6)
                                }
                            >
                                Show More Items
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchResultDisplay;

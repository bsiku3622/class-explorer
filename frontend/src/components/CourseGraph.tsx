import React, { useMemo, useState } from "react";
import { Lock, Check } from "lucide-react";
import { Badge, Icon, Pressable, Surface, Text, paintClass, surfaceClass } from "@studio-baeks/funky-ui";
import { ACCENT_COLORS } from "@studio-baeks/funky-ui/tokens";
import {
    ALL_DEPARTMENTS,
    courseState,
    COURSE_STATE_LABEL,
    layoutFullGraph,
    layoutGraph,
    outsidePrereqs,
    prereqLine,
    NODE_WIDTH,
    NODE_HEIGHT,
    type Course,
    type CourseState,
    type FullGraph,
    type GradeMap,
    type Graph,
    type GraphLane,
    type Prereq,
} from "../lib/curriculum";

/** 이수 상태가 칸의 면이 됩니다 — 교육과정 노드는 `tinted`(연한 면 + 색 테두리 + 검정 글자) */
const STATE_FACE: Record<CourseState, string> = {
    taken: paintClass({ accent: "green", variant: "tinted" }),
    current: paintClass({ accent: "sky", variant: "tinted" }),
    inferred: paintClass({ accent: "green", variant: "tinted", borderStyle: "dashed" }),
    available: paintClass({ variant: "paper" }),
    locked: surfaceClass({ fill: "well", border: "soft" }),
};
const SELECTED_FACE = paintClass({ accent: "pink", variant: "tinted" });
const STATE_TONE = { inferred: "secondary", locked: "faint" } as const;

export const CourseGraphLegend: React.FC<{ states?: CourseState[] }> = ({
    states = ["taken", "current", "inferred", "available", "locked"],
}) => (
    <Text as="div" variant="micro" weight="bold" className="flex flex-wrap items-center gap-3">
        {states.map((state) => (
            <span key={state} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 ${STATE_FACE[state]}`} />
                {COURSE_STATE_LABEL[state]}
            </span>
        ))}
    </Text>
);

interface CourseGraphProps {
    courses: Course[];
    prerequisites: Prereq[];
    /** 화면 표시 순서 (서버가 내려준 순서) */
    departments: string[];
    /** 선택된 학과, 또는 `ALL_DEPARTMENTS` */
    department: string;

    /**
     * 이수 상태. 넘기지 않으면 상태를 칠하지 않고 교육과정 구조만 보여줍니다 —
     * 학번을 등록하지 않은 사람도 과목 흐름은 볼 수 있어야 하니까요.
     */
    taken?: Set<string>;
    current?: Set<string>;
    inferred?: Set<string>;
    englishTaken?: Set<string>;
    grades?: GradeMap;
    /** 직접 체크해 둔 과목 (표시에 체크 아이콘) */
    recorded?: Set<string>;
    /** 손댈 수 없는 과목 — 수집된 학기라 이미 확정된 것들 */
    fixed?: Set<string>;

    focused: string | null;
    onFocus: (name: string) => void;
    onSelect?: (name: string) => void;
}

/**
 * 교육과정 선수관계 그래프.
 *
 * 학과 하나를 고르면 그 학과를 좌→우 흐름으로 그리고, "전체"를 고르면 학과를 가로
 * 레인으로 늘어놓아 학과를 넘는 연결까지 보여줍니다.
 */
const CourseGraph: React.FC<CourseGraphProps> = ({
    courses,
    prerequisites,
    departments,
    department,
    taken,
    current,
    inferred,
    englishTaken,
    grades,
    recorded,
    fixed,
    focused,
    onFocus,
    onSelect,
}) => {
    const isAll = department === ALL_DEPARTMENTS;

    const graph = useMemo<FullGraph | Graph | null>(() => {
        if (!courses.length) return null;
        if (isAll) return layoutFullGraph(courses, prerequisites, departments);
        const scoped = courses.filter((course) => course.department === department);
        if (!scoped.length) return null;
        return layoutGraph(scoped, prerequisites);
    }, [courses, prerequisites, departments, department, isAll]);

    /**
     * 이 판에 안 그려지는 선수 — 다른 학과 것입니다.
     *
     * ⚠️ 예전에는 이런 과목을 판 왼쪽에 함께 그렸는데, 융합 판에 수학·물리 카드가
     * 섞여 나와서 저게 융합 과목인지 아닌지 구별이 안 됐습니다. 지금은 노드 아래에
     * **글로** 답니다.
     */
    const outside = useMemo(() => {
        // 전체 보기는 모든 학과가 이미 판에 있어서 "바깥" 이 없습니다
        if (isAll) return new Map<string, Prereq[]>();
        const scoped = courses.filter((course) => course.department === department);
        return outsidePrereqs(scoped, prerequisites);
    }, [courses, prerequisites, department, isAll]);

    const prereqIndex = useMemo(() => {
        const index = new Map<string, Prereq[]>();
        prerequisites.forEach((edge) => {
            const list = index.get(edge.after);
            if (list) list.push(edge);
            else index.set(edge.after, [edge]);
        });
        return index;
    }, [prerequisites]);

    /** 클릭해 둔 과목 — 그 과목과 바로 이어진 것만 남기고 나머지는 흐려집니다 */
    const [selected, setSelected] = useState<string | null>(null);

    /** 선택한 과목 + 그 선수 + 그 과목이 여는 과목 */
    const related = useMemo(() => {
        if (!selected) return null;
        const set = new Set<string>([selected]);
        prerequisites.forEach((edge) => {
            if (edge.before === selected) set.add(edge.after);
            if (edge.after === selected) set.add(edge.before);
        });
        return set;
    }, [selected, prerequisites]);

    if (!graph) return null;

    const lanes: GraphLane[] = "lanes" in graph ? graph.lanes : [];
    /** 상태를 하나도 안 넘기면 구조만 보여주는 모드 */
    const plain = !taken && !current;

    return (
        <Surface fill="canvas" border="subtle" className="overflow-x-auto p-4">
            <svg
                width={graph.width}
                height={graph.height}
                viewBox={`0 0 ${graph.width} ${graph.height}`}
                style={{ minWidth: graph.width }}
                onClick={(e) => {
                    // 빈 곳을 누르면 강조를 풉니다
                    if (e.target === e.currentTarget) setSelected(null);
                }}
            >
                {/* 학과 레인 — 전체 보기에서만 */}
                {lanes.map((lane) => (
                    <g key={lane.department}>
                        <rect
                            x={-8}
                            y={lane.y - 10}
                            width={graph.width + 16}
                            height={lane.height + 20}
                            strokeWidth={2}
                            style={{ fill: "var(--fk-surface-well)", stroke: "var(--fk-line-subtle)" }}
                        />
                        <Text as="text" variant="overline" x={-4} y={lane.y - 14} fill="currentColor">
                            {lane.department}
                        </Text>
                    </g>
                ))}

                {graph.edges.map((edge) => {
                    const linked =
                        selected !== null &&
                        (edge.before === selected || edge.after === selected);
                    const faded = selected !== null && !linked;
                    return (
                        <path
                            key={`${edge.before}→${edge.after}`}
                            d={edge.path}
                            fill="none"
                            stroke={
                                linked
                                    ? ACCENT_COLORS.pink.solid
                                    : focused === edge.before || focused === edge.after
                                      ? "var(--fk-line-base)"
                                      : "var(--fk-ink-faint)"
                            }
                            // 굵기는 항상 2 — 노드 테두리도 2px 이라, 짚은 선만 굵어지면
                            // 같은 핑크인데 선과 테두리 두께가 어긋납니다
                            strokeWidth={2}
                            strokeOpacity={faded ? 0.15 : 1}
                            strokeDasharray={edge.alternative ? "5 4" : undefined}
                        />
                    );
                })}

                {graph.nodes.map((node) => {
                    const state: CourseState = plain
                        ? "available"
                        : courseState(
                              node.name,
                              taken ?? new Set(),
                              current ?? new Set(),
                              inferred ?? new Set(),
                              prereqIndex,
                          );
                    const tone = state === "inferred" || state === "locked" ? STATE_TONE[state] : undefined;
                    const grade = grades?.[node.name];
                    const togglable = Boolean(onSelect) && !fixed?.has(node.name);
                    const showDept = isAll || node.course.department !== department;
                    const isSelected = node.name === selected;
                    const faded = related !== null && !related.has(node.name);
                    const outsideEdges = outside.get(node.name);
                    const outsideLine = outsideEdges ? prereqLine(outsideEdges) : null;

                    return (
                        <foreignObject
                            key={node.name}
                            x={node.x}
                            y={node.y}
                            width={NODE_WIDTH}
                            height={NODE_HEIGHT}
                            opacity={faded ? 0.25 : 1}
                        >
                            <Pressable
                                motion={focused === node.name || isSelected ? "still" : "raise"}
                                onClick={() => {
                                    // 같은 과목을 다시 누르면 강조를 풉니다
                                    setSelected(isSelected ? null : node.name);
                                    onFocus(node.name);
                                    if (togglable) onSelect?.(node.name);
                                }}
                                onMouseEnter={() => onFocus(node.name)}
                                className={`${isSelected ? SELECTED_FACE : STATE_FACE[state]} w-full h-full px-2 flex flex-col items-start justify-center gap-0.5 text-left`}
                            >
                                <Text as="span" tone={tone} className="flex items-center gap-1 w-full">
                                    {state === "locked" && (
                                        <Icon icon={Lock} size="xs" strokeWidth={3} tone="inherit" className="shrink-0" />
                                    )}
                                    {recorded?.has(node.name) && (
                                        <Icon icon={Check} size="xs" strokeWidth={3} tone="green" className="shrink-0" />
                                    )}
                                    <Text variant="label" truncate>
                                        {node.course.name}
                                    </Text>
                                    {grade && (
                                        <Badge size="sm" variant="paper" className="ml-auto shrink-0">
                                            {grade}
                                        </Badge>
                                    )}
                                </Text>
                                <Text as="span" variant="micro" weight="bold" tone={tone} className="w-full truncate opacity-60">
                                    {/* 다른 학과 선수는 판에 안 그리고 여기 글로 답니다 */}
                                    {outsideLine ? (
                                        <Text variant="micro" weight="bold" tone="purple">
                                            선수 {outsideLine}
                                        </Text>
                                    ) : (
                                        <>
                                            {showDept && !isAll && (
                                                <Text variant="micro" weight="bold" tone="purple">
                                                    {node.course.department}{" · "}
                                                </Text>
                                            )}
                                            {node.course.credits}학점
                                            {englishTaken?.has(node.name) && " · EC 수강"}
                                            {node.course.is_pf && " · P/F"}
                                        </>
                                    )}
                                </Text>
                            </Pressable>
                        </foreignObject>
                    );
                })}
            </svg>
        </Surface>
    );
};

export default CourseGraph;

import React, { useMemo, useState } from "react";
import { Lock, Check } from "lucide-react";
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

const STATE_STYLE: Record<CourseState, { box: string; text: string }> = {
    taken: { box: "bg-retro-green/20 border-retro-green", text: "text-black" },
    current: { box: "bg-retro-accent5/20 border-retro-accent5", text: "text-black" },
    inferred: {
        box: "bg-retro-green/[0.07] border-retro-green border-dashed",
        text: "text-black/60",
    },
    available: { box: "bg-white border-black", text: "text-black" },
    locked: { box: "bg-black/[0.04] border-black/20", text: "text-black/35" },
};

export const CourseGraphLegend: React.FC<{ states?: CourseState[] }> = ({
    states = ["taken", "current", "inferred", "available", "locked"],
}) => (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
        {states.map((state) => (
            <span key={state} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 border-2 ${STATE_STYLE[state].box}`} />
                {COURSE_STATE_LABEL[state]}
            </span>
        ))}
    </div>
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
        <div className="overflow-x-auto border-2 border-black/10 bg-retro-bg/40 p-4">
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
                            fill="rgba(0,0,0,0.025)"
                            stroke="rgba(0,0,0,0.1)"
                            strokeWidth={2}
                        />
                        <text
                            x={-4}
                            y={lane.y - 14}
                            className="text-[10px] font-black uppercase"
                            fill="rgba(0,0,0,0.45)"
                            style={{ letterSpacing: "0.12em" }}
                        >
                            {lane.department}
                        </text>
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
                                    ? "#ff4eba"
                                    : focused === edge.before || focused === edge.after
                                      ? "#000000"
                                      : "rgba(0,0,0,0.25)"
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
                    const style = STATE_STYLE[state];
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
                            <button
                                onClick={() => {
                                    // 같은 과목을 다시 누르면 강조를 풉니다
                                    setSelected(isSelected ? null : node.name);
                                    onFocus(node.name);
                                    if (togglable) onSelect?.(node.name);
                                }}
                                onMouseEnter={() => onFocus(node.name)}
                                className={`w-full h-full border-2 px-2 flex flex-col items-start justify-center gap-0.5 text-left cursor-pointer transition-all duration-100 ${
                                    isSelected
                                        ? "bg-retro-primary/25 border-retro-primary text-black"
                                        : `${style.box} ${style.text}`
                                } hover:shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] ${
                                    focused === node.name || isSelected
                                        ? "shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
                                        : ""
                                }`}
                            >
                                <span className="flex items-center gap-1 w-full">
                                    {state === "locked" && (
                                        <Lock size={10} strokeWidth={3} className="shrink-0" />
                                    )}
                                    {recorded?.has(node.name) && (
                                        <Check
                                            size={10}
                                            strokeWidth={3}
                                            className="shrink-0 text-retro-green"
                                        />
                                    )}
                                    <span className="text-[11px] font-black truncate">
                                        {node.course.name}
                                    </span>
                                    {grade && (
                                        <span className="ml-auto shrink-0 border-2 border-black bg-white px-1 text-[9px] font-black">
                                            {grade}
                                        </span>
                                    )}
                                </span>
                                <span className="w-full truncate text-[9px] font-bold opacity-60">
                                    {/* 다른 학과 선수는 판에 안 그리고 여기 글로 답니다 */}
                                    {outsideLine ? (
                                        <span className="text-retro-secondary">
                                            선수 {outsideLine}
                                        </span>
                                    ) : (
                                        <>
                                            {showDept && !isAll && (
                                                <span className="text-retro-secondary">
                                                    {node.course.department}{" · "}
                                                </span>
                                            )}
                                            {node.course.credits}학점
                                            {englishTaken?.has(node.name) && " · EC 수강"}
                                            {node.course.is_pf && " · P/F"}
                                        </>
                                    )}
                                </span>
                            </button>
                        </foreignObject>
                    );
                })}
            </svg>
        </div>
    );
};

export default CourseGraph;

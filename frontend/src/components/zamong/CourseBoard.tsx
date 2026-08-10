/**
 * 학과 시트 하나 — 워크북의 학과 탭을 옮긴 판입니다.
 *
 * 가로 위치가 **선수 깊이**입니다. 왼쪽 끝이 선수 없는 과목이고, 오른쪽으로 갈수록
 * 그 위에 쌓입니다. 워크북이 셀 배경색으로 그려 둔 선을 우리는 이미 데이터로 읽어
 * 뒀으므로(`curriculum_seed.json`), 같은 모양이 계산으로 나옵니다.
 *
 * ⚠️ **`foreignObject`를 쓰지 않습니다.** 카드 안에 진짜 `<select>`가 둘 들어 있는데,
 * SVG 안에 넣으면 브라우저마다 드롭다운이 열리는 위치가 어긋납니다. 선만 SVG로 뒤에
 * 깔고 카드는 그 위에 절대 배치합니다.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    buildPrereqIndex,
    outsidePrereqs,
    prereqLine,
    prereqSatisfied,
    type Course,
    type Prereq,
} from "../../lib/curriculum";
import {
    CARD_HEIGHT,
    CARD_WIDTH,
    layoutBoard,
    type TermSlot,
    type ZamongEntry,
    type ZamongMap,
} from "../../lib/zamong";
import CourseCard from "./CourseCard";

interface CourseBoardProps {
    courses: Course[];
    prerequisites: Prereq[];
    department: string;
    entries: ZamongMap;
    slots: TermSlot[];
    focused: string | null;
    onFocus: (name: string) => void;
    onChange: (name: string, patch: Partial<ZamongEntry>) => void;
}

const CourseBoard: React.FC<CourseBoardProps> = ({
    courses,
    prerequisites,
    department,
    entries,
    slots,
    focused,
    onFocus,
    onChange,
}) => {
    /**
     * 눌러 둔 과목 — 그 과목에 이어진 **선**을 핑크로 세웁니다.
     *
     * ⚠️ **카드는 흐리게 만들지 않습니다.** 한때 이어지지 않은 카드를 `opacity-15` 로
     * 지웠는데, 한 장을 누를 때마다 판이 통째로 하얘져서 방금 뭘 보고 있었는지까지
     * 사라졌습니다. 선만 골라 세워도 어디로 이어지는지는 충분히 보입니다.
     */
    const [traced, setTraced] = useState<string | null>(null);

    /** 어느 쪽으로 더 스크롤할 수 있는지 — 가장자리 그림자를 켜고 끕니다 */
    const scrollRef = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ left: false, right: false });
    const syncEdges = useCallback(() => {
        const box = scrollRef.current;
        if (!box) return;
        setEdges({
            left: box.scrollLeft > 4,
            right: box.scrollLeft + box.clientWidth < box.scrollWidth - 4,
        });
    }, []);

    const scoped = useMemo(
        () => courses.filter((course) => course.department === department),
        [courses, department],
    );

    const graph = useMemo(
        () => (scoped.length ? layoutBoard(scoped, prerequisites) : null),
        [scoped, prerequisites],
    );

    /** 이 판에 안 그려지는 선수 — 카드가 글로 답니다 */
    const outside = useMemo(
        () => outsidePrereqs(scoped, prerequisites),
        [scoped, prerequisites],
    );

    const prereqIndex = useMemo(() => buildPrereqIndex(prerequisites), [prerequisites]);

    /** 학기를 고른 과목 전부 — 선수 판정은 학과를 넘나듭니다 */
    const taken = useMemo(
        () =>
            new Set(
                Object.entries(entries)
                    .filter(([, entry]) => entry.term)
                    .map(([name]) => name),
            ),
        [entries],
    );

    /**
     * ⚠️ 한 번만 재면 안 됩니다. 이 판은 좁은 화면에서 `hidden` 이라 폭이 **0** 으로
     * 잡히는데, 창을 넓혀 판이 나타나도 학과가 그대로면 다시 잴 일이 없어 그림자가
     * 영영 안 켜집니다. 창 크기가 아니라 **이 상자**를 지켜봐야 그 전환까지 잡힙니다.
     */
    useEffect(() => {
        const box = scrollRef.current;
        if (!box) return;
        syncEdges();
        const observer = new ResizeObserver(syncEdges);
        observer.observe(box);
        return () => observer.disconnect();
    }, [syncEdges, graph]);

    if (!graph) {
        return (
            <p className="p-6 text-center text-xs font-bold text-black/40">
                이 학과에는 등록된 과목이 없습니다.
            </p>
        );
    }

    /** 카드 한 장 — 사다리와 좁은 화면 목록이 같은 것을 그립니다 */
    const renderNode = (node: (typeof graph.nodes)[number]) => {
        const edges = outside.get(node.name);
        return (
            <CourseCard
                course={node.course}
                entry={entries[node.name]}
                slots={slots}
                unlocked={prereqSatisfied(node.name, taken, prereqIndex)}
                focused={focused === node.name}
                outsidePrereq={edges ? prereqLine(edges) : null}
                onFocus={onFocus}
                onChange={onChange}
            />
        );
    };

    /**
     * 좁은 화면 — 사다리를 접고 **단 순서대로** 늘어놓습니다.
     *
     * 390px 에서 1100×1240 짜리 판을 두 방향으로 굴리게 하면 화면에 늘 빈 데가
     * 잡히고, 정작 어느 카드를 보고 있는지도 모릅니다. 가로 위치가 뜻하던 "선수
     * 깊이"는 **읽는 순서**가 대신 말해 주고, 선수관계 자체는 과목을 눌렀을 때 아래
     * 상세에 글로 나옵니다.
     */
    const ordered = [...graph.nodes].sort((a, b) => a.x - b.x || a.y - b.y);

    /**
     * 판 안에 선이 하나도 없으면 **사다리가 아니라 목록**입니다.
     *
     * 융합이 그렇습니다 — 선수가 전부 다른 학과라 이 판 안에서는 이어지는 게 없고,
     * 그런데도 사다리로 그리면 열이 하나뿐이라 카드 열여섯 장이 세로로 죽 늘어서서
     * 오른쪽이 통째로 빕니다. 예체능·국어처럼 선수관계가 옅은 학과도 마찬가지입니다.
     */
    const isLadder = graph.edges.length > 0;

    const grid = (
        <div className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {ordered.map((node) => (
                <div key={node.name} style={{ height: CARD_HEIGHT }}>
                    {renderNode(node)}
                </div>
            ))}
        </div>
    );

    if (!isLadder) return grid;

    return (
        // 판에 테두리를 두르지 않습니다 — 바깥이 이미 카드라 여기 선을 하나 더 그으면
        // 카드 안의 카드가 됩니다 (`design-guide.md`). 판이 **흰 바탕**인 건 색 때문인데,
        // 크림색을 깔면 그 위의 파스텔 카드가 색이 밀려 워크북과 달라 보입니다.
        //
        // 오른쪽 끝이 잘리는 걸 그냥 두면 고장난 것처럼 보이므로, 스크롤이 남았을 때만
        // 가장자리에 그림자를 겁니다 (`overflow` 위의 배경 트릭이 아니라 실제 스크롤에
        // 반응해야 해서 CSS 만으로는 안 됩니다)
        <div className="relative">
            <div className="md:hidden">{grid}</div>

            <div
                ref={scrollRef}
                onScroll={syncEdges}
                className="hidden overflow-x-auto py-2 md:block"
            >
            <div
                className="relative"
                style={{ width: graph.width, height: graph.height, minWidth: graph.width }}
                onClick={(event) => {
                    if (event.target === event.currentTarget) setTraced(null);
                }}
            >
                <svg
                    className="pointer-events-none absolute inset-0"
                    width={graph.width}
                    height={graph.height}
                >
                    {graph.edges.map((edge) => {
                        const linked =
                            traced !== null && (edge.before === traced || edge.after === traced);
                        const touched = focused === edge.before || focused === edge.after;
                        return (
                            <path
                                key={`${edge.before}→${edge.after}`}
                                d={edge.path}
                                fill="none"
                                stroke={linked ? "#ff4eba" : touched ? "#000000" : "rgba(0,0,0,0.32)"}
                                strokeWidth={linked ? 3 : 2}
                                strokeOpacity={traced !== null && !linked ? 0.12 : 1}
                                strokeDasharray={edge.alternative ? "5 4" : undefined}
                            />
                        );
                    })}
                </svg>

                {graph.nodes.map((node) => (
                    <div
                        key={node.name}
                        className="absolute"
                        style={{
                            left: node.x,
                            top: node.y,
                            width: CARD_WIDTH,
                            height: CARD_HEIGHT,
                        }}
                        onClick={() => setTraced(traced === node.name ? null : node.name)}
                    >
                        {renderNode(node)}
                    </div>
                ))}
            </div>
            </div>

            {edges.left && (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/20 to-transparent" />
            )}
            {edges.right && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/20 to-transparent" />
            )}
        </div>
    );
};

export default CourseBoard;

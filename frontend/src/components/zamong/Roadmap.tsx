/**
 * 로드맵 — 워크북의 `Zamong` 시트를 그대로 옮긴 판. **화면 맨 위에 늘 있습니다.**
 *
 * ## ⚠️ 원본의 모양을 바꾸지 마세요
 *
 * 이 화면의 목적은 "엑셀과 같은 경험"입니다. 여기 막대 그래프도, 통계 카드도, 큰
 * 숫자도 넣지 마세요 — 원본은 **숫자 격자 두 개**입니다. 실제로 한 번씩 다 해 봤고
 * 전부 되돌렸습니다:
 *
 * - 계열별 요건을 막대로 → 아홉 줄이 화면 절반을 먹고, 정작 옆칸과 비교가 안 됩니다.
 *   표에서는 `72 / 67` 이 한 눈에 들어옵니다
 * - 학점·평점을 큰 숫자(`RetroStatItem` 풍)로 → 워크북에 없는 위계가 생기고, 학기별
 *   표와 두 번 말합니다
 * - 카드 셋으로 분리 → 같은 이야기의 앞뒤가 흩어집니다
 *
 * 워크북 좌표 그대로:
 *
 * ```
 * 행 2~5   학기 │ 1~6학기 · 계절 │ KAIST AP · 수과학 GPA · OVERALL GPA
 *          → 총 학점 / 만족여부 / GPA
 * 행 7~10  계열 │ 자연 인문 융합 계 EC · 자기계발 협업 세계시민 총 시수 │ 졸업?
 *          → 총 학점 / 졸업요건 / 만족여부
 * 행 14~22 학기별 과목 목록 + EC 목록
 * ```
 *
 * 문구도 원본 것입니다 — `좋아요`/`맞추세요`, `졸업가능`/`더 채우세요`, `응 안돼`.
 *
 * ⚠️ **학교 수강 이력이 아닙니다.** 여기 나오는 건 전부 본인이 학과 판에서 카드에 적은
 * 것입니다. 경계는 `lib/zamong.guide.md` 를 보세요.
 */

import React, { useState } from "react";
import { Route } from "lucide-react";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";
import {
    REGULAR_TERMS,
    type HourInput,
    type TermKey,
    type ZamongSummary,
} from "../../lib/zamong";

interface RoadmapProps {
    summary: ZamongSummary;
    hours: HourInput;
    onHoursChange: (patch: Partial<HourInput>) => void;
    /** 과목을 누르면 그 학과 판으로 갑니다 */
    onOpenCourse: (name: string) => void;
    /** 과목을 끌어다 다른 학기에 놓았을 때 */
    onMoveCourse: (course: string, term: TermKey) => void;
}

/** 표 머리 칸 */
const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = "",
}) => (
    <th
        className={`px-1.5 py-1 text-[9.5px] font-black uppercase tracking-wider text-black/40 ${className}`}
    >
        {children}
    </th>
);

/** 행 이름 — 왼쪽 첫 칸 */
const Rh: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <th className="whitespace-nowrap py-1 pr-2 text-left text-[9.5px] font-black uppercase tracking-widest text-black/40">
        {children}
    </th>
);

/** 값 칸. 빈 칸(표를 가로로 맞추기만 하는 자리)도 있어서 `children` 은 선택입니다 */
const Td: React.FC<{ children?: React.ReactNode; className?: string; title?: string }> = ({
    children,
    className = "",
    title,
}) => (
    <td
        title={title}
        className={`px-1.5 py-1 text-center text-[11px] font-black tabular-nums ${className}`}
    >
        {children}
    </td>
);

/** 워크북의 만족여부 칸 — 문구까지 원본 그대로입니다 */
const Verdict: React.FC<{
    ok: boolean;
    yes: string;
    no: string;
    muted?: boolean;
    borderLeft?: boolean;
}> = ({ ok, yes, no, muted = false, borderLeft = false }) => (
    <Td
        className={`${borderLeft ? "border-l border-black/10 " : ""}${
            muted ? "text-black/20" : ok ? "text-retro-green" : "text-retro-primary"
        }`}
    >
        {muted ? "—" : ok ? yes : no}
    </Td>
);

const num = (value: number) => (value === 0 ? "—" : value);

const Roadmap: React.FC<RoadmapProps> = ({
    summary,
    hours,
    onHoursChange,
    onOpenCourse,
    onMoveCourse,
}) => {
    const credit = (key: string) => summary.creditRequirements.find((row) => row.key === key);
    const hour = (key: string) => summary.hourRequirements.find((row) => row.key === key);

    // 워크북 `K10` — 숫자 요건을 다 채웠는지. 트랙은 우리가 판정하지 않으므로 다
    // 채웠어도 "가능!" 이라고 못 하고, 원본의 `트랙 필요` 를 씁니다
    const numbersReady = summary.creditsReady && summary.hoursReady;

    const HOUR_FIELDS: { key: keyof HourInput; label: string }[] = [
        { key: "self_dev", label: "자기계발" },
        { key: "collab", label: "협업" },
        { key: "global", label: "세계시민" },
    ];

    // 7·8학기는 휴학 자리라 담은 게 있을 때만 나옵니다
    const terms = summary.terms.filter(
        (term) => term.key === "S" || Number(term.key) <= REGULAR_TERMS || term.courses.length > 0,
    );

    return (
        <RetroCard className="bg-white">
            <div className="flex items-center gap-3 border-b-2 border-black/10 px-4 py-2 md:px-6">
                <RetroSubTitle title="Roadmap" icon={Route} iconSize={15} />
            </div>

            {/* ── 워크북 행 2~5 · 학기별 ───────────────────────────────────── */}
            <div className="overflow-x-auto border-b border-black/10 px-4 py-2 md:px-6">
                <table className="w-full min-w-[44rem] border-collapse">
                    <thead>
                        <tr className="border-b border-black/10">
                            <Rh>학기</Rh>
                            {terms.map((term) => (
                                <Th key={term.key}>{term.key === "S" ? "계절" : term.key}</Th>
                            ))}
                            <Th className="border-l border-black/10">KAIST AP</Th>
                            <Th>수과학 GPA</Th>
                            <Th>Overall GPA</Th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <Rh>총 학점</Rh>
                            {terms.map((term) => (
                                <Td
                                    key={term.key}
                                    className={term.credits === 0 ? "text-black/20" : ""}
                                >
                                    {num(term.credits)}
                                </Td>
                            ))}
                            <Td
                                className={`border-l border-black/10 ${
                                    summary.apCredits === 0 ? "text-black/20" : ""
                                }`}
                            >
                                {num(summary.apCredits)}
                            </Td>
                            <Td className={summary.naturalGpa === null ? "text-black/20" : ""}>
                                {summary.naturalGpa === null ? "—" : summary.naturalGpa.toFixed(2)}
                            </Td>
                            <Td className={summary.overallGpa === null ? "text-black/20" : ""}>
                                {summary.overallGpa === null ? "—" : summary.overallGpa.toFixed(2)}
                            </Td>
                        </tr>
                        <tr>
                            <Rh>만족여부</Rh>
                            {terms.map((term) => (
                                <Verdict
                                    key={term.key}
                                    ok={term.ok}
                                    yes="좋아요"
                                    no="맞추세요"
                                    muted={term.credits === 0}
                                />
                            ))}
                            <Td className="border-l border-black/10" />
                            <Td />
                            <Td />
                        </tr>
                        <tr>
                            <Rh>GPA</Rh>
                            {terms.map((term) => (
                                <Td
                                    key={term.key}
                                    className={term.gpa === null ? "text-black/20" : "text-black/60"}
                                >
                                    {term.gpa === null ? "—" : term.gpa.toFixed(2)}
                                </Td>
                            ))}
                            <Td className="border-l border-black/10" />
                            <Td />
                            <Td />
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── 워크북 행 7~10 · 졸업 요건 ───────────────────────────────── */}
            <div className="overflow-x-auto border-b-2 border-black/10 px-4 py-2 md:px-6">
                <table className="w-full min-w-[44rem] border-collapse">
                    <thead>
                        <tr className="border-b border-black/10">
                            <Rh> </Rh>
                            <Th>자연</Th>
                            <Th>인문</Th>
                            <Th>융합</Th>
                            <Th>계</Th>
                            <Th>EC</Th>
                            <Th className="border-l border-black/10">자기계발</Th>
                            <Th>협업</Th>
                            <Th>세계시민</Th>
                            <Th>총 시수</Th>
                            <Th className="border-l border-black/10">졸업?</Th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <Rh>총 학점</Rh>
                            {["natural", "humanities", "convergence", "total", "ec"].map((key) => {
                                const row = credit(key);
                                return (
                                    <Td
                                        key={key}
                                        className={row?.earned === 0 ? "text-black/20" : ""}
                                    >
                                        {num(row?.earned ?? 0)}
                                    </Td>
                                );
                            })}
                            {HOUR_FIELDS.map((field, index) => (
                                <td
                                    key={field.key}
                                    className={`px-1 py-0.5 text-center ${
                                        index === 0 ? "border-l border-black/10" : ""
                                    }`}
                                >
                                    {/* 비교과 시수는 어디에도 데이터가 없어 본인이 적습니다.
                                        워크북에서도 사람이 직접 치는 칸입니다 */}
                                    <input
                                        type="number"
                                        min={0}
                                        max={999}
                                        value={hours[field.key] || ""}
                                        placeholder="—"
                                        aria-label={`${field.label} 시수`}
                                        onChange={(event) =>
                                            onHoursChange({
                                                [field.key]: Math.max(
                                                    0,
                                                    Math.min(999, Number(event.target.value) || 0),
                                                ),
                                            })
                                        }
                                        className="w-full min-w-0 border-2 border-black/15 bg-white px-1 py-0.5 text-center text-[11px] font-black tabular-nums outline-none transition-colors duration-100 placeholder:text-black/20 focus:border-black"
                                    />
                                </td>
                            ))}
                            <Td className={hour("total")?.earned === 0 ? "text-black/20" : ""}>
                                {num(hour("total")?.earned ?? 0)}
                            </Td>
                            <Td className="border-l border-black/10" />
                        </tr>
                        <tr>
                            <Rh>졸업요건</Rh>
                            {["natural", "humanities", "convergence", "total", "ec"].map((key) => (
                                <Td key={key} className="font-bold text-black/35">
                                    {credit(key)?.required ?? 0}
                                </Td>
                            ))}
                            {HOUR_FIELDS.map((field, index) => (
                                <Td
                                    key={field.key}
                                    className={`font-bold text-black/35 ${
                                        index === 0 ? "border-l border-black/10" : ""
                                    }`}
                                >
                                    {hour(field.key)?.required ?? 60}
                                </Td>
                            ))}
                            <Td className="font-bold text-black/35">
                                {hour("total")?.required ?? 270}
                            </Td>
                            <Td className="border-l border-black/10" />
                        </tr>
                        <tr>
                            <Rh>만족여부</Rh>
                            {["natural", "humanities", "convergence", "total", "ec"].map((key) => (
                                <Verdict
                                    key={key}
                                    ok={Boolean(credit(key)?.met)}
                                    yes="졸업가능"
                                    no="더 채우세요"
                                />
                            ))}
                            {HOUR_FIELDS.map((field, index) => (
                                <Verdict
                                    key={field.key}
                                    ok={Boolean(hour(field.key)?.met)}
                                    yes="졸업가능"
                                    no="더 채우세요"
                                    borderLeft={index === 0}
                                />
                            ))}
                            <Verdict
                                ok={Boolean(hour("total")?.met)}
                                yes="졸업가능"
                                no="더 채우세요"
                            />
                            {/* 워크북 `K10`. 트랙은 판정하지 않으므로 다 채워도 "가능!" 이
                                아니라 원본의 `트랙 필요` 까지만 갑니다 */}
                            <Td
                                className={`border-l border-black/10 ${
                                    numbersReady ? "text-retro-green" : "text-retro-primary"
                                }`}
                                title={
                                    numbersReady
                                        ? "숫자 요건은 다 찼습니다. 학과 트랙은 아래 판마다 적어 둔 조건으로 직접 확인해주세요"
                                        : undefined
                                }
                            >
                                {numbersReady ? "트랙 필요" : "응 안돼"}
                            </Td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── 워크북 행 14~22 · 학기별 과목 ────────────────────────────── */}
            <div className="divide-y divide-black/10">
                {terms.map((term) => (
                    <TermRow
                        key={term.key}
                        name={term.key === "S" ? "계절학기" : term.label}
                        courses={term.courses}
                        dropTerm={term.key}
                        onOpenCourse={onOpenCourse}
                        onDropCourse={onMoveCourse}
                    />
                ))}
                <TermRow
                    name="EC"
                    courses={summary.ecCourses}
                    emptyText="영어강의로 들은 과목이 없습니다"
                    onOpenCourse={onOpenCourse}
                />
            </div>
        </RetroCard>
    );
};

/**
 * 학기 한 줄 — 워크북에서는 학기 이름 옆에 과목명이 쉼표로 이어진 한 칸입니다.
 * 여기서는 누를 수 있어야 해서 조각으로 나눴지만, **테두리는 두르지 않습니다** —
 * 스무 개가 전부 상자면 같은 무게로 떠듭니다.
 *
 * **과목을 끌어다 다른 학기에 놓을 수 있습니다.** 학과 판까지 가서 학기 칸을 다시
 * 고르는 것보다, 이미 늘어서 있는 목록에서 옮기는 게 빠릅니다. 카드의 학기 칸과
 * 같은 값을 건드리므로 둘 중 어느 쪽으로 해도 결과는 같습니다.
 *
 * ⚠️ 끌기는 **마우스에서만** 됩니다 (HTML5 drag & drop). 손가락으로는 학과 판의 학기
 * 칸을 쓰면 되고, 그쪽이 원래 방식이라 잃는 게 없습니다.
 */
const TermRow: React.FC<{
    name: string;
    courses: string[];
    /** 놓을 수 있는 학기. EC 줄처럼 학기가 아닌 줄은 비워 둡니다 */
    dropTerm?: TermKey;
    emptyText?: string;
    onOpenCourse: (name: string) => void;
    onDropCourse?: (course: string, term: TermKey) => void;
}> = ({ name, courses, dropTerm, emptyText = "비어 있습니다", onOpenCourse, onDropCourse }) => {
    const [over, setOver] = useState(false);
    const droppable = Boolean(dropTerm && onDropCourse);

    return (
        <div
            onDragOver={(event) => {
                if (!droppable) return;
                // preventDefault 를 해야 브라우저가 "여기 놓을 수 있다" 로 칩니다
                event.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
                if (!droppable) return;
                event.preventDefault();
                setOver(false);
                const course = event.dataTransfer.getData("text/plain");
                if (course) onDropCourse!(course.replace(/\(EC\)$/, ""), dropTerm!);
            }}
            className={`flex flex-col gap-1 px-4 py-1.5 transition-colors duration-100 md:flex-row md:items-baseline md:gap-3 md:px-6 ${
                over ? "bg-retro-primary/15" : ""
            }`}
        >
            <span
                className={`w-16 shrink-0 text-[10px] font-black uppercase tracking-widest ${
                    courses.length ? "text-black" : "text-black/25"
                }`}
            >
                {name}
            </span>
            {courses.length === 0 ? (
                <p className="text-[11px] font-bold text-black/25">
                    {over ? "여기에 놓기" : emptyText}
                </p>
            ) : (
                <div className="flex min-w-0 flex-wrap gap-x-1 gap-y-0.5">
                    {courses.map((course) => (
                        <button
                            key={course}
                            type="button"
                            draggable={droppable}
                            onDragStart={(event) => {
                                event.dataTransfer.setData("text/plain", course);
                                event.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => onOpenCourse(course.replace(/\(EC\)$/, ""))}
                            className={`px-1 text-[11px] font-bold transition-colors duration-100 hover:bg-retro-primary/25 ${
                                droppable ? "cursor-grab active:cursor-grabbing" : ""
                            }`}
                        >
                            {course}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Roadmap;

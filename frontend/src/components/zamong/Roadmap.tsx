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

import React, { useMemo, useState } from "react";
import { Route } from "lucide-react";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";
import type { Course } from "../../lib/curriculum";
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
    /** 과목을 끌어다 놓거나, 빈 자리에서 찾아 넣었을 때 */
    onMoveCourse: (course: string, term: TermKey) => void;
    /** 넣을 수 있는 과목 전체 */
    catalog: Course[];
}

/**
 * 표 머리 칸.
 *
 * ⚠️ **높이는 `h-7` 로 못 박고 `align-middle` 로 가운데 둡니다.** 패딩만 주고 높이를
 * 줄 높이(line-height)에 맡기면 셀마다 다른 값이 나옵니다 — 11px 헤더는 25px, 13px
 * 글자는 27.5px, 입력칸이 든 칸은 28px 이 돼서 표가 들쭉날쭉해집니다.
 */
const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = "",
}) => (
    <th
        className={`h-7 px-2 align-middle text-[11px] font-black uppercase tracking-wider text-black/45 ${className}`}
    >
        {children}
    </th>
);

/** 행 이름 — 왼쪽 첫 칸 */
const Rh: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <th className="h-7 whitespace-nowrap pr-3 text-left align-middle text-[11px] font-black uppercase tracking-widest text-black/45">
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
        className={`h-7 px-2 text-center align-middle text-[13px] font-black tabular-nums ${className}`}
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
    catalog,
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
                <RetroSubTitle title="Roadmap" icon={Route} iconSize={18} />
            </div>

            {/* ── 워크북 행 2~5 · 학기별 ───────────────────────────────────── */}
            <div className="overflow-x-auto border-b border-black/10 px-4 py-1.5 md:px-6">
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
            <div className="overflow-x-auto border-b-2 border-black/10 px-4 py-1.5 md:px-6">
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
                                    className={`h-7 px-2 text-center align-middle ${
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
                                        // ⚠️ 테두리도 스피너도 없습니다. 이 셋만 상자를 두르고 있으니 옆칸(총 시수·
                                        // 계열 학점)과 어긋나 보였습니다 — 여기 있는 건 전부 숫자이고,
                                        // 이 셋만 **고칠 수 있다**는 건 손을 올렸을 때 알면 됩니다
                                        // ⚠️ `block` 이어야 합니다. 인라인이면 글자 아래 여백까지 셀
                                        // 높이에 들어가 이 줄만 두툼해집니다. 세로 위치는 셀의
                                        // `align-middle` 이 잡아 주므로 여기서 높이를 맞출 필요는 없습니다
                                        className="block w-full min-w-0 bg-transparent p-0 text-center text-[13px] font-black leading-5 tabular-nums outline-none [appearance:textfield] placeholder:text-black/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                        credits={term.credits}
                        ok={term.ok}
                        courses={term.courses}
                        dropTerm={term.key}
                        catalog={catalog}
                        onOpenCourse={onOpenCourse}
                        onDropCourse={onMoveCourse}
                    />
                ))}
                <TermRow
                    name="EC"
                    credits={summary.credits.ec}
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
 * 할 수 있는 게 셋입니다.
 *
 * 1. **끌어다 다른 학기에 놓기** — 학과 판까지 가서 학기 칸을 다시 고르는 것보다
 *    빠릅니다. 카드의 학기 칸과 같은 값을 건드리므로 결과는 같습니다
 * 2. **빈 자리를 눌러 과목 넣기** — 학과가 어디였는지 기억이 안 나도 이름만 치면
 *    됩니다. 학과 판을 뒤지는 것보다 이쪽이 짧습니다
 * 3. 과목을 눌러 그 학과 판으로 가기
 *
 * ⚠️ 끌기는 **마우스에서만** 됩니다 (HTML5 drag & drop). 손가락으로는 눌러서 넣거나
 * 학과 판의 학기 칸을 쓰면 되고, 둘 다 같은 값을 건드립니다.
 */
const TermRow: React.FC<{
    name: string;
    /** 학점·범위 판정 — EC 줄은 학점만 옵니다 */
    credits: number;
    ok?: boolean;
    courses: string[];
    /** 놓을 수 있는 학기. EC 줄처럼 학기가 아닌 줄은 비워 둡니다 */
    dropTerm?: TermKey;
    emptyText?: string;
    /** 넣을 수 있는 과목 전체 — 검색 목록입니다 */
    catalog?: Course[];
    onOpenCourse: (name: string) => void;
    onDropCourse?: (course: string, term: TermKey) => void;
}> = ({
    name,
    credits,
    ok = true,
    courses,
    dropTerm,
    emptyText = "비어 있습니다",
    catalog = [],
    onOpenCourse,
    onDropCourse,
}) => {
    const [over, setOver] = useState(false);
    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const editable = Boolean(dropTerm && onDropCourse);

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];
        return catalog
            .filter(
                (course) =>
                    course.name.toLowerCase().includes(needle) ||
                    (course.english_name ?? "").toLowerCase().includes(needle),
            )
            .slice(0, 8);
    }, [catalog, query]);

    const pick = (course: string) => {
        onDropCourse?.(course, dropTerm!);
        setQuery("");
    };

    /**
     * 학점은 **줄 맨 오른쪽**입니다.
     *
     * 이름 옆에 두면 이름 폭을 고정해야 `계절학기` 줄에서 안 밀리는데, 그러면 짧은
     * 이름 뒤로 빈 자리가 길게 남습니다. 오른쪽에 세우면 줄마다 한 열로 서면서 그
     * 빈 자리가 과목 자리로 갑니다.
     */
    const creditLabel = (
        <span
            className={`text-[12px] font-black tabular-nums ${
                credits === 0
                    ? "text-black/20"
                    : ok
                      ? "text-black/45"
                      : "bg-retro-primary/25 px-1 text-black"
            }`}
            title={ok ? undefined : "한 학기 학점이 10~30 범위를 벗어났습니다"}
        >
            {credits === 0 ? "—" : `${credits}학점`}
        </span>
    );

    return (
        <div
            onDragOver={(event) => {
                if (!editable) return;
                // preventDefault 를 해야 브라우저가 "여기 놓을 수 있다" 로 칩니다
                event.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
                if (!editable) return;
                event.preventDefault();
                setOver(false);
                const course = event.dataTransfer.getData("text/plain");
                if (course) onDropCourse!(course.replace(/\(EC\)$/, ""), dropTerm!);
            }}
            className={`flex flex-col gap-0.5 px-4 py-[3px] transition-colors duration-100 md:flex-row md:items-start md:gap-3 md:px-6 ${
                over ? "bg-retro-primary/15" : ""
            }`}
        >
            {/* ⚠️ 오른쪽 첫 줄과 **같은 높이 상자** 안에서 가운데 정렬합니다. 예전에는
                `items-baseline` + `pt-1` 로 눈대중해 놨는데, 오른쪽 줄 높이는 입력칸이
                정해서(그리고 줄이 접히면 더 커져서) 기준선이 매번 어긋났습니다 */}
            <div className="flex h-7 shrink-0 items-center justify-between md:w-[4.5rem] md:justify-start">
                <span
                    className={`text-[12px] font-black uppercase tracking-widest ${
                        courses.length ? "text-black" : "text-black/25"
                    }`}
                >
                    {name}
                </span>
                {/* 좁은 화면에서는 줄이 세로로 쌓여서 오른쪽 끝이라는 게 없습니다 —
                    그때만 이름 옆에 붙입니다 */}
                <span className="md:hidden">{creditLabel}</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                {courses.map((course) => (
                    <button
                        key={course}
                        type="button"
                        draggable={editable}
                        onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", course);
                            event.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onOpenCourse(course.replace(/\(EC\)$/, ""))}
                        // 세로 크기는 **상자 높이**로 잡습니다. 패딩으로 키우면 글자만큼만
                        // 커져서 핑크 면이 글씨에 달라붙은 것처럼 보입니다
                        className={`flex h-7 items-center px-1.5 text-[13px] font-bold transition-colors duration-100 hover:bg-retro-primary/25 ${
                            editable ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                    >
                        {course}
                    </button>
                ))}

                {!editable && courses.length === 0 && (
                    <span className="flex h-7 items-center text-[13px] font-bold text-black/25">{emptyText}</span>
                )}

                {/*
                 * 남는 자리가 그대로 입력칸입니다.
                 *
                 * 처음에는 "+ 과목 넣기" 버튼을 눌러야 입력칸이 나오게 했는데, 누르는
                 * 단계가 하나 더 있을 뿐 하는 일이 같습니다. **테두리 없는 입력칸**으로
                 * 두면 눌러서 바로 치면 되고, 줄에 손을 올리면 테두리가 떠서 여기에
                 * 쓸 수 있다는 게 보입니다.
                 */}
                {editable && (
                    <div className="relative min-w-[9rem] flex-1">
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => {
                                setFocused(false);
                                setQuery("");
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") event.currentTarget.blur();
                                // 한글 IME 는 조합 중에도 Enter 를 흘려보냅니다
                                if (
                                    event.key === "Enter" &&
                                    !event.nativeEvent.isComposing &&
                                    matches[0]
                                ) {
                                    pick(matches[0].name);
                                }
                            }}
                            placeholder={over ? "여기에 놓기" : courses.length ? "과목 넣기" : emptyText}
                            // 테두리도, 호버·포커스 표시도 없습니다. 여기서 바뀌는 건 placeholder 뿐이고,
                            // 칠 수 있다는 건 커서가 말합니다
                            className="h-7 w-full bg-transparent px-1.5 text-[13px] font-bold outline-none placeholder:font-bold placeholder:text-black/25"
                        />
                        {focused && matches.length > 0 && (
                            <div className="absolute left-0 top-8 z-20 max-h-64 w-full min-w-[16rem] overflow-y-auto border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                                {matches.map((course) => (
                                    <button
                                        key={course.name}
                                        type="button"
                                        // blur 가 먼저 돌면 목록이 닫혀 클릭이 안 먹습니다
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => pick(course.name)}
                                        className="flex w-full items-baseline gap-2 border-b border-black/10 px-2 py-1.5 text-left last:border-b-0 hover:bg-retro-primary/20"
                                    >
                                        <span className="text-[13px] font-black">{course.name}</span>
                                        <span className="ml-auto shrink-0 text-[12px] font-bold text-black/40">
                                            {course.department} · {course.credits}학점
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="hidden h-7 w-16 shrink-0 items-center justify-end md:flex">
                {creditLabel}
            </div>
        </div>
    );
};

export default Roadmap;

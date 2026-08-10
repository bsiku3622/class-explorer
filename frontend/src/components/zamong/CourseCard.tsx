/**
 * 자몽 카드 한 장 — 워크북의 과목 상자를 그대로 옮겼습니다.
 *
 * ```
 * ┌──────────────────────┐
 * │▌미적분학2       4 AP3│  제목 (굵은 밑줄이면 심화필수) + 학점
 * │ Calculus2            │
 * │ 학기 [ 5학기 ▾ ] [EC] │  ← 이 칸 하나가 이수 표시입니다
 * │ 평어 [ A-    ▾ ]      │
 * └──────────────────────┘
 * ```
 *
 * **체크박스가 없습니다.** 학기를 고르는 행위가 곧 "들었다"이고, 학기를 비우면
 * 기록이 지워집니다 — 워크북의 "학기를 써야 학점 인정됨"이 그대로 규칙입니다.
 * 재수강도 학기만 다시 고르면 끝이라 따로 장치를 두지 않았습니다.
 *
 * 원본의 `학점` 줄은 제목으로 올렸습니다 — 읽기만 하는 값이라 라벨 붙은 줄을 따로
 * 쓸 이유가 없고, 스무 장이 늘어서면 "학점"이라는 회색 글자가 스무 번 반복됩니다.
 * EC 는 학기 옆으로 갔습니다: "5학기에 영어강의로 들었다"가 한 줄에서 끝납니다.
 *
 * **채우지 않은 카드도 분류색을 깝니다.** 워크북에서 색은 진행 상황이 아니라
 * 교육과정의 생김새라, 한 칸도 안 채운 상태에서 "이 열이 AP구나"가 보여야 합니다.
 * 채운 카드는 색이 아니라 **검은 테두리와 그림자**로 그 위에 올라옵니다.
 */

import React from "react";
import { ChevronDown, Lock } from "lucide-react";
import { GRADE_OPTIONS, type Course } from "../../lib/curriculum";
import {
    TIER_LABEL,
    TIER_TINT,
    tierOf,
    type TermKey,
    type TermSlot,
    type ZamongEntry,
} from "../../lib/zamong";

interface CourseCardProps {
    course: Course;
    entry: ZamongEntry | undefined;
    slots: TermSlot[];
    /** 선수를 채웠는지 — 못 채웠으면 흐리게 두고 자물쇠를 답니다 */
    unlocked: boolean;
    /** 누르면 상세가 열립니다 */
    onFocus: (name: string) => void;
    onChange: (name: string, patch: Partial<ZamongEntry>) => void;
    focused?: boolean;
    /**
     * 이 판에 안 그려지는 선수 과목 — 다른 학과 것입니다.
     *
     * 융합 과목은 선수가 전부 타 학과라 판에 끌어오면 융합 판에 수학·물리 카드가
     * 섞입니다. 그래서 선 대신 **글로** 답니다.
     */
    outsidePrereq?: string | null;
}

/**
 * 카드 안의 작은 입력 칸 — 워크북의 **셀**입니다.
 *
 * ⚠️ 채운 칸을 검게 칠하지 마세요. 한 번 그렇게 해 봤는데, 카드마다 검은 막대가
 * 박혀서 파스텔 판 위에 잉크를 쏟은 것처럼 보였습니다. 원본은 그냥 값이 적힌 셀이라
 * **흰 바탕에 검은 글씨**이고, 채웠는지는 테두리 굵기와 글자색이 말합니다.
 */
const cellClass = (filled: boolean) =>
    `h-7 w-full min-w-0 cursor-pointer appearance-none border-2 bg-white pl-1.5 pr-5 text-[13px] font-black outline-none transition-colors duration-100 ${
        filled ? "border-black text-black" : "border-black/20 text-black/35 hover:border-black/50"
    }`;

/**
 * 고르는 칸. `appearance-none` 으로 기본 모양을 지우면 **화살표까지 사라져서** 눌러서
 * 여는 칸인지 안 보입니다 — 직접 답니다.
 */
const SelectCell: React.FC<{
    value: string;
    filled: boolean;
    onChange: (value: string) => void;
    children: React.ReactNode;
}> = ({ value, filled, onChange, children }) => (
    <span className="relative flex min-w-0 flex-1 items-center">
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cellClass(filled)}
        >
            {children}
        </select>
        <ChevronDown
            size={13}
            strokeWidth={3}
            className={`pointer-events-none absolute right-1 ${
                filled ? "text-black/60" : "text-black/30"
            }`}
        />
    </span>
);

const CourseCard: React.FC<CourseCardProps> = ({
    course,
    entry,
    slots,
    unlocked,
    onFocus,
    onChange,
    focused = false,
    outsidePrereq = null,
}) => {
    const tier = tierOf(course);
    const taken = Boolean(entry?.term);
    const grade = entry?.grade ?? "";

    return (
        <div
            onMouseEnter={() => onFocus(course.name)}
            title={`${TIER_LABEL[tier]}${course.required_advanced ? " · 트랙필수" : ""}`}
            className={`flex h-full w-full flex-col gap-1.5 border-2 px-2 py-1.5 transition-all duration-100 ${
                taken
                    ? // ⚠️ 채운 카드에 **그림자를 얹지 마세요.** 검은 테두리에 하드 그림자까지
                      // 붙이면 두 변이 두 겹으로 두꺼워져서, 판에 스무 장 깔렸을 때 채운
                      // 카드만 시커멓게 튀어나옵니다. 테두리 굵기 차이(검정 vs 40%)면
                      // 채웠는지는 충분히 보이고, 안의 학기 칸도 이미 진해집니다
                      "border-black"
                    : unlocked
                      ? "border-black/40"
                      : "border-dashed border-black/25"
            } ${taken || unlocked ? "" : "opacity-65"} ${
                focused ? "shadow-[2px_2px_0_0_rgba(0,0,0,0.12)]" : ""
            }`}
            style={{ backgroundColor: TIER_TINT[tier] }}
        >
            {/* 제목 줄 — 오른쪽이 학점입니다. 분류는 카드 색이 말하므로 띠를 따로
                두지 않습니다 (원본에도 없고, 색 위에 색을 얹으면 둘 다 흐려집니다) */}
            {/* 포커스 링을 끕니다. 이 버튼이 하는 일은 아래 상세를 여는 것뿐이고 마우스를
                올려도 같은 일이 일어나는데, 판에 카드가 스무 장 깔린 상태에서 클릭할 때마다
                파란 테두리가 뜨면 정작 봐야 할 카드 색과 선을 가립니다. 실제 조작은 아래
                셀렉트들이 맡고, 그쪽 포커스 표시는 그대로 둡니다 */}
            <button
                type="button"
                onClick={() => onFocus(course.name)}
                className="flex w-full min-w-0 items-center gap-1 text-left outline-none"
            >
                {!unlocked && !taken && (
                    <Lock size={12} strokeWidth={3} className="shrink-0 text-black/35" />
                )}
                <span
                    className={`min-w-0 flex-1 truncate text-sm font-black leading-tight ${
                        course.required_advanced ? "underline decoration-2 underline-offset-2" : ""
                    }`}
                >
                    {course.name}
                </span>
                <span className="shrink-0 text-[13px] font-black tabular-nums text-black/55">
                    {course.credits}
                    {course.ap_credits > 0 && (
                        <span className="ml-0.5 text-[10px] tracking-tight text-black/40">
                            AP{course.ap_credits}
                        </span>
                    )}
                </span>
            </button>

            <span className="-mt-1 truncate text-[10.5px] font-bold leading-tight text-black/35">
                {outsidePrereq ? `선수 ${outsidePrereq}` : (course.english_name ?? " ")}
            </span>

            <label className="mt-auto flex items-center gap-1">
                <span className="w-7 shrink-0 text-[11px] font-black uppercase tracking-wider text-black/45">
                    학기
                </span>
                <SelectCell
                    value={entry?.term ?? ""}
                    filled={taken}
                    onChange={(value) =>
                        onChange(course.name, { term: (value || null) as TermKey | null })
                    }
                >
                    <option value="">—</option>
                    {slots.map((slot) => (
                        <option key={slot.key} value={slot.key}>
                            {slot.label}
                        </option>
                    ))}
                </SelectCell>
                {/* ⚠️ EC 자리는 **비어 있어도 잡아 둡니다.** 영어강의가 열리는 과목에만
                    버튼이 뜨는데, 그때만 폭을 뺏으면 같은 카드 안에서 학기 칸과 평어
                    칸의 길이가 달라지고, 카드끼리도 들쭉날쭉해집니다 */}
                <span className="flex w-8 shrink-0 justify-end">
                    {course.has_ec && (
                        // EC 여부는 과목이 아니라 **분반**이 정합니다
                        <button
                            type="button"
                            onClick={() => onChange(course.name, { isEc: !entry?.isEc })}
                            title={entry?.isEc ? "영어강의로 이수" : "눌러서 영어강의로 표시"}
                            className={`h-7 border-2 bg-white px-1.5 text-[11px] font-black transition-colors duration-100 ${
                                entry?.isEc
                                    ? "border-black text-black"
                                    : "border-black/20 text-black/25 hover:border-black/50"
                            }`}
                        >
                            EC
                        </button>
                    )}
                </span>
            </label>

            <label className="flex items-center gap-1">
                <span className="w-7 shrink-0 text-[11px] font-black uppercase tracking-wider text-black/45">
                    평어
                </span>
                {course.is_pf ? (
                    <span className="flex h-7 flex-1 items-center border-2 border-black/15 bg-white/40 px-1.5 text-[12px] font-black text-black/30">
                        P/F
                    </span>
                ) : (
                    <SelectCell
                        value={grade}
                        filled={Boolean(grade)}
                        onChange={(value) => onChange(course.name, { grade: value || null })}
                    >
                        <option value="">—</option>
                        {GRADE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </SelectCell>
                )}
                {/* 위 학기 줄의 EC 자리와 폭을 맞춥니다 */}
                <span className="w-8 shrink-0" />
            </label>
        </div>
    );
};

export default CourseCard;

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
import { Lock } from "lucide-react";
import { Button, Icon, Select, Surface, Text } from "@studio-baeks/funky-ui";
import { ACCENT_COLORS } from "@studio-baeks/funky-ui/tokens";
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
    /** 마우스가 올라오면 이름, 나가면 `null` */
    onFocus: (name: string | null) => void;
    onChange: (name: string, patch: Partial<ZamongEntry>) => void;
    focused?: boolean;
    /**
     * 지금 눌러 둔 과목 — 테두리가 핑크로 섭니다.
     *
     * **누른 것 하나뿐입니다.** 이어진 과목까지 칠하면 판의 절반이 핑크가 되는데,
     * 어디로 이어지는지는 핑크 선이 이미 말합니다.
     */
    traced?: boolean;
    /**
     * 이 판에 안 그려지는 선수 과목 — 다른 학과 것입니다.
     *
     * 융합 과목은 선수가 전부 타 학과라 판에 끌어오면 융합 판에 수학·물리 카드가
     * 섞입니다. 그래서 선 대신 **글로** 답니다.
     */
    outsidePrereq?: string | null;
}

/**
 * 고르는 칸 — 카드 안의 작은 입력 칸, 워크북의 **셀**입니다.
 *
 * ⚠️ 채운 칸을 검게 칠하지 마세요. 한 번 그렇게 해 봤는데, 카드마다 검은 막대가
 * 박혀서 파스텔 판 위에 잉크를 쏟은 것처럼 보였습니다. 원본은 그냥 값이 적힌 셀이라
 * **흰 바탕에 검은 글씨**이고, 채웠는지는 테두리 굵기와 글자색이 말합니다. 그래서
 * 채우지 않은 칸만 `quiet`(옅은 테두리 · 약한 글자)입니다.
 */
const SelectCell: React.FC<{
    value: string;
    filled: boolean;
    onChange: (value: string) => void;
    children: React.ReactNode;
}> = ({ value, filled, onChange, children }) => (
    <Select
        quiet={!filled}
        size="xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // ⚠️ **칸에만** 겁니다. 줄 전체에 걸면 라벨이나 여백을 눌러도 카드가 안
        // 골라지는데, 카드 한가운데가 이 칸이라 "눌러도 아무 일도 안 나는" 자리가
        // 넓어집니다. 칸을 만지는 건 카드를 고르는 것과 다른 일이니 여기서 끊습니다
        onClick={(event) => event.stopPropagation()}
        className="min-w-0 flex-1"
    >
        {children}
    </Select>
);

const CourseCard: React.FC<CourseCardProps> = ({
    course,
    entry,
    slots,
    unlocked,
    onFocus,
    onChange,
    focused = false,
    traced = false,
    outsidePrereq = null,
}) => {
    const tier = tierOf(course);
    const taken = Boolean(entry?.term);
    const grade = entry?.grade ?? "";

    return (
        <Surface
            fill="none"
            border={taken || traced ? "line" : "soft"}
            borderStyle={!traced && !taken && !unlocked ? "dashed" : "solid"}
            shadow={focused ? "raised" : "none"}
            onMouseEnter={() => onFocus(course.name)}
            // ⚠️ 나갈 때 끄지 않으면 마우스를 치운 뒤에도 그 과목이 짚인 채로 남습니다 —
            // 아래 상세도, 검게 선 선수 선도 그대로 굳습니다
            onMouseLeave={() => onFocus(null)}
            title={`${TIER_LABEL[tier]}${course.required_advanced ? " · 트랙필수" : ""}`}
            // ⚠️ 채운 카드에 **그림자를 얹지 마세요.** 검은 테두리에 하드 그림자까지
            // 붙이면 두 변이 두 겹으로 두꺼워져서, 판에 스무 장 깔렸을 때 채운
            // 카드만 시커멓게 튀어나옵니다. 테두리 굵기 차이(검정 vs 옅은 회색)면
            // 채웠는지는 충분히 보이고, 안의 학기 칸도 이미 진해집니다.
            // 지금 눌러 둔 카드(`traced`)만 테두리가 핑크입니다
            className={`flex h-full w-full flex-col gap-1.5 px-2 py-1.5 transition-all duration-100 ${
                taken || unlocked ? "" : "opacity-65"
            }`}
            style={{
                backgroundColor: TIER_TINT[tier],
                ...(traced ? { borderColor: ACCENT_COLORS.pink.solid } : null),
            }}
        >
            {/* 제목 줄 — 오른쪽이 학점입니다. 분류는 카드 색이 말하므로 띠를 따로
                두지 않습니다 (원본에도 없고, 색 위에 색을 얹으면 둘 다 흐려집니다) */}
            {/* 버튼이 아니라 그냥 줄입니다. 카드를 고르는 건 **카드 전체**가 받고
                (`CourseBoard`), 여기 버튼을 겹쳐 두면 포커스 링이 카드 색과 선을 가립니다 */}
            <div className="flex w-full min-w-0 items-center gap-1 text-left">
                {!unlocked && !taken && <Icon icon={Lock} size={12} strokeWidth={3} tone="faint" className="shrink-0" />}
                <Text
                    weight="black"
                    leading="fixed"
                    truncate
                    decoration={course.required_advanced ? "underline" : undefined}
                    className="min-w-0 flex-1 underline-offset-2"
                >
                    {course.name}
                </Text>
                <Text weight="black" tone="secondary" numeric className="shrink-0">
                    {course.credits}
                    {course.ap_credits > 0 && (
                        <Text variant="micro" weight="black" tone="muted" className="ml-0.5 tracking-tight">
                            AP{course.ap_credits}
                        </Text>
                    )}
                </Text>
            </div>

            <Text variant="micro" weight="bold" tone="muted" truncate className="-mt-1 block">
                {outsidePrereq ? `선수 ${outsidePrereq}` : (course.english_name ?? " ")}
            </Text>

            <label className="mt-auto flex items-center gap-1">
                <Text variant="label" tone="muted" className="w-7 shrink-0">
                    학기
                </Text>
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
                        <Button
                            size="xs"
                            variant="muted"
                            selected={Boolean(entry?.isEc)}
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange(course.name, { isEc: !entry?.isEc });
                            }}
                            title={entry?.isEc ? "영어강의로 이수" : "눌러서 영어강의로 표시"}
                            className="px-1.5"
                        >
                            EC
                        </Button>
                    )}
                </span>
            </label>

            <label className="flex items-center gap-1">
                <Text variant="label" tone="muted" className="w-7 shrink-0">
                    평어
                </Text>
                {course.is_pf ? (
                    <Surface fill="none" border="subtle" className="flex h-6 flex-1 items-center px-1.5">
                        <Text variant="caption" weight="black" tone="faint">
                            P/F
                        </Text>
                    </Surface>
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
        </Surface>
    );
};

export default CourseCard;

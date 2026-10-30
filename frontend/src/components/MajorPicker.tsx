import React from "react";
import type { MajorDivision } from "../lib/majors";
import { getDepartmentColor } from "../lib/utils";
import { Badge, Surface, Text, ToneButton } from "@studio-baeks/funky-ui";

interface MajorPickerProps {
    /** 서버가 주는 목록(`GET /majors` 의 `options`) — 학부별 트랙과 심화필수 조건 */
    options: MajorDivision[];
    /** 지금 골라 둔 트랙. 아직 안 골랐으면 `null` */
    value: string | null;
    onChange: (major: string) => void;
    /** 수강 이력으로 짐작한 트랙 — "추천" 표식만 답니다. 고르는 건 사람입니다 */
    suggested?: string | null;
    disabled?: boolean;
}

/**
 * 전공 트랙 고르기 — 묻는 창(`MajorPrompt`)과 `/about`(`MajorSettings`)이 같이 씁니다.
 *
 * ```
 * 수리정보과학부
 * [ 수학 ] [ 정보과학 추천 ]
 * 물리지구과학부
 * [ 물리학 ] [ 지구과학 ]
 * …
 * ┌ 정보과학 심화필수 ───────────────┐
 * │ 자료구조, 정보과학3, 알고리즘을 …  │
 * └─────────────────────────────────┘
 * ```
 *
 * 고른 트랙만 **학과색**으로 채웁니다(`ToneButton` 의 `tone` — 홈의 학과색과 같은 값). 심화필수
 * 조건은 고른 트랙 하나만 아래에 펼칩니다 — 여섯 개를 다 늘어놓으면 물리학 한 줄이 세 줄이라 창이
 * 화면을 넘깁니다. 상자는 고르기 전에도 자리를 지켜서 고르는 순간 아래 버튼이 밀리지 않습니다.
 */
const MajorPicker: React.FC<MajorPickerProps> = ({ options, value, onChange, suggested, disabled }) => {
    const requirement = options
        .flatMap((d) => d.majors)
        .find((m) => m.name === value)?.requirement;

    return (
        <div className="space-y-3">
            {options.map(({ division, majors }) => (
                <div key={division}>
                    <Text as="p" variant="overline" className="mb-1.5">
                        {division}
                    </Text>
                    <div className="grid grid-cols-2 gap-2">
                        {majors.map(({ name }) => (
                            <ToneButton
                                key={name}
                                tone={getDepartmentColor(name)}
                                selected={value === name}
                                disabled={disabled}
                                onClick={() => onChange(name)}
                                fullWidth
                                className="relative"
                            >
                                {name}
                                {suggested === name && (
                                    <Badge
                                        size="sm"
                                        variant="paper"
                                        className="absolute -right-1.5 -top-2"
                                    >
                                        추천
                                    </Badge>
                                )}
                            </ToneButton>
                        ))}
                    </div>
                </div>
            ))}

            <Surface fill="well" border="subtle" paddingX="lg" paddingY="md" className="min-h-[4.25rem]">
                {value ? (
                    <>
                        <Text as="p" variant="overline">
                            {value} 심화필수
                        </Text>
                        <Text as="p" variant="caption" tone="secondary" leading="relaxed" className="mt-1">
                            {requirement ?? "교육과정에 적힌 조건이 아직 없습니다."}
                        </Text>
                    </>
                ) : (
                    <Text as="p" variant="caption" tone="muted" leading="relaxed">
                        트랙을 누르면 심화필수 조건이 여기 보입니다.
                    </Text>
                )}
            </Surface>
        </div>
    );
};

export default MajorPicker;

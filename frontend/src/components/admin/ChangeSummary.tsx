import React from "react";
import { ArrowRight } from "lucide-react";
import { Icon, SectionTitle, Text } from "@studio-baeks/funky-ui";

export interface ChangeSummaryData {
    changed: boolean;
    classes: {
        added: string[];
        removed: string[];
        moved: { class: string; from: string; to: string }[];
        /** 담당 교사만 바뀐 분반. 예전 요약에는 없어서 optional 입니다 */
        swapped?: { class: string; from: string; to: string }[];
        /** `배정중` 이던 강의실이 실제 교실로 정해진 분반 수 */
        assigned?: number;
        kept: number;
    };
    times: { added: number; removed: number };
    enrollments: { added: number; removed: number; by_class: { class: string; delta: number }[] };
    students: { new: number; renamed: number };
}

/** `+3` / `-2` — 0 이면 아무것도 그리지 않습니다 */
const Delta: React.FC<{ value: number }> = ({ value }) =>
    value === 0 ? null : (
        <Text variant="caption" weight="black" tone={value > 0 ? "green" : "red"}>
            {value > 0 ? "+" : ""}{value}
        </Text>
    );

const Stat: React.FC<{ label: string; added: number; removed: number }> = ({
    label, added, removed,
}) => (
    <div className="flex items-baseline gap-1.5">
        <Text variant="caption" weight="black" tone="muted">{label}</Text>
        {added === 0 && removed === 0 ? (
            <Text variant="caption" weight="black" tone="muted">변화 없음</Text>
        ) : (
            <>
                <Delta value={added} />
                {added > 0 && removed > 0 && <Text variant="caption" weight="black" tone="faint">/</Text>}
                <Delta value={-removed} />
            </>
        )}
    </div>
);

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
    items.length === 0 ? null : (
        <div className="space-y-1">
            <SectionTitle title={`${title} (${items.length})`} />
            <ul className="space-y-0.5">
                {items.map((item) => (
                    <Text as="li" key={item} variant="caption" tone="secondary" truncate>{item}</Text>
                ))}
            </ul>
        </div>
    );

/**
 * 한 회차에서 무엇이 바뀌었는지.
 *
 * **개인 이름은 나오지 않습니다** — 서버가 애초에 담아 주지 않습니다. 분반별 인원
 * 증감까지가 끝이고, 누가 들어오고 나갔는지는 여기서 알 수 없습니다.
 */
const ChangeSummary: React.FC<{ data: ChangeSummaryData }> = ({ data }) => {
    if (!data.changed) {
        return <Text as="p" variant="caption" tone="muted">직전 회차와 같습니다.</Text>;
    }

    const { classes, times, enrollments, students } = data;
    const swapped = classes.swapped ?? [];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Stat label="분반" added={classes.added.length} removed={classes.removed.length} />
                <Stat label="시간" added={times.added} removed={times.removed} />
                <Stat label="수강" added={enrollments.added} removed={enrollments.removed} />
                {classes.moved.length > 0 && (
                    <div className="flex items-baseline gap-1.5">
                        <Text variant="caption" weight="black" tone="muted">교실 이동</Text>
                        <Text variant="caption" weight="black">{classes.moved.length}</Text>
                    </div>
                )}
                {swapped.length > 0 && (
                    <div className="flex items-baseline gap-1.5">
                        <Text variant="caption" weight="black" tone="muted">교사 교체</Text>
                        <Text variant="caption" weight="black">{swapped.length}</Text>
                    </div>
                )}
                {!!classes.assigned && (
                    <div className="flex items-baseline gap-1.5">
                        <Text variant="caption" weight="black" tone="muted">교실 배정</Text>
                        <Text variant="caption" weight="black">{classes.assigned}</Text>
                    </div>
                )}
                {students.new > 0 && (
                    <div className="flex items-baseline gap-1.5">
                        <Text variant="caption" weight="black" tone="muted">신규 학생</Text>
                        <Text variant="caption" weight="black">{students.new}</Text>
                    </div>
                )}
                <div className="flex items-baseline gap-1.5">
                    <Text variant="caption" weight="black" tone="muted">유지</Text>
                    <Text variant="caption" weight="black" tone="secondary">{classes.kept}</Text>
                </div>
            </div>

            <List title="신설" items={classes.added} />
            <List title="폐강" items={classes.removed} />

            {swapped.length > 0 && (
                <div className="space-y-1">
                    <SectionTitle title={`교사 교체 (${swapped.length})`} />
                    <ul className="space-y-0.5">
                        {swapped.map((row) => (
                            <Text as="li" key={row.class} variant="caption" tone="secondary" className="flex items-center gap-1.5">
                                <Text variant="caption" tone="inherit" truncate>{row.class}</Text>
                                <Text variant="caption" tone="muted" className="shrink-0">{row.from}</Text>
                                <Icon icon={ArrowRight} size={10} strokeWidth={3} tone="muted" className="shrink-0" />
                                <Text variant="caption" className="shrink-0">{row.to}</Text>
                            </Text>
                        ))}
                    </ul>
                </div>
            )}

            {classes.moved.length > 0 && (
                <div className="space-y-1">
                    <SectionTitle title={`교실 이동 (${classes.moved.length})`} />
                    <ul className="space-y-0.5">
                        {classes.moved.map((m) => (
                            <Text as="li" key={m.class} variant="caption" tone="secondary" className="flex items-center gap-1.5">
                                <Text variant="caption" tone="inherit" truncate>{m.class}</Text>
                                <Text variant="caption" tone="muted" className="shrink-0">{m.from}</Text>
                                <Icon icon={ArrowRight} size={10} strokeWidth={3} tone="muted" className="shrink-0" />
                                <Text variant="caption" className="shrink-0">{m.to}</Text>
                            </Text>
                        ))}
                    </ul>
                </div>
            )}

            {enrollments.by_class.length > 0 && (
                <div className="space-y-1">
                    <SectionTitle title="인원 변동" />
                    <ul className="space-y-0.5">
                        {enrollments.by_class.map((row) => (
                            <Text as="li" key={row.class} variant="caption" className="flex items-center justify-between gap-2">
                                <Text variant="caption" tone="secondary" truncate>{row.class}</Text>
                                <span className="shrink-0"><Delta value={row.delta} /></span>
                            </Text>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ChangeSummary;

import React from "react";
import { ArrowRight } from "lucide-react";
import RetroSubTitle from "../atoms/RetroSubTitle";

export interface ChangeSummaryData {
    changed: boolean;
    classes: {
        added: string[];
        removed: string[];
        moved: { class: string; from: string; to: string }[];
        /** 담당 교사만 바뀐 분반. 예전 요약에는 없어서 optional 입니다 */
        swapped?: { class: string; from: string; to: string }[];
        kept: number;
    };
    times: { added: number; removed: number };
    enrollments: { added: number; removed: number; by_class: { class: string; delta: number }[] };
    students: { new: number; renamed: number };
}

/** `+3` / `-2` — 0 이면 아무것도 그리지 않습니다 */
const Delta: React.FC<{ value: number }> = ({ value }) =>
    value === 0 ? null : (
        <span className={value > 0 ? "text-green-700" : "text-red-600"}>
            {value > 0 ? "+" : ""}{value}
        </span>
    );

const Stat: React.FC<{ label: string; added: number; removed: number }> = ({
    label, added, removed,
}) => (
    <div className="flex items-baseline gap-1.5">
        <span className="text-black/40">{label}</span>
        {added === 0 && removed === 0 ? (
            <span className="text-black/30">변화 없음</span>
        ) : (
            <>
                <Delta value={added} />
                {added > 0 && removed > 0 && <span className="text-black/20">/</span>}
                <Delta value={-removed} />
            </>
        )}
    </div>
);

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
    items.length === 0 ? null : (
        <div className="space-y-1">
            <RetroSubTitle title={`${title} (${items.length})`} />
            <ul className="space-y-0.5">
                {items.map((item) => (
                    <li key={item} className="text-xs font-bold text-black/70 truncate">{item}</li>
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
        return <p className="text-xs font-bold text-black/40">직전 회차와 같습니다.</p>;
    }

    const { classes, times, enrollments, students } = data;
    const swapped = classes.swapped ?? [];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-black">
                <Stat label="분반" added={classes.added.length} removed={classes.removed.length} />
                <Stat label="시간" added={times.added} removed={times.removed} />
                <Stat label="수강" added={enrollments.added} removed={enrollments.removed} />
                {classes.moved.length > 0 && (
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-black/40">교실 이동</span>
                        <span className="text-black">{classes.moved.length}</span>
                    </div>
                )}
                {swapped.length > 0 && (
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-black/40">교사 교체</span>
                        <span className="text-black">{swapped.length}</span>
                    </div>
                )}
                {students.new > 0 && (
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-black/40">신규 학생</span>
                        <span className="text-black">{students.new}</span>
                    </div>
                )}
                <div className="flex items-baseline gap-1.5">
                    <span className="text-black/40">유지</span>
                    <span className="text-black/60">{classes.kept}</span>
                </div>
            </div>

            <List title="신설" items={classes.added} />
            <List title="폐강" items={classes.removed} />

            {swapped.length > 0 && (
                <div className="space-y-1">
                    <RetroSubTitle title={`교사 교체 (${swapped.length})`} />
                    <ul className="space-y-0.5">
                        {swapped.map((row) => (
                            <li key={row.class} className="flex items-center gap-1.5 text-xs font-bold text-black/70">
                                <span className="truncate">{row.class}</span>
                                <span className="shrink-0 text-black/40">{row.from}</span>
                                <ArrowRight size={10} strokeWidth={3} className="shrink-0 text-black/40" />
                                <span className="shrink-0">{row.to}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {classes.moved.length > 0 && (
                <div className="space-y-1">
                    <RetroSubTitle title={`교실 이동 (${classes.moved.length})`} />
                    <ul className="space-y-0.5">
                        {classes.moved.map((m) => (
                            <li key={m.class} className="flex items-center gap-1.5 text-xs font-bold text-black/70">
                                <span className="truncate">{m.class}</span>
                                <span className="shrink-0 text-black/40">{m.from}</span>
                                <ArrowRight size={10} strokeWidth={3} className="shrink-0 text-black/40" />
                                <span className="shrink-0">{m.to}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {enrollments.by_class.length > 0 && (
                <div className="space-y-1">
                    <RetroSubTitle title="인원 변동" />
                    <ul className="space-y-0.5">
                        {enrollments.by_class.map((row) => (
                            <li key={row.class} className="flex items-center justify-between gap-2 text-xs font-bold">
                                <span className="truncate text-black/70">{row.class}</span>
                                <span className="shrink-0"><Delta value={row.delta} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ChangeSummary;

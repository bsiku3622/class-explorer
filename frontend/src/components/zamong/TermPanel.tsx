import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Drawer, IconButton, Surface, Text } from "@studio-baeks/funky-ui";
import CourseCard from "./CourseCard";
import type { Course } from "../../lib/curriculum";
import type { TermSlot, TermSummary, ZamongEntry, ZamongMap } from "../../lib/zamong";

interface TermPanelProps {
    term: TermSummary;
    catalog: Map<string, Course>;
    entries: ZamongMap;
    slots: TermSlot[];
    onChange: (name: string, patch: Partial<ZamongEntry>) => void;
    onClose: () => void;
    saveDisabled: boolean;
}

const ignoreFocus = () => {};

/** 학과 판과 같은 카드를 편집하므로 평어·EC·학기와 자동 저장이 함께 갱신됩니다. */
const TermPanel: React.FC<TermPanelProps> = ({
    term, catalog, entries, slots, onChange, onClose, saveDisabled,
}) => {
    // `Drawer` 는 뒤 화면을 막지 않는 판이라, 예전 native `<dialog>` 가 맡던 일을 여기서 합니다 —
    // Esc 로 닫기 · 뒤 스크롤 잠금 · 닫은 뒤 학기 버튼으로 포커스 복구 (바깥 클릭은 아래 덮개)
    // 부르는 쪽이 매번 새 함수를 넘기므로 ref 로 읽습니다 — effect 가 다시 돌면 포커스가 학기 버튼으로 튑니다
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });
    useEffect(() => {
        const opener = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeRef.current();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = overflow;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);

    return (
        <>
            <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[299] bg-[var(--fk-surface-inverse)] opacity-35" />
            <Drawer open aria-label="학기 상세" className="h-dvh w-full max-w-[36rem]">
                <div className="flex h-full min-h-0 flex-col">
                    <Surface as="header" border="line" borderSide="bottom" className="flex shrink-0 items-start justify-between gap-4 p-4 sm:p-6">
                        <div>
                            <Text as="h2" variant="heading" id="zamong-term-title">
                                {term.key === "S" ? "Summer / Winter Term" : `Semester ${term.key}`}
                            </Text>
                            <Text as="p" tone="secondary" className="mt-1">
                                {term.label} · {term.courses.length}과목 · {term.credits}학점
                                {" · GPA "}{term.gpa === null ? "—" : term.gpa.toFixed(2)}
                            </Text>
                        </div>
                        <IconButton icon={X} label="학기 상세 닫기" variant="paper" size="sm" autoFocus onClick={onClose} />
                    </Surface>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                        <Text as="p" variant="caption" tone="secondary" leading="relaxed" className="mb-4">
                            평어와 EC를 입력하면 평점과 이수 현황에 반영됩니다. {saveDisabled ? "기록을 불러오지 못해 변경 내용은 저장되지 않습니다. 새로고침해주세요." : "변경 내용은 자동 저장됩니다."}{" "}
                            학기를 바꾸면 해당 학기로 과목이 이동합니다.
                        </Text>
                        {term.courses.length === 0 ? (
                            <Surface border="soft" borderStyle="dashed" className="p-6">
                                <Text as="p" tone="muted">
                                    이 학기에 담은 과목이 없습니다. 로드맵의 과목 넣기에서 먼저 추가해주세요.
                                </Text>
                            </Surface>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                                {term.courses.map((label) => {
                                    const name = label.replace(/\(EC\)$/, "");
                                    const course = catalog.get(name);
                                    if (!course) return null;
                                    return (
                                        <div key={name} className="h-[136px] min-w-0">
                                            <CourseCard
                                                course={course}
                                                entry={entries[name]}
                                                slots={slots}
                                                unlocked
                                                onFocus={ignoreFocus}
                                                onChange={onChange}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Drawer>
        </>
    );
};

export default TermPanel;

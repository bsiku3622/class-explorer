import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import RetroButton from "../atoms/RetroButton";
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
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current!;
        const opener = document.activeElement;
        dialog.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            dialog.close();
            document.body.style.overflow = overflow;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby="zamong-term-title"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right ||
                    event.clientY < rect.top || event.clientY > rect.bottom) onClose();
            }}
            className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-[36rem] border-0 border-l-2 border-black bg-retro-bg p-0 text-retro-fg shadow-[-6px_0_0_0_rgba(0,0,0,0.2)] backdrop:bg-black/35 motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200"
        >
            <div className="flex h-full min-h-0 flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-black bg-white p-4 sm:p-6">
                    <div>
                        <h2 id="zamong-term-title" className="text-xl font-black">
                            {term.key === "S" ? "Summer / Winter Term" : `Semester ${term.key}`}
                        </h2>
                        <p className="mt-1 text-sm font-bold text-black/55">
                            {term.label} · {term.courses.length}과목 · {term.credits}학점
                            {" · GPA "}{term.gpa === null ? "—" : term.gpa.toFixed(2)}
                        </p>
                    </div>
                    <RetroButton type="button" size="sm" autoFocus onClick={onClose} aria-label="학기 상세 닫기">
                        <X size={18} strokeWidth={2.5} />
                    </RetroButton>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    <p className="mb-4 text-xs font-bold leading-relaxed text-black/55">
                        평어와 EC를 입력하면 평점과 이수 현황에 반영됩니다. {saveDisabled ? "기록을 불러오지 못해 변경 내용은 저장되지 않습니다. 새로고침해주세요." : "변경 내용은 자동 저장됩니다."}{" "}
                        학기를 바꾸면 해당 학기로 과목이 이동합니다.
                    </p>
                    {term.courses.length === 0 ? (
                        <p className="border-2 border-dashed border-black/25 bg-white p-6 text-sm font-bold text-black/45">
                            이 학기에 담은 과목이 없습니다. 로드맵의 과목 넣기에서 먼저 추가해주세요.
                        </p>
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
        </dialog>
    );
};

export default TermPanel;

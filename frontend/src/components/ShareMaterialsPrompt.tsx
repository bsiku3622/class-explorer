import React, { useCallback, useEffect, useState } from "react";
import { FileHeart, UploadCloud, X } from "lucide-react";
import type { Term } from "../types";

interface ShareMaterialsPromptProps {
    term: Term | null;
    pathname: string;
    onUpload: () => void;
}

const DISMISSED_KEY = "ksa_material_prompt_dismissed";
const todayInKorea = (): string =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());

const ShareMaterialsPrompt: React.FC<ShareMaterialsPromptProps> = ({
    term,
    pathname,
    onUpload,
}) => {
    const [dismissedDate, setDismissedDate] = useState(
        () => localStorage.getItem(DISMISSED_KEY),
    );
    const eligible = term?.year === 2026 && term.semester === 2 && pathname !== "/upload";
    const open = eligible && dismissedDate !== todayInKorea();

    const dismiss = useCallback(() => {
        const today = todayInKorea();
        localStorage.setItem(DISMISSED_KEY, today);
        setDismissedDate(today);
    }, []);

    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") dismiss();
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [dismiss, open]);

    const goUpload = () => {
        dismiss();
        onUpload();
    };

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-materials-title"
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) dismiss();
            }}
        >
            <div className="w-full max-w-lg border-2 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,0.22)]">
                <header className="flex items-center justify-between border-b-2 border-black bg-retro-secondary px-4 py-3 text-white">
                    <p className="text-xs font-black uppercase tracking-widest">2026-2 Syllabus Wanted</p>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="오늘 하루 보지 않기"
                        className="grid size-8 place-items-center border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(0,0,0,0.18)]"
                    >
                        <X size={16} strokeWidth={2.75} />
                    </button>
                </header>
                <div className="p-6 text-center sm:p-8">
                    <div className="mx-auto grid size-16 place-items-center border-2 border-black bg-white text-retro-secondary shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                        <FileHeart size={30} strokeWidth={2.4} />
                    </div>
                    <h2 id="share-materials-title" className="mt-6 text-2xl font-black tracking-tight text-retro-secondary">
                        실라버스를 공유해주세요
                    </h2>
                    <p className="mx-auto mt-3 max-w-sm text-sm font-bold leading-relaxed text-black/55">
                        가지고 있는 2026-2 강의계획서나 수업 자료를 올려주시면 검수 후 같은 과목을 듣는 학생들과 나눌게요.
                    </p>
                </div>
                <footer className="grid gap-3 border-t-2 border-black bg-white p-4 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={dismiss}
                        className="border-2 border-black bg-white px-4 py-3 text-xs font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    >
                        오늘 하루 보지 않기
                    </button>
                    <button
                        type="button"
                        onClick={goUpload}
                        className="flex items-center justify-center gap-2 border-2 border-black bg-retro-secondary px-4 py-3 text-xs font-black uppercase text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    >
                        <UploadCloud size={17} /> 자료 공유하기
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ShareMaterialsPrompt;

import React, { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Eye, FileText, X } from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    findSyllabiForSubject,
    type SyllabusDocument,
} from "../lib/syllabi";

interface SyllabusPanelProps {
    subject: SubjectData;
    term: Term | null;
}

const SyllabusPanel: React.FC<SyllabusPanelProps> = ({ subject, term }) => {
    const [preview, setPreview] = useState<SyllabusDocument | null>(null);
    const documents = useMemo(
        () => findSyllabiForSubject(subject, term),
        [subject, term],
    );

    useEffect(() => {
        if (!preview) return;

        const previousOverflow = document.body.style.overflow;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPreview(null);
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleEscape);
        };
    }, [preview]);

    if (documents.length === 0) return null;

    return (
        <>
            <section
                aria-label={`${subject.subject} syllabus`}
                className="border-2 border-black bg-retro-accent2 shadow-[4px_4px_0_0_rgba(0,0,0,0.16)]"
            >
                <div className="flex items-center justify-between gap-3 border-b-2 border-black px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText size={17} strokeWidth={2.75} className="shrink-0" />
                        <h3 className="text-sm font-black">Syllabus</h3>
                    </div>
                    <span className="text-[10px] font-black bg-white border-2 border-black px-2 py-0.5 shrink-0">
                        {documents.length} {documents.length === 1 ? "FILE" : "FILES"}
                    </span>
                </div>

                <div className="divide-y-2 divide-black bg-white">
                    {documents.map((document) => (
                        <div
                            key={document.id}
                            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-black leading-snug break-words">
                                    {document.title}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-black/45 break-words">
                                    {document.department} · {document.sourceFormat}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setPreview(document)}
                                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 border-2 border-black bg-retro-accent1 px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
                                >
                                    <Eye size={14} strokeWidth={2.5} />
                                    Preview
                                </button>
                                <a
                                    href={document.downloadUrl}
                                    download
                                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
                                >
                                    <Download size={14} strokeWidth={2.5} />
                                    Download
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {preview && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${preview.title} preview`}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setPreview(null);
                    }}
                >
                    <div className="flex h-full max-h-[96vh] w-full max-w-6xl flex-col border-2 border-black bg-white shadow-[8px_8px_0_0_var(--color-retro-accent2)]">
                        <header className="flex items-start justify-between gap-3 border-b-2 border-black bg-retro-accent2 px-3 py-3 sm:px-4">
                            <div className="min-w-0">
                                <p className="text-sm sm:text-base font-black leading-tight break-words">
                                    {preview.title}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-black/50">
                                    PDF preview · {preview.sourceFormat} source
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <a
                                    href={preview.previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Open preview in a new tab"
                                    className="grid size-9 place-items-center border-2 border-black bg-white shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
                                >
                                    <ExternalLink size={16} strokeWidth={2.5} />
                                </a>
                                <button
                                    type="button"
                                    autoFocus
                                    onClick={() => setPreview(null)}
                                    aria-label="Close preview"
                                    className="grid size-9 place-items-center border-2 border-black bg-retro-primary shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
                                >
                                    <X size={18} strokeWidth={2.75} />
                                </button>
                            </div>
                        </header>
                        <iframe
                            src={`${preview.previewUrl}#view=FitH`}
                            title={`${preview.title} PDF preview`}
                            className="min-h-0 flex-1 bg-[#525659]"
                        />
                        <div className="border-t-2 border-black bg-white px-3 py-2 text-center text-[10px] font-bold text-black/50 sm:hidden">
                            If the preview does not load, open it in a new tab.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SyllabusPanel;

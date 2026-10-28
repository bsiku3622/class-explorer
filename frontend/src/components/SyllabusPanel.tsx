import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    downloadSyllabus,
    findSyllabiForSubject,
    syllabusRuleFor,
    type SyllabusDocument,
} from "../lib/syllabi";
import { useSyllabusFiles } from "../hooks/useSyllabusFiles";
import type { Material } from "../types";
import {
    downloadMaterialFile,
    getApprovedMaterials,
} from "../lib/materialsApi";
import MaterialPreviewModal, {
    type MaterialPreviewTarget,
} from "./MaterialPreviewModal";

interface SyllabusPanelProps {
    subject: SubjectData;
    term: Term | null;
}

const SyllabusPanel: React.FC<SyllabusPanelProps> = ({ subject, term }) => {
    const [preview, setPreview] = useState<MaterialPreviewTarget | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState("");
    const [dynamicResult, setDynamicResult] = useState<{
        key: string;
        rows: Material[];
    }>({ key: "", rows: [] });
    // 강의계획서가 있는 과목만 목록을 받습니다 — 아코디언마다 요청이 나가지 않게
    const syllabi = useSyllabusFiles(syllabusRuleFor(subject, term) !== undefined);
    const documents = useMemo(
        () => findSyllabiForSubject(subject, term, syllabi.files),
        [subject, term, syllabi.files],
    );
    // 창은 이 함수가 바뀌면 Blob 을 다시 받습니다 — 목록이 늦게 와서 다시 그려질 때 깜빡이지 않게 고정합니다
    const closePreview = useCallback(() => setPreview(null), []);

    useEffect(() => {
        if (!term) return;
        let active = true;
        const key = `${term.year}-${term.semester}-${subject.subject_id}`;
        getApprovedMaterials(term)
            .then((rows) => {
                if (!active) return;
                setDynamicResult({
                    key,
                    rows: rows.filter(
                        (material) =>
                            material.subject.id === subject.subject_id &&
                            material.category === "syllabus",
                    ),
                });
            })
            .catch(() => active && setDynamicResult({ key, rows: [] }));
        return () => {
            active = false;
        };
    }, [subject.subject_id, term]);

    const dynamicKey = term
        ? `${term.year}-${term.semester}-${subject.subject_id}`
        : "";
    const dynamicMaterials = dynamicResult.key === dynamicKey
        ? dynamicResult.rows
        : [];

    const dynamicFiles = dynamicMaterials.flatMap((material) =>
        material.files.map((file) => ({ material, file })),
    );
    const totalFiles = documents.length + dynamicFiles.length;

    if (totalFiles === 0 && !syllabi.loading && !syllabi.error) return null;

    const handleDownload = async (doc: SyllabusDocument) => {
        setDownloading(doc.id);
        setDownloadError("");
        try {
            await downloadSyllabus(doc);
        } catch {
            setDownloadError("강의계획서를 내려받지 못했습니다.");
        } finally {
            setDownloading(null);
        }
    };

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
                        {totalFiles} {totalFiles === 1 ? "FILE" : "FILES"}
                    </span>
                </div>

                <div className="divide-y-2 divide-black bg-white">
                    {syllabi.loading && (
                        <p className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-black/40">
                            Loading syllabus…
                        </p>
                    )}
                    {syllabi.error && (
                        <p className="px-3 py-3 text-xs font-black">
                            강의계획서 목록을 불러오지 못했습니다.
                        </p>
                    )}
                    {downloadError && (
                        <p className="bg-retro-primary px-3 py-2 text-xs font-black">{downloadError}</p>
                    )}
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
                                    onClick={() => setPreview({
                                        name: document.title,
                                        mediaType: "application/pdf",
                                        syllabusId: document.previewId,
                                    })}
                                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 border-2 border-black bg-retro-accent1 px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
                                >
                                    <Eye size={14} strokeWidth={2.5} />
                                    Preview
                                </button>
                                <button
                                    type="button"
                                    disabled={downloading === document.id}
                                    onClick={() => handleDownload(document)}
                                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-40"
                                >
                                    <Download size={14} strokeWidth={2.5} />
                                    {downloading === document.id ? "…" : "Download"}
                                </button>
                            </div>
                        </div>
                    ))}
                    {dynamicFiles.map(({ material, file }) => (
                        <div
                            key={`material-${file.id}`}
                            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <p className="break-words text-sm font-black leading-snug">
                                    {material.title}
                                </p>
                                <p className="mt-1 break-words text-[10px] font-bold text-black/45">
                                    {file.name} · VERIFIED UPLOAD
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                {file.preview_available && (
                                    <button
                                        type="button"
                                        onClick={() => setPreview({
                                            name: file.name,
                                            mediaType: file.preview_media_type || "application/pdf",
                                            fileId: file.id,
                                        })}
                                        className="inline-flex flex-1 items-center justify-center gap-1.5 border-2 border-black bg-retro-accent1 px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none sm:flex-none"
                                    >
                                        <Eye size={14} strokeWidth={2.5} /> Preview
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => downloadMaterialFile(file.id, file.name)}
                                    className="inline-flex flex-1 items-center justify-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none sm:flex-none"
                                >
                                    <Download size={14} strokeWidth={2.5} /> Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <MaterialPreviewModal target={preview} onClose={closePreview} />
        </>
    );
};

export default SyllabusPanel;

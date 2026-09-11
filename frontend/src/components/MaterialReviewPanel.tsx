import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Check,
    Download,
    Eye,
    FileCheck2,
    RefreshCw,
    Star,
    Trash2,
    X,
} from "lucide-react";
import type { Material, MaterialCategory, MaterialSubject } from "../types";
import {
    decideMaterial,
    deleteMaterialAsAdmin,
    downloadMaterialFile,
    getAdminMaterials,
    getMaterialSubjects,
    MATERIAL_CATEGORIES,
    MATERIAL_CATEGORY_LABELS,
} from "../lib/materialsApi";
import MaterialPreviewModal, {
    type MaterialPreviewTarget,
} from "./MaterialPreviewModal";

type ReviewFilter = "pending" | "approved" | "rejected" | "all";

interface Draft {
    title: string;
    subjectId: number;
    category: MaterialCategory;
    description: string;
    rejectionReason: string;
    primarySyllabus: boolean;
}

const makeDraft = (material: Material): Draft => ({
    title: material.title,
    subjectId: material.subject.id,
    category: material.category,
    description: material.description ?? "",
    rejectionReason: material.rejection_reason ?? "",
    primarySyllabus: material.primary_syllabus,
});

const MaterialReviewPanel: React.FC = () => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [subjectOptions, setSubjectOptions] = useState<Record<string, MaterialSubject[]>>({});
    const [filter, setFilter] = useState<ReviewFilter>("pending");
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<MaterialPreviewTarget | null>(null);

    const load = useCallback(async () => {
        setError("");
        try {
            const rows = await getAdminMaterials();
            setMaterials(rows);
            setDrafts(Object.fromEntries(rows.map((row) => [row.id, makeDraft(row)])));
        } catch (reason) {
            const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
            setError(detail || "검수 목록을 불러오지 못했습니다.");
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const counts = useMemo(
        () => ({
            pending: materials.filter((row) => row.status === "pending").length,
            approved: materials.filter((row) => row.status === "approved").length,
            rejected: materials.filter((row) => row.status === "rejected").length,
            all: materials.length,
        }),
        [materials],
    );
    const visible = filter === "all" ? materials : materials.filter((row) => row.status === filter);

    const patchDraft = (id: number, patch: Partial<Draft>) => {
        setDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
    };

    const ensureSubjects = async (material: Material) => {
        const key = `${material.term.year}-${material.term.semester}`;
        if (subjectOptions[key]) return;
        try {
            const rows = await getMaterialSubjects(material.term);
            setSubjectOptions((previous) => ({ ...previous, [key]: rows }));
        } catch {
            setSubjectOptions((previous) => ({ ...previous, [key]: [material.subject] }));
        }
    };

    const decide = async (material: Material, status: "approved" | "rejected") => {
        const draft = drafts[material.id];
        if (!draft) return;
        setBusy(material.id);
        setError("");
        try {
            await decideMaterial(material.id, {
                status,
                title: draft.title,
                subject_id: draft.subjectId,
                category: draft.category,
                description: draft.description,
                rejection_reason: status === "rejected" ? draft.rejectionReason : undefined,
                primary_syllabus: status === "approved" && draft.primarySyllabus,
            });
            await load();
        } catch (reason) {
            const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
            setError(detail || "검수 결과를 저장하지 못했습니다.");
        } finally {
            setBusy(null);
        }
    };

    const remove = async (material: Material) => {
        if (!window.confirm(`“${material.title}” 자료와 저장된 파일을 삭제할까요?`)) return;
        setBusy(material.id);
        try {
            await deleteMaterialAsAdmin(material.id);
            setMaterials((rows) => rows.filter((row) => row.id !== material.id));
        } catch (reason) {
            const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
            setError(detail || "자료를 삭제하지 못했습니다.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {(["pending", "approved", "rejected", "all"] as ReviewFilter[]).map((item) => (
                        <button
                            type="button"
                            key={item}
                            onClick={() => setFilter(item)}
                            className={`border-2 px-3 py-1.5 text-[10px] font-black uppercase transition-all duration-100 ${
                                filter === item ? "border-black bg-black text-white" : "border-black/30 text-black/45 hover:border-black hover:text-black"
                            }`}
                        >
                            {item} {counts[item]}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={load} className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 text-[10px] font-black uppercase shadow-[3px_3px_0_0_rgba(0,0,0,0.12)]">
                    <RefreshCw size={12} /> Refetch
                </button>
            </div>

            {error && <p className="border-2 border-black bg-retro-primary px-3 py-2 text-xs font-black">{error}</p>}

            {visible.length === 0 ? (
                <div className="border-2 border-dashed border-black p-8 text-center">
                    <FileCheck2 size={28} className="mx-auto mb-2 text-black/25" />
                    <p className="text-sm font-bold text-black/40">검수할 자료가 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {visible.map((material) => {
                        const draft = drafts[material.id] ?? makeDraft(material);
                        const key = `${material.term.year}-${material.term.semester}`;
                        const options = subjectOptions[key] ?? [material.subject];
                        return (
                            <article key={material.id} className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]" onMouseEnter={() => ensureSubjects(material)}>
                                <header className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-black bg-retro-accent2 px-4 py-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-black/45">#{material.id} · {material.term.year}-{material.term.semester}</p>
                                        <p className="mt-1 text-xs font-bold">{material.uploader?.username} · {material.uploader?.stu_id ?? "학번 미등록"} · {new Date(material.created_at).toLocaleString("ko-KR")}</p>
                                    </div>
                                    <span className="border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">{material.status}</span>
                                </header>

                                <div className="grid gap-3 border-b-2 border-black p-4 lg:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-black/40">Title</span>
                                        <input value={draft.title} onChange={(event) => patchDraft(material.id, { title: event.target.value })} className="w-full border-2 border-black px-3 py-2 text-sm font-bold" />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-black/40">Subject</span>
                                        <select value={draft.subjectId} onFocus={() => ensureSubjects(material)} onChange={(event) => patchDraft(material.id, { subjectId: Number(event.target.value) })} className="w-full border-2 border-black px-3 py-2 text-sm font-black">
                                            {options.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                                        </select>
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-black/40">Type</span>
                                        <select value={draft.category} onChange={(event) => patchDraft(material.id, { category: event.target.value as MaterialCategory, primarySyllabus: event.target.value === "syllabus" && draft.primarySyllabus })} className="w-full border-2 border-black px-3 py-2 text-sm font-black">
                                            {MATERIAL_CATEGORIES.map((item) => <option key={item} value={item}>{MATERIAL_CATEGORY_LABELS[item]}</option>)}
                                        </select>
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase text-black/40">Description</span>
                                        <input value={draft.description} onChange={(event) => patchDraft(material.id, { description: event.target.value })} className="w-full border-2 border-black px-3 py-2 text-sm font-bold" />
                                    </label>
                                </div>

                                <div className="divide-y-2 divide-black border-b-2 border-black">
                                    {material.files.map((file) => (
                                        <div key={file.id} className="flex items-center gap-2 px-4 py-2.5">
                                            <span className="min-w-0 flex-1 truncate text-xs font-black">{file.name}</span>
                                            {file.preview_available && (
                                                <button type="button" onClick={() => setPreview({ name: file.name, mediaType: file.preview_media_type || "application/pdf", fileId: file.id })} className="grid size-8 place-items-center border-2 border-black bg-retro-accent1" aria-label={`${file.name} preview`}><Eye size={14} /></button>
                                            )}
                                            <button type="button" onClick={() => downloadMaterialFile(file.id, file.name)} className="grid size-8 place-items-center border-2 border-black bg-white" aria-label={`${file.name} download`}><Download size={14} /></button>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-3 p-4">
                                    <div className="flex flex-wrap items-end gap-3">
                                        <label className="min-w-[15rem] flex-1 space-y-1.5">
                                            <span className="text-[10px] font-black uppercase text-black/40">Rejection Reason</span>
                                            <input value={draft.rejectionReason} onChange={(event) => patchDraft(material.id, { rejectionReason: event.target.value })} placeholder="거절할 때 필수" className="w-full border-2 border-black px-3 py-2 text-sm font-bold" />
                                        </label>
                                        {draft.category === "syllabus" && (
                                            <label className="flex h-10 items-center gap-2 border-2 border-black bg-retro-accent2 px-3 text-xs font-black">
                                                <input type="checkbox" checked={draft.primarySyllabus} onChange={(event) => patchDraft(material.id, { primarySyllabus: event.target.checked })} />
                                                <Star size={14} /> Primary
                                            </label>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <button type="button" disabled={busy === material.id} onClick={() => remove(material)} className="grid size-9 place-items-center border-2 border-black bg-white text-retro-primary" aria-label="자료 삭제"><Trash2 size={15} /></button>
                                        <button type="button" disabled={busy === material.id} onClick={() => decide(material, "rejected")} className="flex items-center gap-1.5 border-2 border-black bg-retro-primary px-4 py-2 text-xs font-black uppercase"><X size={15} /> Reject</button>
                                        <button type="button" disabled={busy === material.id} onClick={() => decide(material, "approved")} className="flex items-center gap-1.5 border-2 border-black bg-retro-green px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0_0_rgba(0,0,0,0.18)]"><Check size={15} /> Approve</button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <MaterialPreviewModal target={preview} onClose={() => setPreview(null)} />
        </div>
    );
};

export default MaterialReviewPanel;

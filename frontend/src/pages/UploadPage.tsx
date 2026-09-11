import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
    CheckCircle2,
    Download,
    Eye,
    FileArchive,
    FileUp,
    Pencil,
    RotateCcw,
    Trash2,
    UploadCloud,
    X,
} from "lucide-react";
import PageHeader from "../components/molecules/PageHeader";
import MaterialPreviewModal, {
    type MaterialPreviewTarget,
} from "../components/MaterialPreviewModal";
import type {
    Material,
    MaterialCategory,
    MaterialSubject,
    Term,
} from "../types";
import {
    downloadMaterialFile,
    getMaterialSubjects,
    getMyMaterials,
    MATERIAL_CATEGORIES,
    MATERIAL_CATEGORY_LABELS,
    updateMyMaterial,
    uploadMaterial,
    withdrawMaterial,
} from "../lib/materialsApi";

interface UploadPageProps {
    term: Term | null;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.zip";
const extensionOf = (name: string): string => `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
const ACCEPTED_EXTENSIONS = new Set(ACCEPTED.split(","));

const statusStyle: Record<Material["status"], string> = {
    pending: "bg-retro-accent2",
    approved: "bg-retro-green",
    rejected: "bg-retro-primary",
};

const UploadPage: React.FC<UploadPageProps> = ({ term }) => {
    const fileInput = useRef<HTMLInputElement>(null);
    const [subjects, setSubjects] = useState<MaterialSubject[]>([]);
    const [title, setTitle] = useState("");
    const [subjectId, setSubjectId] = useState<number | "">("");
    const [category, setCategory] = useState<MaterialCategory>("syllabus");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [mine, setMine] = useState<Material[]>([]);
    const [preview, setPreview] = useState<MaterialPreviewTarget | null>(null);
    const [editing, setEditing] = useState<Material | null>(null);
    const [editSubjects, setEditSubjects] = useState<MaterialSubject[]>([]);

    const loadMine = useCallback(() => {
        getMyMaterials().then(setMine).catch(() => setError("내 업로드 기록을 불러오지 못했습니다."));
    }, []);

    useEffect(() => {
        loadMine();
    }, [loadMine]);

    useEffect(() => {
        if (!term) return;
        let active = true;
        setSubjects([]);
        setSubjectId("");
        getMaterialSubjects(term)
            .then((rows) => active && setSubjects(rows))
            .catch(() => active && setError("과목 목록을 불러오지 못했습니다."));
        return () => {
            active = false;
        };
    }, [term]);

    const addFiles = (incoming: File[]) => {
        setError("");
        const invalid = incoming.find((file) => !ACCEPTED_EXTENSIONS.has(extensionOf(file.name)));
        if (invalid) {
            setError(`지원하지 않는 파일입니다: ${invalid.name}`);
            return;
        }
        const oversized = incoming.find((file) => file.size > 50 * 1024 * 1024);
        if (oversized) {
            setError(`50MB를 넘는 파일입니다: ${oversized.name}`);
            return;
        }
        const next = [...files];
        incoming.forEach((file) => {
            if (!next.some((item) => item.name === file.name && item.size === file.size)) {
                next.push(file);
            }
        });
        if (next.length > 20) {
            setError("한 번에 최대 20개 파일을 선택할 수 있습니다.");
            return;
        }
        if (next.reduce((total, file) => total + file.size, 0) > 90 * 1024 * 1024) {
            setError("한 번의 업로드는 총 90MB까지 가능합니다.");
            return;
        }
        setFiles(next);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!term || !subjectId || !title.trim() || files.length === 0) {
            setError("학기·과목·제목·파일을 모두 채워주세요.");
            return;
        }
        setBusy(true);
        setProgress(0);
        setError("");
        setMessage("");
        try {
            await uploadMaterial(
                {
                    title: title.trim(),
                    subjectId,
                    term,
                    category,
                    description,
                    files,
                },
                setProgress,
            );
            setTitle("");
            setSubjectId("");
            setCategory("syllabus");
            setDescription("");
            setFiles([]);
            if (fileInput.current) fileInput.current.value = "";
            setMessage("업로드했습니다. 관리자가 검수하면 자료실에 공개됩니다.");
            loadMine();
        } catch (reason) {
            const detail = axios.isAxiosError(reason)
                ? reason.response?.data?.detail
                : null;
            setError(detail || "업로드하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const startEdit = async (material: Material) => {
        setEditing({ ...material });
        try {
            setEditSubjects(await getMaterialSubjects(material.term));
        } catch {
            setEditSubjects([material.subject]);
        }
    };

    const saveEdit = async () => {
        if (!editing) return;
        setBusy(true);
        setError("");
        try {
            await updateMyMaterial(editing.id, {
                title: editing.title,
                subject_id: editing.subject.id,
                category: editing.category,
                description: editing.description ?? "",
            });
            setEditing(null);
            setMessage("수정했습니다. 승인된 자료였다면 다시 검수 대기 상태가 됩니다.");
            loadMine();
        } catch (reason) {
            const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
            setError(detail || "수정하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const withdraw = async (material: Material) => {
        if (!window.confirm(`“${material.title}” 업로드를 철회할까요?`)) return;
        try {
            await withdrawMaterial(material.id);
            setMine((rows) => rows.filter((row) => row.id !== material.id));
        } catch (reason) {
            const detail = axios.isAxiosError(reason) ? reason.response?.data?.detail : null;
            setError(detail || "철회하지 못했습니다.");
        }
    };

    const selectedSubject = useMemo(
        () => subjects.find((subject) => subject.id === subjectId),
        [subjectId, subjects],
    );

    return (
        <div className="flex flex-col gap-6 pb-20">
            <PageHeader
                title="Upload"
                subtitle={term ? `${term.year}-${term.semester} Share Course Materials` : "Share Course Materials"}
                icon={UploadCloud}
            />

            <form onSubmit={submit} className="border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                <div className="border-b-2 border-black bg-retro-primary px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-widest">Material Details</p>
                </div>
                <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
                    <label className="space-y-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-black/45">Subject *</span>
                        <select
                            value={subjectId}
                            onChange={(event) => setSubjectId(Number(event.target.value) || "")}
                            className="w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] outline-none focus:shadow-none"
                        >
                            <option value="">과목을 선택하세요</option>
                            {subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>{subject.label}</option>
                            ))}
                        </select>
                        {selectedSubject?.english && (
                            <span className="block text-[10px] font-bold text-black/35">{selectedSubject.english}</span>
                        )}
                    </label>
                    <label className="space-y-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-black/45">Type *</span>
                        <select
                            value={category}
                            onChange={(event) => setCategory(event.target.value as MaterialCategory)}
                            className="w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] outline-none focus:shadow-none"
                        >
                            {MATERIAL_CATEGORIES.map((item) => (
                                <option key={item} value={item}>{MATERIAL_CATEGORY_LABELS[item]}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-2 lg:col-span-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-black/45">Title *</span>
                        <input
                            value={title}
                            maxLength={120}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="예: 2026-2 일반물리학2 강의계획서"
                            className="w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] outline-none focus:shadow-none"
                        />
                    </label>
                    <label className="space-y-2 lg:col-span-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-black/45">Description</span>
                        <textarea
                            value={description}
                            maxLength={1000}
                            rows={3}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="자료의 범위나 버전을 적어주세요."
                            className="w-full resize-y border-2 border-black bg-white px-3 py-2.5 text-sm font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] outline-none focus:shadow-none"
                        />
                    </label>
                </div>

                <div className="border-t-2 border-black p-4 sm:p-6">
                    <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept={ACCEPTED}
                        className="hidden"
                        onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
                    />
                    <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            addFiles(Array.from(event.dataTransfer.files));
                        }}
                        className={`flex w-full flex-col items-center gap-3 border-2 border-dashed border-black p-8 text-center transition-colors ${dragging ? "bg-retro-accent1" : "bg-retro-bg hover:bg-retro-accent1/15"}`}
                    >
                        <FileUp size={34} strokeWidth={2.5} />
                        <span className="text-sm font-black">파일을 놓거나 눌러서 선택</span>
                        <span className="text-[10px] font-bold leading-relaxed text-black/45">
                            PDF · PNG · JPG · WEBP · DOCX · PPTX · XLSX · ZIP / 파일당 50MB · 총 90MB
                        </span>
                    </button>

                    {files.length > 0 && (
                        <div className="mt-4 divide-y-2 divide-black border-2 border-black">
                            {files.map((file, index) => (
                                <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 bg-white px-3 py-2.5">
                                    {extensionOf(file.name) === ".zip" ? <FileArchive size={17} /> : <FileUp size={17} />}
                                    <span className="min-w-0 flex-1 truncate text-xs font-black">{file.name}</span>
                                    <span className="text-[10px] font-bold text-black/35">{(file.size / (1024 * 1024)).toFixed(1)}MB</span>
                                    <button
                                        type="button"
                                        aria-label={`${file.name} 제거`}
                                        onClick={() => setFiles((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                                        className="text-black/35 hover:text-black"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t-2 border-black bg-retro-accent2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-bold text-black/55">업로드 후 관리자 승인 전까지 다른 사용자에게 보이지 않습니다.</p>
                    <button
                        type="submit"
                        disabled={busy}
                        className="flex min-w-36 items-center justify-center gap-2 border-2 border-black bg-black px-5 py-3 text-xs font-black uppercase text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.25)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-40"
                    >
                        <UploadCloud size={17} /> {busy ? `${progress}%` : "Submit for Review"}
                    </button>
                </div>
            </form>

            {message && (
                <div className="flex items-center gap-3 border-2 border-black bg-retro-green px-4 py-3 text-sm font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                    <CheckCircle2 size={19} /> {message}
                </div>
            )}
            {error && (
                <div className="border-2 border-black bg-retro-primary px-4 py-3 text-sm font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">{error}</div>
            )}

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Submission History</p>
                        <h2 className="mt-1 text-xl font-black uppercase">My Uploads</h2>
                    </div>
                    <button type="button" onClick={loadMine} className="grid size-9 place-items-center border-2 border-black bg-white shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]" aria-label="업로드 기록 새로고침">
                        <RotateCcw size={15} />
                    </button>
                </div>

                {mine.length === 0 ? (
                    <div className="border-2 border-dashed border-black bg-white p-8 text-center text-sm font-bold text-black/40">아직 올린 자료가 없습니다.</div>
                ) : (
                    <div className="grid items-start gap-4 xl:grid-cols-2">
                        {mine.map((material) => (
                            <article key={material.id} className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.18)]">
                                <header className={`flex items-start justify-between gap-3 border-b-2 border-black px-4 py-3 ${statusStyle[material.status]}`}>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-black/45">{material.term.year}-{material.term.semester} · {material.subject.label}</p>
                                        <h3 className="mt-1 break-words text-sm font-black">{material.title}</h3>
                                    </div>
                                    <span className="shrink-0 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">{material.status}</span>
                                </header>
                                {material.rejection_reason && (
                                    <p className="border-b-2 border-black bg-retro-primary/20 px-4 py-3 text-xs font-bold">거절 사유: {material.rejection_reason}</p>
                                )}
                                <div className="divide-y-2 divide-black">
                                    {material.files.map((file) => (
                                        <div key={file.id} className="flex items-center gap-2 px-4 py-2.5">
                                            <span className="min-w-0 flex-1 truncate text-xs font-black">{file.name}</span>
                                            {file.preview_available && (
                                                <button type="button" onClick={() => setPreview({ name: file.name, mediaType: file.preview_media_type || "application/pdf", fileId: file.id })} className="grid size-8 place-items-center border-2 border-black bg-retro-accent1" aria-label={`${file.name} preview`}>
                                                    <Eye size={14} />
                                                </button>
                                            )}
                                            <button type="button" onClick={() => downloadMaterialFile(file.id, file.name)} className="grid size-8 place-items-center border-2 border-black bg-white" aria-label={`${file.name} download`}>
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <footer className="flex items-center justify-end gap-2 border-t-2 border-black px-4 py-3">
                                    {material.status !== "rejected" && (
                                        <button type="button" onClick={() => startEdit(material)} className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 text-[10px] font-black uppercase">
                                            <Pencil size={13} /> Edit
                                        </button>
                                    )}
                                    {material.status !== "approved" && (
                                        <button type="button" onClick={() => withdraw(material)} className="flex items-center gap-1.5 border-2 border-black bg-retro-primary px-3 py-1.5 text-[10px] font-black uppercase">
                                            <Trash2 size={13} /> Withdraw
                                        </button>
                                    )}
                                </footer>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {editing && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
                    <div className="w-full max-w-lg border-2 border-black bg-white shadow-[8px_8px_0_0_var(--color-retro-accent1)]">
                        <header className="flex items-center justify-between border-b-2 border-black bg-retro-accent1 px-4 py-3">
                            <h2 className="font-black uppercase">Edit Submission</h2>
                            <button type="button" onClick={() => setEditing(null)} className="grid size-8 place-items-center border-2 border-black bg-white"><X size={16} /></button>
                        </header>
                        <div className="space-y-4 p-4">
                            <input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} className="w-full border-2 border-black px-3 py-2 text-sm font-bold" />
                            <select value={editing.subject.id} onChange={(event) => {
                                const selected = editSubjects.find((row) => row.id === Number(event.target.value));
                                if (selected) setEditing({ ...editing, subject: selected });
                            }} className="w-full border-2 border-black px-3 py-2 text-sm font-black">
                                {editSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                            </select>
                            <select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value as MaterialCategory })} className="w-full border-2 border-black px-3 py-2 text-sm font-black">
                                {MATERIAL_CATEGORIES.map((item) => <option key={item} value={item}>{MATERIAL_CATEGORY_LABELS[item]}</option>)}
                            </select>
                            <textarea rows={3} value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} className="w-full border-2 border-black px-3 py-2 text-sm font-bold" />
                        </div>
                        <footer className="flex justify-end gap-2 border-t-2 border-black bg-retro-accent2 p-4">
                            <button type="button" onClick={() => setEditing(null)} className="border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase">Cancel</button>
                            <button type="button" disabled={busy} onClick={saveEdit} className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white">Save</button>
                        </footer>
                    </div>
                </div>
            )}

            <MaterialPreviewModal target={preview} onClose={() => setPreview(null)} />
        </div>
    );
};

export default UploadPage;

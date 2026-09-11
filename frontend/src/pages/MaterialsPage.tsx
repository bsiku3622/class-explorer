import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    BookOpen,
    Download,
    Eye,
    FileText,
    FolderOpen,
    Plus,
    Search,
    Star,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../components/molecules/PageHeader";
import MaterialPreviewModal, {
    type MaterialPreviewTarget,
} from "../components/MaterialPreviewModal";
import type { Material, MaterialCategory, SubjectData, Term } from "../types";
import {
    downloadMaterialFile,
    getApprovedMaterials,
    MATERIAL_CATEGORIES,
    MATERIAL_CATEGORY_LABELS,
} from "../lib/materialsApi";
import { findSyllabiForSubject } from "../lib/syllabi";

interface MaterialsPageProps {
    term: Term | null;
    allClassesData: SubjectData[];
}

type StaticMaterial = {
    id: string;
    subjectId: number;
    subjectLabel: string;
    title: string;
    department: string;
    previewUrl: string;
    downloadUrl: string;
    sourceFormat: "PDF" | "DOCX";
};

const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MaterialsPage: React.FC<MaterialsPageProps> = ({ term, allClassesData }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<MaterialCategory | "all">("all");
    const [subjectId, setSubjectId] = useState<number | "all">("all");
    const [preview, setPreview] = useState<MaterialPreviewTarget | null>(null);
    const [busyFile, setBusyFile] = useState<number | null>(null);

    useEffect(() => {
        const value = new URLSearchParams(location.search).get("subject");
        const parsed = value ? Number(value) : NaN;
        setSubjectId(Number.isFinite(parsed) ? parsed : "all");
    }, [location.search]);

    useEffect(() => {
        if (!term) return;
        let active = true;
        setLoading(true);
        setError("");
        getApprovedMaterials(term)
            .then((rows) => active && setMaterials(rows))
            .catch((reason) => {
                if (!active) return;
                const detail = axios.isAxiosError(reason)
                    ? reason.response?.data?.detail
                    : null;
                setError(detail || "자료실을 불러오지 못했습니다.");
            })
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [term]);

    const staticMaterials = useMemo<StaticMaterial[]>(() => {
        if (!term) return [];
        return allClassesData.flatMap((subject) =>
            findSyllabiForSubject(subject, term).map((document) => ({
                id: document.id,
                subjectId: subject.subject_id,
                subjectLabel: subject.subject,
                title: document.title,
                department: document.department,
                previewUrl: document.previewUrl,
                downloadUrl: document.downloadUrl,
                sourceFormat: document.sourceFormat,
            })),
        );
    }, [allClassesData, term]);

    const subjects = useMemo(() => {
        const labels = new Map<number, string>();
        allClassesData.forEach((subject) => labels.set(subject.subject_id, subject.subject));
        materials.forEach((material) => labels.set(material.subject.id, material.subject.label));
        return [...labels.entries()].sort((a, b) => a[1].localeCompare(b[1], "ko"));
    }, [allClassesData, materials]);

    const normalizedQuery = query.trim().toLowerCase();
    const visibleDynamic = materials.filter((material) => {
        if (category !== "all" && material.category !== category) return false;
        if (subjectId !== "all" && material.subject.id !== subjectId) return false;
        if (!normalizedQuery) return true;
        return [material.title, material.subject.label, material.description ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
    });
    const visibleStatic = staticMaterials.filter((material) => {
        if (category !== "all" && category !== "syllabus") return false;
        if (subjectId !== "all" && material.subjectId !== subjectId) return false;
        if (!normalizedQuery) return true;
        return [material.title, material.subjectLabel, material.department]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
    });

    const closePreview = useCallback(() => setPreview(null), []);

    const handleDownload = async (fileId: number, filename: string) => {
        setBusyFile(fileId);
        setError("");
        try {
            await downloadMaterialFile(fileId, filename);
        } catch {
            setError("파일을 다운로드하지 못했습니다.");
        } finally {
            setBusyFile(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            <PageHeader
                title="Files"
                subtitle={term ? `${term.year}-${term.semester} Course Materials` : "Course Materials"}
                icon={FolderOpen}
                action={
                    <button
                        type="button"
                        onClick={() => navigate("/upload")}
                        className="flex items-center gap-2 border-2 border-black bg-retro-primary px-3 py-2 text-xs font-black uppercase shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    >
                        <Plus size={16} strokeWidth={2.75} /> Upload
                    </button>
                }
            />

            <section className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                <div className="border-b-2 border-black bg-retro-accent1 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-widest">Find Materials</p>
                </div>
                <div className="grid gap-3 p-4 lg:grid-cols-[1fr_15rem]">
                    <label className="flex items-center gap-2 border-2 border-black bg-white px-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] focus-within:shadow-none">
                        <Search size={17} />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="자료명 또는 과목 검색"
                            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-bold outline-none"
                        />
                    </label>
                    <select
                        value={subjectId}
                        onChange={(event) =>
                            setSubjectId(event.target.value === "all" ? "all" : Number(event.target.value))
                        }
                        className="border-2 border-black bg-white px-3 py-2.5 text-sm font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] outline-none focus:shadow-none"
                    >
                        <option value="all">전체 과목</option>
                        {subjects.map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 border-t-2 border-black px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setCategory("all")}
                        className={`border-2 px-3 py-1.5 text-[10px] font-black uppercase transition-all duration-100 ${
                            category === "all" ? "border-black bg-black text-white" : "border-black/30 text-black/50 hover:border-black hover:text-black"
                        }`}
                    >
                        All
                    </button>
                    {MATERIAL_CATEGORIES.map((item) => (
                        <button
                            type="button"
                            key={item}
                            onClick={() => setCategory(item)}
                            className={`border-2 px-3 py-1.5 text-[10px] font-black uppercase transition-all duration-100 ${
                                category === item ? "border-black bg-black text-white" : "border-black/30 text-black/50 hover:border-black hover:text-black"
                            }`}
                        >
                            {MATERIAL_CATEGORY_LABELS[item]}
                        </button>
                    ))}
                </div>
            </section>

            {error && (
                <div className="border-2 border-black bg-retro-primary px-4 py-3 text-sm font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                    {error}
                </div>
            )}

            <div className="flex items-end justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-black/40">
                    {visibleDynamic.length + visibleStatic.length} Materials
                </p>
                <p className="text-[10px] font-bold text-black/35">
                    승인된 자료만 표시됩니다
                </p>
            </div>

            {loading && materials.length === 0 ? (
                <div className="border-2 border-black bg-white p-10 text-center font-black uppercase tracking-widest shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]">
                    Loading materials…
                </div>
            ) : visibleDynamic.length + visibleStatic.length === 0 ? (
                <div className="border-2 border-dashed border-black bg-white p-10 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.12)]">
                    <BookOpen size={30} className="mx-auto mb-3 text-black/30" />
                    <p className="font-black">아직 조건에 맞는 자료가 없습니다.</p>
                    <button
                        type="button"
                        onClick={() => navigate("/upload")}
                        className="mt-4 border-2 border-black bg-retro-accent2 px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
                    >
                        첫 자료 공유하기
                    </button>
                </div>
            ) : (
                <div className="grid items-start gap-5 xl:grid-cols-2">
                    {visibleDynamic.map((material) => (
                        <article
                            key={`dynamic-${material.id}`}
                            className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
                        >
                            <header className="flex items-start justify-between gap-3 border-b-2 border-black bg-retro-accent2 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/50">
                                        {material.subject.label}
                                    </p>
                                    <h2 className="mt-1 break-words text-base font-black">{material.title}</h2>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">
                                    {material.primary_syllabus && <Star size={12} fill="currentColor" />}
                                    {MATERIAL_CATEGORY_LABELS[material.category]}
                                </div>
                            </header>
                            {material.description && (
                                <p className="border-b-2 border-black px-4 py-3 text-xs font-bold leading-relaxed text-black/55">
                                    {material.description}
                                </p>
                            )}
                            <div className="divide-y-2 divide-black">
                                {material.files.map((file) => (
                                    <div key={file.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-black">{file.name}</p>
                                            <p className="mt-1 text-[10px] font-bold text-black/35">{formatBytes(file.size_bytes)}</p>
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
                                                    className="flex flex-1 items-center justify-center gap-1.5 border-2 border-black bg-retro-accent1 px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                                                >
                                                    <Eye size={14} /> Preview
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                disabled={busyFile === file.id}
                                                onClick={() => handleDownload(file.id, file.name)}
                                                className="flex flex-1 items-center justify-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none disabled:opacity-40"
                                            >
                                                <Download size={14} /> {busyFile === file.id ? "…" : "Download"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}

                    {visibleStatic.map((material) => (
                        <article
                            key={`static-${material.id}`}
                            className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
                        >
                            <header className="flex items-start justify-between gap-3 border-b-2 border-black bg-retro-accent2 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-black/50">{material.subjectLabel}</p>
                                    <h2 className="mt-1 break-words text-base font-black">{material.title}</h2>
                                </div>
                                <span className="shrink-0 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">Syllabus</span>
                            </header>
                            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="flex items-center gap-2 text-sm font-black"><FileText size={15} /> {material.sourceFormat} ORIGINAL</p>
                                    <p className="mt-1 text-[10px] font-bold text-black/35">{material.department}</p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPreview({ name: material.title, mediaType: "application/pdf", url: material.previewUrl })}
                                        className="flex flex-1 items-center justify-center gap-1.5 border-2 border-black bg-retro-accent1 px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                                    >
                                        <Eye size={14} /> Preview
                                    </button>
                                    <a
                                        href={material.downloadUrl}
                                        download
                                        className="flex flex-1 items-center justify-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                                    >
                                        <Download size={14} /> Download
                                    </a>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <MaterialPreviewModal target={preview} onClose={closePreview} />
        </div>
    );
};

export default MaterialsPage;

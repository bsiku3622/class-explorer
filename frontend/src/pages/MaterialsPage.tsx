import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    BookOpen,
    Download,
    Eye,
    FileText,
    FolderOpen,
    Plus,
    Star,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
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
import {
    downloadSyllabus,
    findSyllabiForSubject,
    hasSyllabusTerm,
    type SyllabusDocument,
} from "../lib/syllabi";
import { useSyllabusFiles } from "../hooks/useSyllabusFiles";
import SearchInput from "../components/atoms/SearchInput";
import {
    Badge,
    Button,
    Card,
    Divider,
    EmptyState,
    Notice,
    PageHeader,
    SegmentedControl,
    Select,
    Surface,
    Text,
} from "@studio-baeks/funky-ui";

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
    sourceFormat: "PDF" | "DOCX";
    /** 미리보기·내려받기에 쓰는 서버 문서 (`lib/syllabi.ts`) */
    document: SyllabusDocument;
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
    const [busySyllabus, setBusySyllabus] = useState<string | null>(null);
    const syllabi = useSyllabusFiles(hasSyllabusTerm(term));

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
            findSyllabiForSubject(subject, term, syllabi.files).map((document) => ({
                id: document.id,
                subjectId: subject.subject_id,
                subjectLabel: subject.subject,
                title: document.title,
                department: document.department,
                sourceFormat: document.sourceFormat,
                document,
            })),
        );
    }, [allClassesData, term, syllabi.files]);

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

    const handleSyllabusDownload = async (doc: SyllabusDocument) => {
        setBusySyllabus(doc.id);
        setError("");
        try {
            await downloadSyllabus(doc);
        } catch {
            setError("강의계획서를 내려받지 못했습니다.");
        } finally {
            setBusySyllabus(null);
        }
    };

    const notice = error || (syllabi.error ? "강의계획서 목록을 불러오지 못했습니다." : "");

    return (
        <div className="flex flex-col gap-6 pb-20">
            <PageHeader
                title="Files"
                subtitle={term ? `${term.year}-${term.semester} Course Materials` : "Course Materials"}
                icon={FolderOpen}
                action={
                    <Button
                        size="sm"
                        accent="pink"
                        variant="solid"
                        shadow
                        icon={Plus}
                        onClick={() => navigate("/upload")}
                    >
                        Upload
                    </Button>
                }
            />

            <Card shadow="raised" as="section" padding="0">
                <Card.Header title="Find Materials" tone="bar" accent="cyan" />
                <div className="grid gap-3 p-4 lg:grid-cols-[1fr_15rem]">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="자료명 또는 과목 검색"
                    />
                    <Select
                        shadow
                        value={subjectId}
                        onChange={(event) =>
                            setSubjectId(event.target.value === "all" ? "all" : Number(event.target.value))
                        }
                    >
                        <option value="all">전체 과목</option>
                        {subjects.map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                        ))}
                    </Select>
                </div>
                <Surface fill="none" border="line" borderSide="top" className="px-4 py-3">
                    <SegmentedControl<MaterialCategory | "all">
                        aria-label="자료 유형"
                        size="xs"
                        value={category}
                        onChange={setCategory}
                        options={[
                            { value: "all", label: "All" },
                            ...MATERIAL_CATEGORIES.map((item) => ({
                                value: item,
                                label: MATERIAL_CATEGORY_LABELS[item],
                            })),
                        ]}
                    />
                </Surface>
            </Card>

            {notice && (
                <Notice accent="pink" variant="solid" shadow role="alert">{notice}</Notice>
            )}

            <div className="flex items-end justify-between gap-3">
                <Text as="p" variant="overline">
                    {visibleDynamic.length + visibleStatic.length} Materials
                </Text>
                <Text as="p" variant="micro" tone="muted">
                    {syllabi.loading ? "강의계획서 목록을 불러오는 중…" : "승인된 자료만 표시됩니다"}
                </Text>
            </div>

            {loading && materials.length === 0 ? (
                <Card shadow="raised" padding="0" className="p-10 text-center">
                    <Text variant="overline" tone="primary">Loading materials…</Text>
                </Card>
            ) : visibleDynamic.length + visibleStatic.length === 0 ? (
                <EmptyState
                    framed
                    icon={BookOpen}
                    title="아직 조건에 맞는 자료가 없습니다."
                    action={
                        <Button size="lg" accent="yellow" variant="solid" shadow onClick={() => navigate("/upload")}>
                            첫 자료 공유하기
                        </Button>
                    }
                />
            ) : (
                <div className="grid items-start gap-5 xl:grid-cols-2">
                    {visibleDynamic.map((material) => (
                        <Card shadow="raised" as="article" key={`dynamic-${material.id}`} padding="0">
                            <Card.Strip accent="yellow" placement="top" className="flex items-start justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <Text as="p" variant="overline">
                                        {material.subject.label}
                                    </Text>
                                    <Text as="h2" variant="subheading" className="mt-1 break-words">{material.title}</Text>
                                </div>
                                <Badge variant="paper" className="shrink-0">
                                    {material.primary_syllabus && <Star size={12} fill="currentColor" />}
                                    {MATERIAL_CATEGORY_LABELS[material.category]}
                                </Badge>
                            </Card.Strip>
                            {material.description && (
                                <Surface fill="none" border="line" borderSide="bottom" className="px-4 py-3">
                                    <Text as="p" variant="caption" tone="secondary" leading="relaxed">
                                        {material.description}
                                    </Text>
                                </Surface>
                            )}
                            <div>
                                {material.files.map((file, index) => (
                                    <React.Fragment key={file.id}>
                                        {index > 0 && <Divider tone="line" />}
                                        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <Text as="p" weight="black" className="break-words">{file.name}</Text>
                                                <Text as="p" variant="micro" tone="muted" className="mt-1">{formatBytes(file.size_bytes)}</Text>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                {file.preview_available && (
                                                    <Button
                                                        size="sm"
                                                        accent="cyan"
                                                        variant="solid"
                                                        shadow
                                                        icon={Eye}
                                                        onClick={() => setPreview({
                                                            name: file.name,
                                                            mediaType: file.preview_media_type || "application/pdf",
                                                            fileId: file.id,
                                                        })}
                                                        className="flex-1"
                                                    >
                                                        Preview
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="paper"
                                                    shadow
                                                    icon={Download}
                                                    disabled={busyFile === file.id}
                                                    onClick={() => handleDownload(file.id, file.name)}
                                                    className="flex-1"
                                                >
                                                    {busyFile === file.id ? "…" : "Download"}
                                                </Button>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </Card>
                    ))}

                    {visibleStatic.map((material) => (
                        <Card shadow="raised" as="article" key={`static-${material.id}`} padding="0">
                            <Card.Strip accent="yellow" placement="top" className="flex items-start justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <Text as="p" variant="overline">{material.subjectLabel}</Text>
                                    <Text as="h2" variant="subheading" className="mt-1 break-words">{material.title}</Text>
                                </div>
                                <Badge variant="paper" className="shrink-0">Syllabus</Badge>
                            </Card.Strip>
                            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <Text as="p" weight="black" className="flex items-center gap-2"><FileText size={15} /> {material.sourceFormat} ORIGINAL</Text>
                                    <Text as="p" variant="micro" tone="muted" className="mt-1">{material.department}</Text>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        size="sm"
                                        accent="cyan"
                                        variant="solid"
                                        shadow
                                        icon={Eye}
                                        onClick={() => setPreview({ name: material.title, mediaType: "application/pdf", syllabusId: material.document.previewId })}
                                        className="flex-1"
                                    >
                                        Preview
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="paper"
                                        shadow
                                        icon={Download}
                                        disabled={busySyllabus === material.id}
                                        onClick={() => handleSyllabusDownload(material.document)}
                                        className="flex-1"
                                    >
                                        {busySyllabus === material.id ? "…" : "Download"}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <MaterialPreviewModal target={preview} onClose={closePreview} />
        </div>
    );
};

export default MaterialsPage;

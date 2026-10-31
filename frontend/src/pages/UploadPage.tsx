import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
    Badge,
    Button,
    Card,
    Divider,
    EmptyState,
    FileDrop,
    FormField,
    IconButton,
    Input,
    Modal,
    Notice,
    PageHeader,
    Select,
    Surface,
    Text,
    Textarea,
    type AccentName,
} from "@studio-baeks/funky-ui";

interface UploadPageProps {
    term: Term | null;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.zip";
const extensionOf = (name: string): string => `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
const ACCEPTED_EXTENSIONS = new Set(ACCEPTED.split(","));
const OFFICE_EXTENSIONS = new Set([".docx", ".pptx", ".xlsx"]);

const statusStyle: Record<Material["status"], AccentName> = {
    pending: "yellow",
    approved: "green",
    rejected: "pink",
};

const UploadPage: React.FC<UploadPageProps> = ({ term }) => {
    const [subjects, setSubjects] = useState<MaterialSubject[]>([]);
    const [title, setTitle] = useState("");
    const [subjectId, setSubjectId] = useState<number | "">("");
    const [category, setCategory] = useState<MaterialCategory>("syllabus");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
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
        if (next.filter((file) => OFFICE_EXTENSIONS.has(extensionOf(file.name))).length > 10) {
            setError("PDF preview로 변환할 Office 문서는 한 번에 10개까지 가능합니다.");
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

            <Card as="form" padding="0" onSubmit={submit}>
                <Card.Header title="Material Details" tone="bar" accent="pink" />
                <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
                    <FormField label="Subject *" hint={selectedSubject?.english}>
                        <Select
                            value={subjectId}
                            onChange={(event) => setSubjectId(Number(event.target.value) || "")}
                        >
                            <option value="">과목을 선택하세요</option>
                            {subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>{subject.label}</option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Type *">
                        <Select
                            value={category}
                            onChange={(event) => setCategory(event.target.value as MaterialCategory)}
                        >
                            {MATERIAL_CATEGORIES.map((item) => (
                                <option key={item} value={item}>{MATERIAL_CATEGORY_LABELS[item]}</option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Title *" className="lg:col-span-2">
                        <Input
                            value={title}
                            maxLength={120}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="예: 2026-2 일반물리학2 강의계획서"
                        />
                    </FormField>
                    <FormField label="Description" className="lg:col-span-2">
                        <Textarea
                            value={description}
                            maxLength={1000}
                            rows={3}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="자료의 범위나 버전을 적어주세요."
                        />
                    </FormField>
                </div>

                <Surface fill="none" border="line" borderSide="top" className="p-4 sm:p-6">
                    <FileDrop
                        multiple
                        accept={ACCEPTED}
                        icon={FileUp}
                        title="파일을 놓거나 눌러서 선택"
                        onFiles={addFiles}
                    >
                        PDF · PNG · JPG · WEBP · DOCX · PPTX · XLSX · ZIP / 파일당 50MB · 총 90MB
                    </FileDrop>

                    {files.length > 0 && (
                        <Surface border="line" className="mt-4">
                            {files.map((file, index) => (
                                <React.Fragment key={`${file.name}-${file.size}`}>
                                    {index > 0 && <Divider tone="line" />}
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                        {extensionOf(file.name) === ".zip" ? <FileArchive size={17} /> : <FileUp size={17} />}
                                        <Text variant="caption" weight="black" truncate className="min-w-0 flex-1">{file.name}</Text>
                                        <Text variant="micro" tone="muted">{(file.size / (1024 * 1024)).toFixed(1)}MB</Text>
                                        <IconButton
                                            icon={X}
                                            size="xs"
                                            label={`${file.name} 제거`}
                                            onClick={() => setFiles((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                        </Surface>
                    )}
                </Surface>

                <Card.Strip accent="yellow" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Text variant="caption" tone="secondary">업로드 후 관리자 승인 전까지 다른 사용자에게 보이지 않습니다.</Text>
                    <Button size="lg"
                        type="submit"
                        variant="filled"
                        shadow
                        disabled={busy}
                        icon={UploadCloud}
                        className="min-w-36 justify-center"
                    >
                        {busy ? `${progress}%` : "Submit for Review"}
                    </Button>
                </Card.Strip>
            </Card>

            {message && (
                <Notice accent="success" variant="solid" shadow icon={CheckCircle2}>{message}</Notice>
            )}
            {error && (
                <Notice accent="pink" variant="solid" shadow role="alert">{error}</Notice>
            )}

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <Text as="p" variant="overline">Submission History</Text>
                        <Text as="h2" variant="heading" className="mt-1 uppercase">My Uploads</Text>
                    </div>
                    <IconButton icon={RotateCcw} size="sm" variant="paper" shadow onClick={loadMine} label="업로드 기록 새로고침" />
                </div>

                {mine.length === 0 ? (
                    <EmptyState framed title="아직 올린 자료가 없습니다." />
                ) : (
                    <div className="grid items-start gap-4 xl:grid-cols-2">
                        {mine.map((material) => (
                            <Card as="article" key={material.id} padding="0">
                                <Card.Strip accent={statusStyle[material.status]} placement="top" className="flex items-start justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <Text as="p" variant="overline">{material.term.year}-{material.term.semester} · {material.subject.label}</Text>
                                        <Text as="h3" weight="black" className="mt-1 break-words">{material.title}</Text>
                                    </div>
                                    <Badge variant="paper" className="shrink-0">{material.status}</Badge>
                                </Card.Strip>
                                {material.rejection_reason && (
                                    <Card.Strip accent="pink" variant="tinted" placement="top" className="py-3">
                                        <Text as="p" variant="caption">거절 사유: {material.rejection_reason}</Text>
                                    </Card.Strip>
                                )}
                                <div>
                                    {material.files.map((file, index) => (
                                        <React.Fragment key={file.id}>
                                            {index > 0 && <Divider tone="line" />}
                                            <div className="flex items-center gap-2 px-4 py-2.5">
                                                <Text variant="caption" weight="black" truncate className="min-w-0 flex-1">{file.name}</Text>
                                                {file.preview_available && (
                                                    <IconButton icon={Eye} size="sm" accent="cyan" variant="solid" onClick={() => setPreview({ name: file.name, mediaType: file.preview_media_type || "application/pdf", fileId: file.id })} label={`${file.name} preview`} />
                                                )}
                                                <IconButton icon={Download} size="sm" variant="paper" onClick={() => downloadMaterialFile(file.id, file.name)} label={`${file.name} download`} />
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <Surface as="footer" fill="none" border="line" borderSide="top" className="flex items-center justify-end gap-2 px-4 py-3">
                                    {material.status !== "rejected" && (
                                        <Button size="xs" variant="paper" icon={Pencil} onClick={() => startEdit(material)}>Edit</Button>
                                    )}
                                    {material.status !== "approved" && (
                                        <Button size="xs" accent="pink" variant="solid" icon={Trash2} onClick={() => withdraw(material)}>Withdraw</Button>
                                    )}
                                </Surface>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {editing && (
                <Modal
                    open
                    onClose={() => setEditing(null)}
                    title="Edit Submission"
                    accent="cyan"
                    footerAccent="yellow"
                    footer={<>
                        <Button size="lg" variant="paper" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="lg" variant="filled" disabled={busy} onClick={saveEdit}>Save</Button>
                    </>}
                >
                    <div className="space-y-4">
                        <Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
                        <Select value={editing.subject.id} onChange={(event) => {
                            const selected = editSubjects.find((row) => row.id === Number(event.target.value));
                            if (selected) setEditing({ ...editing, subject: selected });
                        }}>
                            {editSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                        </Select>
                        <Select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value as MaterialCategory })}>
                            {MATERIAL_CATEGORIES.map((item) => <option key={item} value={item}>{MATERIAL_CATEGORY_LABELS[item]}</option>)}
                        </Select>
                        <Textarea rows={3} value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
                    </div>
                </Modal>
            )}

            <MaterialPreviewModal target={preview} onClose={() => setPreview(null)} />
        </div>
    );
};

export default UploadPage;

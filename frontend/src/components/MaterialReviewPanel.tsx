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
import {
    Badge,
    Button,
    Card,
    Checkbox,
    Divider,
    EmptyState,
    FormField,
    IconButton,
    Input,
    Notice,
    Paint,
    SegmentedControl,
    Select,
    Surface,
    Text,
} from "@studio-baeks/funky-ui";

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
                <SegmentedControl
                    aria-label="검수 상태"
                    value={filter}
                    onChange={setFilter}
                    options={(["pending", "approved", "rejected", "all"] as ReviewFilter[]).map((item) => ({
                        value: item,
                        label: `${item} ${counts[item]}`,
                    }))}
                />
                <Button size="xs" variant="paper" shadow icon={RefreshCw} onClick={load}>Refetch</Button>
            </div>

            {error && <Notice accent="pink" variant="solid" role="alert">{error}</Notice>}

            {visible.length === 0 ? (
                <EmptyState framed icon={FileCheck2} title="검수할 자료가 없습니다." />
            ) : (
                <div className="space-y-4">
                    {visible.map((material) => {
                        const draft = drafts[material.id] ?? makeDraft(material);
                        const key = `${material.term.year}-${material.term.semester}`;
                        const options = subjectOptions[key] ?? [material.subject];
                        return (
                            <Card shadow="raised" as="article" key={material.id} padding="0" onMouseEnter={() => ensureSubjects(material)}>
                                <Card.Strip accent="yellow" placement="top" className="flex flex-wrap items-start justify-between gap-2 py-3">
                                    <div>
                                        <Text as="p" variant="overline">#{material.id} · {material.term.year}-{material.term.semester}</Text>
                                        <Text as="p" variant="caption" className="mt-1">{material.uploader?.username} · {material.uploader?.stu_id ?? "학번 미등록"} · {new Date(material.created_at).toLocaleString("ko-KR")}</Text>
                                    </div>
                                    <Badge variant="paper">{material.status}</Badge>
                                </Card.Strip>

                                <Surface fill="none" border="line" borderSide="bottom" className="grid gap-3 p-4 lg:grid-cols-2">
                                    <FormField label="Title">
                                        <Input value={draft.title} onChange={(event) => patchDraft(material.id, { title: event.target.value })} />
                                    </FormField>
                                    <FormField label="Subject">
                                        <Select value={draft.subjectId} onFocus={() => ensureSubjects(material)} onChange={(event) => patchDraft(material.id, { subjectId: Number(event.target.value) })}>
                                            {options.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                                        </Select>
                                    </FormField>
                                    <FormField label="Type">
                                        <Select value={draft.category} onChange={(event) => patchDraft(material.id, { category: event.target.value as MaterialCategory, primarySyllabus: event.target.value === "syllabus" && draft.primarySyllabus })}>
                                            {MATERIAL_CATEGORIES.map((item) => <option key={item} value={item}>{MATERIAL_CATEGORY_LABELS[item]}</option>)}
                                        </Select>
                                    </FormField>
                                    <FormField label="Description">
                                        <Input value={draft.description} onChange={(event) => patchDraft(material.id, { description: event.target.value })} />
                                    </FormField>
                                </Surface>

                                <Surface fill="none" border="line" borderSide="bottom">
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
                                </Surface>

                                <div className="space-y-3 p-4">
                                    <div className="flex flex-wrap items-end gap-3">
                                        <FormField label="Rejection Reason" className="min-w-[15rem] flex-1">
                                            <Input value={draft.rejectionReason} onChange={(event) => patchDraft(material.id, { rejectionReason: event.target.value })} placeholder="거절할 때 필수" />
                                        </FormField>
                                        {draft.category === "syllabus" && (
                                            <Paint accent="yellow" variant="solid" className="flex h-10 items-center px-3">
                                                <Checkbox checked={draft.primarySyllabus} onChange={(event) => patchDraft(material.id, { primarySyllabus: event.target.checked })}>
                                                    <Text variant="caption" weight="black" tone="inherit" className="inline-flex items-center gap-2"><Star size={14} /> Primary</Text>
                                                </Checkbox>
                                            </Paint>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <IconButton icon={Trash2} accent="pink" variant="plain" disabled={busy === material.id} onClick={() => remove(material)} label="자료 삭제" />
                                        <Button size="sm" accent="pink" variant="solid" icon={X} disabled={busy === material.id} onClick={() => decide(material, "rejected")}>Reject</Button>
                                        <Button size="sm" accent="green" variant="solid" shadow icon={Check} disabled={busy === material.id} onClick={() => decide(material, "approved")}>Approve</Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <MaterialPreviewModal target={preview} onClose={() => setPreview(null)} />
        </div>
    );
};

export default MaterialReviewPanel;

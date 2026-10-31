import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { Badge, Button, Card, Divider, Notice, Surface, Text } from "@studio-baeks/funky-ui";
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
            <Card shadow="raised"
                as="section"
                padding="0"
                aria-label={`${subject.subject} syllabus`}
            >
                <Card.Strip accent="yellow" placement="top" className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText size={17} strokeWidth={2.75} className="shrink-0" />
                        <Text as="h3" weight="black">Syllabus</Text>
                    </div>
                    <Badge variant="paper" size="sm" className="shrink-0">
                        {totalFiles} {totalFiles === 1 ? "FILE" : "FILES"}
                    </Badge>
                </Card.Strip>

                <Surface fill="none">
                    {syllabi.loading && (
                        <Text as="p" variant="overline" className="px-3 py-3">
                            Loading syllabus…
                        </Text>
                    )}
                    {syllabi.error && (
                        <Text as="p" variant="caption" weight="black" className="block px-3 py-3">
                            강의계획서 목록을 불러오지 못했습니다.
                        </Text>
                    )}
                    {downloadError && (
                        <Notice accent="pink" variant="solid" role="alert">{downloadError}</Notice>
                    )}
                    {documents.map((document, index) => (
                        <React.Fragment key={document.id}>
                            {index > 0 && <Divider tone="line" />}
                            <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <Text as="p" weight="black" className="break-words">
                                        {document.title}
                                    </Text>
                                    <Text as="p" variant="micro" tone="muted" className="mt-1 break-words">
                                        {document.department} · {document.sourceFormat}
                                    </Text>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button
                                        size="sm"
                                        accent="cyan"
                                        variant="solid"
                                        shadow
                                        icon={Eye}
                                        uppercase={false}
                                        onClick={() => setPreview({
                                            name: document.title,
                                            mediaType: "application/pdf",
                                            syllabusId: document.previewId,
                                        })}
                                        className="flex-1 sm:flex-none"
                                    >
                                        Preview
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="paper"
                                        shadow
                                        icon={Download}
                                        uppercase={false}
                                        disabled={downloading === document.id}
                                        onClick={() => handleDownload(document)}
                                        className="flex-1 sm:flex-none"
                                    >
                                        {downloading === document.id ? "…" : "Download"}
                                    </Button>
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                    {dynamicFiles.map(({ material, file }, index) => (
                        <React.Fragment key={`material-${file.id}`}>
                            {(documents.length > 0 || index > 0) && <Divider tone="line" />}
                            <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <Text as="p" weight="black" className="break-words">
                                        {material.title}
                                    </Text>
                                    <Text as="p" variant="micro" tone="muted" className="mt-1 break-words">
                                        {file.name} · VERIFIED UPLOAD
                                    </Text>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {file.preview_available && (
                                        <Button
                                            size="sm"
                                            accent="cyan"
                                            variant="solid"
                                            shadow
                                            icon={Eye}
                                            uppercase={false}
                                            onClick={() => setPreview({
                                                name: file.name,
                                                mediaType: file.preview_media_type || "application/pdf",
                                                fileId: file.id,
                                            })}
                                            className="flex-1 sm:flex-none"
                                        >
                                            Preview
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="paper"
                                        shadow
                                        icon={Download}
                                        uppercase={false}
                                        onClick={() => downloadMaterialFile(file.id, file.name)}
                                        className="flex-1 sm:flex-none"
                                    >
                                        Download
                                    </Button>
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                </Surface>
            </Card>

            <MaterialPreviewModal target={preview} onClose={closePreview} />
        </>
    );
};

export default SyllabusPanel;

import React, { useEffect, useState } from "react";
import { ExternalLink, FileWarning } from "lucide-react";
import { Card, IconButton, Modal, Spinner, Surface, Text } from "@studio-baeks/funky-ui";
import { getMaterialFileBlob } from "../lib/materialsApi";
import { getSyllabusBlob } from "../lib/syllabi";

export interface MaterialPreviewTarget {
    name: string;
    mediaType: string;
    /** 자료실 파일 — `/materials/files/{id}/preview` */
    fileId?: number;
    /** 2026-1 강의계획서 — `/syllabi/{id}` (`lib/syllabi.ts`) */
    syllabusId?: string;
}

interface MaterialPreviewModalProps {
    target: MaterialPreviewTarget | null;
    onClose: () => void;
}

const MaterialPreviewContent: React.FC<{
    target: MaterialPreviewTarget;
    onClose: () => void;
}> = ({
    target,
    onClose,
}) => {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;

        const load = target.syllabusId !== undefined
            ? getSyllabusBlob(target.syllabusId)
            : target.fileId !== undefined
              ? getMaterialFileBlob(target.fileId, "preview")
              : null;
        if (load) {
            load
                .then((blob) => {
                    if (!active) return;
                    objectUrl = URL.createObjectURL(blob);
                    setUrl(objectUrl);
                })
                .catch(() => active && setError("Preview를 불러오지 못했습니다."));
        } else {
            Promise.resolve().then(() => active && setError("Preview 주소가 없습니다."));
        }

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [target, onClose]);

    const isImage = target.mediaType.startsWith("image/");

    return (
        <Modal
            open
            onClose={onClose}
            size="full"
            flush
            accent="yellow"
            title={target.name}
            titleUppercase={false}
            subtitle="AUTHENTICATED PREVIEW"
            closeLabel="Close preview"
            actions={url && (
                <IconButton
                    as="a"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    icon={ExternalLink}
                    label="Open preview in a new tab"
                    variant="paper"
                    shadow
                    size="sm"
                />
            )}
        >
            <Surface fill="inverse" className="flex h-full min-h-0 flex-1 items-center justify-center">
                {!url && !error && (
                    <div className="flex flex-col items-center gap-3">
                        <Spinner size="lg" label="Loading preview" />
                        <Text variant="overline" tone="inverseMuted">
                            Loading preview
                        </Text>
                    </div>
                )}
                {error && (
                    <Card shadow="raised" className="m-5 flex max-w-sm flex-col items-center gap-3 text-center">
                        <FileWarning size={28} />
                        <Text as="p" weight="black">{error}</Text>
                    </Card>
                )}
                {url && isImage && (
                    <img
                        src={url}
                        alt={target.name}
                        className="max-h-full max-w-full object-contain"
                    />
                )}
                {url && !isImage && (
                    <iframe
                        src={`${url}#view=FitH`}
                        title={`${target.name} preview`}
                        className="h-full w-full"
                    />
                )}
            </Surface>
        </Modal>
    );
};

const MaterialPreviewModal: React.FC<MaterialPreviewModalProps> = ({
    target,
    onClose,
}) => {
    if (!target) return null;
    const key = target.syllabusId ?? String(target.fileId ?? target.name);
    return <MaterialPreviewContent key={key} target={target} onClose={onClose} />;
};

export default MaterialPreviewModal;

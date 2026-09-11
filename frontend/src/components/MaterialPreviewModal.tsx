import React, { useEffect, useState } from "react";
import { ExternalLink, FileWarning, LoaderCircle, X } from "lucide-react";
import { getMaterialFileBlob } from "../lib/materialsApi";

export interface MaterialPreviewTarget {
    name: string;
    mediaType: string;
    fileId?: number;
    url?: string;
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
    const [url, setUrl] = useState<string | null>(target.url ?? null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;

        if (!target.url && target.fileId !== undefined) {
            getMaterialFileBlob(target.fileId, "preview")
                .then((blob) => {
                    if (!active) return;
                    objectUrl = URL.createObjectURL(blob);
                    setUrl(objectUrl);
                })
                .catch(() => active && setError("Preview를 불러오지 못했습니다."));
        } else if (!target.url) {
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
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`${target.name} preview`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 sm:p-5"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="flex h-full max-h-[96vh] w-full max-w-6xl flex-col border-2 border-black bg-white shadow-[8px_8px_0_0_var(--color-retro-accent2)]">
                <header className="flex items-start justify-between gap-3 border-b-2 border-black bg-retro-accent2 px-3 py-3 sm:px-4">
                    <div className="min-w-0">
                        <p className="break-words text-sm font-black leading-tight sm:text-base">
                            {target.name}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-black/50">
                            AUTHENTICATED PREVIEW
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        {url && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Open preview in a new tab"
                                className="grid size-9 place-items-center border-2 border-black bg-white shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                            >
                                <ExternalLink size={16} strokeWidth={2.5} />
                            </a>
                        )}
                        <button
                            type="button"
                            autoFocus
                            onClick={onClose}
                            aria-label="Close preview"
                            className="grid size-9 place-items-center border-2 border-black bg-retro-primary shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                        >
                            <X size={18} strokeWidth={2.75} />
                        </button>
                    </div>
                </header>

                <div className="flex min-h-0 flex-1 items-center justify-center bg-black/70">
                    {!url && !error && (
                        <div className="flex flex-col items-center gap-3 text-white">
                            <LoaderCircle size={30} className="animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest">
                                Loading preview
                            </span>
                        </div>
                    )}
                    {error && (
                        <div className="m-5 flex max-w-sm flex-col items-center gap-3 border-2 border-black bg-white p-6 text-center shadow-[4px_4px_0_0_var(--color-retro-primary)]">
                            <FileWarning size={28} />
                            <p className="text-sm font-black">{error}</p>
                        </div>
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
                </div>
            </div>
        </div>
    );
};

const MaterialPreviewModal: React.FC<MaterialPreviewModalProps> = ({
    target,
    onClose,
}) => {
    if (!target) return null;
    const key = target.url ?? String(target.fileId ?? target.name);
    return <MaterialPreviewContent key={key} target={target} onClose={onClose} />;
};

export default MaterialPreviewModal;

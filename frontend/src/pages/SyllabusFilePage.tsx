/**
 * 강의계획서 한 장 — Ask 답의 근거 링크가 여는 자리(`/syllabus/:id`).
 *
 * 파일은 인증 헤더를 붙여야 받을 수 있어서(`lib/syllabi.ts`) 서버 주소를 그대로 링크로 걸 수 없습니다. 앱 화면으로
 * 걸면 저장된 세션으로 받아 옵니다. docx 는 같은 자리의 `.preview.pdf` 를 보여 줍니다 — 없으면 브라우저가 그릴 수
 * 없어서 내려받기만 합니다.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Button, Spinner, Text } from "@studio-baeks/funky-ui";
import MaterialPreviewModal, { type MaterialPreviewTarget } from "../components/MaterialPreviewModal";
import { downloadSyllabus, fetchSyllabusFiles, type SyllabusDocument } from "../lib/syllabi";

type Found =
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "preview"; target: MaterialPreviewTarget }
    | { kind: "download"; document: SyllabusDocument };

const SyllabusFilePage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [found, setFound] = useState<Found>({ kind: "loading" });
    const close = useCallback(() => navigate("/"), [navigate]);

    useEffect(() => {
        let active = true;
        fetchSyllabusFiles()
            .then((files) => {
                if (!active) return;
                const file = files.find((f) => f.id === id);
                if (!file) {
                    setFound({ kind: "missing" });
                    return;
                }
                const filename = file.path.split("/").pop() ?? file.path;
                const title = filename.replace(/\.(pdf|docx)$/i, "");
                const preview = file.format === "docx"
                    ? files.find((f) => f.path === file.path.replace(/\.docx$/i, ".preview.pdf"))
                    : file;
                if (preview) {
                    setFound({ kind: "preview", target: { name: title, mediaType: "application/pdf", syllabusId: preview.id } });
                } else {
                    setFound({ kind: "download", document: {
                        id: file.id, previewId: file.id, title, filename, department: "", sourceFormat: "DOCX",
                    } });
                }
            })
            .catch(() => active && setFound({ kind: "missing" }));
        return () => {
            active = false;
        };
    }, [id]);

    if (found.kind === "preview") return <MaterialPreviewModal target={found.target} onClose={close} />;
    return (
        <Text as="div" className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
            {found.kind === "loading" && <Spinner />}
            {found.kind === "missing" && <p>강의계획서를 찾지 못했습니다.</p>}
            {found.kind === "download" && (
                <Button size="lg"
                    variant="paper"
                    shadow
                    icon={Download}
                    uppercase={false}
                    onClick={() => void downloadSyllabus(found.document)}
                >
                    {found.document.filename} 내려받기
                </Button>
            )}
        </Text>
    );
};

export default SyllabusFilePage;

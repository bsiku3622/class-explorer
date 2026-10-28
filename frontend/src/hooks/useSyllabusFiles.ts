import { useEffect, useState } from "react";
import { fetchSyllabusFiles, type SyllabusFile } from "../lib/syllabi";

interface SyllabusFiles {
    files: SyllabusFile[];
    loading: boolean;
    error: boolean;
}

/**
 * 강의계획서 파일 목록(`GET /syllabi`). `enabled` 가 거짓이면 받지 않습니다 — 강의계획서가 없는 학기·과목에서
 * 아코디언마다 요청이 나가지 않게요. 같은 목록을 여러 곳이 동시에 불러도 `lib/cache.ts` 가 하나로 묶습니다.
 *
 * 상태는 응답이 온 뒤에만 바꿉니다 — 로딩 중인지는 "아직 결과가 없다" 에서 셉니다(effect 안에서 곧바로
 * setState 하면 화면을 한 번 더 그립니다).
 */
export const useSyllabusFiles = (enabled: boolean): SyllabusFiles => {
    const [result, setResult] = useState<{ files: SyllabusFile[] | null; error: boolean }>({
        files: null,
        error: false,
    });

    useEffect(() => {
        if (!enabled) return;
        let active = true;
        fetchSyllabusFiles()
            .then((files) => {
                if (active) setResult({ files, error: false });
            })
            .catch(() => {
                if (active) setResult({ files: null, error: true });
            });
        return () => {
            active = false;
        };
    }, [enabled]);

    if (!enabled) return { files: [], loading: false, error: false };
    return {
        files: result.files ?? [],
        loading: result.files === null && !result.error,
        error: result.error,
    };
};

import React, { useState, useCallback } from "react";
import { IdCard, X } from "lucide-react";
import api from "../lib/api";
import RetroButton from "./atoms/RetroButton";

const SESSION_TOKEN_KEY = "ksa_session_token";

interface LinkStudentModalProps {
    /** 등록에 성공하면 갱신된 계정 정보를 넘깁니다 */
    onLinked: (info: { stu_id: string; student_name: string }) => void;
    /** 나중에 하기 — 닫을 수 있는 화면에서만 넘깁니다 */
    onDismiss?: () => void;
}

/**
 * 계정에 본인 학번을 등록하는 안내창.
 *
 * 학번이 없으면 이수 현황·성적을 쓸 수 없어서, 해당 화면에 들어갈 때 띄웁니다.
 */
const LinkStudentModal: React.FC<LinkStudentModalProps> = ({ onLinked, onDismiss }) => {
    const [stuId, setStuId] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = useCallback(async () => {
        if (!stuId.trim() || !name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            const token = localStorage.getItem(SESSION_TOKEN_KEY);
            const res = await api.post(
                "/auth/link-student",
                { stu_id: stuId.trim(), name: name.trim() },
                { headers: token ? { Authorization: `Bearer ${token}` } : {} },
            );
            onLinked(res.data);
        } catch (e: unknown) {
            const detail =
                typeof e === "object" && e && "response" in e
                    ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            setError(detail ?? "등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setBusy(false);
        }
    }, [stuId, name, busy, onLinked]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between gap-4 border-b-2 border-black bg-retro-secondary px-5 py-3">
                    <div className="flex items-center gap-2 text-white">
                        <IdCard size={18} strokeWidth={2.5} />
                        <span className="text-sm font-black uppercase tracking-widest">
                            학번 등록
                        </span>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-white/60 transition-colors duration-100 hover:text-white"
                            aria-label="닫기"
                        >
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    )}
                </div>

                <div className="space-y-4 p-5">
                    <p className="text-xs font-bold leading-relaxed text-black/60">
                        이수 현황과 성적은 계정에 저장됩니다. 누구의 기록인지 정해야 하니
                        본인 학번과 이름을 입력해주세요.
                    </p>

                    <div className="space-y-2">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                학번
                            </span>
                            <input
                                value={stuId}
                                onChange={(e) => setStuId(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
                                }}
                                placeholder="25-059"
                                className="mt-1 w-full border-2 border-black px-3 py-2 text-sm font-bold outline-none transition-all duration-100 focus:shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                                이름
                            </span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
                                }}
                                placeholder="백재원"
                                className="mt-1 w-full border-2 border-black px-3 py-2 text-sm font-bold outline-none transition-all duration-100 focus:shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
                            />
                        </label>
                    </div>

                    {error && (
                        <p className="border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold text-retro-primary">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        {onDismiss && (
                            <RetroButton size="sm" onClick={onDismiss}>
                                나중에
                            </RetroButton>
                        )}
                        <RetroButton
                            size="sm"
                            isSelected
                            onClick={submit}
                            disabled={busy || !stuId.trim() || !name.trim()}
                        >
                            {busy ? "확인 중..." : "등록"}
                        </RetroButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LinkStudentModal;

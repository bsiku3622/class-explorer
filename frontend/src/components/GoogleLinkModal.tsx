import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { IdCard, LogOut } from "lucide-react";
import api from "../lib/api";
import { GOOGLE_LOGIN_READY, takeGoogleRedirect } from "../lib/googleAuth";
import RetroButton from "./atoms/RetroButton";
import GoogleLoginButton from "./GoogleLoginButton";

const SESSION_TOKEN_KEY = "ksa_session_token";

interface GoogleLinkModalProps {
    username: string;
    /** 연결에 성공하면 갱신된 계정 정보를 넘깁니다 */
    onLinked: (info: { email: string; stu_id: string; student_name: string }) => void;
    onLogout: () => void;
}

/**
 * 아이디·비밀번호로 들어온 계정에 학교 구글 계정을 붙이라고 요구하는 창.
 *
 * **닫을 수 없습니다.** 옛 계정은 이 계정이 누구 것인지 알 방법이 없어서, 연결하기
 * 전에는 이수 기록 같은 개인 데이터를 다룰 수 없습니다. 나가려면 로그아웃뿐입니다.
 *
 * **구글에서 돌아오는 것도 이 창이 받습니다.** 리다이렉트로 바뀌면서 돌아올 자리가
 * 필요해졌는데(`/auth/google`), 미연결 계정에는 **경로와 상관없이 이 창이 뜨므로**
 * 라우트를 따로 두지 않았습니다 — 돌아온 주소의 조각을 여기서 꺼내 씁니다.
 */
const GoogleLinkModal: React.FC<GoogleLinkModalProps> = ({ username, onLinked, onLogout }) => {
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = useCallback(
        async (credential: string, nonce: string) => {
            setError(null);
            setBusy(true);
            try {
                const token = localStorage.getItem(SESSION_TOKEN_KEY);
                const res = await api.post(
                    "/auth/link-google",
                    { credential, nonce },
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                );
                onLinked(res.data);
            } catch (e: unknown) {
                const detail = axios.isAxiosError(e)
                    ? (e.response?.data as { detail?: string } | undefined)?.detail
                    : undefined;
                setError(detail ?? "연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
            } finally {
                setBusy(false);
            }
        },
        [onLinked],
    );

    /**
     * 구글에서 돌아왔는지 봅니다.
     *
     * `takeGoogleRedirect()` 는 **한 번만 꺼낼 수 있습니다**(읽으면서 주소에서 지웁니다).
     * 그래서 개발 모드가 이 효과를 두 번 돌려도 두 번째는 `null` 이라 요청이 겹치지
     * 않습니다.
     */
    useEffect(() => {
        const result = takeGoogleRedirect();
        if (!result) return;
        if (!result.ok) {
            setError(result.message);
            return;
        }
        void submit(result.credential, result.nonce);
    }, [submit]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                <div className="flex items-center gap-2 border-b-2 border-black bg-retro-secondary px-5 py-3 text-white">
                    <IdCard size={18} strokeWidth={2.5} />
                    <span className="text-sm font-black uppercase tracking-widest">
                        학교 계정 연결
                    </span>
                </div>

                <div className="space-y-4 p-5">
                    <p className="text-xs font-bold leading-relaxed text-black/60">
                        <span className="text-black">{username}</span> 계정은 아직 학교 구글
                        계정과 이어져 있지 않습니다. 한 번 연결하면 학번이 확인되고, 그동안
                        기록한 내용은 그대로 남습니다.
                    </p>

                    {/* ⚠️ 버튼이 없을 때 **빈 자리로 두면 안 됩니다.** 이 창은 닫을 수
                        없어서, 연결할 방법이 사라지면 로그아웃 말고 할 수 있는 게 없는
                        막다른 길이 됩니다 — 실제로 배포에 `VITE_GOOGLE_CLIENT_ID` 가
                        빠져 그 상태로 나간 적이 있습니다 */}
                    {GOOGLE_LOGIN_READY ? (
                        <GoogleLoginButton onStart={() => setError(null)} disabled={busy} />
                    ) : (
                        <p className="border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold leading-relaxed text-retro-primary">
                            지금은 학교 계정 연결을 할 수 없습니다. 관리자에게 알려주세요.
                        </p>
                    )}

                    {busy && (
                        <p className="text-center text-xs font-bold text-black/40">확인 중...</p>
                    )}

                    {error && (
                        <p className="border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold text-retro-primary">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t-2 border-black/10 pt-3">
                        <p className="text-[10px] font-bold text-black/40">
                            연결 전에는 이용할 수 없습니다.
                        </p>
                        <RetroButton
                            size="sm"
                            onClick={onLogout}
                            icon={<LogOut size={14} strokeWidth={2.5} />}
                        >
                            로그아웃
                        </RetroButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoogleLinkModal;

import React, { useState, useCallback } from "react";
import axios from "axios";
import api from "../lib/api";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import GoogleLoginButton from "../components/GoogleLoginButton";

interface LoginPageProps {
    onLogin: (token: string) => void;
}

type Tab = "google" | "password";

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [tab, setTab] = useState<Tab>("google");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const switchTab = (next: Tab) => {
        setTab(next);
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (
            e.nativeEvent instanceof KeyboardEvent &&
            (e.nativeEvent as KeyboardEvent & { isComposing: boolean }).isComposing
        )
            return;
        setError("");
        setLoading(true);
        try {
            const res = await api.post("/auth/login", { username, password });
            onLogin(res.data.session_token);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                setError("아이디 또는 비밀번호가 틀렸습니다.");
            } else {
                setError("로그인 중 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = useCallback(
        async (credential: string) => {
            setError("");
            setLoading(true);
            try {
                const res = await api.post("/auth/google", { credential });
                onLogin(res.data.session_token);
            } catch (err: unknown) {
                const detail = axios.isAxiosError(err)
                    ? (err.response?.data as { detail?: string } | undefined)?.detail
                    : undefined;
                setError(detail ?? "로그인 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        },
        [onLogin],
    );

    const inputClass =
        "w-full border-2 border-black px-4 py-3 text-sm font-bold bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] focus:shadow-none outline-none transition-all duration-100";

    /** 고른 탭은 아래 카드와 한 덩어리로 보이도록 경계선을 지웁니다 */
    const tabClass = (self: Tab) =>
        `flex-1 border-2 border-black px-4 py-3.5 text-xs font-black uppercase tracking-widest transition-all duration-100 ${
            tab === self
                ? "bg-white text-black border-b-white relative z-10"
                : "bg-black/[0.05] text-black/35 hover:text-black/60 hover:bg-black/[0.02]"
        }`;

    return (
        <div className="min-h-screen bg-retro-bg flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black tracking-tighter text-black uppercase transform -skew-x-6 inline-block">
                        Class Explorer
                    </h1>
                    <p className="text-[11px] font-black text-black/40 uppercase tracking-[0.2em] mt-2">
                        KSA Timetable System
                    </p>
                </div>

                <div className="flex -mb-0.5">
                    <button
                        type="button"
                        onClick={() => switchTab("google")}
                        className={`${tabClass("google")} border-r-0`}
                    >
                        학교 계정
                    </button>
                    <button
                        type="button"
                        onClick={() => switchTab("password")}
                        className={tabClass("password")}
                    >
                        아이디
                    </button>
                </div>

                <RetroCard shadow="lg" className="bg-white p-8">
                    {tab === "google" ? (
                        <div className="space-y-5">
                            <p className="text-xs font-bold leading-relaxed text-black/50">
                                한국과학영재학교 구글 계정으로 들어옵니다. 학번은 계정에서
                                바로 확인되니 따로 입력하지 않아도 됩니다.
                            </p>
                            <GoogleLoginButton onCredential={handleGoogle} onError={setError} />
                            {loading && (
                                <p className="text-center text-xs font-bold text-black/40">
                                    로그인 중...
                                </p>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className={inputClass}
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={inputClass}
                                    autoComplete="current-password"
                                    required
                                />
                            </div>

                            <RetroButton
                                type="submit"
                                variant="black"
                                size="md"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? "로그인 중..." : "로그인"}
                            </RetroButton>

                            <p className="text-[10px] font-bold leading-relaxed text-black/40">
                                예전에 받은 계정입니다. 들어오시면 학교 구글 계정을 한 번
                                연결하게 됩니다 — 그동안 기록한 내용은 그대로 남습니다.
                            </p>
                        </form>
                    )}

                    {error && (
                        <p className="mt-5 border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold text-retro-primary">
                            {error}
                        </p>
                    )}
                </RetroCard>
            </div>
        </div>
    );
};

export default LoginPage;

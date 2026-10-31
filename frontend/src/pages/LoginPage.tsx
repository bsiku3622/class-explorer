import React, { useState } from "react";
import axios from "axios";
import api from "../lib/api";
import { Button, Card, FormField, Input, Notice, Surface, Text, Wordmark } from "@studio-baeks/funky-ui";

interface LoginPageProps {
    onLogin: (token: string) => void;
}

/**
 * 아이디·비밀번호 로그인.
 *
 * 계정은 관리자가 만들어 줍니다 — 아는 사람만 쓰는 서비스라 스스로 만드는 길은
 * 두지 않았습니다. 구글 계정은 로그인이 아니라 **학번 확인**에만 쓰고, 들어온
 * 다음 `GoogleLinkModal`이 한 번 받습니다.
 */
const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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

    return (
        <Surface fill="canvas" className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <Wordmark as="h1" size="lg">
                        Class Explorer
                    </Wordmark>
                    <Text as="p" variant="overline" className="mt-2">
                        KSA Timetable System
                    </Text>
                </div>

                <Card shadow="none" padding="0" className="shadow-[8px_8px_0_0_rgba(0,0,0,0.2)] p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <FormField label="Username">
                            <Input
                                type="text"
                                shadow
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                autoFocus
                                required
                            />
                        </FormField>

                        <FormField label="Password">
                            <Input
                                type="password"
                                shadow
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </FormField>

                        <Button type="submit" variant="filled" shadow size="md" fullWidth disabled={loading}>
                            {loading ? "로그인 중..." : "로그인"}
                        </Button>

                        <Text as="p" variant="micro" weight="bold" tone="muted" leading="relaxed">
                            계정은 관리자가 만들어 줍니다. 처음 들어오시면 학교 구글 계정으로
                            학번을 한 번 확인합니다 — 그동안 기록한 내용은 그대로 남습니다.
                        </Text>
                    </form>

                    {error && (
                        <Notice role="alert" className="mt-5">
                            {error}
                        </Notice>
                    )}
                </Card>
            </div>
        </Surface>
    );
};

export default LoginPage;

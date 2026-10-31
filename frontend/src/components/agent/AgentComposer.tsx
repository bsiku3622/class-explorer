/**
 * Ask 입력창 — ChatGPT 와 같은 한 줄 구조: `[+ 이미지] [입력칸 ……] [모델 ▾] [보내기]`.
 * `/ai` · 미니 창 · 모바일 창이 같이 씁니다.
 *
 * 모양(모서리·검은 테두리)은 이 앱의 언어를 따르고, **줄 구성은 ChatGPT 를 그대로** 따릅니다.
 * 한때 입력칸 아래에 따로 줄을 두고 모델 · 단축키 안내 · "쉬는 중" 문구를 늘어놨더니 어수선했습니다.
 *
 * - **이미지 첨부**: `+` 버튼 · 붙여넣기(⌘V) · 끌어다 놓기. 최대 3장, 브라우저에서 1600px JPEG 로
 *   줄여 보냅니다(`lib/imageAttach.ts`). 첨부는 입력칸 위에 썸네일로 쌓이고 ✕ 로 뺍니다
 * - 모델 고르기는 보내기 버튼 바로 왼쪽, 같은 높이(40px)입니다. 데스크탑 모델 상태는 이름 앞 점 하나
 * - Enter 보내기 · Shift+Enter 줄바꿈 · ⚠️ 한글 조합 중 Enter 는 거릅니다 (`isComposing`)
 * - 여러 줄이 되면 단추들은 맨 아래 줄에 남습니다 (`items-end`)
 * - 처음 그려질 때 입력칸으로 갑니다 — **터치 화면만 빼고.** 폰에서는 키보드가 올라와 추천 질문과
 *   답을 반쯤 가립니다
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Plus, Square, X } from "lucide-react";
import { IconButton, Input, Select, Surface, Swatch, Text, Textarea } from "@studio-baeks/funky-ui";
import type { IconComponentProps } from "@studio-baeks/funky-ui";
import type { AgentChat } from "../../hooks/useAgentChat";
import { imageFiles, MAX_IMAGES, shrinkImage } from "../../lib/imageAttach";

const LINE = 24;

/** 정지 단추의 속 찬 네모 — IconButton 은 아이콘을 컴포넌트째 받아서, fill 을 미리 준 것을 넘깁니다 */
const StopIcon: React.FC<IconComponentProps> = (props) => <Square {...props} fill="currentColor" />;

interface AgentComposerProps {
    chat: AgentChat;
    /** 바뀔 때마다 입력창에 포커스 (⌘K · 창 열기) */
    focusKey: number;
    placeholder?: string;
    /**
     * 보내기를 가로챕니다 — 모바일 창이 보내면서 `/ai` 로 옮겨 갈 때. ⚠️ 이때는 입력칸을 비우지
     * 않습니다: 옮겨 가는 모션이 **글이 든 입력창**을 찍어야 하고, 이 입력창은 어차피 곧 사라집니다
     */
    onSend?: (text: string, images: string[]) => void;
    /** 화면 전환 모션에서 이 입력창을 이어 붙일 이름 (`lib/askMotion.ts`) */
    transitionName?: string;
}

const AgentComposer: React.FC<AgentComposerProps> = ({
    chat,
    focusKey,
    placeholder = "무엇이든 물어보세요",
    onSend,
    transitionName,
}) => {
    const [text, setText] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const ref = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const selected = chat.models?.models.find((m) => m.id === chat.model);
    const local = selected?.provider !== "openai";
    const gateway = chat.models?.gateway;

    // 글자가 바뀔 때와 **폭이 바뀔 때** 높이를 다시 잽니다 — 폭만 바뀌면(폰 회전, 창 크기) 좁을 때 잰
    // 두 줄 높이가 그대로 남았습니다
    useLayoutEffect(() => {
        const box = ref.current;
        if (!box) return;
        const fit = () => {
            box.style.height = "auto";
            box.style.height = `${Math.min(box.scrollHeight, 8 * LINE + 16)}px`;
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(box.parentElement ?? box);
        return () => observer.disconnect();
    }, [text]);

    useEffect(() => {
        if (window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
    }, [focusKey]);

    const attach = async (files: File[]) => {
        setError(null);
        const room = MAX_IMAGES - images.length;
        if (room <= 0 || files.length === 0) {
            if (files.length) setError(`이미지는 ${MAX_IMAGES}장까지 붙일 수 있어요`);
            return;
        }
        try {
            const shrunk = await Promise.all(files.slice(0, room).map(shrinkImage));
            setImages((prev) => [...prev, ...shrunk].slice(0, MAX_IMAGES));
            if (files.length > room) setError(`이미지는 ${MAX_IMAGES}장까지 붙일 수 있어요`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "이미지를 붙이지 못했어요");
        }
        ref.current?.focus();
    };

    const canSend = !chat.running && (text.trim().length > 0 || images.length > 0);
    const submit = () => {
        if (!canSend) return;
        if (onSend) {
            onSend(text, images);
            return;
        }
        chat.send(text, images);
        setText("");
        setImages([]);
        setError(null);
    };

    return (
        // 모델 이름을 보일지는 **화면이 아니라 이 상자의 폭**으로 정합니다(`@container`) — 미니 창은
        // 데스크탑 화면 안의 400px 이라 화면 폭(`sm:`)으로 재면 이름이 붙어 입력칸이 반으로 줄었습니다
        <Surface
            border="line"
            shadow="raised"
            fill={dragging ? "well" : "raised"}
            style={transitionName ? { viewTransitionName: transitionName } : undefined}
            onDragOver={(e: React.DragEvent) => {
                if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
                    e.preventDefault();
                    setDragging(true);
                }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: React.DragEvent) => {
                e.preventDefault();
                setDragging(false);
                void attach(imageFiles(e.dataTransfer.files));
            }}
            className="@container"
        >
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                    {images.map((src, i) => (
                        <div key={i} className="relative">
                            <Surface as="img" fill="none" border="line" src={src} alt={`첨부 이미지 ${i + 1}`} className="h-16 w-16 object-cover" />
                            <IconButton
                                icon={X}
                                label={`첨부 이미지 ${i + 1} 빼기`}
                                variant="paper"
                                size="xs"
                                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                className="absolute -right-2 -top-2 h-5 w-5"
                            />
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-end gap-1 p-1.5">
                <IconButton
                    icon={Plus}
                    label="이미지 첨부"
                    size="md"
                    onClick={() => fileRef.current?.click()}
                    disabled={chat.running || images.length >= MAX_IMAGES}
                    className="shrink-0"
                />
                <Input
                    bare
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        void attach(imageFiles(e.target.files));
                        e.target.value = "";
                    }}
                />
                <Textarea
                    ref={ref}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onFocus={chat.warm}
                    onPaste={(e) => {
                        const files = imageFiles(e.clipboardData.items);
                        if (files.length) {
                            e.preventDefault();
                            void attach(files);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter" || e.shiftKey) return;
                        e.preventDefault();
                        if (!e.nativeEvent.isComposing) submit();
                    }}
                    maxLength={1000}
                    placeholder={chat.running ? "답을 찾는 중이에요…" : placeholder}
                    className="min-w-0 flex-1 resize-none self-center border-transparent bg-transparent px-1.5 py-2 text-[15px] leading-6 focus:outline-none"
                />
                {chat.models && chat.models.models.length > 0 && (
                    // 좁은 상자에서는 이름 없이 점 + ▾ 만 — 선택 상자는 그 위에 투명하게 겹쳐 두어 누르면
                    // 목록이 그대로 열립니다. 이름까지 두면 390px 에서 입력칸이 130px 로 줄어 안내 문구가 꺾였습니다
                    <div className="relative flex h-10 shrink-0 items-center gap-1.5 px-2">
                        {local && gateway !== undefined && (
                            <Swatch
                                accent={gateway === null ? "error" : gateway.running ? "green" : "black"}
                                rung={gateway === null || gateway.running ? "solid" : "soft"}
                                title={gateway === null ? "데스크탑에 닿지 않습니다" : gateway.running ? "데스크탑 모델이 켜져 있습니다" : "데스크탑 모델이 쉬는 중 — 첫 답은 1분쯤 걸려요"}
                                className="shrink-0"
                            />
                        )}
                        <Select
                            quiet
                            size="xs"
                            value={chat.model}
                            onChange={(e) => chat.pickModel(e.target.value)}
                            disabled={chat.running}
                            aria-label="모델"
                            className="absolute inset-0 w-full opacity-0 @md:static @md:w-auto @md:max-w-[11rem] @md:opacity-100"
                        >
                            {chat.models.models.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </Select>
                        <ChevronDown size={13} strokeWidth={2.75} className="pointer-events-none @md:hidden" />
                    </div>
                )}
                {chat.running ? (
                    <IconButton icon={StopIcon} label="정지" variant="filled" size="md" onClick={chat.stop} className="shrink-0" />
                ) : (
                    <IconButton
                        icon={ArrowUp}
                        label="보내기"
                        title="보내기 (Enter)"
                        accent="purple"
                        variant="solid"
                        size="md"
                        onClick={submit}
                        disabled={!canSend}
                        className="shrink-0"
                    />
                )}
            </div>
            {error && <Text as="p" variant="caption" tone="orange" className="px-3 pb-2">{error}</Text>}
        </Surface>
    );
};

export default AgentComposer;

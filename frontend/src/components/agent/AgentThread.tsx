/**
 * Ask 의 대화 본문 — 사용자 말풍선, 답(작업 블록 + 본문 + 근거 글 + 꼬리말).
 * `/ai` · 미니 창 · 모바일 창이 같이 씁니다.
 *
 * 모양은 ChatGPT·Claude 를, 작업 표시는 DiskLens AI 사이드바를 옮겨 이 앱의 레트로 규칙으로 그렸습니다.
 *
 * - **사용자 말은 오른쪽 말풍선**(연한 보라 면 + 검은 테두리 + 하드 그림자), **답은 말풍선 없이**
 *   왼쪽 ✨ 아이콘 옆에 전체 폭으로 둡니다. 답까지 상자에 넣으면 카드 안에 카드가 줄줄이 생깁니다
 * - **답이 도는 동안**은 상태 줄(스피너 · 지금 하는 일 · 경과 초)과 단계 줄이 실시간으로 펼쳐집니다.
 *   단계마다 실행 중 스피너 → ✓ 초록 / ✗ 빨강 + 결과 한 줄("글 6건") + 걸린 시간
 * - **끝나면 작업 블록이 한 줄로 접힙니다**("작업 2단계 · 0.1초 ▸") — ChatGPT 의 "n초 동안 생각함"
 *   자리입니다. 누르면 펼쳐지고, 단계를 누르면 도구에 넘긴 값이 보입니다
 * - 핑크는 쓰지 않습니다 (이 앱에서 핑크는 "지금")
 */
import React, { useEffect, useState } from "react";
import { Check, ChevronDown, CircleAlert, CircleCheck, CircleX, Copy, ExternalLink, Info, Sparkles } from "lucide-react";
import { Accordion, Button, Icon, Paint, Pressable, Spinner, Surface, surfaceClass, Swatch, Text } from "@studio-baeks/funky-ui";
import { blocks, duration, statusLine, type AgentStep, type AssistantTurn, type Turn } from "../../lib/agentChat";

const StepRow: React.FC<{ step: AgentStep }> = ({ step }) => {
    const [open, setOpen] = useState(false);
    const hasArgs = Object.keys(step.args).length > 0;
    const rowClass = "flex w-full items-center gap-2 px-2.5 py-1 text-left";
    const row = (
        <>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {step.status === "running" ? (
                    <Spinner size="sm" label={`${step.label} 중`} />
                ) : step.status === "done" ? (
                    <Icon icon={CircleCheck} size={14} strokeWidth={2.75} tone="green" />
                ) : (
                    <Icon icon={CircleX} size={14} strokeWidth={2.75} tone="red" />
                )}
            </span>
            <Text variant="caption" tone={step.status === "failed" ? "red" : undefined} truncate className="min-w-0 flex-1">
                {step.label}
                {step.summary && <Text variant="caption" tone="muted" className="ml-1.5">— {step.summary}</Text>}
            </Text>
            {step.ms !== undefined && (
                <Text variant="micro" weight="regular" tone="muted" numeric className="shrink-0">{(step.ms / 1000).toFixed(1)}초</Text>
            )}
            {hasArgs && (
                <Icon icon={ChevronDown} size={12} strokeWidth={3} tone="faint" className={`shrink-0 transition-transform duration-100 ${open ? "rotate-180" : ""}`} />
            )}
        </>
    );
    return (
        <li>
            {hasArgs ? (
                <Pressable aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${surfaceClass({ fill: "none", hoverable: true })} ${rowClass}`}>
                    {row}
                </Pressable>
            ) : (
                <div className={rowClass}>{row}</div>
            )}
            {open && (
                <Surface as="pre" fill="well" className="mx-2.5 mb-1 overflow-x-auto px-2 py-1.5">
                    <Text as="code" variant="micro" weight="regular" family="mono" tone="secondary" leading="relaxed">
                        {step.name}({JSON.stringify(step.args, null, 1)})
                    </Text>
                </Surface>
            )}
        </li>
    );
};

/** 작업 블록 — 도는 동안 펼침, 끝나면 한 줄로 접힘 */
const Work: React.FC<{ turn: AssistantTurn }> = ({ turn }) => {
    const [expanded, setExpanded] = useState(false);
    const live = turn.phase !== "done";
    if (turn.steps.length === 0) return null;
    const failed = turn.steps.filter((s) => s.status === "failed").length;
    const total = turn.steps.reduce((sum, s) => sum + (s.ms ?? 0), 0) / 1000;
    const steps = <ul>{turn.steps.map((step) => <StepRow key={step.id} step={step} />)}</ul>;
    if (live) return <Surface fill="none" border="soft" borderSide="left">{steps}</Surface>;
    return (
        <Accordion
            size="sm"
            open={expanded}
            onOpenChange={setExpanded}
            title={`작업 ${turn.steps.length}단계${failed > 0 ? ` · 실패 ${failed}` : ""} · ${total.toFixed(1)}초`}
            trailing={
                !expanded && (
                    <Text variant="caption" tone="muted" truncate className="min-w-0 flex-1">
                        {turn.steps.map((s) => s.label).join(" → ")}
                    </Text>
                )
            }
        >
            {steps}
        </Accordion>
    );
};

/** 도는 동안 답 자리 맨 위의 한 줄 — 스피너 · 지금 하는 일 · 경과 초 */
const LiveStatus: React.FC<{ turn: AssistantTurn; cold: boolean }> = ({ turn, cold }) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const elapsed = Math.max(0, (now - turn.startedAt) / 1000);
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <Spinner size="sm" label="답을 찾는 중" />
                <Text weight="black" truncate className="min-w-0">{statusLine(turn)}</Text>
                <Text weight="black" tone="muted" numeric className="shrink-0">· {duration(elapsed)}</Text>
            </div>
            {cold && elapsed > 4 && turn.steps.length === 0 && (
                <Text as="p" variant="caption" tone="muted" className="pl-6">데스크탑 모델을 깨우는 중이라 첫 답은 1분쯤 걸려요</Text>
            )}
        </div>
    );
};

const Body: React.FC<{ text: string }> = ({ text }) => (
    <Text as="div" weight="medium" leading="relaxed" className="flex flex-col gap-2.5">
        {blocks(text).map((block, i) =>
            block.kind === "p" ? (
                <p key={i} className="whitespace-pre-wrap">{block.text}</p>
            ) : (
                <ul key={i} className="flex flex-col gap-1.5">
                    {block.items.map((item, j) => (
                        <li key={j} className="flex gap-2.5">
                            {block.kind === "ul" ? (
                                <Swatch className="mt-[0.68em] shrink-0" />
                            ) : (
                                <Text weight="black" tone="purple" numeric className="w-5 shrink-0 text-right">{j + 1}.</Text>
                            )}
                            <span className="min-w-0">{item}</span>
                        </li>
                    ))}
                </ul>
            ),
        )}
    </Text>
);

const Footer: React.FC<{ turn: AssistantTurn }> = ({ turn }) => {
    const [copied, setCopied] = useState(false);
    const modelName = turn.model?.replace(/^(local|openai):/, "");
    return (
        <Text as="div" variant="caption" tone="muted" className="flex items-center gap-3">
            {turn.seconds !== undefined && <Text variant="caption" tone="muted" numeric>{duration(turn.seconds)}</Text>}
            {modelName && <span>{modelName}</span>}
            {turn.text && (
                <Button
                    variant="ghostMuted"
                    size="xs"
                    uppercase={false}
                    icon={copied ? Check : Copy}
                    onClick={() => {
                        void navigator.clipboard?.writeText(turn.text ?? "").then(() => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                        });
                    }}
                >
                    {copied ? "복사됨" : "복사"}
                </Button>
            )}
        </Text>
    );
};

const Assistant: React.FC<{ turn: AssistantTurn; cold: boolean }> = ({ turn, cold }) => (
    <div className="flex gap-3">
        <Paint as="span" accent="purple" variant="solid" shadow className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
            <Sparkles size={15} strokeWidth={2.75} />
        </Paint>
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
            {turn.phase !== "done" && <LiveStatus turn={turn} cold={cold} />}
            <Work turn={turn} />
            {turn.text && <Body text={turn.text} />}
            {turn.notice && (
                <Text as="p" variant="caption" tone={turn.notice.tone === "error" ? "orange" : "muted"} className="flex items-start gap-1.5">
                    {turn.notice.tone === "error" ? <CircleAlert size={15} strokeWidth={2.75} className="mt-0.5 shrink-0" /> : <Info size={15} strokeWidth={2.75} className="mt-0.5 shrink-0" />}
                    {turn.notice.text}
                </Text>
            )}
            {turn.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {turn.sources.map((s) => (
                        <Button
                            key={s.url}
                            as="a"
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            variant="paper"
                            size="xs"
                            uppercase={false}
                            icon={ExternalLink}
                            className="max-w-full"
                        >
                            <span className="truncate">{s.title}</span>
                        </Button>
                    ))}
                </div>
            )}
            {turn.phase === "done" && <Footer turn={turn} />}
        </div>
    </div>
);

const AgentThread: React.FC<{ turns: Turn[]; cold: boolean }> = ({ turns, cold }) => (
    <div className="flex flex-col gap-8">
        {turns.map((turn) =>
            turn.kind === "user" ? (
                <div key={turn.id} className="flex max-w-[85%] flex-col items-end gap-2 self-end">
                    {turn.images && turn.images.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2">
                            {turn.images.map((src, i) => (
                                <Surface key={i} as="img" fill="none" border="line" shadow="raised" src={src} alt={`첨부 이미지 ${i + 1}`} className="h-28 max-w-[12rem] object-cover" />
                            ))}
                        </div>
                    )}
                    <Paint accent="purple" variant="solidMuted" shadow className="px-4 py-2.5">
                        <Text as="p" weight="bold" leading="relaxed" className="whitespace-pre-wrap break-words">{turn.text}</Text>
                    </Paint>
                </div>
            ) : (
                <Assistant key={turn.id} turn={turn} cold={cold} />
            ),
        )}
    </div>
);

export default AgentThread;

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@studio-baeks/funky-ui";

interface CopyButtonProps {
    /** 클립보드에 넣을 내용 */
    text: string;
    label?: string;
    className?: string;
    title?: string;
}

/** 클립보드에 복사하고 잠깐 "복사됨"을 보여주는 버튼 */
const CopyButton: React.FC<CopyButtonProps> = ({
    text,
    label = "복사",
    className,
    title,
}) => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // https가 아니거나 권한이 없는 환경 — 옛 방식으로 한 번 더 시도합니다
            const area = document.createElement("textarea");
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            document.body.removeChild(area);
        }
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
    }, [text]);

    return (
        <Button
            size="xs"
            accent={copied ? "green" : undefined}
            variant={copied ? "filled" : "paper"}
            shadow={copied ? false : "hover"}
            icon={copied ? Check : Copy}
            onClick={copy}
            title={title ?? text}
            className={className}
        >
            {copied ? "복사됨" : label}
        </Button>
    );
};

export default CopyButton;

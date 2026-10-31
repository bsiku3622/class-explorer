import { useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

import { cx } from "../internal/cx";
import { Icon, type IconComponent } from "../primitives/Icon";
import { paintClass } from "../primitives/Paint";
import { Text } from "../primitives/Text";
import type { Accent } from "../tokens/vocabulary";
import { fileDrop, fileDropDisabled, fileDropInput } from "./FileDrop.css";

export interface FileDropProps {
  /** 파일을 고르거나 끌어다 놓으면 부릅니다 */
  onFiles: (files: File[]) => void;
  /** `<input type="file">` 의 `accept` */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  icon?: IconComponent;
  /** 끄는 동안 칸을 칠하는 색 (기본 `cyan`) */
  accent?: Accent;
  title?: ReactNode;
  className?: string;
  /** 제목 아래 안내 — 형식 · 크기 제한 */
  children?: ReactNode;
}

/** 파일 끌어놓기 칸 — 점선 테두리. 눌러서 고를 수도 있고, 끄는 동안 칸이 그 색으로 물듭니다. 안쪽은 native 파일 입력이라 키보드로도 엽니다 */
export function FileDrop({ onFiles, accept, multiple = false, disabled = false, icon, accent = "cyan", title, className, children }: FileDropProps) {
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    take(e.target.files);
    // 같은 파일을 다시 골라도 불리게 비웁니다
    e.target.value = "";
  };
  return (
    <label
      className={cx(paintClass({ accent, variant: over ? "tinted" : "frameline", borderStyle: "dashed" }), fileDrop, disabled && fileDropDisabled, className)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input type="file" className={fileDropInput} accept={accept} multiple={multiple} disabled={disabled} onChange={onChange} />
      {icon && <Icon icon={icon} size="xl" />}
      {title && (
        <Text variant="subheading" tone="inherit">
          {title}
        </Text>
      )}
      {children && (
        <Text variant="caption" tone="muted">
          {children}
        </Text>
      )}
    </label>
  );
}

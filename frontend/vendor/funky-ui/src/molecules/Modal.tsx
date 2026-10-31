import { useEffect, useId, useRef, type ElementType, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";

import { cx } from "../internal/cx";
import { CloseGlyph } from "../internal/glyphs";
import { Paint } from "../primitives/Paint";
import { Surface } from "../primitives/Surface";
import type { Accent } from "../tokens/vocabulary";
import {
  modal,
  modalBody,
  modalBodyFill,
  modalBodyFlush,
  modalClose,
  modalCloseCorner,
  modalContent,
  modalContentFill,
  modalFooter,
  modalFooterStrip,
  modalFull,
  modalHeadActions,
  modalHeader,
  modalHeadText,
  modalSize,
  modalSubtitle,
  modalTitle,
  modalTitlePlain,
} from "./Modal.css";

export interface ModalProps {
  open: boolean;
  /** Esc · 바깥 누름 · 닫기 버튼이 모두 이걸 부릅니다 */
  onClose: () => void;
  title?: ReactNode;
  /** 머리 막대의 두 번째 줄 — 파일 설명 같은 것 (두 줄에서 자릅니다) */
  subtitle?: ReactNode;
  /** 제목을 대문자로 그립니다 (기본 true). 파일명처럼 원문이 뜻인 제목이면 끕니다 */
  titleUppercase?: boolean;
  /** 머리 막대 오른쪽 — 닫기 앞에 놓는 동작 버튼 (새 탭 열기) */
  actions?: ReactNode;
  /** 머리 막대의 색 (기본 보라) */
  accent?: Accent;
  /** `full` 은 96vh 높이에 머리가 고정되고 본문이 남은 높이를 채웁니다 */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** 아래 동작 줄 — 오른쪽 정렬 */
  footer?: ReactNode;
  /** 주면 아래 동작 줄을 그 색의 띠로 칠합니다 */
  footerAccent?: Accent;
  /** 바깥(막)을 눌러 닫을지 (기본 true). 입력 중인 폼이면 false */
  dismissible?: boolean;
  /** 닫을 수 있는 창인지 (기본 true). false 면 닫기 버튼이 없고 Esc · 막 누름도 닫지 않습니다 — 다 끝내야 나가는 창 */
  closable?: boolean;
  /** 본문의 안쪽 여백을 뺍니다 — 파일 미리보기처럼 본문이 가장자리까지 차는 창 */
  flush?: boolean;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}

const SurfaceRoot = Surface as ElementType;
const PaintRoot = Paint as ElementType;

/**
 * 모달 — native `<dialog>` 의 `showModal()` 위에 섭니다. 포커스 가두기 · Esc · 뒤 화면 비활성 ·
 * 가장 위 층은 브라우저가 맡으므로 z-index 를 고르지 않습니다. 판은 `Surface`(흰 면 · 2px · 시스템에서
 * 유일한 6px 그림자), 머리 막대는 `Paint` 의 filled 입니다.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  titleUppercase = true,
  actions,
  accent = "purple",
  size = "md",
  footer,
  footerAccent,
  dismissible = true,
  closable = true,
  flush = false,
  closeLabel = "닫기",
  className,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const full = size === "full";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onCancel = (e: SyntheticEvent) => {
    e.preventDefault();
    if (closable) onClose();
  };
  // 막을 누르면 dialog 자신이 target 입니다 (내용은 안쪽 div 가 받습니다)
  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (closable && dismissible && e.target === e.currentTarget) onClose();
  };
  const closeButton = (
    <button type="button" className={modalClose} onClick={onClose} aria-label={closeLabel}>
      <CloseGlyph size={18} />
    </button>
  );

  return (
    <SurfaceRoot
      as="dialog"
      ref={ref}
      fill="raised"
      border="line"
      shadow="floating"
      className={cx(modal, modalSize[size], full && modalFull, className)}
      onCancel={onCancel}
      onClick={onBackdrop}
      aria-labelledby={title !== undefined ? titleId : undefined}
    >
      {open && (
        <div className={cx(modalContent, full && modalContentFill)}>
          {title !== undefined ? (
            <PaintRoot accent={accent} variant="filled" className={modalHeader}>
              <span className={modalHeadText}>
                <span id={titleId} className={cx(modalTitle, !titleUppercase && modalTitlePlain)}>
                  {title}
                </span>
                {subtitle && <span className={modalSubtitle}>{subtitle}</span>}
              </span>
              {(actions || closable) && (
                <span className={modalHeadActions}>
                  {actions}
                  {closable && closeButton}
                </span>
              )}
            </PaintRoot>
          ) : (
            // 머리 막대가 없어도 닫는 길은 눈에 보여야 합니다 — Esc 와 막 누름만으로는 모자랍니다
            closable && (
              <button type="button" className={cx(modalClose, modalCloseCorner)} onClick={onClose} aria-label={closeLabel}>
                <CloseGlyph size={18} />
              </button>
            )
          )}
          <div className={cx(modalBody, flush && modalBodyFlush, full && modalBodyFill)}>{children}</div>
          {footer &&
            (footerAccent ? (
              <PaintRoot accent={footerAccent} variant="solid" className={cx(modalFooter, modalFooterStrip)}>
                {footer}
              </PaintRoot>
            ) : (
              <div className={modalFooter}>{footer}</div>
            ))}
        </div>
      )}
    </SurfaceRoot>
  );
}

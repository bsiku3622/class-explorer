/** 알림 몰레큘 셋 — Notice(눈에 띄는 안내 상자) · Busy(영역을 덮는 불러오는 중) · EmptyState(비어 있는 자리) */
import type { ElementType, ReactNode } from "react";

import { Spinner } from "../atoms/Spinner";
import { cx } from "../internal/cx";
import { Icon, type IconComponent } from "../primitives/Icon";
import { Inline, Stack } from "../primitives/layout";
import { Paint } from "../primitives/Paint";
import { Text } from "../primitives/Text";
import type { Accent, NoticeVariant } from "../tokens/vocabulary";
import { busy, busyContent, busyOverlay, emptyState, emptyStateFramed, notice, noticeBody, noticeWrap } from "./feedback.css";

export interface NoticeProps {
  /** 기본 `error`(빨강) — 안내면 `sky`, 됐다는 알림이면 `success` */
  accent?: Accent;
  /** 기본 `plain`(연한 면). `solid` 는 꽉 찬 색 띠에 검정 테두리입니다 */
  variant?: NoticeVariant;
  /** 4px 그림자 — 화면의 주인공 알림 */
  shadow?: boolean;
  /** 좁은 폭에서 `action` 이 글 아래로 내려갑니다 — 버튼이 여럿인 배너 */
  wrap?: boolean;
  icon?: IconComponent;
  title?: ReactNode;
  /** 오른쪽 끝 — 다시 시도 같은 버튼 */
  action?: ReactNode;
  /** 기본 `status`. 곧바로 읽혀야 하는 오류면 `alert` */
  role?: "status" | "alert";
  className?: string;
  children?: ReactNode;
}

const PaintRoot = Paint as ElementType;

/** 안내 상자 — `Paint` 의 plain(연한 면 · 진한 테두리 · 진한 글자), 또는 solid(꽉 찬 색 띠) */
export function Notice({ accent = "error", variant = "plain", shadow = false, wrap = false, icon, title, action, role = "status", className, children }: NoticeProps) {
  return (
    <PaintRoot role={role} accent={accent} variant={variant} shadow={shadow} className={cx(notice, wrap && noticeWrap, className)}>
      <Inline gap="lg" align="start" className={wrap ? noticeBody : undefined}>
        {icon && <Icon icon={icon} size="md" />}
        <Stack gap="2xs">
          {title && (
            <Text variant="caption" weight="black" tone="inherit">
              {title}
            </Text>
          )}
          <Text variant="caption" tone="inherit">
            {children}
          </Text>
        </Stack>
      </Inline>
      {action}
    </PaintRoot>
  );
}

export interface BusyProps {
  /** 불러오는 중 */
  active: boolean;
  /** 스피너 아래 글자 */
  label?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** 영역을 덮는 불러오는 중 — 내용을 지우지 않고 흐리게 두어 자리가 튀지 않습니다. 그동안 아래 내용은 눌리지 않습니다 */
export function Busy({ active, label = "불러오는 중", className, children }: BusyProps) {
  return (
    <div className={cx(busy, className)} aria-busy={active || undefined}>
      <div className={active ? busyContent : undefined}>{children}</div>
      {active && (
        <div className={busyOverlay}>
          <Spinner size="lg" label={typeof label === "string" ? label : "불러오는 중"} />
          <Text variant="overline">{label}</Text>
        </div>
      )}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconComponent;
  title?: ReactNode;
  /** 할 수 있는 것 — 첫 자료 올리기 같은 버튼 */
  action?: ReactNode;
  /** 점선 테두리로 자리를 그립니다 */
  framed?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * 비어 있는 자리 — 카드가 비었을 때 검은 줄 하나만 남기지 말고 이걸 넣습니다.
 * "오늘은 정해진 일정이 없습니다" 같은 한 줄.
 */
export function EmptyState({ icon, title, action, framed = false, className, children }: EmptyStateProps) {
  return (
    <Stack gap="md" align="center" className={cx(emptyState, framed && emptyStateFramed, className)}>
      {icon && <Icon icon={icon} size="xl" tone="faint" />}
      {title && (
        <Text variant="subheading" tone="muted">
          {title}
        </Text>
      )}
      {children && (
        <Text variant="caption" tone="muted" align="center">
          {children}
        </Text>
      )}
      {action}
    </Stack>
  );
}

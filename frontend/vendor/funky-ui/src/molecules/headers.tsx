/** 제목 몰레큘 둘 — SectionTitle(섹션 소제목) · PageHeader(페이지 머리 카드) */
import type { ElementType, ReactNode } from "react";

import { cx } from "../internal/cx";
import { Surface } from "../primitives/Surface";
import { Icon, type IconComponent } from "../primitives/Icon";
import { Inline, Stack } from "../primitives/layout";
import { Text } from "../primitives/Text";
import { Card } from "./Card";
import { pageHeaderIcon, pageHeaderRow, pageTitle, sectionTitle } from "./headers.css";

export interface SectionTitleProps {
  title: ReactNode;
  icon?: IconComponent;
  /** 오른쪽 끝 — 개수 · 작은 버튼 */
  trailing?: ReactNode;
  /** 제목 태그 (기본 h2). 생김새는 바뀌지 않습니다 */
  as?: ElementType;
  className?: string;
}

/** 섹션 소제목 — 14px · 대문자 · 넓은 자간 · 약한 잉크. 제목 줄은 영어로 씁니다 */
export function SectionTitle({ title, icon, trailing, as = "h2", className }: SectionTitleProps) {
  return (
    <Inline justify="between" gap="md" className={cx(sectionTitle, className)}>
      <Inline gap="md">
        {icon && <Icon icon={icon} size={18} tone="muted" />}
        <Text as={as} variant="subtitle">
          {title}
        </Text>
      </Inline>
      {trailing}
    </Inline>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** 제목 위 작은 이름표 (overline) */
  subtitle?: ReactNode;
  icon?: IconComponent;
  /** 오른쪽 — 페이지의 주 동작 */
  action?: ReactNode;
  /** 머리 아래 같은 카드 안에 붙는 내용 (필터 줄 등) */
  children?: ReactNode;
  className?: string;
}

/** 페이지 머리 — 검정 아이콘 칸 + 이름표 + 큰 제목 */
export function PageHeader({ title, subtitle, icon, action, children, className }: PageHeaderProps) {
  return (
    <Card as="header" className={className}>
      <Stack gap="3xl">
        <div className={pageHeaderRow}>
          <Inline gap="xl" align="center">
            {icon && (
              <Surface fill="inverse" className={pageHeaderIcon}>
                <Icon icon={icon} size="lg" />
              </Surface>
            )}
            <Stack gap="2xs">
              {subtitle && <Text variant="overline">{subtitle}</Text>}
              <Text as="h1" variant="title" uppercase className={pageTitle}>
                {title}
              </Text>
            </Stack>
          </Inline>
          {action}
        </div>
        {children}
      </Stack>
    </Card>
  );
}

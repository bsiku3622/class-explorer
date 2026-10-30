import type { ElementType, ReactNode } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { Box } from "../primitives/Box";
import { Icon, type IconComponent } from "../primitives/Icon";
import { Inline, Stack } from "../primitives/layout";
import { Paint } from "../primitives/Paint";
import { Pressable } from "../primitives/Pressable";
import { Surface, surfaceClass } from "../primitives/Surface";
import { Text } from "../primitives/Text";
import type { Accent, PressMotion, Space, SurfaceFill, Variant } from "../tokens/vocabulary";
import { cardBase, cardHeader, cardHeaderBar, cardHeaderTitle, cardPressable, cardSection, cardSectionDivided, cardStrip, cardStripBottom, cardStripTop } from "./Card.css";

export interface CardOwnProps {
  /**
   * 흑백 면 (기본 `raised` — 흰 면). 카드는 면이 있는 흑백 박스라 `none` 도, 뼈대의 보라(`brand`)도, accent 도
   * 없습니다 — 색이 있는 박스는 Paint
   */
  fill?: Exclude<SurfaceFill, "none" | "brand">;
  /** 기본 `raised`(4px). 모달이 아니면 `floating` 을 쓰지 않습니다. `motion` 을 주면 몸짓이 그림자를 가집니다 */
  shadow?: "raised" | "none";
  /** 기본 `3xl`(24px). 머리 막대를 붙이려면 `0` 을 주고 `Card.Header` · `Card.Section` 으로 나눕니다 */
  padding?: Space;
  /** 카드 전체가 누르는 물건이면 — 가라앉거나(sink) · 떠오르거나(lift) · 그림자가 올라옵니다(raise). `none` 은 누르지만 움직이지 않습니다 */
  motion?: PressMotion;
  className?: string;
  children?: ReactNode;
}

export type CardProps<E extends ElementType = "div"> = PolyProps<E, CardOwnProps>;

const SurfaceRoot = Surface as ElementType;
const PressableRoot = Pressable as ElementType;

/** 카드 — `Surface`(흰 면 · 2px 검정 · 4px 그림자) 위에 섭니다. 화면의 영역은 카드로 나눕니다 */
export function Card<E extends ElementType = "div">({
  as,
  fill = "raised",
  shadow = "raised",
  padding = "3xl",
  motion,
  className,
  ...rest
}: CardProps<E>) {
  if (motion) {
    // 누르는 카드 — 누름(Pressable)이 그림자를 갖고, 면과 테두리만 Surface 에서 빌려 옵니다
    return (
      <PressableRoot as={as} motion={motion} padding={padding} className={cx(surfaceClass({ fill, border: "line" }), cardBase, cardPressable, className)} {...rest} />
    );
  }
  return <SurfaceRoot as={as} fill={fill} border="line" shadow={shadow} padding={padding} className={cx(cardBase, className)} {...rest} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  /** 제목 위의 작은 이름표 (overline). 주면 두 줄 머리가 되어 제목이 줄바꿈됩니다 */
  eyebrow?: ReactNode;
  /** 제목 아래 설명. 주면 두 줄 머리가 되어 제목이 줄바꿈됩니다 */
  description?: ReactNode;
  /** 제목의 글자 (기본 `subtitle` — 대문자 14px). `heading` 은 대소문자를 둔 20px 이고 줄바꿈됩니다 */
  titleStyle?: "subtitle" | "heading";
  icon?: IconComponent;
  /** 오른쪽 끝 — 개수 · 버튼 */
  actions?: ReactNode;
  /** `bar` 는 Paint 의 filled 로 칠한 머리 막대 (모달 머리와 같은 모양) */
  tone?: "plain" | "bar";
  /** 머리 막대의 색 (`tone="bar"` 일 때, 기본 검정) */
  accent?: Accent;
  className?: string;
}

const PaintRoot = Paint as ElementType;

/** 카드 머리 — 섹션 소제목 글자 + 오른쪽 끝 자리 */
function CardHeader({ title, eyebrow, description, titleStyle = "subtitle", icon, actions, tone = "plain", accent, className }: CardHeaderProps) {
  const bar = tone === "bar";
  const ink = bar ? "inherit" : undefined;
  const rich = Boolean(eyebrow || description) || titleStyle === "heading";
  const content = (
    <>
      <Inline gap="md" className={cardHeaderTitle}>
        {icon && <Icon icon={icon} size={18} tone={bar ? "inherit" : "muted"} />}
        {rich ? (
          <Stack gap="2xs" className={cardHeaderTitle}>
            {eyebrow && (
              <Text as="div" variant="overline" tone={ink}>
                {eyebrow}
              </Text>
            )}
            <Text as="div" variant={titleStyle} tone={ink}>
              {title}
            </Text>
            {description && (
              <Text as="div" variant="caption" tone={bar ? "inherit" : "muted"}>
                {description}
              </Text>
            )}
          </Stack>
        ) : (
          <Text variant="subtitle" tone={ink} truncate>
            {title}
          </Text>
        )}
      </Inline>
      {actions && <Inline gap="sm">{actions}</Inline>}
    </>
  );
  return bar ? (
    <PaintRoot as={Inline} accent={accent} variant="filled" justify="between" gap="md" className={cx(cardHeader, cardHeaderBar, className)}>
      {content}
    </PaintRoot>
  ) : (
    <Inline justify="between" gap="md" className={cx(cardHeader, className)}>
      {content}
    </Inline>
  );
}

export interface CardSectionProps {
  /** 위에 카드 안 구분선 — 카드 안에 카드를 넣지 말고 이걸로 나눕니다 */
  divided?: boolean;
  padding?: Space;
  className?: string;
  children?: ReactNode;
}

function CardSection({ divided, padding = "3xl", className, children }: CardSectionProps) {
  return (
    <Box padding={padding} className={cx(cardSection, divided && cardSectionDivided, className)}>
      {children}
    </Box>
  );
}

export interface CardStripProps {
  accent?: Accent;
  /** 칠 (기본 `solid`) */
  variant?: Variant;
  /** 카드의 어느 끝에 붙는지 (기본 `bottom`) — 테두리는 카드 쪽 한 줄만 남습니다 */
  placement?: "top" | "bottom";
  className?: string;
  children?: ReactNode;
}

/** 전폭 색 띠 — 카드 안 아래 · 위 끝의 상태 줄 (노란 푸터 막대 · 거절 사유). 카드는 `padding="0"` 으로 둡니다 */
function CardStrip({ accent, variant = "solid", placement = "bottom", className, children }: CardStripProps) {
  return (
    <PaintRoot accent={accent} variant={variant} className={cx(cardStrip, placement === "top" ? cardStripTop : cardStripBottom, className)}>
      {children}
    </PaintRoot>
  );
}

Card.Header = CardHeader;
Card.Section = CardSection;
Card.Strip = CardStrip;

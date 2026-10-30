import { useId, useState, type ReactNode } from "react";

import { cx } from "../internal/cx";
import { ChevronDownGlyph } from "../internal/glyphs";
import { Icon, type IconComponent } from "../primitives/Icon";
import { Pressable } from "../primitives/Pressable";
import { surfaceClass } from "../primitives/Surface";
import { Text } from "../primitives/Text";
import { enterClass } from "../styles/enter.css";
import { truncateClass } from "../styles/typography.css";
import type { AccordionSize, AccordionTitle } from "../tokens/vocabulary";
import { Card } from "./Card";
import { accordionBody, accordionBodyLg, accordionBodySm, accordionChevron, accordionChevronOpen, accordionHead, accordionHeader, accordionHeaderLg, accordionHeaderSm, accordionTitle, accordionTitleSection } from "./Accordion.css";

export interface AccordionProps {
  title: ReactNode;
  /** 제목의 글자 (기본 `heading` — 20px). `section` 은 대문자 섹션 제목입니다 — 좁은 화면 14px, 넓은 화면 20px */
  titleStyle?: AccordionTitle;
  /** `sm` 은 12px 제목의 촘촘한 줄입니다 (기본 `md`). 이때 `titleStyle` 은 쓰지 않습니다. `lg` 는 화면의 주인공 목록 — 머리가 넓고 그림자가 6px 입니다 */
  size?: AccordionSize;
  icon?: IconComponent;
  /** 제목 옆 — 개수 배지 같은 것. 넓은 화면에서는 오른쪽 끝에 모이고, 좁은 화면에서는 제목 아래로 내려갑니다 */
  trailing?: ReactNode;
  /** 제어할 때 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children?: ReactNode;
}

/**
 * 접히는 카드 — 머리를 누르면 펼쳐지고, 내용은 카드 안 구분선 아래에 제자리에서 나타납니다(fade). 머리는 움직이지 않는
 * Pressable 위의 hover 층(Surface)입니다
 */
export function Accordion({ title, titleStyle = "heading", size = "md", icon, trailing, open, defaultOpen = false, onOpenChange, className, children }: AccordionProps) {
  const small = size === "sm";
  const large = size === "lg";
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const id = useId();
  const headerId = `${id}-header`;
  const toggle = () => {
    if (open === undefined) setInner(!isOpen);
    onOpenChange?.(!isOpen);
  };
  return (
    <Card padding="0" shadow={large ? "floating" : "raised"} className={className}>
      <Pressable id={headerId} className={cx(surfaceClass({ fill: "none", hoverable: true }), accordionHeader, small && accordionHeaderSm, large && accordionHeaderLg)} aria-expanded={isOpen} aria-controls={isOpen ? id : undefined} onClick={toggle}>
        {icon && <Icon icon={icon} size={small ? "sm" : "lg"} strokeWidth={3} />}
        <span className={accordionHead}>
          {small ? (
            <Text variant="caption" weight="black" truncate className={accordionTitle}>
              {title}
            </Text>
          ) : titleStyle === "section" ? (
            <span className={cx(accordionTitleSection, truncateClass, accordionTitle)}>{title}</span>
          ) : (
            <Text variant="heading" truncate className={accordionTitle}>
              {title}
            </Text>
          )}
          {trailing}
        </span>
        <ChevronDownGlyph size={small ? 16 : 24} strokeWidth={3} className={cx(accordionChevron, isOpen && accordionChevronOpen)} />
      </Pressable>
      {isOpen && (
        <div id={id} role="region" aria-labelledby={headerId} className={cx(accordionBody, small && accordionBodySm, large && accordionBodyLg, enterClass.fade)}>
          {children}
        </div>
      )}
    </Card>
  );
}

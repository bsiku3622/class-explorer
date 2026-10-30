/** 글자 아톰 — Link · Label · Code · Wordmark · Divider */
import type { ComponentPropsWithRef, ElementType, MouseEventHandler } from "react";

import { cx } from "../internal/cx";
import type { PolyProps } from "../internal/polymorphic";
import { useAccent } from "../primitives/Paint";
import { surfaceClass } from "../primitives/Surface";
import { textRoleClass } from "../styles/typography.css";
import type { Accent, LinkUnderline, WordmarkSize } from "../tokens/vocabulary";
import { code, divider, dividerTone, link, linkQuiet, linkQuietAccent, required, wordmark, wordmarkPress, wordmarkSize } from "./text-atoms.css";

export type LinkProps<E extends ElementType = "a"> = PolyProps<E, { accent?: Accent; underline?: LinkUnderline; className?: string }>;

/**
 * 글 속 링크 — accent 의 진한 글자에 2px 밑줄, hover 때 accent 면으로 뒤집힙니다.
 * `underline="hover"` 는 조용한 링크입니다 — 글자 · 굵기를 바깥에서 물려받고 hover 때만 밑줄이 생기며, `accent` 를 주면 그때 그 색이 됩니다.
 * 라우터 링크는 `as={RouterLink}` 로 넘깁니다.
 */
export function Link<E extends ElementType = "a">({ as, accent, underline = "always", className, ...rest }: LinkProps<E>) {
  const Comp: ElementType = as ?? "a";
  const quiet = underline === "hover";
  return <Comp className={cx(quiet ? linkQuiet : link, quiet && accent && linkQuietAccent, useAccent(accent), className)} {...rest} />;
}

export type CodeProps = ComponentPropsWithRef<"code">;

/**
 * 문장 속 코드 칩 — 검정 면 · 흰 900 글자. 검색식(`student:25-001`)처럼 대소문자가 뜻을 가지는 글자를 그대로 보이고,
 * 줄이 바뀌면 칩도 같이 줄을 바꿉니다. 상태를 적는 라벨은 `Badge` 입니다
 */
export function Code({ className, ...rest }: CodeProps) {
  return <code className={cx(surfaceClass({ fill: "inverse" }), code, className)} {...rest} />;
}

export type WordmarkProps<E extends ElementType = "span"> = PolyProps<E, { size?: WordmarkSize; onClick?: MouseEventHandler<HTMLElement>; className?: string }>;

/**
 * 로고 글자 — 기울어진 900 대문자. 색은 바깥 글자색을 물려받습니다. `onClick` 을 주면 버튼이 되어 hover 때 커지고
 * 누르면 작아지며, 제목이면 `as="h1"` 로 그립니다
 */
export function Wordmark<E extends ElementType = "span">({ as, size = "md", onClick, className, ...rest }: WordmarkProps<E>) {
  const Comp: ElementType = as ?? (onClick ? "button" : "span");
  return (
    <Comp
      type={Comp === "button" ? "button" : undefined}
      onClick={onClick}
      className={cx(wordmark, wordmarkSize[size], onClick && wordmarkPress, className)}
      {...rest}
    />
  );
}

export type LabelProps = ComponentPropsWithRef<"label"> & { required?: boolean };

/** 폼 칸의 이름표 — overline 글자 (10px · 900 · 대문자 · 약한 잉크) */
export function Label({ required: isRequired, className, children, ...rest }: LabelProps) {
  return (
    <label className={cx(textRoleClass.overline, className)} {...rest}>
      {children}
      {isRequired && (
        <span className={required} aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export interface DividerProps {
  /** 선의 색 (굵기는 셋 다 2px) — 기본 `subtle` 은 카드 안의 구분선, `line` 은 검정 */
  tone?: "subtle" | "soft" | "line";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** 구분선 — 카드 안을 나눌 때. 카드 안에 카드를 넣지 말고 이걸로 나눕니다 */
export function Divider({ tone = "subtle", orientation = "horizontal", className }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cx(divider[orientation], dividerTone[tone], className)}
    />
  );
}

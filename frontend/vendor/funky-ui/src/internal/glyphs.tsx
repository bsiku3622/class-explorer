/**
 * 패키지 안에서만 쓰는 작은 그림 — Select 화살표 · 닫기 · 체크 · 검색.
 * 아이콘 라이브러리를 의존성으로 들이지 않으려고 직접 그립니다. 앱은 lucide-react 를 씁니다.
 */
import type { ReactNode, SVGProps } from "react";

import { ICON_STROKE } from "../tokens/shape";

type GlyphProps = Omit<SVGProps<SVGSVGElement>, "children" | "size"> & { size?: number | string };

const glyph = (paths: ReactNode) =>
  function Glyph({ size = 16, strokeWidth = ICON_STROKE, ...rest }: GlyphProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  };

export const ChevronDownGlyph = glyph(<path d="m6 9 6 6 6-6" />);
export const CloseGlyph = glyph(<path d="M18 6 6 18M6 6l12 12" />);
export const CheckGlyph = glyph(<path d="M20 6 9 17l-5-5" />);
export const SearchGlyph = glyph(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </>,
);

# RetroSubTitle Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
섹션 소제목 표준 컴포넌트. 스타일이 고정되어 일관성을 보장합니다.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `title` | `string` | 소제목 텍스트 |
| `icon` | `LucideIcon` | 아이콘 컴포넌트 |

## 고정 스타일
```
flex items-center gap-2
text-sm font-bold text-black/40 uppercase tracking-widest
아이콘: size={18} className="text-black/40"
```

## 사용 예시
```tsx
import { Users } from "lucide-react";
<RetroSubTitle title="Search & Add Students" icon={Users} />
```

## 주의
- 섹션 소제목은 반드시 이 컴포넌트 사용
- 직접 `text-sm font-bold text-black/40 uppercase tracking-widest` 스타일링 금지
- `AccordionSection`의 헤더는 이 컴포넌트와 별개 (자체 스타일)

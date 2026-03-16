# PageHeader Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
모든 페이지 상단에 사용하는 표준 헤더 블록. `RetroCard` + `RetroFeatureTag` 조합.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `tag` | `string` | Feature 태그 텍스트 (우상단) |
| `title` | `string` | 메인 제목 (대형 텍스트) |
| `subtitle` | `string` | 부제목 |
| `icon` | `LucideIcon` | 제목 옆 아이콘 |
| `action` | `ReactNode` | 우측 액션 영역 (버튼 등) |
| `children` | `ReactNode` | 헤더 하단 추가 콘텐츠 |
| `className` | `string` | 추가 클래스 |

## 레이아웃
```
┌─────────────────────────────────────────┐  ← RetroCard (relative)
│                           [FEATURE: X]  │  ← RetroFeatureTag (absolute)
│  [icon] TITLE                           │
│  subtitle                [action]       │
│                                         │
│  [children]                             │
└─────────────────────────────────────────┘
```

## 타이포그래피
- `tag`: `text-[10px] font-black uppercase` (RetroFeatureTag)
- `title`: `text-4xl font-black tracking-tighter uppercase`
- `subtitle`: `text-sm font-bold text-black/40`

## 사용 예시
```tsx
<PageHeader
  tag="Feature: Search Engine"
  title="Class Explorer"
  subtitle="Find classes, teachers & rooms"
  icon={Search}
  action={<RetroButton>Refresh</RetroButton>}
>
  {/* 검색창 등 추가 콘텐츠 */}
</PageHeader>
```

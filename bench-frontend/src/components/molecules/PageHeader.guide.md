# PageHeader Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
모든 페이지 상단에 쓰는 표준 헤더 블록. `RetroCard` 안에 아이콘·제목·액션을 담습니다.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `title` | `string` | 메인 제목 (대형 텍스트) |
| `subtitle` | `string` | 제목 **위**에 붙는 작은 라벨 |
| `icon` | `LucideIcon` | 검정 정사각형 안에 들어가는 아이콘 |
| `action` | `ReactNode` | 우측 액션 영역 (버튼 등) |
| `children` | `ReactNode` | 헤더 하단 추가 콘텐츠 |
| `className` | `string` | 추가 클래스 |

## 레이아웃
```
┌─────────────────────────────────────────┐  ← RetroCard (bg-white, p-6 md:p-8)
│  ┌───┐  SUBTITLE                        │
│  │ ▣ │  TITLE                [action]   │
│  └───┘                                  │
│                                         │  ← gap-6 md:gap-8
│  [children]                             │
└─────────────────────────────────────────┘
```

## 타이포그래피
- `subtitle`: `text-[10px] font-black text-black/40 uppercase tracking-widest`
- `title`: `text-2xl md:text-3xl font-black tracking-tight uppercase leading-tight`
- 아이콘 상자: `w-10 h-10 md:w-12 md:h-12 bg-black`, 아이콘은 `size={20}` 흰색

## 사용 예시
```tsx
<PageHeader
  title="Class Explorer"
  subtitle="Class Finder"
  icon={Search}
  action={<RetroButton>Refresh</RetroButton>}
>
  {/* 검색창 등 추가 콘텐츠 */}
</PageHeader>
```

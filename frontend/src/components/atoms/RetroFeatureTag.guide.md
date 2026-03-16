# RetroFeatureTag Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
카드 우상단에 기능명을 표시하는 절대 위치 태그.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `feature` | `string` | 표시할 기능명 |

## 스타일
```
position: absolute top-0 right-0
bg-black text-white
text-[10px] font-black uppercase tracking-wider
px-2 py-1
```

## 사용 예시
```tsx
// PageHeader 내부에서 자동 사용
<RetroFeatureTag feature="Search Engine" />
// → 우상단에 "FEATURE: SEARCH ENGINE" 표시

// 직접 사용 시 부모에 relative 필요
<div className="relative">
  <RetroFeatureTag feature="Room Finder" />
</div>
```

## 사용처
- `PageHeader` 컴포넌트에서 `tag` prop이 있을 때 자동 렌더링
- 각 페이지 헤더에서 Feature 이름 표시용

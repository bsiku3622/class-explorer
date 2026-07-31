# Navigation Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
상단 고정 네비게이션 바. 로고만 표시 (검색은 SearchPage에서).

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `onLogoClick` | `() => void` | 로고 클릭 핸들러 (검색 초기화 + `/` 이동) |

## 스타일
```
fixed top-0 left-0 right-0  z-50
bg-retro-secondary (#1a1a1a)  text-white
height: h-16 (pt-20으로 컨텐츠 밀어냄)
```

## 로고 애니메이션
- "Class Explorer" 텍스트
- 호버 시 `skew-x-[-6deg]` 변형
- `transition-transform duration-200`

## 레이아웃 영향
`App.tsx`에서 `<div className="flex pt-20">` — Navigation 높이(h-16+여유) 만큼 상단 패딩 적용.

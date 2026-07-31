# RetroButton Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
레트로 브루탈리즘 스타일의 물리 피드백 버튼. 모든 버튼은 이 컴포넌트를 사용합니다.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `variant` | `"primary" \| "secondary" \| "white" \| "black"` | `"white"` | 색상 변형 |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | 크기 |
| `isSelected` | `boolean` | `false` | 선택 상태 (검정 배경) |
| `icon` | `ReactNode` | - | 좌측 아이콘 |
| `onClick` | `() => void` | - | 클릭 핸들러 |
| `className` | `string` | - | 추가 클래스 |
| `children` | `ReactNode` | - | 버튼 텍스트 |

## 애니메이션 동작
```
기본:       shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]
hover:      shadow 없어지고 translate-x-1 translate-y-1 (그림자 안으로 이동)
transition: duration-100 (즉각적)
```

`isSelected=true`일 때:
```
기본:   scale-105 + shadow (검정 배경)
hover:  shadow만 없어짐 (translate 없음 — 선택된 버튼은 움직이지 않음)
active: scale-100
```

## 사용 예시
```tsx
// 기본 버튼
<RetroButton onClick={fn}>확인</RetroButton>

// 선택 가능한 토글 버튼
<RetroButton isSelected={isActive} onClick={toggle}>필터</RetroButton>

// 아이콘 포함
<RetroButton icon={<Plus size={14} />} size="sm">추가</RetroButton>

// 검정 스타일 (네비게이션 등)
<RetroButton variant="black">메뉴</RetroButton>
```

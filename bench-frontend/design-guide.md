# Frontend Design Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md) | 원본 레퍼런스: [/design-guide.md](../design-guide.md)

**스타일**: 레트로 브루탈리즘 — 굵은 테두리, 하드 쉐도우, 물리적 버튼 피드백

## 색상 토큰
| 토큰 | 값 | 용도 |
|------|----|------|
| `retro-bg` | `#f8f5f0` | 전체 배경 (누런 미색) |
| `retro-fg` | `#000000` | 기본 텍스트 + 테두리 |
| `retro-primary` | `#ff3e3e` | 강조 (통계 막대 기본색) |
| `retro-secondary` | `#1a1a1a` | 네비게이션 다크 요소 |
| `retro-accent-light` | `#fdf6e3` | 리스트/버튼 호버 배경 |
| `retro-green` | `#22c55e` | 성공 상태, 빈 교실 표시 |

## 학번별 색상
| 학번 | 색상 | Hex |
|------|------|-----|
| 23 | Purple | `#7828C8` |
| 24 | Orange | `#FC8200` |
| 25 | Green | `#00B327` |
| 26 | Cyan | `#00B5E7` |

## 타이포그래피
- **폰트**: Pretendard Variable
- **섹션 소제목**: `text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2`
- **아이콘 (소제목)**: `size={18} className="text-black/40"`
- **대형 제목**: `text-4xl font-black tracking-tighter uppercase`
- **통계 라벨**: `text-sm font-black uppercase`
- **배지**: `text-[10px] font-black`

## 테두리 & 구분선
```
카드/버튼/컨테이너:  border-2 border-black
내부 구분선:        border-black/10  또는  divide-black/10
```

## 쉐도우 & 애니메이션 (핵심)
"그림자가 버튼 안으로 숨는 물리 피드백" 패턴:
```
기본:       shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]
호버:       shadow-[0_0_0_0_rgba(0,0,0,0.2)] translate-x-1 translate-y-1
전환:       transition-all duration-100
카드(큰):   shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]
```

선택된 버튼 (검정 배경):
```
normal:  scale-105 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]
hover:   shadow-[0_0_0_0_rgba(0,0,0,0.2)]  (translate 없음)
active:  scale-100
```

## 카드 패턴
```
기본 카드:     bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]
호버 카드:     hover:-translate-y-1.5 transition-transform
RetroCard:    border-2 border-black (bg 없음 — className으로 별도 지정)
```

## 기능별 규칙

### 시간표 그리드 (빈 교실 / 비교)
```
빈 교실:   bg-retro-green/20
점유됨:    bg-black/[0.07] grayscale
선택됨:    bg-black
공통 슬롯: w-1.5 h-1.5 bg-retro-green rotate-45 (다이아몬드)
```

### 통계 바 차트
```
바 높이:   h-5
기본색:    bg-retro-primary
호버:      group-hover:bg-[#ff7e7e]
```

### 학생 배지
```
형식: "25 이름"  (연도 + 이름)
테두리: border-2  (학번 색상)
배경:  bg-[color]/15
글자:  학번 색상
```

### HeroUI 전역 오버라이드
```css
/* index.css */
[data-slot="base"] { border-radius: 0 !important; }  /* 모든 모서리 직각 */
```

## 관련 가이드
- [component-guide.md](component-guide.md) — 컴포넌트 props & 사용법

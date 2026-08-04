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

⚠️ **`color` 를 준 버튼에는 `scale-105` 를 걸지 않습니다.** 확대하면 테두리도 같이
2px → 2.1px 로 커져서 **선이 굵어진 것처럼** 보이는데, 나란히 붙은 버튼 무리(급식
끼니 같은)에서는 그게 크기 차이가 아니라 굵기 차이로 읽힙니다. 색이 이미 "골랐다" 를
충분히 말하므로 확대는 덧붙임일 뿐입니다.

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

### 하루 시간 축 (홈의 `DayRuler` + `TodayTimeline`)

⚠️ **카드 안에 카드를 넣지 마세요.** 한때 자를 테두리 있는 칸 열한 개로, 목록을 줄마다
`border-2` 로 그렸는데 — 카드 안에 카드가 열아홉 개 든 꼴이라 전부 같은 무게로 떠들고
정작 "지금" 이 묻혔습니다. **테두리는 바깥 카드 하나**, 안쪽은 `black/10` 구분선입니다.

```
자 · 높이:      h-10 md:h-12 (칸이 거의 정사각형이 되는 크기)
자 · 칸:        교시마다 border-2 + 11px 번호. **번호가 곧 이름표입니다**
자 · 수업 예정:  border-black bg-white text-black shadow-[2px_2px_0_0_…0.2]
자 · 수업 지금:  border-black bg-retro-primary text-black shadow-[3px_3px_0_0_…0.25]
자 · 수업 지남:  border-black/15 bg-black/15 text-black/40
자 · 공강:      border-dashed border-black/20 · 배경 없음 · text-black/25
자 · 점심·저녁:  빗금 rgba(0,0,0,0.13) 0 3px / transparent 3px 7px
               ↳ 양옆을 **쉬는시간(10분)만큼 물려** 칸 사이 간격과 리듬을 맞춥니다
지금 캐럿:      w-0.5 bg-black + 위에 마름모(h-2 w-2 rotate-45) · transition-[left] 700ms
눈금 글자:      9px black/30 (덩어리 양 끝) + 구멍 이름 "점심"·"저녁"
목록:          divide-y divide-black/10 · 테두리 없음
줄 · 지금:      -mx-5 px-5 border-y-2 border-black bg-retro-primary  (카드 여백까지 흐름)
줄 · 지남:      opacity-40
빈 시간:       11px black/30 · 앞에 4px 짧은 선
방학 막대:      남은 쪽만 계절색 · 지나간 쪽은 빗금
```

⚠️ **자의 칸에는 반드시 교시 번호를 답니다.** 번호 없이 막대만 두면 그게 몇 교시인지
알 방법이 없어 아래 목록과 연결이 끊깁니다. 색을 빼고 무늬(빗금 두 종류)로 성격을
주려다 더 안 읽히게 만든 적이 있습니다 — **부족한 건 장식이 아니라 이름표였습니다.**

**테두리는 칸마다 두릅니다.** 바깥을 하나로 감싸면 교시 사이 쉬는시간(10분)이 칸
안쪽의 여백처럼 보여 칸을 세어야 알 수 있습니다 — 칸마다 두르면 쉬는시간이 칸 사이의
**틈**으로 그냥 보입니다. (여기서 카드 안 카드를 금지한 규칙과 부딪히지 않는 이유는
이게 목록이 아니라 **눈금**이어서입니다 — 칸 하나하나가 데이터입니다.)

**면을 채우는 건 "지금" 하나뿐입니다.** 남은 수업까지 검게 칠했더니 하루가 통째로
쨍했습니다 — 내 수업인지 아닌지는 **테두리**(실선 vs 점선)가 이미 가르고 있습니다.

빈틈은 두 종류이고 뜻이 다릅니다 — **칸 사이의 흰 틈**은 10분 쉬는시간, **빗금**은
점심·저녁처럼 수업이 놓일 수 없는 구간입니다.

⚠️ **과목마다 색을 달리하지 마세요.** 학과별 팔레트를 만들어 자와 목록에 입혀 봤는데,
하루가 색표처럼 보이고 정작 "지금" 이 묻혔습니다. 이 화면에서 **면을 가진 건 진행
중인 줄 하나뿐**입니다.

**타입 스케일이 있어야 시선이 멈춥니다.** 전부 10~15px `font-black` 이면 초점이
없습니다 — 시계 24px / 과목 17px / 시각 15px / 부연 11px / 눈금 9px.

**면을 가진 건 진행 중인 줄 하나뿐입니다.** 그 줄만 카드 여백까지 꽉 채워 흐르고
나머지는 흰 바탕에 글자만 있습니다 — 그래야 "지금" 이 목록 안의 한 칸이 아니라
지나가는 구간으로 읽힙니다.

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

## 로딩 표시

`RetroSpinner` 를 씁니다. **HeroUI `<Spinner />` 는 이 프로젝트에서 동작하지 않습니다** —
`animate-spinner-ease-spin`·`w-5` 같은 클래스가 `node_modules` 안에만 있어서 Tailwind v4
가 유틸리티를 생성하지 않고, 회전 없는 **4px 세로선**으로 그려집니다. 원형 스피너는
전역 `rounded-none!` 오버라이드와도 싸웁니다.

생김새는 **paper-ui 의 `Spinner`** 를 옮겼습니다 — 옅은 링에 위쪽 한 조각만 진해서
회전이 읽힙니다.

```
rounded-full · border-black/15 · border-t-black · 900ms linear
sm 16px(2px) · md 20px(2px) · lg 28px(3px)
```

## 관련 가이드
- [component-guide.md](component-guide.md) — 컴포넌트 props & 사용법

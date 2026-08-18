# Frontend Design Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md) | 토큰 원본: [`src/index.css`](src/index.css) 의 `@theme`

**스타일**: 레트로 브루탈리즘 — 굵은 테두리, 하드 쉐도우, 물리적 버튼 피드백

## 색상 토큰

**값의 원본은 `src/index.css` 의 `@theme` 하나뿐입니다.** 아래 표는 그걸 옮겨 적은
것이라, 토큰을 고치면 여기도 같이 고쳐야 합니다 — 한동안 이 표가 실제 값과 전부
어긋나 있었고, 표를 믿고 색을 고른 화면이 엉뚱한 색으로 나왔습니다.

| 토큰 | 값 | 쓰이는 곳 |
|------|----|------|
| `retro-bg` | `#fff5d1` | 전체 배경 (크림). 사이드바도 같은 색입니다 |
| `retro-fg` | `#222222` | 기본 글자색. **테두리는 이게 아니라 `black`(#000) 입니다** |
| `retro-primary` | `#ff4eba` | 핑크. 홈에서는 **"지금"**, 통계 막대 기본색 |
| `retro-secondary` | `#7828c8` | 보라. 상단 바·하단 바 같은 **어두운 면** |
| `retro-accent-light` | `#f0fdff` | 아주 옅은 시안. 목록·버튼 호버 배경 |
| `retro-accent1` | `#3decfd` | 시안. 홈의 Trade 배너, 강조 칸 |
| `retro-accent2` | `#ffd500` | 노랑. 급식 아침, 여름방학 막대 |
| `retro-accent3` | `#ff4eba` | 핑크 — ⚠️ `retro-primary` 와 **같은 값**입니다 |
| `retro-accent4` | `#ff9100` | 주황. 급식 점심, 분반 상태 |
| `retro-accent5` | `#00c8ff` | 하늘. 겨울방학 막대, 생활관 일정 |
| `retro-green` | `#00c22a` | 초록. 빈 교실, 성공 상태 |

⚠️ **`retro-primary` 와 `retro-accent3` 은 같은 핑크입니다.** 한쪽만 바꾸면 같은 뜻이던
두 자리가 조용히 갈라집니다 — 색을 바꿀 일이 생기면 둘 다 보세요.

⚠️ **테두리에 `retro-fg` 를 쓰지 마세요.** 글자는 `#222222`, 테두리는 순수 검정입니다
(`border-2 border-black`). 브루탈리즘의 굵은 선은 완전한 검정일 때만 제대로 섭니다.

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
빈 교실:   bg-retro-green/20          (RoomsPage)
점유됨:    bg-black/[0.07] grayscale
선택됨:    bg-black
```

**초록 마름모**(`h-1.5 w-1.5 rotate-45 bg-retro-green`)는 여기가 아니라 **달력의 개인
일정 표식**입니다 (`CalendarGrid`·`CalendarPage`). 같은 모양을 다른 뜻으로 쓰지 마세요.

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
**틈**으로 그냥 보입니다. (위에서 카드 안 카드를 금지한 규칙과 부딪히지 않는 이유는
이게 목록이 아니라 **눈금**이어서입니다 — 칸 하나하나가 데이터입니다.)

⚠️ **면을 채우는 건 "지금" 하나뿐입니다.** 자에서는 남은 수업까지 검게 칠했더니 하루가
통째로 쨍했고 — 내 수업인지 아닌지는 **테두리**(실선 vs 점선)가 이미 가르고 있습니다.
목록에서는 진행 중인 줄만 카드 여백까지 꽉 채워 흐르고 나머지는 흰 바탕에 글자만
있습니다 — 그래야 "지금" 이 목록 안의 한 칸이 아니라 지나가는 구간으로 읽힙니다.

⚠️ **과목마다 색을 달리하지 마세요.** 학과별 팔레트를 만들어 면 → 띠 → 점으로 줄여 가며
입혀 봤는데, 어느 크기로 줄여도 하루가 색표처럼 보이고 정작 "지금" 이 묻혔습니다.
크기 문제가 아니라 **색 개수** 문제였습니다.

빈틈은 두 종류이고 뜻이 다릅니다 — **칸 사이의 흰 틈**은 10분 쉬는시간, **빗금**은
점심·저녁처럼 수업이 놓일 수 없는 구간입니다.

**타입 스케일이 있어야 시선이 멈춥니다.** 전부 10~15px `font-black` 이면 초점이
없습니다 — 시계 24px / 과목 17px / 시각 15px / 부연 11px / 눈금 9px.

### 주간 격자 (홈의 `WeekTimetable`)

자가 **하루**를 재는 물건이라면 이건 **한 주의 모양**을 보는 물건입니다. 같은 언어를
씁니다 — 칸마다 테두리, 빈 자리는 진짜 비움, 채우는 건 "지금" 하나.

```
행 높이:        h-[3.25rem] md:h-11   ← 좁은 쪽이 더 큽니다 (폭 대신 높이)
교시 번호 열:    1.75rem · 10px black/25 · **위쪽 정렬**(pt-1.5)
요일 머리:      bg-black text-white 11px · **오늘만 bg-white text-black 반전**
바탕 격자선:     border-black/[0.07] — 가로·세로 둘 다
수업 칩:        m-px border-2 border-black bg-white · px-1 py-1
칩 · 지금:      bg-retro-primary (테두리는 같음)
칩 · 과목명:     11px font-black leading-[1.15] line-clamp-2
칩 · 교실:      9px font-bold black/40 — **이름 바로 아래**
점심·저녁 띠:    h-4 빗금 rgba(0,0,0,0.13) 0 3px / transparent 3px 7px
               ↳ 이름은 왼쪽 교시 열에 9px black/35
```

⚠️ **옅은 채움(`bg-black/[0.05]`)으로 칸을 그리지 마세요.** 그렇게 뒀더니 한 주가 통째로
옅은 회색 얼룩이 되어 **어디가 비었는지 세어야** 알 수 있었습니다. 브루탈리즘에서 5%
회색은 아무 말도 안 합니다 — 검은 테두리가 말합니다.

⚠️ **칩 안의 글자를 가운데 정렬하지 마세요.** 연강 덩어리에서 이름이 두 교시 번호
**사이**에 걸려 6교시인지 7교시인지 알 수 없게 됩니다. 이름도 교시 번호도 **위쪽**입니다.

⚠️ **오늘을 핑크로 칠하지 마세요.** 핑크는 "지금" 이고, 오늘 요일 머리까지 핑크면 한
화면에서 같은 색이 두 뜻을 갖습니다. 검은 바에서 **흰색으로 반전**하면 색 없이 됩니다.

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
/* index.css — 네 개의 slot 을 한꺼번에 직각으로 만듭니다 */
[data-slot="base"],
[data-slot="trigger"],
[data-slot="content"],
[data-slot="input-wrapper"] {
    @apply rounded-none! border!;
}
```
⚠️ **건드리지 마세요.** HeroUI 가 기본으로 주는 둥근 모서리를 여기서 한 번에 눌러
놓은 것이라, 빼면 앱 곳곳의 드롭다운·인풋만 둥글어집니다.

## 넘치는 한 줄

문장 전체가 곧 내용인 자리(배너 등)는 `…` 로 자르지 말고 `MarqueeText` 를 씁니다 —
자르면 뒷말을 영영 못 읽습니다.

```
넘칠 때만 움직임 (ResizeObserver 로 다시 잼)
속도 45px/s 고정 · 양 끝에서 10%씩 멈춤 · 최소 6초
prefers-reduced-motion 이면 정지
```

목록의 과목명·교실처럼 **옆에 같은 정보가 또 있는 자리**는 그냥 `truncate` 로 둡니다.
움직이는 것이 늘어나면 정작 "지금" 이 안 보입니다.

## 나타났다 사라지는 버튼

같은 자리에서 모양이 바뀌는 버튼(확인 단계 등)은 **상자를 먼저 고정**합니다.

```
줄 높이 고정 (h-7 등)     ← 안 하면 아래 항목이 통째로 밀립니다
transition-colors        ← transition-all 은 폭까지 애니메이션합니다
whitespace-nowrap        ← 좁아지는 순간 글자가 접혀 아래로 삐져나옵니다
```

⚠️ `transition-all` + 고정 높이 + 긴 글자는 **글자가 상자 밖으로 나오는** 조합입니다.
폭이 애니메이션되는 100ms 동안 글자가 두 줄이 되는데 높이는 안 늘어나서요.

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

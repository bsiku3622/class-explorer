# Component Guide

> [← Frontend Guide](CLAUDE.md) | 상세: [Atoms](component-guide-atoms.md) | [Molecules & Organisms](component-guide-organisms.md)

## Atoms (`src/components/atoms/`)
| 컴포넌트 | Props 요약 | 역할 |
|----------|-----------|------|
| `RetroButton` | `variant`, `color`, `size`, `isSelected`, `icon`, `onClick` | 물리 피드백 버튼. `color`(hex)를 주면 **고른 것만 그 색으로 꽉 차고 나머지는 흰색** — 값이 런타임에 정해지는 버튼용(끼니·학과)입니다 |
| `RetroCard` | `shadow` (none/sm/md/lg), `className` + div 속성 | 테두리+쉐도우 컨테이너. `none`은 바깥에서 그림자를 걸 때 (탭처럼 카드와 붙는 요소가 있는 경우). `onMouseEnter` 같은 div 속성은 그대로 넘어갑니다 |
| `RetroStatItem` | `label`, `value`, `unit`, `size` (sm/lg) | 숫자 통계 아이템 |
| `RetroSubTitle` | `title`, `icon` | 섹션 소제목 (표준 스타일 고정) |
| `StudentBadge` | `studentId`, `studentName`, `size`, `onClick` | 학번색 뱃지 |
| `CopyButton` | `text`, `label`, `title` | 클립보드 복사 + 1.5초간 "복사됨" 표시. https가 아닌 환경은 execCommand로 폴백 |
| `RetroSpinner` | `size` (sm/md/lg), `label` | 도는 원 (paper-ui `Spinner` 이식). **HeroUI `<Spinner />` 를 쓰지 마세요** — 그 클래스는 `node_modules` 안에 있어 Tailwind v4 가 유틸리티를 만들지 않습니다 (회전 없이 4px 세로선으로 보입니다) |
| `MarqueeText` | `children`, `className` | 한 줄이 자리에 안 들어갈 때 **`…` 로 자르는 대신 좌우로 훑고 돌아옵니다.** 잘린 문장은 뒷말을 영영 못 읽습니다 — 배너처럼 문장 전체가 곧 내용인 자리에 씁니다. **넘칠 때만** 움직이고(`ResizeObserver` 로 다시 잼), `prefers-reduced-motion` 이면 안 움직입니다. 속도는 거리와 무관하게 일정 |
| `SearchInput` | `value`, `onChange`, `placeholder`, `size` (lg/sm), `autoFocus`, `className` | 검색 입력 필드. `sm`은 모달·패널 안에서 — 주인공이 아닌 자리에 `lg`를 두면 검색창이 화면을 다 차지합니다 |
| `StudentCard` | `stuId`, `name`, `subjects`, `onClick` | 학생 프로필 카드 (툴팁용) |
| `TeacherCard` | `name`, `subjects`, `onClick` | 교사 프로필 카드 (툴팁용) |

## Molecules (`src/components/molecules/`)
| 컴포넌트 | Props 요약 | 역할 |
|----------|-----------|------|
| `PageHeader` | `tag`, `title`, `subtitle`, `icon`, `action`, `children` | 페이지 상단 헤더 블록 |
| `AccordionSection` | `title`, `icon`, `isOpen`, `onToggle`, `children` | 토글 가능한 패널 |
| `BarChartRow` | `label`, `value`, `maxValue`, `caption`, `layout`, `onLabelClick` | 바 차트 행 |

## Organisms (`src/components/`)
| 컴포넌트 | 역할 |
|----------|------|
| `Navigation` | 상단 고정 바 (`onLogoClick`, `onLogout`, `isAdmin`, `username`, `terms`, `currentTerm`, `onTermChange`). **좁은 화면에는 로고와 학기 선택 둘만** 둡니다 — 계정 이름·로그아웃까지 넣었더니 390px 에서 서로를 밀어내 잘렸습니다. 로그아웃은 `BottomNav` 의 More 안으로 갔습니다 |
| `TermSwitcher` | 학기 선택 드롭다운 (`terms`, `current`, `onChange`). Navigation 전용 — 다크 배경 기준 스타일, 학기 1개면 미렌더. 바깥 클릭·Esc로 닫힘 |
| `SectionsTimetable` | 한 과목의 **모든 분반**을 한 그리드에 겹쳐 표시 (`sections`, `currentSectionId`, `busySlots`). 칸에 분반 번호만 넣고, 호버하면 그리드 아래 바에 상세(교사·강의실·시간·인원·상태)를 띄웁니다. 내 분반 `retro-accent1` 진하게 / 이동 가능 연하게 / 충돌 회색 |
| `CourseGraph` | 교육과정 선수관계 그래프. 학과 하나 또는 `ALL_DEPARTMENTS`(전체 — 학과를 가로 레인으로). 이수 상태를 넘기지 않으면 구조만 그립니다. 과목을 누르면 그 과목과 직접 이어진 것만 남고 나머지는 흐려집니다 |
| `GoogleLoginButton` | 학교 구글 계정 확인 버튼 (`onCredential`, `onError`). **로그인이 아니라 학번 확인용** — `GoogleLinkModal`에서만 씁니다. 생김새는 인풋과 같게 우리가 그리고, 구글이 그린 버튼을 투명하게 그 위에 겹쳐 둡니다 (눌리는 건 구글 것). `VITE_GOOGLE_CLIENT_ID`가 없으면 아무것도 그리지 않습니다 |
| `CalendarGrid` | 월 달력 격자(항상 6주). **그날 시작하는** 일정만 칩으로 쌓고, 걸쳐 있는 건 `⋯ N` 으로 접습니다 — 장기 일정이 달력을 도배하지 않게 |
| `EventFormModal` | 일정 입력 창. `purpose`(personal/shared/request)에 따라 칸이 달라집니다. 시간은 종일·시각·교시 중 선택 |
| `RequestSidebar` | 접었다 펴는 제안 서랍. 매니저면 허용·거절, 아니면 내가 낸 제안 상태만. 빨간 배지는 매니저에게만 |
| `GoogleLinkModal` | 학번을 확인하라고 요구하는 창. **닫을 수 없고** 로그아웃만 가능합니다 |
| `FriendsManager` | 친구 등록·삭제 + "지금 공강". **Browse 의 Friends 탭**에 있습니다. 검색창 하나가 등록한 사람을 거르고, 거기 없으면 전교생에서 찾아 "추가"를 내밉니다 (두 글자부터·8명까지). 등록은 단방향 |
| `home/TodayCardV1` | 홈 배치 **V1** — 세로로 긴 카드. **개발 전용**(프로덕션 번들에 안 들어갑니다). 머리(날짜·시계) + `DayRuler` + `TodayTimeline` 전체. 하루가 다 보이는 대신 깁니다 |
| `home/TodayCardV2` | 홈 배치 **V2 — 배포본**. 낮고 가로로 긴 카드. 왼쪽 1/3 에 지금 상태 + 오늘 학사일정, 가운데에 **지금을 가운데 둔 스크롤 목록**(공강도 한 교시씩), 오른쪽에 급식까지 **한 카드 안**. 너비는 내용이 정하고(18rem/1fr/17rem), 시간표가 없는 날은 그 칸을 아예 없앱니다. 시계는 두지 않습니다 |
| `home/WeekTimetable` | 홈 아래에 붙는 **주간 격자** — 위 카드가 오늘을 말한다면 여기는 **이 학기**입니다. 그래서 `today` 와 달리 **방학·주말에도 그립니다**(서버가 `week` 를 안 비웁니다). 같은 과목·분반·**교실**이 이어지면 행을 걸쳐 **한 덩어리**로 놓고(교실이 바뀌면 사이에 이동이 있어 잇지 않습니다), 교시는 수업이 있는 범위만 처음부터 끝까지 이어 그립니다. **면을 채우는 건 지금 수업 하나뿐**이고 나머지 수업 칸은 `bg-black/[0.05]` — 대신 수업 칸의 **윗선만 `/25`** 로 진하게 둡니다(같은 `/10` 이면 세로로 붙은 다른 수업이 한 덩어리로 읽힙니다). 오늘 요일 머리도 핑크. 좁은 화면에서는 교실을 접습니다 |
| `DayRuler` | 하루(08:40~21:20)를 **h-5 짜리 얇은 띠 하나**로. 교시를 등간격이 아니라 **실제 시각에 비례해서** 놓아 점심·저녁의 구멍이 그대로 보입니다. **칸마다 교시 번호를 답니다** — 번호 없이 막대만 두면 몇 교시인지 알 수 없어 아래 목록과 연결이 끊깁니다. 내 수업은 실선 테두리·공강은 점선이고, **면을 채우는 건 "지금"(핑크) 하나뿐**입니다(지난 수업만 옅은 회색). 점심·저녁은 빗금. **테두리는 칸마다** — 바깥을 하나로 감싸면 교시 사이 쉬는시간이 칸 안쪽 여백처럼 보입니다. 마름모 캐럿이 "지금" 을 짚습니다. **과목마다 색을 달리하지 마세요** — 하루가 색표처럼 보입니다. 테두리 있는 칸으로 그리지 마세요 — 카드 안에 카드가 열한 개 든 꼴이 됩니다 |
| `VacationBar` | 방학을 재는 막대 — 종업부터 개학까지를 한 줄로 놓고 오늘을 캐럿으로 찍습니다. **칠하는 쪽은 남은 방학**이고(지나간 날은 빗금) 색은 계절에서 옵니다(여름 노랑·겨울 하늘). 주 단위 눈금이 없으면 그냥 긴 상자로 읽힙니다. `since` 가 없으면 막대 대신 남은 날짜만 |
| `TodayTimeline` | `DayRuler` 가 그린 하루의 **글로 쓴 판본**. `divide-y divide-black/10` 로만 나누고 **줄에 테두리를 두르지 않습니다**. 면을 가진 건 진행 중인 줄 하나뿐이고, 그 줄은 카드 여백까지 꽉 채워(`-mx-5`) 핑크로 흐릅니다. **빈 시간을 건너뛰지 않습니다** — 수업만 늘어놓으면 2교시 다음이 5교시인 게 안 보입니다 |
| `MealCard` | 급식. 끼니 토글(아침·점심·저녁, **고른 것만 색**) + 날짜 화살표(±31일). `bare` 는 다른 카드 안의 한 칸으로 들어갈 때(테두리 없이), `fill` 은 **한 행에 나란히 놓을 때만** — 아래에 따로 두면서 켜면 행 높이만큼 늘어나 아래가 빈 상자가 됩니다. 메뉴는 카드가 직접 `GET /meal` 로 받습니다 — 홈 응답에 묶으면 학교 API 대기(3~5초) 동안 홈이 통째로 빕니다. 받는 동안 스피너, 없으면 `No Data Found` |
| `Sidebar` | 좌측 고정 메뉴 (데스크톱). **System Status 는 맨 아래에 붙어 있고 메뉴만 스크롤합니다** — 메뉴가 길어져 상태 카드가 밀려나면 "서버가 살아 있나" 를 보려고 스크롤해야 하니 표시등의 의미가 없어집니다. Admin 아래에는 줄을 긋지 않습니다(바로 밑 상태 카드 테두리와 겹쳐 두 줄로 읽힙니다) |
| `BottomNav` | 하단 고정 메뉴 (모바일). **버튼 다섯 개 — 자주 여는 넷 + 나머지를 여는 햄버거.** 여덟 개를 폭에 욱여넣으면 글자가 4px 이 되고 손가락이 옆 버튼을 누릅니다. 펼친 판은 **햄버거 바로 위 오른쪽 구석**(`w-52`)에 박힙니다. 로그아웃은 판 우상단의 작은 정사각형이고 **두 번 눌러야** 실행됩니다 — 확인은 왼쪽에 나타나고 방금 누른 자리는 취소가 됩니다 |
| `FilterSection` | 학년 선택 필터 + 새로고침 |
| `SearchResultDisplay` | 검색 결과 표시 (통합/그리드 뷰) |
| `SectionCard` | 개별 분반 카드 (학생 배지, 교사, 강의실, 시간) |
| `SubjectAccordionItem` | 과목 아코디언 (분반 목록 토글) |
| `StatsCards` | 3열 통계 카드 (과목수, 분반수, 학생수) |
| `TimetableGrid` | 요일×교시 시간표 그리드. `colorFor(time)`로 칸마다 다른 색 지정 가능 (미지정 시 `color`). `highlightSubject`를 주면 그 과목 칸에 **마우스를 올렸을 때와 같은 테두리**를 켜고 나머지를 흐리게 합니다 — 배경색을 덧칠하지 않는 이유는 칸 색이 이미 상태를 뜻하고 있어서입니다 |
| `EntityCard` | 검색된 엔티티 카드 (학생/교사/강의실) |

## Pages (`src/pages/`)
| 페이지 | 경로 | 역할 |
|--------|------|------|
| `LoginPage` | (전체 앱 대체) | 로그인 폼, `onLogin(token)` 콜백 |
| `AdminPage` | `/admin` | 사용자/세션/데이터 관리 (admin 전용) |
| `HomePage` | `/` | 홈 — **껍데기**(fetch·시계·DEV 스위치)이고 화면은 `home/TodayCardV2`(배포본)가 그립니다. V1 은 개발에서만 되돌아볼 수 있습니다 |
| `SearchPage` | `/search` | 통합 검색 + 결과 표시 |
| `RoomsPage` | `/emptyroomfinder` | 형설관 빈 교실 탐색 |
| `AnalysisPage` | `/analysis` | 학사 데이터 통계 대시보드 |
| `BrowsePage` | `/browse` | 학생·교사 목록 + 교육과정 그래프 + 친구 관리 (Students / Teachers / Courses / Friends 토글) |
| `TradePage` | `/trade` | 수강 변경 탐색 (2026-2 한정, features 플래그). 드랍한 과목은 시간표에서 빠지고, 추천 목록은 이미 들었거나 선수를 안 채운 과목을 걸러 냅니다 |
| `ZamongPage` | `/zamong` | 자몽 — 학교 Zamong 워크북을 옮긴 화면. 로드맵 탭 + 학과별 카드 보드 (학번 등록 필요) |
| `zamong/Roadmap` | — | 워크북 `Zamong` 시트 — **화면 맨 위 고정**. 숫자 격자 두 개 + 1~8학기·계절·EC 목록. 과목을 끌어 학기 이동 |
| `zamong/CourseBoard` | — | 학과 시트 — 선수 깊이 순 카드 배치. 좁은 화면에서는 사다리를 접고 단 순서대로 |
| `zamong/CourseCard` | — | 과목 카드 — 학기·평어를 바로 고릅니다 (체크박스 없음) |
| `CalendarPage` | `/calendar` | 학사일정 달력 — 월 격자 + 날짜 상세 + 개인 일정(반복 가능) + 제안 서랍 |
| `SettingsPage` | `/about` | 기능 가이드북 + About |
| `InventoryPage` | `/inventory` | **개발 전용** (`import.meta.env.DEV`) — 이 앱이 실제로 그리는 버튼·인풋·카드·색의 표본집. funky-ui 토큰 재설계용 작업대라 메뉴에 올리지 않습니다. 표본마다 원본 `파일:줄` 이 붙어 있습니다. 이관이 끝나면 삭제합니다 |

## 상세 가이드
- [component-guide-atoms.md](component-guide-atoms.md) — Atoms props 상세 + 사용 예시
- [component-guide-organisms.md](component-guide-organisms.md) — Molecules/Organisms 상세

## 디자인 규칙
모든 컴포넌트는 [design-guide.md](design-guide.md)의 규칙을 따릅니다.
- `RetroButton`의 `isSelected`로 선택 상태 처리 (직접 className 조작 금지)
- `RetroSubTitle`로 소제목 표준 스타일 강제 유지
- `StudentBadge`로 학번색 자동 매핑 (색상 직접 하드코딩 금지)

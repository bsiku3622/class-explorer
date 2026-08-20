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
| `GoogleLoginButton` | 학교 구글 계정 확인 버튼 (`onStart`, `disabled`). **로그인이 아니라 학번 확인용** — `GoogleLinkModal`에서만 씁니다. **그냥 버튼입니다** — 누르면 `startGoogleLogin()`이 구글로 페이지를 넘기고, 돌아오는 건 모달이 받습니다. ⚠️ 예전처럼 **구글이 그린 버튼(GSI)을 투명하게 겹쳐 두지 마세요** — 그 버튼은 구글 iframe 안에서 팝업을 여는데 iOS Safari·인앱 브라우저가 그걸 막아서 모바일에서 눌러도 아무 일도 안 일어났습니다 |
| `CalendarGrid` | 월 달력 격자(항상 6주). **그날 시작하는** 일정만 칩으로 쌓고, 걸쳐 있는 건 `⋯ N` 으로 접습니다 — 장기 일정이 달력을 도배하지 않게 |
| `EventFormModal` | 일정 입력 창. `purpose`(personal/shared/request)에 따라 칸이 달라집니다. 시간은 종일·시각·교시 중 선택 |
| `RequestSidebar` | 접었다 펴는 제안 서랍. 매니저면 허용·거절, 아니면 내가 낸 제안 상태만. 빨간 배지는 매니저에게만 |
| `GoogleLinkModal` | 학번을 확인하라고 요구하는 창. **닫을 수 없고** 로그아웃만 가능합니다 |
| `DeviceSessions` | 로그인해 둔 기기 목록 + 폐기. **`/about` 에 있습니다.** 다중 기기 로그인(계정당 5대)을 열면서 같이 생긴 화면이라, 밀려난 기기가 왜 튕겼는지 볼 수 있는 유일한 자리입니다. ⚠️ **"이 기기"(`current`) 표시가 안전장치입니다** — 그 줄에는 끊기 버튼을 아예 안 답니다(누르면 그 자리에서 로그인 화면으로 튕깁니다). 끊기는 **두 번 눌러야** 실행되고 상자를 미리 고정합니다(`h-7` + `transition-colors`). 시각은 상대(`8분 전`)로 — 절대 시각이면 어느 게 오래된 건지 빼기를 해야 압니다. ⚠️ 서버가 UTC 를 시간대 없이 주므로 `Z` 를 붙여 파싱합니다. `device_label` 이 `null` 인 옛 세션은 `웹`/`모바일` 로 대신 표시 |
| `FriendsManager` | 친구 등록·삭제 + "지금 공강". **Browse 의 Friends 탭**에 있습니다. 검색창 하나가 등록한 사람을 거르고, 거기 없으면 전교생에서 찾아 "추가"를 내밉니다 (두 글자부터·8명까지). 등록은 단방향 |
| `home/TodayCardV1` | 홈 배치 **V1** — 세로로 긴 카드. **개발 전용**(프로덕션 번들에 안 들어갑니다). 머리(날짜·시계) + `DayRuler` + `TodayTimeline` 전체. 하루가 다 보이는 대신 깁니다 |
| `home/TodayCardV3` | 홈 배치 **V3 — 배포본**. **머리 한 줄**(지금 \| 오늘 일정 \| 급식) + **본문 두 칸**(주간 격자 \| 오늘). `WeekTimetable` 을 **자기가 그립니다** — 오늘과 나란히 놓아야 해서 `HomePage` 아래에 따로 붙이면 어긋납니다. DOM 은 오늘이 먼저고 `xl:order-2` 로 넓을 때만 자리를 바꿉니다(좁으면 한 주가 오늘 위로 올라갑니다). 급식은 **머리 줄**입니다 — 아래로 내리면 자·목록 사이에 끼어 흐름이 끊기고, `meal` 이 `null` 이어도 칸을 남겨 "급식 정보가 없습니다" 를 띄웁니다. 히어로는 목록이 못 하는 말만 합니다 — 남은 시간(진행바)·다음 수업·**교실 이동**(`current.room !== next.room`), 그리고 **연강 단위**(`currentPeriods`)로 잡아야 20:20 에 끝난다면서 NEXT 에 같은 과목을 또 거는 일이 없습니다. `planned` 를 켜면 날짜 옆에 `계획 미리보기` 표식이 붙고 `WeekTimetable` 에도 그대로 넘깁니다 — 계획은 아직 등록된 시간표가 아니라서 어느 쪽을 보는지 헷갈리면 엉뚱한 교실로 갑니다 |
| `home/TodayCardV2` | 홈 배치 **V2** — **개발 전용**(프로덕션 번들에 안 들어갑니다). 낮고 가로로 긴 카드. 왼쪽 1/3 에 지금 상태 + 오늘 학사일정, 가운데에 **지금을 가운데 둔 스크롤 목록**(공강도 한 교시씩), 오른쪽에 급식까지 **한 카드 안**. 너비는 내용이 정하고(18rem/1fr/17rem), 시간표가 없는 날은 그 칸을 아예 없앱니다. 시계는 두지 않습니다 |
| `home/WeekTimetable` | 홈 본문 왼쪽의 **주간 격자** — 위 카드가 오늘이라면 여기는 **이 학기**입니다. 그래서 `today` 와 달리 **방학·주말에도 그립니다**. 칩은 **학과색**(테두리 100% + 채움 8%)이고 과목명·분반·교사·교실 세 층입니다. 행 높이는 **칸이 4:3** 이 되는 값(`h-24 md:h-28 xl:h-20`)이고, 점심·저녁 구멍은 **교시 칸에 비례**합니다(70분 점심이 16px 이면 50분 수업보다 짧아 보입니다). 요일 머리는 옅은 회색 바에 **오늘만 핑크**, 그 아래로 **핑크 기둥**이 열 전체를 관통합니다 — ⚠️ `gridRow: "2 / -1"` 은 행이 암시적이라 헤더 한 칸으로 쪼그라듭니다(`2 / span {행 수}`). 연강은 과목·분반·**교실**·**시간 인접** 넷이 다 맞아야 잇습니다. 격자만 제 안에서 스크롤하고(`max-h`), **좁은 화면에서는 `min-w-[35rem]` 으로 가로 스크롤**합니다(`xl:min-w-0`) — 교시 열과 요일 머리는 `sticky` 로 남고, 열 때 **오늘 열을 가운데**로 맞춥니다. ⚠️ 고정된 칸의 배경은 **불투명**이어야 합니다(`#f7f7f7`·`#ffd3ee`) — 반투명이면 칩이 요일 글자를 통과해 보입니다. 머리의 **PNG 버튼**으로 내보냅니다(스크롤 상자가 아니라 **안쪽 격자**를 찍어야 잘린 교시까지 담깁니다). `planned` 면 제목 옆에 `계획` 표식이 붙고 PNG 이름에도 `_계획` 이 들어갑니다 — 찍어 둔 그림에는 홈 위쪽 표식이 안 담깁니다. 제목은 **`Timetable`** 이고, 칩의 **과목명·분반·교사는 검색 링크**입니다(`searchEngine` 의 `subjectQuery`·`sectionQuery`·`teacherQuery`). 머리의 `현재 요일 표시` 체크박스(기본 켜짐)를 끄면 **오늘 열·요일 머리·지금 칩의 핑크가 화면에서 사라지고**, PNG 도 보이는 그대로 찍힙니다 — ⚠️ 내보내기 전용 옵션으로 되돌리지 마세요. 화면에서 확인할 수 없는 설정이 되고, 찍는 순간에만 상태를 바꿨다 되돌리는 곡예가 따라붙습니다 |
| `DayRuler` | 하루를 **가로로 흐르는 자**로. 교시를 등간격이 아니라 **실제 시각에 비례해서** 놓아 점심·저녁의 구멍이 그대로 보입니다. 트랙에 `min-w-[60rem]`(칸이 4:3 이 되는 폭)을 주고 `overflow-x-auto` 로 흘리며, 열 때 **지금을 가운데**로 스크롤합니다. ⚠️ `overflow-x-auto` 만 주면 `overflow-y` 가 auto 로 계산돼 하드 쉐도우 때문에 **세로 스크롤이 생깁니다** — `overflow-y-hidden` + `py-1`. **연강은 한 칸**(`10–11`)이고 칸마다 교시 번호를 답니다. 색은 **학과색**(테두리 100% + 채움 14%)이고 **지남은 회색이 아니라 `opacity: 0.4`** 입니다 — 회색으로 덮으면 뭘 들었는지가 지워집니다. 공강은 점선, **지금만** 핑크(22% 채움 + `#ff4eba` 테두리)입니다. ⚠️ **공강·점심은 강조하지 않습니다** — 검은 캐럿만 짚고 지나갑니다 |
| `VacationBar` | 방학을 재는 막대 — 종업부터 개학까지를 한 줄로 놓고 오늘을 캐럿으로 찍습니다. **칠하는 쪽은 남은 방학**이고(지나간 날은 빗금) 색은 계절에서 옵니다(여름 노랑·겨울 하늘). 주 단위 눈금이 없으면 그냥 긴 상자로 읽힙니다. `since` 가 없으면 막대 대신 남은 날짜만 |
| `home/MySubjects` | 홈 **맨 아래**의 수강 과목 목록. ⚠️ **화면을 새로 만들지 않습니다** — 검색에서 자기 이름을 찾았을 때 나오는 그 아코디언(`SubjectAccordionItem`)을 그대로 씁니다. 이 컴포넌트가 하는 일은 **내가 듣는 분반만 남긴 `SubjectData` 를 만들어 넘기는 것** 하나입니다. 검색과 같은 조건(`searchMode="student"` · `isSingleStudentSearch` · `searchTerm`=내 학번)이라 머리 칩이 `SECTION 5` 로 뜨고 명단에서 내 배지만 살아납니다 — ⚠️ `searchTerm` 을 비우면 `hasStudentInSearch` 가 켜진 채 맞는 사람이 없어 **명단 전체가 회색**이 됩니다. 계획을 보는 중이면 **계획의 과목**이 나옵니다(`week` 를 그대로 받습니다) |
| `TodayTimeline` | `DayRuler` 가 그린 하루의 **글로 쓴 판본**. `divide-y divide-black/10` 로만 나누고 줄에 테두리를 두르지 않습니다. **줄 높이 = 교시 수 × 3.25rem** — 100분 연강은 50분 수업의 두 배고, 공강도 같은 한 칸입니다(같은 시간인데 높이가 다르면 시간을 재는 물건이 아니게 됩니다). 왼쪽에 **학과색 띠**, 과목명도 학과색이며 진행 중이면 면·띠·글자가 모두 핑크로 모입니다. **연강은 자·주간 격자와 같은 조건으로 잇고**(과목·분반·교실·시간 인접) 교시는 `10–11교시` 로 적습니다. **빈 시간을 건너뛰지 않습니다** — 수업만 늘어놓으면 2교시 다음이 5교시인 게 안 보입니다. **공강 줄도 진행 중이면 강조합니다** — 목록에는 자와 달리 캐럿이 없어서, 공강 시간에는 지금이 어디인지 짚어 주는 게 없었습니다. ⚠️ 대신 **수업 줄보다 옅게**(8% vs 12%) 칠해 진행 중인 수업이 더 무겁게 남습니다. **과목명·교사·분반은 검색 링크**입니다(주간 격자의 칩과 같은 규칙) · **글자 하한 12px** |
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
| `AdminPage` | `/admin` | 사용자/세션/데이터 관리 + DB 스냅샷 (admin 전용). 수집은 **학기를 골라서** 돌립니다 — 칩은 DB에 있는 학기, `새 학기` 는 직접 입력(첫 수집용). `Backups` 는 목록만 보여 줍니다(자동 삭제·복원 없음) |
| `HomePage` | `/` | 홈 — **껍데기**(fetch·시계·DEV 스위치)이고 화면은 `home/TodayCardV3`(배포본)가 그립니다. V1·V2 는 개발에서만 되돌아볼 수 있습니다. 수강 정정 기간에 `/trade` 계획이 있으면 **[기존 시간표 \| 트레이드 계획]** 전환이 붙고, 고르면 **화면 전체**가 갈립니다(응답을 갈아 끼웁니다 — `lib/plannedHome.ts`). 고른 쪽은 `ksa_home_view` 로 이 기기에 남아 **다음에도 그대로 열립니다** |
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

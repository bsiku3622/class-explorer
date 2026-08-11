# API Guide

> [← Backend Guide](CLAUDE.md)

## 서버는 하나, 프론트가 둘

`backend.main:app` 하나가 class-explorer 와 ksa-bench 를 모두 받습니다. **API 표면은
같습니다** — 두 프론트의 차이는 어떤 화면을 그리고 무엇을 캐시하느냐에 있습니다.

주로 ksa-bench 가 쓰는 것: `GET /students/search`, `GET /students/{stu_id}`(한 명씩
조회), `GET /me/progress`(본인만), `GET /stats/enrollment`(집계). 자세한 설계 의도는
[bench_router.guide.md](bench_router.guide.md).

홈 (`home_router.py`):

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/home` | 홈이 쓰는 것 — 지금 교시·오늘 시간표(`today`)·**요일별 한 주 시간표(`week`)**·현재/다음 수업·학기/방학·교시 시각표 (급식은 키 유무와 지금 끼니만). ⚠️ `today` 는 방학·휴업에 비지만 `week` 는 그대로 옵니다 |
| `GET` | `/meal?date=` | 하루치 급식. 홈에서 날짜를 앞뒤로 넘길 때. 오늘 기준 **±31일**까지 |

**`today` 는 수업이 없는 날이면 항상 빈 배열입니다.** 학기 데이터(`ClassTime.day`)는
요일 단위라 날짜를 모릅니다 — 그냥 조회하면 방학에도, 추석에도 "월요일 시간표" 가
그대로 나옵니다. 그래서 `session` 이 학사일정으로 한 번 거릅니다.

| `session` 필드 | 뜻 |
|---|---|
| `in_session` | 학기 중인가 (`개학`·`종업` 표지로 판단) |
| `has_class` | **오늘 수업이 있는 날인가.** `false` 면 `today` 는 빈 배열 |
| `off_reason` | `vacation` \| `weekend` \| `holiday` \| `null` |
| `off_label` | `"여름방학"` · `"주말"` · `"추석"` — 화면에 그대로 씁니다 |
| `since` / `resumes_on` / `days_left` | 방학의 시작·끝·남은 날 (막대로 그립니다) |

휴업일은 `CalendarEvent.category='holiday'` 중 **공용 일정만**(`owner_id IS NULL`)
봅니다 — 개인 일정이 남의 수업까지 없애면 안 됩니다.

`today` 의 각 항목에는 **`department`** 가 붙습니다 (`Subject → Course → Department`).
교육과정에 없는 과목(외국인 전형 등 26개)은 `null` 입니다. 지금 홈 화면은 이 값을
그리지 않습니다 — 과목마다 색을 달리해 봤다가 화면이 색표처럼 보여 걷어냈습니다.

**오늘 학사일정(`events`)도 같이 옵니다** — 공용 전부 + 내 개인 일정입니다
(`/calendar` 와 같은 조건). 홈이 "오늘 뭐 있더라" 를 답하는 데 필요하고 하루치라 몇
줄 안 돼서, 화면이 `/calendar` 를 또 부르지 않게 묶었습니다.

**교시 시각표(`periods`)와 시간대(`breaks`)가 응답에 실려 옵니다.** 홈이 하루를 시간
축으로 그려서 열한 교시의 시작·끝 분이 전부 필요하고, 교시 사이의 큰 구멍에 "점심"·
"저녁" 이름을 답니다. 화면이 상수를 따로 들면 `periods.py` 만 고쳤을 때 조용히
어긋납니다 — 열한 줄 + 여섯 줄이라 값도 쌉니다.

급식은 `menu` 에 **끼니별 줄 배열**로 옵니다 (`{"lunch": ["단호박카레라이스&소시지",
…]}`). 원문은 개행이 섞인 한 덩어리 문자열이라 서버가 쪼개서 보냅니다 — 화면마다
파싱 규칙을 다시 쓰면 어긋납니다. 아직 급식이 안 올라온 날은 `menu` 가 `null` 입니다.

`/home` 의 `meal` 에는 **메뉴가 없습니다** — `{date, slot}` 뿐이고, 학교 API 가 3~5초씩
걸려서 홈을 붙잡지 않으려는 것입니다. 메뉴는 `/meal` 로 따로 받습니다. 키가 없으면
`meal` 이 통째로 `null` 이라 화면이 급식 칸을 아예 그리지 않습니다 — `menu` 가 `null` 인
것(그날 급식이 없음)과는 뜻이 다릅니다.

친구·교시 엔드포인트(`friends_router.py`) — 두 프론트 공통:

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/periods` | 교시별 시각표 (화면이 상수를 따로 들지 않도록) |
| `GET` | `/friends` | 내가 등록한 사람들 |
| `POST` | `/friends` | 추가 — **단방향**, 상대의 수락 없음 |
| `DELETE` | `/friends/{stuId}` | 삭제 |
| `GET` | `/friends/busy` | 친구(+본인)의 수업 슬롯. **과목명 없음** |
| `GET` | `/friends/now` | 지금 공강인 친구. "지금"은 **서버 시계** 기준 |

## 인증

모든 보호된 엔드포인트는 `Authorization: Bearer <session_token>` 헤더가 필요합니다.

---

## 인증 엔드포인트

### `POST /auth/login`
로그인 → session_token 발급 (기존 세션 즉시 만료)

**Request Body**:
```json
{
  "username": "admin",
  "password": "password123",
  "device_type": "web"
}
```
`device_type`: `"web"` | `"mobile"` (기본값 `"web"`)

**Response**:
```json
{
  "session_token": "<token>",
  "token_type": "bearer"
}
```

1계정 1세션. 새로 로그인하면 기존 기기 세션 즉시 만료.

---

### `POST /auth/logout`
현재 세션 삭제

**Headers**: `Authorization: Bearer <session_token>`

---

### `POST /auth/link-google` *(인증 필요)*
계정에 학교 구글 계정을 붙여 **학번을 확정합니다.** 프론트가 Google Identity Services에서
받은 ID 토큰을 그대로 넘깁니다.

**구글은 로그인이 아니라 학번 확인에만 씁니다.** 로그인은 `/auth/login` 하나뿐이고, 계정은
관리자가 만들어 줍니다 — 아는 사람만 쓰는 서비스라 스스로 만드는 길을 두지 않았습니다.
프론트는 `email`이 비어 있는 계정에 이 창을 강제로 띄우고, 확인 전에는 앱을 쓸 수 없게 막습니다.

```json
{ "credential": "<google id token>" }
```

이메일이 곧 학번이라(`25-059@ksa.hs.kr`) 학번을 따로 받지 않습니다.

| 응답 | 경우 |
|------|------|
| `200` | `{ "email": ..., "stu_id": ..., "student_name": ... }` |
| `401` | 토큰이 우리 앱 것이 아니거나 만료됨 / 이메일 미인증 |
| `403` | `@ksa.hs.kr` 학번 계정이 아님 (교사 계정 포함) / 명단에 없는 학번 |
| `409` | 다른 계정이 쓰는 구글 계정 / 이 계정에 이미 다른 학번이 등록됨 |
| `503` | 서버에 `GOOGLE_CLIENT_ID`가 없음 |

서버는 구글의 `tokeninfo`로 토큰을 확인하고 `aud`(우리 앱인지)와 이메일 인증 여부를
직접 검사합니다. 이미 학번이 정해진 계정이면 구글 계정의 학번과 같아야 합니다 — 다르면
남의 계정에 붙이려는 것이므로 막습니다.

학번을 **다른 학번으로 바꾸면 기존 이수 기록을 지웁니다** — 이전 사람의 성적이 남아
있으면 안 됩니다.

---

### `GET /auth/me`
현재 로그인된 사용자 정보

**Headers**: `Authorization: Bearer <session_token>`

**Response**:
```json
{
  "id": 1, "username": "admin", "is_admin": true,
  "stu_id": "25-059", "student_name": "백재원",
  "email": "25-059@ksa.hs.kr"
}
```

`email`이 `null`이면 학교 구글 계정과 아직 이어지지 않은 옛 계정입니다. 프론트가
연결 창을 강제로 띄우므로 이 상태로는 앱을 쓸 수 없습니다. 구글로 들어오면 `stu_id`도
함께 정해집니다.

---

### `GET /auth/sessions`
현재 사용자의 활성 세션 목록 (항상 최대 1개)

**Headers**: `Authorization: Bearer <session_token>`

**Response**:
```json
[
  {
    "id": 1,
    "device_type": "web",
    "created_at": "2026-03-17T00:00:00",
    "last_used_at": "2026-03-17T01:00:00",
    "expires_at": "2026-04-16T00:00:00"
  }
]
```

---

### `DELETE /auth/sessions/{session_id}`
특정 세션 강제 종료

**Headers**: `Authorization: Bearer <session_token>`

---

## 데이터 엔드포인트

### `GET /terms` *(인증 필요)*
데이터가 존재하는 학기 목록 (최신순)

**Response**:
```json
{ "terms": [{ "year": 2026, "semester": 2 }, { "year": 2026, "semester": 1 }] }
```

---

### `GET /` *(인증 필요)*
지정 학기의 수업 데이터, 학년별 학생 수, 통계를 한 번에 반환합니다.

**Headers**: `Authorization: Bearer <session_token>`

**Query Parameters**:
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `year` | int (2000~2100) | 학년도. 생략 시 데이터가 있는 최신 학기 |
| `semester` | int (1\|2) | 학기. 생략 시 데이터가 있는 최신 학기 |

> `year`와 `semester`가 **둘 다** 주어졌을 때만 해당 학기를 조회합니다. 하나만 주면 최신 학기로 폴백합니다.

**Response**:
```json
{
  "term": { "year": 2026, "semester": 2 },
  "available_terms": [
    { "year": 2026, "semester": 2 },
    { "year": 2026, "semester": 1 }
  ],
  "stats": {
    "total_subjects": 80,
    "total_sections": 240,
    "total_active_students": 350
  },
  "student_counts": {
    "23": 85,
    "24": 90,
    "25": 92,
    "26": 88
  },
  "data": [
    {
      "subject": "미적분학2",
      "subject_id": 12,
      "subject_english": "Calculus2",
      "is_ec": false,
      "subject_student_count": 45,
      "section_count": 3,
      "credits": 3.0,
      "is_pf": false,
      "department": "수학",
      "category": "natural",
      "sections": [
        {
          "id": 1,
          "section": "제1분반",
          "teacher": "홍길동",
          "room": "형설202",
          "students": [
            { "stuId": "25-001", "name": "김철수" }
          ],
          "student_count": 15,
          "times": [
            { "day": "MON", "period": 2, "room": "형설202" }
          ]
        }
      ]
    }
  ]
}
```

**정렬 규칙**:
- `data`: 과목명 알파벳순
- 각 `sections`: 분반 번호 오름차순
- 각 `students`: 학번(stuId) 오름차순
- 각 `times`: 요일(MON→FRI), 교시 오름차순

`student_counts`는 **해당 학기에 수강 이력이 있는 학생** 기준입니다 (전체 재적생이 아님).

## 교육과정 엔드포인트

수업(`Class`)이 특정 학기에 열린 분반이라면, 교육과정(`Course`)은 학교가 개설할 수 있는
과목의 정의입니다. 학기와 무관하므로 프론트에서 오래 캐시해도 됩니다.

### `GET /curriculum` *(인증 필요)*
카탈로그 전체와 선수관계 그래프. 응답 약 70KB.

**Response**:
```json
{
  "courses": [
    {
      "name": "미적분학2(EC)", "english_name": "Calculus2",
      "department": "수학", "category": "natural",
      "credits": 4.0, "ap_credits": 0.0,
      "is_ec": true, "is_pf": false,
      "recommended_semester": "5",
      "description": "..."
    }
  ],
  "prerequisites": [
    { "before": "미적분학1", "after": "미적분학2(EC)", "alternative": false }
  ],
  "subject_map": { "미적분학2(EC)(Calculus2(EC))": "미적분학2(EC)" },
  "requirements": { "natural": 67.0, "humanities": 52.0, "convergence": 8.0, "ec": 10.0 },
  "grade_points": { "A+": 4.3, "A0": 4.0, "A-": 3.7, "B+": 3.3, "...": 0.0 }
}
```

`category`는 `natural` | `humanities` | `convergence`.
`alternative: true`는 같은 `after`를 향한 다른 항목과 **택일** 관계라는 뜻입니다 —
예술속의물리는 물리학및실험2 *또는* 일반물리학2면 되지만, 법과학은 화학및실험과
생물학및실험을 **모두** 들어야 합니다.

`subject_map`은 화면에 보이는 개설 과목명을 교육과정 과목으로 옮기는 표입니다.
프론트가 이미 들고 있는 수강 데이터를 교육과정에 붙일 때 씁니다. 영어강의는 이름 뒤에
`(EC)`가 붙어 한국어강의와 구분됩니다 — 둘은 따로 개설되는 별개 과목이지만 학점과
선수관계는 같은 교육과정 과목을 가리킵니다.

`departments`는 학과 목록을 화면 표시 순서대로 돌려줍니다.

---

### `GET /curriculum/progress/{stuId}` *(인증 필요)*
한 학생이 **모든 학기에 걸쳐** 수강한 과목. `GET /`는 학기 하나만 주므로 누적 이수
현황은 여기서 조회합니다.

**Response**:
```json
{
  "stu_id": "25-059",
  "terms": [
    {
      "year": 2026, "semester": 1,
      "courses": [
        { "subject": "미적분학1(Calculus1)", "course": "미적분학1" },
        { "subject": "한국정치사(조선붕당정치)(...)", "course": null }
      ]
    }
  ]
}
```

`course`가 `null`이면 교육과정에 연결되지 않은 과목입니다 (학점 집계에서 빠짐).
수집 대상이 아닌 학기(2026-1 이전)는 데이터 자체가 없습니다.

---

### `GET /curriculum/courses/{name}` *(인증 필요)*
과목 하나의 상세 — 책자에서 가져온 설명 본문(`description_sections`)까지 포함합니다.
`prerequisites`(선수 목록)와 `unlocks`(이 과목이 여는 과목)를 함께 돌려줍니다.
없는 이름이면 `404`.

---

### `GET·PUT /curriculum/grades` *(인증 필요)*
성적은 **교육과정 과목(`Course`) 단위**입니다 — 같은 과목을 영어강의로 들었든
한국어강의로 들었든 이수는 하나입니다. 그래서 `미적분학2(EC)`는 받지 않고
`미적분학2`로 기록합니다.

**로그인한 계정 본인의** 이수 내역과 평어. 누구의 기록인지는 `User.stu_id`가 정하므로
학번을 따로 받지 않습니다. 학번이 등록되지 않은 계정은 `409`.

행이 있으면 이수한 것으로 봅니다. `grade`는 선택이라 평어 없이 이수 체크만 할 수도
있습니다. 수집된 학기(`/curriculum/progress`)와는 별개로, 그 이전 학기를 채우는 용도입니다.

```json
{ "entries": [ { "course": "미적분학1", "grade": "A+" },
               { "course": "수학1", "grade": null } ] }
```

`PUT`은 **전체 교체**입니다. 항목이 145개를 넘지 않아 부분 갱신보다 단순하고, 여러
기기에서 편집해도 마지막 저장이 이깁니다. 교육과정에 없는 과목이나 알 수 없는 평어는
`400`. 같은 과목이 두 번 오면 뒤엣것을 씁니다.

---

## 계정 상태 엔드포인트

작업 중인 계획을 기기(localStorage)가 아니라 계정에 붙여 둡니다. 서버는 `data` 내용을
해석하지 않습니다 — 화면마다 구조가 다르고 자주 바뀌기 때문입니다.

### `POST /curriculum/import-workbook` *(인증 필요, multipart)*
사람이 채운 Zamong 워크북(`.xlsx`, 최대 8MB)을 올리면 **본인 기록을 통째로 교체**합니다.
응답은 `{imported, graded, ec, sheets, unknown_courses, unknown_terms, unknown_grades}`.
xlsx 가 아니거나 채워진 과목이 없으면 `400`, 너무 크면 `413`.

### `GET·PUT·DELETE /state/{key}` *(인증 필요)*
`key`는 `plan` | `trade` | `zamong`만 허용하며, 그 외에는 `404`. 저장 크기 상한은 256KB(`413`).

`zamong`은 자몽이 쓰는 값입니다 — 손으로 적는 비교과 시수(`self_dev`/`collab`/`global`)와,
밑칠을 이미 물어봤는지(`seeded`). 어디서도 자동으로 알 수 없는 값이라 서버가 검증하지 않습니다.

```json
// PUT 요청
{ "data": { "stuId": "25-059", "actions": { "체육4(...)": "drop" } } }

// GET 응답 — 저장된 적 없으면 data가 null
{ "key": "trade", "data": { "...": "..." }, "updated_at": "2026-07-30T01:20:00" }
```

---

## 프론트엔드 연동
Vite 개발 서버에서 `/api/*` → `http://localhost:8000`으로 프록시합니다.
(rewrite: `/api/auth/login` → `POST /auth/login`)

**항상 `src/lib/api.ts`의 axios 인스턴스 사용** (`axios` 직접 import 금지):

```ts
import api from './lib/api'

// 로그인
const res = await api.post('/auth/login', { username, password })
const { session_token } = res.data

// 데이터 fetch
const data = await api.get('/', {
  headers: { Authorization: `Bearer ${session_token}` }
})
```

## 보안 제약
- `/auth/login`: IP당 60초 10회 초과 시 `429 Too Many Requests`
- 모든 요청: username `max_length=64`, password `max_length=128`

## 캐싱
- 프론트엔드 localStorage에 1시간 캐싱 — 키는 학기별로 분리 (`ksa_class_finder_cache_{year}_{semester}`)
- 선택 학기는 `ksa_selected_term`에 보존 (새로고침 시 유지)
- 강제 갱신: `fetchInitialData(true)`

---

## 학사일정 엔드포인트 (`/calendar/*`)

일정은 두 갈래입니다 — **공용**(모두에게 보임, 매니저만 수정)과 **개인**(본인만).
일반 계정이 공용 일정을 넣고 싶으면 제안하고, 매니저가 허용하면 그때 만들어집니다.

### `GET /calendar?start=&end=` *(인증 필요)*
기간에 걸치는 일정 — 공용 전부 + **내** 개인 일정. 남의 개인 일정은 절대 나오지 않습니다.

```json
{ "events": [{
  "id": 12, "title": "중간고사(~4.17)",
  "start_date": "2026-04-14", "end_date": "2026-04-17",
  "time_mode": "allday", "start_minute": null, "end_minute": null,
  "start_period": null, "end_period": null,
  "category": "exam", "target_grades": [], "source": "pdf",
  "is_personal": false, "series_id": null, "note": null
}] }
```

`category`: `holiday` · `dorm` · `exam` · `term` · `academic` · `event`
`time_mode`: `allday` · `clock`(`start_minute`, 자정 기준 분) · `period`(`start_period`, 1~11교시)

---

### `POST /calendar/personal` *(인증 필요)* / `POST /calendar/events` *(매니저)*
내 일정 / 공용 일정을 만듭니다. 본문은 같습니다.

```json
{ "title": "R&E 미팅", "start_date": "2026-04-14", "end_date": null,
  "time_mode": "period", "start_period": 7, "end_period": 8,
  "category": "event", "target_grades": [1], "note": null,
  "repeat": "weekly", "repeat_until": "2026-05-12" }
```

`repeat`: `none` · `daily` · `weekly` · `monthly`. 반복은 **회차마다 한 행**으로 저장되고
같은 `series_id` 로 묶입니다 (한 번에 최대 200 회차).

| 응답 | 경우 |
|------|------|
| `201` | `{ "created": 5, "events": [...] }` |
| `403` | 공용 일정인데 매니저가 아님 |
| `422` | 끝이 시작보다 앞섬 / 시각·교시를 골랐는데 값이 없음 / 반복인데 끝날짜 없음 |

---

### `PUT /calendar/events/{id}` · `DELETE /calendar/events/{id}?series=` *(인증 필요)*
한 회차를 고치거나 지웁니다. `series=true` 면 같은 반복 묶음을 통째로 지웁니다.

| 응답 | 경우 |
|------|------|
| `200` | 성공 |
| `403` | 공용 일정인데 매니저가 아님 |
| `404` | 없는 일정 **또는 남의 개인 일정** (있다는 사실을 숨깁니다) |

---

### `POST /calendar/requests` · `GET /calendar/requests` *(인증 필요)*
공용 일정 제안. 조회는 매니저면 **처리 대기 전부**, 아니면 **내가 낸 것**만 나옵니다.
`repeat` 은 받지 않습니다 — 반복 여부는 매니저가 정합니다.

### `POST /calendar/requests/{id}/decide` *(매니저)*
```json
{ "approve": true, "reason": null }
```
허용하면 그 자리에서 공용 일정이 만들어지고 `event_id` 로 이어집니다.
`409` 는 이미 처리된 제안입니다.

### `GET /calendar/requests/pending-count` *(인증 필요)*
사이드바 빨간 표시용. 매니저가 아니면 항상 `0` 입니다.

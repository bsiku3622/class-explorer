# API Guide

> [← Backend Guide](CLAUDE.md)

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

### `GET /auth/me`
현재 로그인된 사용자 정보

**Headers**: `Authorization: Bearer <session_token>`

**Response**:
```json
{ "id": 1, "username": "admin", "is_admin": true }
```

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
      "subject": "수학(Math I)",
      "subject_student_count": 45,
      "section_count": 3,
      "aliases": ["수학", "Math"],
      "credits": 3.0,
      "is_ec": false,
      "is_pf": false,
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
  "requirements": { "natural": 67.0, "humanities": 52.0, "convergence": 8.0, "ec": 10.0 }
}
```

`category`는 `natural` | `humanities` | `convergence`.
`alternative: true`는 같은 `after`를 향한 다른 항목과 **택일** 관계라는 뜻입니다 —
예술속의물리는 물리학및실험2 *또는* 일반물리학2면 되지만, 법과학은 화학및실험과
생물학및실험을 **모두** 들어야 합니다.

`subject_map`은 KEIS 과목명(`Class.subject`)을 카탈로그 이름으로 옮기는 표입니다.
프론트가 이미 들고 있는 수강 데이터를 교육과정에 붙일 때 씁니다.

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

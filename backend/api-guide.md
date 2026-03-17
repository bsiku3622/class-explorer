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

### `GET /` *(인증 필요)*
전체 수업 데이터, 학년별 학생 수, 통계를 한 번에 반환합니다.

**Headers**: `Authorization: Bearer <session_token>`

**Response**:
```json
{
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
- 프론트엔드 localStorage에 1시간 캐싱
- 강제 갱신: `fetchInitialData(true)`

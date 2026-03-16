# API Guide

> [← Backend Guide](guide.md)

## 엔드포인트

### `GET /`
전체 수업 데이터, 학년별 학생 수, 통계를 한 번에 반환합니다.

**Request**: 없음 (파라미터 없음)

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

```ts
// vite.config.ts
proxy: { '/api': 'http://localhost:8000' }
```

프론트엔드 호출 코드 (`App.tsx`):
```ts
const response = await axios.get('/api/')
```

## 캐싱
- 프론트엔드 localStorage에 1시간 캐싱
- 강제 갱신: `fetchInitialData(true)`

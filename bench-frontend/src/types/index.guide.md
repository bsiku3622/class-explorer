# types/index.ts Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
프론트엔드 전체에서 사용하는 TypeScript 인터페이스 정의.

## 인터페이스 목록

### `StudentInfo`
```ts
{ stuId: string; name: string; }
```
학생 기본 정보. `stuId` 형식: `"25-001"`.

### `SectionTime`
```ts
{ day: string; period: number; room: string;
  subject?: string; section?: string; teacher?: string; }
```
분반의 특정 교시 정보. `day`: `"MON"~"FRI"`, `period`: `1~11`.
optional 필드는 검색 엔진에서 EntityCard 시간표 구성 시 채워짐.

### `Section`
```ts
{ id: number; section: string; teacher: string; room: string;
  students: StudentInfo[]; student_count: number; times: SectionTime[]; }
```
개별 분반 (예: "제1분반"). API 응답의 기본 단위.

### `SubjectData`
```ts
{ subject: string; subject_student_count: number;
  section_count: number; sections: Section[]; }
```
과목 단위 묶음. `allClassesData` 배열의 요소.

### `Stats`
```ts
{ total_subjects: number; total_sections: number; total_active_students: number; }
```
검색 없을 때 전체 통계 (StatsCards에서 사용).

### `SearchEntity`
```ts
{ type: "student" | "teacher" | "room"; name: string; id: string;
  subject_count: number; subjects: string[]; times: SectionTime[]; }
```
검색 결과로 추출된 엔티티. `subjects`는 포맷팅된 문자열 배열.

### `SearchResultStats`
```ts
{ keyword: string; prefix: string; entities: SearchEntity[];
  total_subjects: number; total_sections: number;
  total_matched_students: number; warning?: string; }
```
검색 결과 메타 정보. `App.tsx`의 `searchResult` 상태 타입.

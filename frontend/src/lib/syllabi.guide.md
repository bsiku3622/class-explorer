# Syllabi Guide

## 역할

`src/assets/syllabi/`의 PDF·DOCX 파일을 Vite asset URL로 불러오고, 2026-1 개설 과목과 명시적 규칙으로 연결합니다.

## 동작

- 2026-1이 아닌 학기에서는 빈 배열을 반환합니다.
- 과목의 `subject`, `subject_english`, `is_ec`를 함께 정규화해 EC·비EC 과목을 구분합니다.
- 원본 PDF는 같은 파일을 preview와 download에 사용합니다.
- 원본 DOCX는 download에 사용하고, 같은 폴더의 `.preview.pdf` 파일을 preview에 사용합니다.
- ZIP에 중복으로 들어 있던 법과학 문서는 표시 제목 기준으로 한 번만 노출합니다.
- 규칙이 없는 과목은 빈 배열을 반환해 UI 자체를 숨깁니다.

## 파일 추가

1. 원본을 `src/assets/syllabi/<교과 영역>/`에 둡니다.
2. DOCX라면 같은 경로에 `<원본명>.preview.pdf`를 생성합니다.
3. `SYLLABUS_RULES`에 과목명과 파일 경로를 정규화한 고유 substring을 추가합니다.

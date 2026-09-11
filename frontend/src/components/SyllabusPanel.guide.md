# SyllabusPanel Guide

## 역할

과목 아코디언 안에서 연결된 강의계획서를 보여주고, 원본 다운로드와 PDF preview를 제공합니다.

## Props

| prop | 설명 |
|------|------|
| `subject` | API가 반환한 `SubjectData` |
| `term` | 현재 선택 학기. 2026-1에서만 문서가 표시됨 |

## UX

- 연결 문서가 없으면 렌더링하지 않습니다.
- 문서별 `Preview`와 `Download`를 제공합니다.
- preview는 동일 origin PDF를 iframe으로 표시합니다.
- 바깥 영역 클릭이나 Escape로 닫히며, 열려 있는 동안 body scroll을 잠급니다.
- 모바일에서 PDF viewer가 iframe을 지원하지 않을 때 새 탭 열기 버튼을 fallback으로 제공합니다.

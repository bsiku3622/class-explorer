# SyllabusPanel Guide

## 역할

과목 아코디언 안에서 연결된 강의계획서를 보여주고, 원본 다운로드와 PDF preview를 제공합니다.

## Props

| prop | 설명 |
|------|------|
| `subject` | API가 반환한 `SubjectData` |
| `term` | 현재 선택 학기. 2026-1에서만 문서가 표시됨 |

## 파일은 서버가 줍니다

⚠️ **강의계획서 파일은 화면 번들에 없습니다.** 한때 `assets/syllabi/` 를 번들에 실었더니 Netlify 가 로그인
없이 내줬고, 파일 대부분에 교사 이메일·전화번호가 들어 있었습니다. 지금은 `GET /syllabi` 목록을 받아
(`hooks/useSyllabusFiles.ts`) 과목에 짝짓고(`lib/syllabi.ts`), 파일은 인증 헤더를 붙여 Blob 으로 받습니다.

- 목록은 **강의계획서가 있는 과목에서만** 받습니다(`syllabusRuleFor`). 아코디언마다 요청이 나가지 않게요 —
  같은 목록을 여럿이 불러도 `lib/cache.ts` 가 하나로 묶고 한 시간 캐시합니다
- preview 는 공용 `MaterialPreviewModal` 에 `syllabusId` 를 줘서 엽니다. docx 는 같은 자리의 `.preview.pdf` 를,
  미리보기가 없으면 원본을 보여 줍니다. iframe 은 Bearer 헤더를 보낼 수 없어서 URL 을 직접 넣지 않습니다
- download 는 `downloadSyllabus` 가 Blob 으로 받아 저장 창을 띄우고 Blob URL 을 바로 거둡니다

## UX

- 연결 문서가 없으면 렌더링하지 않습니다. 목록을 받는 동안과 받지 못했을 때는 패널에 한 줄로 알립니다.
- 문서별 `Preview`와 `Download`를 제공합니다. 내려받는 동안 그 단추는 `…` 이 되고, 실패하면 패널 위에 알립니다.
- preview 창은 바깥 영역 클릭이나 Escape로 닫히며, 열려 있는 동안 body scroll을 잠급니다(`MaterialPreviewModal`).
- ⚠️ 창을 닫는 함수(`closePreview`)는 `useCallback` 으로 고정합니다. 창은 그 함수가 바뀌면 Blob 을 다시 받아서,
  목록이 늦게 도착해 패널이 다시 그려질 때 깜빡입니다.

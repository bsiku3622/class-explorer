# ksain 수집 · 분석 · 학사일정 자동 관리

> [← Backend Guide](CLAUDE.md) · 코드: `backend/ksain/`

ksain(가온누리) 게시글을 전부 받아 `backend/ksain.db` 에 쌓고, LLM 으로 요약·중요도·일정을
뽑아 공용 학사일정에 자동으로 반영합니다. 홈 질문창(Agent)이 같은 DB 를 검색합니다.

```
ksain (api.ksain.kr 본문·첨부 / api.ksain.net 최신 목록)
   │  systemd timer, 07~23시 10분마다 (deploy/class-explorer-ksain.timer)
   ▼
sync.py ──► ksain.db (posts · attachments · gaps · state · analyses)
   │
   ▼  밀린 글만, 최신순 150건씩 — 데스크탑에 닿지 않으면 다음 주기로
analyze.py ──► llm.py ──► 데스크탑 게이트웨이(10.8.10.1:11434) 또는 OpenAI
   │
   ▼
apply.py ──► calendar_events (source='ksain', source_ref='<글 번호>:<순번>')
```

## ksain 은 한 DB 를 두 사이트가 씁니다

구 사이트(ksain.net)에서 쓴 글은 **3천 번대**, 새 사이트(ksain.kr)에서 쓴 글은
**100000번대** 번호를 받고 둘 다 `api.ksain.kr/document/get/{id}` 로 읽힙니다. 학교 공지는
지금도 구 경로로 올라오고, 학생회 글은 새 경로로 올라옵니다.

| 용도 | 주소 | 인증 |
| --- | --- | --- |
| 글 하나 | `GET api.ksain.kr/document/get/{id}` | 없음 |
| 첨부 | `GET api.ksain.kr/document/{attachments[].path}` | 없음 |
| 게시판별 최신 30건 | `POST api.ksain.net/v1/document.php` (`key`·`boardID`·`count`) | `KSAIN_API_KEY` |
| 전체 목록 | `GET api.ksain.kr/document/list` | 로그인 토큰 — 쓰지 않습니다 |

⚠️ **목록 API 는 최신 30건만 주고 100000번대 글을 빼먹습니다.** 페이지 파라미터도 무시합니다.
그래서 수집은 **번호를 앞으로 훑는 것**이 중심이고, 목록 API 는 새 구 번호를 빨리 알아채는
데만 씁니다.

⚠️ 본문·첨부를 비로그인으로 주는 건 ksain 의 **지금 동작**입니다. 막히면 `KSAIN_TOKEN`
(ksain.kr 로그인 토큰, `POST /auth/signin {uid, password}` 의 `data.token`)을 넣으면 같은
요청에 Bearer 로 붙습니다.

## 수집 (`sync.py`)

```bash
python3.14 -m backend.ksain.sync --backfill   # 처음 한 번 — 두 번호 공간을 처음부터
python3.14 -m backend.ksain.sync              # 주기 실행
```

증분 실행은 셋입니다 — ① 목록 API 로 모르는 구 번호 받기 ② 두 공간 끝에서 빈 번호 30개가
이어질 때까지 앞으로 훑기 ③ 최근 14일 글을 다시 받아 수정(`content_hash`)과 삭제
(`missing_since`) 잡기.

- **빈 번호(`ksain_gaps`)를 기억합니다.** 백필을 다시 돌려도 같은 번호를 또 묻지 않습니다.
  다만 **끝 부근 60개는 매번 다시 묻습니다** — 예약 발행 글은 번호가 먼저 잡히고 나중에 보입니다
- **글마다 커밋합니다.** 한때 50건마다 커밋했더니 그동안 쓰기 잠금을 쥐고 있어서 같은 DB 를
  쓰는 다른 프로세스가 `database is locked` 로 죽었습니다
- 같은 첨부가 목록에 두 번 실려 오는 글이 있습니다(100099). 경로로 중복을 거릅니다
- 사라진 글은 지우지 않고 `missing_since` 만 찍습니다. 자동 일정만 걷어냅니다

### 첨부

파일은 저장하지 않고 **텍스트만** 남깁니다(원본은 ksain 링크로 엽니다). 시험 명단 xlsx 처럼
개인정보가 든 파일이 섞여서, 서버 디스크에 파일을 쌓아 둘 이유를 만들지 않았습니다.

| 형식 | 읽는 법 |
| --- | --- |
| xlsx | `workbook.py` (표준 라이브러리) — 시트당 150행까지 |
| docx · pptx · hwpx | zip 안의 XML |
| hwp 5.x | `olefile` 로 BodyText 의 문단 레코드(태그 67)만 |
| pdf | `pypdf`, 40쪽까지 |
| 이미지 | 아직 안 읽습니다 (`unsupported`) |

⚠️ **hwp 문단 텍스트의 0~31 은 컨트롤입니다.** 줄바꿈·하이픈 같은 몇 개만 한 글자 폭이고
나머지(표·그림·각주)는 데이터까지 **8글자 폭**을 차지합니다. 한 글자로 보고 건너뛰면
`捤獥汤捯` 같은 깨진 한자가 섞입니다.

## 분석 (`analyze.py`)

```bash
python3.14 -m backend.ksain.analyze                     # 밀린 글 최신순 150건
python3.14 -m backend.ksain.analyze --post 3092 --dry-run
python3.14 -m backend.ksain.analyze --reapply           # LLM 없이 학사일정만 다시 맞춤
```

글마다 JSON 하나 — `summary` · `importance`(0~3) · `tags` · `mandatory` · `target_grades` ·
`items`(일정: kind·title·날짜·시각·category·대상 학년·`calendar`·`confidence`).
`content_hash` 나 `ANALYZER_VERSION` 이 바뀐 글만 다시 돌립니다. **프롬프트를 고쳐 전부
다시 돌리려면 버전을 올리세요.**

모델 출력은 `coerce()` 가 다시 거릅니다 — 날짜·시각 형식, 허용된 태그·분류, 학년. 세 학년
전부(`[1,2,3]`)는 학사일정 관례대로 빈 값(전학년)으로 바꿉니다.

⚠️ **작년 공지를 복사해 연도만 안 고친 글이 있습니다.** 2980번은 2026-08-04 에 올라왔는데
본문 일시가 "2025. 8. 22." 입니다. 작성 시각보다 200일 넘게 과거인 날짜는 작성 연도로
옮겨 봅니다(`_fix_year`).

⚠️ **JSON schema 에 `["string", "null"]` 유니언을 쓰지 마세요.** Ollama 의 문법 제약이 그
칸을 null 로만 채워서 본문에 `09:00 ~09:20` 이 있어도 시각이 비었습니다. 문자열 하나로 두고
없으면 빈 문자열을 받습니다.

밀린 글이 수천 건이면 첫 분석은 데스크탑 GPU 로 몇 시간이 걸립니다(글 하나 5~10초).
최신순이라 중요한 최근 글이 먼저 끝납니다.

## 학사일정 자동 관리 (`apply.py`)

| 반영 | 건너뜀 |
| --- | --- |
| `calendar=true`, `confidence ≥ 0.6` | 끝나는 날이 14일보다 더 지난 항목 (백필한 옛 글) |
| 기간 45일 이하 | 날짜가 겹치고 제목이 비슷한 공용 일정이 이미 있음 (PDF·다른 글) |
| | 시험 분류인데 같은 기간에 PDF 시험 일정이 있음 |
| | **사람이 지웠거나 고친 일정** |

글이 바뀌면 **그 글 것만**(`source_ref LIKE '<번호>:%'`) 지우고 다시 만듭니다.

- **사람이 고친 일정은 자동 관리에서 빠집니다.** `PUT /calendar/events/{id}` 가
  `source='ksain'` 을 `manual` 로 바꿉니다 — 다음 분석이 고친 내용을 덮어쓰지 않게요
- **사람이 지운 일정은 다시 만들지 않습니다.** 반영 기록(`Analysis.applied`)에 있던 일정이
  없어졌으면 그 항목의 서명(날짜|제목)을 `suppressed` 에 넣습니다
- ⚠️ **`holiday`·`term` 분류는 쓰지 않습니다.** 홈이 `holiday` 일정으로 그날 수업을 지우고,
  `term` 의 개학·종업 표지로 방학을 판정합니다. 모델 실수 하나로 전교생 시간표가 사라집니다
- 일정 `note` 에 원문 링크(`https://ksain.kr/document/{id}`)가 들어갑니다

⚠️ **`--reapply` 는 `applied` 를 비우고 시작합니다.** 분석을 다른 DB(스테이징)에서 돌렸으면
그 기록은 다른 DB 의 일정 번호라, 남겨 두면 "사람이 지운 일정" 으로 읽혀 전부 막힙니다.

## 검색 (`search.py`)

FTS5 를 쓰지 않습니다. 글이 3천 건 남짓이라 LIKE + 점수로 충분하고, FTS5 trigram 은
"필참"·"귀가" 같은 **두 글자 한국어 단어를 못 찾습니다.** 질문 끝의 흔한 조사("마감일이")는
떼고 찾습니다.

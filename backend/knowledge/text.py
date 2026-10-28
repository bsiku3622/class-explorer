"""검색용 글 다듬기 — 정규화, 바이그램 토큰, 질문에서 검색어 뽑기, 비슷한 문장 판정.

**한국어는 두 글자씩 겹쳐 자른 바이그램으로 색인합니다.** "필참교육" → `필참 참교 교육`.
FTS5 의 trigram 토크나이저는 "필참"·"귀가" 같은 두 글자 단어를 못 찾고, 형태소 분석기는 의존성이
큽니다. 바이그램은 두 글자 단어도 찾고, 검색어의 바이그램을 **순서대로 이어 붙인 구문**으로 찾으면
그 글자열이 그대로 든 곳만 걸립니다("기말고사" → `"기말 말고 고사"`).

**띄어쓰기는 무시합니다.** 한글 사이의 공백을 지우고 자르므로 "수강 신청" 과 "수강신청" 이 같은
글자열로 찾힙니다 — 공지마다 띄어쓰기가 제각각입니다. 문장부호에서는 끊습니다.
"""
from __future__ import annotations

import re
import unicodedata

# "R&E" 는 표기가 제각각입니다 (R&E · R & E · 알앤이). 하나의 낱말로 묶습니다
_RNE = re.compile(r"r\s*&\s*e|알앤이", re.I)
# 한글 덩어리(공백으로 이어진 것까지) · 영문·숫자 낱말
_RUN = re.compile(r"[가-힣]+(?:\s+[가-힣]+)*|[a-z0-9]+")
_SPACE = re.compile(r"\s+")

# 질문에 붙어 오는 조사·어미. "마감일이" 로 찾으면 "마감일" 이 안 걸립니다
_SUFFIX = re.compile(r"(에서|에게|으로|이랑|하고|이야|인가요|인가|이에요|예요|까지|부터|한테|은|는|이|가|을|를|에|의|도|만|랑|야|요)$")
# 용언 꼬리 — "외출하려면" 은 공지에 "외출" 로 적혀 있습니다. 바이그램 구문 검색은 낱말이 통째로 들어
# 있어야 걸려서, 꼬리가 붙은 채로는 아무것도 못 찾습니다
_VERB = re.compile(r"(하려면|하려고|받으려면|받아야|받아|하면|해야|해서|하는|했어|했나|하나요|되는|되나요|될까)$")
# 무엇을 묻는지는 알려 주지만 공지 본문에서 찾을 말은 아닌 것들
_STOP = {"언제", "어디", "뭐", "무엇", "알려줘", "알려", "있어", "있나", "오늘", "내일", "공지", "ksain", "관련", "좀",
         "어떻게", "얼마", "누구", "무슨", "있는지", "해줘", "궁금해",
         # 기간은 검색어가 아니라 since·until 로 넘깁니다 ("이번 주" 의 "이번" 이 "이번주 휴강" 을 끌어왔습니다)
         "이번", "다음", "지난", "저번", "이번주", "다음주", "지난주", "이번달", "다음달",
         # 묻는 꼴의 말 — 공지에 거의 안 나와서 희소도가 높게 잡히고, 그만큼 맞는 사실을 밀어냅니다
         "내야", "해야", "하면", "되나", "되나요", "돼", "할까", "가야", "있어요", "있나요", "몇", "몇시",
         "누구", "받아야", "하려면", "가려면", "알려주세요", "뭐야", "언제야", "가는", "오는", "시에", "때",
         "하는", "거야", "건가", "어디서", "어디야", "받아", "받나", "돼요", "되요", "해요"}
# 같은 것을 다르게 부르는 말 — 검색어에 하나가 있으면 나머지도 같이 찾습니다
_SYNONYMS = [
    {"기숙사", "생활관"},
    {"동아리", "클럽"},
    {"필참", "필수참석", "전원참석"},
    {"마감", "기한"},
]


def normalize(text: str | None) -> str:
    """NFKC + 소문자 + R&E 표기 통일."""
    text = unicodedata.normalize("NFKC", text or "").lower()
    return _RNE.sub(" rne ", text)


def squeeze(text: str | None) -> str:
    """띄어쓰기를 지운 정규형 — "이 글에 이 낱말이 있는가" 를 볼 때 씁니다."""
    return _SPACE.sub("", normalize(text))


def tokens(text: str | None) -> list[str]:
    """본문 → 색인 토큰. 한 글자짜리 한글 덩어리는 버립니다(검색어도 두 글자부터)."""
    out: list[str] = []
    for match in _RUN.finditer(normalize(text)):
        run = match.group(0)
        if "가" <= run[0] <= "힣":
            run = _SPACE.sub("", run)
            if len(run) >= 2:
                out.extend(run[i:i + 2] for i in range(len(run) - 1))
        elif len(run) >= 2 or run.isdigit():
            out.append(run)
    return out


def query_terms(query: str | None, limit: int = 8) -> list[str]:
    """질문 → 검색어. 조사를 떼고, 묻는 말("언제"·"알려줘")은 뺍니다."""
    out = []
    for word in re.findall(r"[0-9A-Za-z가-힣&]+", normalize(query)):
        if len(word) > 2:
            word = _SUFFIX.sub("", word)
        if len(word) > 3:
            word = _VERB.sub("", word)
        if len(word) >= 2 and word not in _STOP:
            out.append(word)
    return list(dict.fromkeys(out))[:limit]


def expand(term: str) -> list[str]:
    """검색어 + 같은 뜻의 다른 말."""
    for group in _SYNONYMS:
        if term in group:
            return [term] + sorted(group - {term})
    return [term]


def fts_query(terms: list[str]) -> str | None:
    """검색어들 → FTS5 질의. 낱말 하나는 바이그램을 이은 **구문**, 낱말끼리는 OR 입니다."""
    phrases = []
    for term in terms:
        for variant in expand(term):
            parts = tokens(variant)
            if parts:
                phrases.append('"' + " ".join(parts) + '"')
    return " OR ".join(dict.fromkeys(phrases)) or None


def hits(terms: list[str], text: str) -> int:
    """검색어(같은 뜻의 말 포함) 중 몇 개가 이 글자열에 들어 있는가 — 띄어쓰기 무시."""
    flat = squeeze(text)
    return sum(any(squeeze(v) in flat for v in expand(term)) for term in terms)


def _bigrams(text: str) -> set[str]:
    flat = re.sub(r"[\s\W_]+", "", normalize(text))
    return {flat[i:i + 2] for i in range(len(flat) - 1)} or ({flat} if flat else set())


def similar(a: str, b: str, threshold: float = 0.5) -> bool:
    """두 문장이 같은 말인가 — 한쪽이 다른 쪽을 품거나, 바이그램이 `threshold` 이상 겹치면."""
    na, nb = re.sub(r"[\s\W_]+", "", normalize(a)), re.sub(r"[\s\W_]+", "", normalize(b))
    if not na or not nb:
        return False
    if na in nb or nb in na:
        return True
    ga, gb = _bigrams(a), _bigrams(b)
    return len(ga & gb) / len(ga | gb) >= threshold

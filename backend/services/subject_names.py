"""
과목명 정규화.

같은 과목이 출처마다 다르게 적혀 있습니다.

    KEIS 시간표    "미적분학2(EC)(Calculus2(EC))"
    교육과정       "미적분학2"

그래서 이름 하나에서 있을 수 있는 표기를 모두 만들어 두고 차례로 맞춰봅니다.
정규화 규칙을 여기 한곳에 모아, 백엔드 어디서든 같은 판단을 하게 합니다.

**로마숫자는 정규화하지 않습니다.** `물리학및실험Ⅰ`과 `물리학및실험1`은 표기 차이가
아니라 서로 다른 과목입니다 — 로마숫자 쪽은 외국인 전형 과목이고 수강생이 100%
외국인 학번입니다. 합치면 인원과 학점이 뒤섞입니다.

사람이 부르는 이름(`미1`, `선대`)으로 과목을 찾는 일은 `rank_names()` 가 합니다 — Ask 의 도구가 씁니다.
"""
import re
import unicodedata
from collections.abc import Iterable

EC_TAG = "(EC)"


def strip_trailing_parens(name: str) -> str:
    """
    맨 뒤 괄호 묶음을 괄호 균형을 맞춰 떼어냅니다.
    정규식으로는 "(EC)(Calculus2(EC))" 같은 중첩을 다루기 어렵습니다.

    >>> strip_trailing_parens("미적분학2(EC)(Calculus2(EC))")
    '미적분학2(EC)'
    >>> strip_trailing_parens("화학특강(센서화학)(Special Topics in Chemistry )")
    '화학특강(센서화학)'
    """
    text = name.strip()
    if not text.endswith(")"):
        return text
    depth = 0
    for i in range(len(text) - 1, -1, -1):
        if text[i] == ")":
            depth += 1
        elif text[i] == "(":
            depth -= 1
            if depth == 0:
                return text[:i].strip()
    return text


def split_name(raw: str) -> tuple[str, str | None, bool]:
    """
    KEIS 과목명 원문을 (한글명, 영문명, 영어강의 여부)로 쪼갭니다.

    원문은 세 가지가 한 문자열에 붙어 있습니다.

        미적분학2(EC)(Calculus2(EC))
        └한글명┘└태그┘└─── 영문명 ───┘

    **부제는 한글명에 남깁니다.** "수학특강(논리및집합)"과 "수학특강(대수학)"은 서로 다른
    강의라, 여기서 떼면 구분이 사라집니다. 교육과정 과목을 찾을 때만
    `candidate_names()`가 부제를 떼고 맞춰봅니다.

    >>> split_name("미적분학2(EC)(Calculus2(EC))")
    ('미적분학2', 'Calculus2', True)
    >>> split_name("화학특강(센서화학)(Special Topics in Chemistry )")
    ('화학특강(센서화학)', 'Special Topics in Chemistry', False)
    >>> split_name("물리학및실험Ⅰ(Physics and Lab Ⅰ)")
    ('물리학및실험Ⅰ', 'Physics and Lab Ⅰ', False)
    >>> split_name("한국어1")
    ('한국어1', None, False)
    """
    text = raw.strip()
    front = strip_trailing_parens(text)

    english: str | None = None
    tail = text[len(front):].strip()
    if tail.startswith("(") and tail.endswith(")"):
        english = tail[1:-1].strip()
        # 영문명에도 태그가 붙어 있으면 떼어냅니다 — "Calculus2(EC)" → "Calculus2"
        if english.endswith(EC_TAG):
            english = english[: -len(EC_TAG)].strip()
        english = english or None

    is_english_class = front.endswith(EC_TAG)
    name = front[: -len(EC_TAG)].strip() if is_english_class else front

    return name, english, is_english_class


def candidate_names(subject: str) -> list[str]:
    """
    과목명 하나에서 시도해볼 이름 후보를 우선순위대로 만듭니다.

    바꿔보는 것은 세 가지입니다.

    1. 뒤에 붙은 영문 괄호 떼기 — "미적분학2(EC)(Calculus2(EC))" → "미적분학2(EC)"
    2. EC 태그 떼기 — 교육과정은 언어를 구분하지 않습니다
    3. 부제 떼기 — "수학특강(심화미분방정식)" → "수학특강"

    >>> candidate_names("미적분학2(EC)(Calculus2(EC))")
    ['미적분학2(EC)(Calculus2(EC))', '미적분학2(EC)', '미적분학2']
    >>> candidate_names("수학특강(심화미분방정식)(Special Topics)")[-1]
    '수학특강'
    """
    seen: list[str] = []

    def add(value: str) -> None:
        value = value.strip()
        if value and value not in seen:
            seen.append(value)

    add(subject)

    base = strip_trailing_parens(subject)
    add(base)

    # 교육과정에는 언어 태그가 없으니 떼고도 찾아봅니다
    without_ec = base.replace(EC_TAG, "").strip()
    add(without_ec)

    # "화학특강(센서화학)" → "화학특강" 처럼 부제까지 떼어낸 형태
    add(strip_trailing_parens(without_ec))

    return seen


def match_course(subject: str, course_names: set[str] | dict) -> str | None:
    """KEIS 과목명을 교육과정 과목명으로 옮깁니다. 못 찾으면 None."""
    for candidate in candidate_names(subject):
        if candidate in course_names:
            return candidate
    return None


# ─── 부르는 이름으로 찾기 ──────────────────────────────────────────────────────
def squash(text: str | None) -> str:
    """비교용 — NFKC·소문자에 글자·숫자만 남깁니다. 로마숫자는 NFKC 가 `II` 로 펴서 `2` 와 갈립니다."""
    return re.sub(r"[^0-9a-z가-힣]", "", unicodedata.normalize("NFKC", text or "").lower())


def abbreviation(query: str, name: str) -> tuple[int, int] | None:
    """`query` 의 글자가 `name` 의 **첫 글자부터** 순서대로 다 들어 있으면 (마지막으로 맞은 자리 + 1, 자리 합).

    "미1" → "미적분학1" 은 (5, 4), "선대" → "선형대수" 는 (3, 2). 학생들이 부르는 줄임말(미방·자구·확통·일물)이
    대개 이 꼴입니다. 첫 글자를 묶지 않으면 "학1" 이 "수학1"·"미적분학1"·"일반화학1" 에 다 걸립니다. 자리 합은
    낱말 머리를 딴 쪽을 앞에 세웁니다 — "일물2" 는 "일반생물학2" 에도 들어 있지만 "일반물리학2" 가 먼저입니다.
    """
    if not query or not name or query[0] != name[0]:
        return None
    at = total = 0
    for char in query:
        at = name.find(char, at)
        if at < 0:
            return None
        total += at
        at += 1
    return at, total


# "영어2" 로 불러도 "영어Ⅱ" 가 나오게 — 맞는 게 하나도 없을 때만 씁니다(로마숫자 과목은 따로입니다, 위 설명)
_ROMAN = {"1": "i", "2": "ii", "3": "iii", "4": "iv"}


def rank_names(query: str, names: Iterable[str]) -> list[str]:
    """`query` 로 부른 이름을 가까운 순으로 — 맞는 게 없으면 빈 목록.

    1. 같은 이름
    2. 앞부분이 같거나(`미적분학` → `미적분학1·2·3`) 이름 안에 든 것, 또는 질문이 세 글자 넘는 이름을
       통째로 품은 것(`미적분학1 기말고사` → `미적분학1`)
    3. 줄임말 — 첫 글자부터 순서대로 다 든 것(`미1` → `미적분학1`, `일물2` → `일반물리학2`). 가장 촘촘하게
       맞은 것들만 남깁니다 — "일물2" 는 "일반생물학2" 에도 들어 있지만 "일반물리학2" 하나면 됩니다. 똑같이
       맞으면 다 남깁니다("일화" → 일반화학1·2, 일반화학실험1·2 — 정말 모호합니다)

    앞 단계에서 하나라도 맞으면 뒤 단계는 보지 않습니다 — "물리" 를 물었는데 줄임말 규칙으로 먼 이름까지
    끌려오지 않게 합니다. 같은 단계 안에서는 앞부분이 같은 것, 짧고 촘촘한 것이 앞입니다. 하나도 안 맞으면
    끝 숫자를 로마숫자로 바꿔 한 번 더 봅니다(`영어2` → `영어Ⅱ`).

    >>> rank_names("미1", ["미적분학1", "미적분학2", "미분방정식"])
    ['미적분학1']
    >>> rank_names("일물2", ["일반생물학2", "일반물리학실험2", "일반물리학2", "일반화학2"])
    ['일반물리학2']
    >>> rank_names("일화", ["일반화학실험1", "일반화학1", "일본언어와문화"])
    ['일반화학1', '일반화학실험1']
    >>> rank_names("영어2", ["영어Ⅰ", "영어Ⅱ"])
    ['영어Ⅱ']
    """
    q = squash(query)
    if not q:
        return []
    names = list(dict.fromkeys(names))
    tiers: list[list[tuple[tuple, str]]] = [[], [], []]
    for name in names:
        n = squash(name)
        if not n:
            continue
        if n == q:
            tiers[0].append(((len(n),), name))
        elif n.startswith(q):
            tiers[1].append(((0, len(n)), name))
        elif q in n:
            tiers[1].append(((1, len(n)), name))
        elif len(n) >= 3 and n in q:
            tiers[1].append(((2, -len(n)), name))
        else:
            hit = abbreviation(q, n)
            if hit is not None:
                tiers[2].append(((*hit, len(n)), name))
    if tiers[2]:
        best = min(key[:2] for key, _name in tiers[2])
        tiers[2] = [(key, name) for key, name in tiers[2] if key[:2] == best]
    for tier in tiers:
        if tier:
            return [name for _key, name in sorted(tier)]
    digit = re.search(r"([1-4])$", q)
    if digit:
        return rank_names(q[:-1] + _ROMAN[digit.group(1)], names)
    return []

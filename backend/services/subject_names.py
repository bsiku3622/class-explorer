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
"""

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

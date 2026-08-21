/**
 * 시간표를 읽는 **규칙**. 화면이 아니라 규칙만 있습니다.
 *
 * 여기 있는 것들은 전부 "이 두 교시가 한 수업인가", "이 틈이 쉬는시간인가" 같은
 * 판정입니다. 히어로·주간 격자·오늘 목록·자(`DayRuler`)가 **같은 답을 내야 하는**
 * 물음이라 한 곳에 둡니다.
 *
 * ⚠️ **예전엔 네 파일이 각자 들고 있었습니다.** 임계값이 `20`·`20`·`20`·`15` 로
 * 어긋나 있었고, 연강 판정도 조건을 각자 적어 두어서 한 곳을 고쳐도 나머지가 옛
 * 규칙을 그대로 썼습니다 — 실제로 "연강 중인데 공강으로 뜬다" 가 그렇게 나왔습니다.
 * 규칙을 바꿀 일이 있으면 **이 파일만** 고치세요.
 */

/**
 * 교시 사이가 이보다 짧으면 **쉬는시간**입니다 (길면 점심·저녁 같은 이름 붙은 구간).
 *
 * 실제 시각표(`backend/periods.py`)에서 교시 사이는 10분, 아니면 60분(9→10교시)·
 * 70분(4→5교시)뿐이라 그 사이 어디를 잘라도 답이 같습니다. 20분으로 둔 건 시각표가
 * 조금 바뀌어도 안 흔들리게 하려는 여유입니다.
 */
export const BREAK_MINUTES = 20;

/** 시간을 가진 교시 한 칸 — `PeriodTime` 이든 뭐든 이 둘만 있으면 됩니다 */
interface Span {
    start_minute: number;
    end_minute: number;
}

/** 이름 붙은 시간대(점심·저녁·자습) */
interface Named extends Span {
    name: string;
}

/** 한 수업인지 가릴 때 보는 것 — 과목·분반·교실 */
interface ClassLike {
    subject: string;
    section: string;
    room: string;
}

/**
 * 앞 교시가 끝나고 뒤 교시가 시작할 때까지의 틈이 **쉬는시간인가**.
 *
 * ⚠️ 교시 **번호**로 판단하면 안 됩니다. 4교시와 5교시는 번호가 이어지지만 사이에
 * 점심이 70분 있습니다 — 번호만 보면 점심을 가로지르는 연강이 생깁니다.
 */
export const isBreakGap = (prevEnd: number, nextStart: number): boolean =>
    nextStart - prevEnd <= BREAK_MINUTES;

/**
 * 두 칸이 **같은 수업인가** — 과목·분반·교실이 모두 같아야 합니다.
 *
 * ⚠️ **교실까지 봅니다.** 같은 과목이라도 교실이 바뀌면 사이에 이동이 있어서, 한
 * 덩어리로 묶으면 옮겨야 한다는 걸 화면이 말하지 않게 됩니다.
 */
export const isSameClass = (a: ClassLike, b: ClassLike): boolean =>
    a.subject === b.subject && a.section === b.section && a.room === b.room;

/**
 * 뒤 칸이 앞 칸에 **이어지는 연강인가** — 같은 수업이고, 교시 번호가 바로 다음이고,
 * 시간도 붙어 있어야 합니다.
 *
 * 셋을 다 봐야 하는 이유는 각각 다릅니다. 같은 수업인지는 당연하고, 번호가 이어져야
 * 중간에 다른 교시를 건너뛰지 않으며, 시간이 붙어야 점심을 가로지르지 않습니다.
 */
export const continuesClass = (
    prev: { klass: ClassLike; period: number; end_minute: number },
    next: { klass: ClassLike; period: number; start_minute: number },
): boolean =>
    isSameClass(prev.klass, next.klass) &&
    prev.period + 1 === next.period &&
    isBreakGap(prev.end_minute, next.start_minute);

/**
 * 교시 사이의 구멍에 이름을 붙입니다 — `breaks` 중 **가장 많이 겹치는** 것.
 *
 * ⚠️ 처음 걸리는 것을 쓰면 안 됩니다. 점심 구멍(12:30~13:40)에는 `점심`(40분)과
 * `학급모임`(20분)이 **둘 다** 걸쳐서, 순서에 따라 답이 달라집니다.
 *
 * 겹치는 게 없으면 빈 문자열입니다 (이름 없는 구멍).
 */
export const gapName = (from: number, to: number, breaks: Named[]): string => {
    let name = "";
    let longest = 0;
    for (const item of breaks) {
        const overlap = Math.min(to, item.end_minute) - Math.max(from, item.start_minute);
        if (overlap > longest) {
            longest = overlap;
            name = item.name;
        }
    }
    return name;
};

/**
 * 교시들을 **붙어 있는 덩어리로** 묶습니다 — 수업이 뭔지는 보지 않고 시간만 봅니다.
 *
 * 자(`DayRuler`)가 축 눈금을 덩어리의 양 끝에만 다는 데 씁니다. 교시마다 시각을 달면
 * 열한 개가 겹칩니다.
 */
export const mergeSpans = <T extends Span>(spans: T[]): { start: number; end: number }[] => {
    const out: { start: number; end: number }[] = [];
    for (const item of spans) {
        const tail = out[out.length - 1];
        if (tail && isBreakGap(tail.end, item.start_minute)) tail.end = item.end_minute;
        else out.push({ start: item.start_minute, end: item.end_minute });
    }
    return out;
};

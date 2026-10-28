import React, { useCallback, useEffect, useState } from "react";
import { Signpost, X } from "lucide-react";
import {
    fetchMajors,
    isMajorPromptSnoozed,
    saveMajor,
    snoozeMajorPrompt,
    type MajorsInfo,
    type MyMajor,
} from "../lib/majors";
import { getDepartmentColor, particleRo, withAlpha } from "../lib/utils";
import RetroButton from "./atoms/RetroButton";
import MajorPicker from "./MajorPicker";

interface MajorPromptProps {
    userId: number;
    /** 답을 받았을 때 — App 이 `currentUser` 의 전공 칸을 바꾸면 이 창이 내려갑니다 */
    onAnswered: (me: MyMajor) => void;
}

/**
 * 전공을 묻는 창 — 아직 답하지 않은 학생에게 뜹니다(`App.tsx` 가 `major_answered === false` 일 때만
 * 붙입니다). 전공은 학사일정의 "내 학년·전공 것만" 과 Ask 의 "내 일정" 에 쓰입니다.
 *
 * - **저장은 사람이 누를 때만** 합니다. 수강 이력으로 짐작한 트랙(`suggestion`)은 "추천" 표식과
 *   근거 과목만 보여 줍니다 — 맞는지 대 볼 정답이 없는 짐작이고(수집된 학기가 짧아 윗 학번도 열에
 *   서넛은 짐작조차 안 나옵니다), 미리 골라 두면 그대로 눌러 버리기 쉽습니다
 * - "아직 정하지 않았어요" 도 **답**입니다. 다시 묻지 않고, 정하면 `/about` 에서 고릅니다
 * - "나중에"(✕·바깥·Esc 도 같습니다)는 **그날 하루만** 미룹니다 — 영영 숨기는 길은 위의 "아직" 입니다
 *
 * 다른 기기에서 이미 답했으면 창을 띄우지 않고 App 쪽 값만 맞춥니다.
 */
const MajorPrompt: React.FC<MajorPromptProps> = ({ userId, onAnswered }) => {
    const [snoozed, setSnoozed] = useState(() => isMajorPromptSnoozed(userId));
    const [info, setInfo] = useState<MajorsInfo | null>(null);
    const [choice, setChoice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (snoozed) return;
        let alive = true;
        fetchMajors()
            .then((data) => {
                if (!alive) return;
                if (data.me.answered) onAnswered(data.me);
                else setInfo(data);
            })
            .catch(() => {
                // 못 받으면 띄우지 않습니다 — 묻는 창 때문에 앱이 막힐 이유는 없습니다
            });
        return () => {
            alive = false;
        };
    }, [snoozed, onAnswered]);

    const open = !snoozed && info !== null;

    const dismiss = useCallback(() => {
        snoozeMajorPrompt(userId);
        setSnoozed(true);
    }, [userId]);

    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") dismiss();
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [dismiss, open]);

    const answer = async (major: string | null) => {
        setBusy(true);
        setError(null);
        try {
            onAnswered(await saveMajor(major));
        } catch {
            setError("저장하지 못했습니다. 잠시 뒤에 다시 눌러주세요.");
            setBusy(false);
        }
    };

    if (snoozed || !info) return null;
    const suggestion = info.suggestion;
    const tint = suggestion ? getDepartmentColor(suggestion.major) : null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="major-prompt-title"
            // 위 24 는 상단 바(h-20) 자리입니다 — 창이 길면 바 밑으로 들어가지 않고 이 안에서 흐릅니다
            className="fixed inset-0 z-[110] flex justify-center overflow-y-auto bg-black/70 px-4 pb-4 pt-24"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) dismiss();
            }}
        >
            <div className="my-auto h-fit w-full max-w-lg border-2 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,0.22)]">
                <header className="flex items-center justify-between border-b-2 border-black bg-retro-secondary px-4 py-3 text-white">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                        <Signpost size={15} strokeWidth={2.75} /> Major Survey
                    </p>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="나중에 — 오늘은 다시 묻지 않습니다"
                        className="grid size-8 place-items-center border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.18)]"
                    >
                        <X size={16} strokeWidth={2.75} />
                    </button>
                </header>

                <div className="space-y-5 p-5 sm:p-6">
                    <div>
                        <h2
                            id="major-prompt-title"
                            className="text-2xl font-black tracking-tight text-retro-secondary"
                        >
                            전공을 입력해주세요!
                        </h2>
                        <p className="mt-2 text-sm font-bold leading-relaxed text-black/55">
                            학사일정과 Ask 답을 내 전공에 맞춰 보여 드리려고 물어요. 심화필수
                            전공 트랙은 3학년 2학기까지 바꿀 수 있어서, 고른 뒤에도 About 에서
                            언제든 고칠 수 있어요.
                        </p>
                    </div>

                    {suggestion && tint && (
                        <div
                            className="border-2 px-3 py-2.5"
                            style={{ borderColor: tint, backgroundColor: withAlpha(tint, 0.08) }}
                        >
                            <p className="text-sm font-black" style={{ color: tint }}>
                                수강 이력으로 보면 {suggestion.major} 트랙 같아요
                            </p>
                            {suggestion.courses.length > 0 && (
                                <p className="mt-0.5 text-xs font-bold leading-relaxed text-black/55">
                                    {suggestion.courses.join(" · ")}
                                </p>
                            )}
                            <p className="mt-1 text-[11px] font-bold text-black/40">
                                짐작이라 틀릴 수 있어요. 맞으면 아래에서 직접 눌러주세요.
                            </p>
                        </div>
                    )}

                    <MajorPicker
                        options={info.options}
                        value={choice}
                        onChange={setChoice}
                        suggested={suggestion?.major}
                        disabled={busy}
                    />

                    {error && (
                        <p className="border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold text-retro-primary">
                            {error}
                        </p>
                    )}
                </div>

                {/* 좁은 화면에서는 저장이 맨 아래 한 줄을 통째로 씁니다 — 엄지가 닿는 자리입니다 */}
                <footer className="grid grid-cols-2 gap-2 border-t-2 border-black p-4 sm:flex sm:justify-end">
                    <RetroButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={dismiss}
                        title="오늘은 다시 묻지 않습니다"
                        className="h-11 disabled:pointer-events-none disabled:opacity-40"
                    >
                        나중에
                    </RetroButton>
                    <RetroButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void answer(null)}
                        className="h-11 disabled:pointer-events-none disabled:opacity-40"
                    >
                        아직 정하지 않았어요
                    </RetroButton>
                    <RetroButton
                        type="button"
                        size="sm"
                        variant="black"
                        disabled={busy || !choice}
                        onClick={() => choice && void answer(choice)}
                        className="col-span-2 h-11 disabled:pointer-events-none disabled:opacity-40"
                    >
                        {busy ? "저장 중..." : choice ? `${choice}${particleRo(choice)} 저장` : "트랙을 골라주세요"}
                    </RetroButton>
                </footer>
            </div>
        </div>
    );
};

export default MajorPrompt;

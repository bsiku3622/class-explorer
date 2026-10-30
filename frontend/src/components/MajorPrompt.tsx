import React, { useCallback, useEffect, useState } from "react";
import { Signpost } from "lucide-react";
import {
    fetchMajors,
    isMajorPromptSnoozed,
    saveMajor,
    snoozeMajorPrompt,
    type MajorsInfo,
    type MyMajor,
} from "../lib/majors";
import { getDepartmentColor, particleRo } from "../lib/utils";
import { Button, Modal, Notice, Text, ToneBox, ToneText } from "@studio-baeks/funky-ui";
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
        <Modal
            open
            onClose={dismiss}
            title={
                <span className="flex items-center gap-2">
                    <Signpost size={15} strokeWidth={2.75} /> Major Survey
                </span>
            }
            closeLabel="나중에 — 오늘은 다시 묻지 않습니다"
            footer={
                /* 좁은 화면에서는 저장이 맨 아래 한 줄을 통째로 씁니다 — 엄지가 닿는 자리입니다 */
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button size="lg"
                        variant="paper"
                        shadow
                        disabled={busy}
                        onClick={dismiss}
                        title="오늘은 다시 묻지 않습니다"
                    >
                        나중에
                    </Button>
                    <Button size="lg" variant="paper" shadow disabled={busy} onClick={() => void answer(null)}>
                        아직 정하지 않았어요
                    </Button>
                    <Button size="lg"
                        variant="filled"
                        shadow
                        disabled={busy || !choice}
                        onClick={() => choice && void answer(choice)}
                        className="col-span-2"
                    >
                        {busy ? "저장 중..." : choice ? `${choice}${particleRo(choice)} 저장` : "트랙을 골라주세요"}
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div>
                    <Text as="h2" variant="title" tone="purple">
                        전공을 입력해주세요!
                    </Text>
                    <Text as="p" tone="secondary" leading="relaxed" className="mt-2">
                        학사일정과 Ask 답을 내 전공에 맞춰 보여 드리려고 물어요. 심화필수
                        전공 트랙은 3학년 2학기까지 바꿀 수 있어서, 고른 뒤에도 About 에서
                        언제든 고칠 수 있어요.
                    </Text>
                </div>

                {suggestion && tint && (
                    <ToneBox tone={tint} paddingX="lg" paddingY="md">
                        <ToneText as="p" tone={tint} weight="black">
                            수강 이력으로 보면 {suggestion.major} 트랙 같아요
                        </ToneText>
                        {suggestion.courses.length > 0 && (
                            <Text as="p" variant="caption" tone="secondary" leading="relaxed" className="mt-0.5">
                                {suggestion.courses.join(" · ")}
                            </Text>
                        )}
                        <Text as="p" variant="label" weight="bold" tone="muted" className="mt-1">
                            짐작이라 틀릴 수 있어요. 맞으면 아래에서 직접 눌러주세요.
                        </Text>
                    </ToneBox>
                )}

                <MajorPicker
                    options={info.options}
                    value={choice}
                    onChange={setChoice}
                    suggested={suggestion?.major}
                    disabled={busy}
                />

                {error && <Notice role="alert">{error}</Notice>}
            </div>
        </Modal>
    );
};

export default MajorPrompt;

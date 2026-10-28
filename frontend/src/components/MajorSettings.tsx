import React, { useCallback, useEffect, useState } from "react";
import { Signpost } from "lucide-react";
import { fetchMajors, saveMajor, type MajorsInfo, type MyMajor } from "../lib/majors";
import { particleRo } from "../lib/utils";
import RetroButton from "./atoms/RetroButton";
import RetroCard from "./atoms/RetroCard";
import RetroSpinner from "./atoms/RetroSpinner";
import RetroSubTitle from "./atoms/RetroSubTitle";
import MajorPicker from "./MajorPicker";

interface MajorSettingsProps {
    /** 저장했을 때 — App 이 `currentUser` 의 전공 칸을 바꿉니다(달력 거르기·묻는 창이 그 값을 봅니다) */
    onSaved: (me: MyMajor) => void;
}

/**
 * `/about` 의 전공 칸 — 묻는 창(`MajorPrompt`)에서 고른 값을 보고 바꾸는 자리입니다. 트랙은
 * 3학년 2학기까지 바꿀 수 있어서 한 번 답했다고 끝나지 않습니다.
 *
 * 고르기만 해서는 안 바뀌고 **저장을 눌러야** 바뀝니다 — 칸을 훑다가 손가락이 닿은 걸로 전공이
 * 바뀌면 안 됩니다. "미정으로" 는 계정의 전공을 비웁니다(답한 것으로는 남습니다).
 */
const MajorSettings: React.FC<MajorSettingsProps> = ({ onSaved }) => {
    const [info, setInfo] = useState<MajorsInfo | null>(null);
    const [choice, setChoice] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await fetchMajors();
            setInfo(data);
            setChoice(data.me.major);
            setError(null);
        } catch {
            setError("전공 정보를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async (major: string | null) => {
        setBusy(true);
        setError(null);
        try {
            const me = await saveMajor(major);
            // 고른 뒤에는 짐작을 보여 주지 않습니다 — 서버도 고른 사람에게는 짐작을 안 보냅니다
            setInfo((prev) => (prev ? { ...prev, me, suggestion: me.major ? null : prev.suggestion } : prev));
            setChoice(me.major);
            onSaved(me);
        } catch {
            setError("저장하지 못했습니다. 잠시 뒤에 다시 눌러주세요.");
        } finally {
            setBusy(false);
        }
    };

    const current = info?.me.major ?? null;
    const status = !info
        ? ""
        : current
          ? `지금 ${current} 트랙(${info.me.division})`
          : info.me.answered
            ? "지금 미정"
            : "아직 고르지 않았습니다";

    return (
        <RetroCard className="bg-white p-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <RetroSubTitle title="Major" icon={Signpost} />
                    {status && (
                        <span className="text-[11px] font-bold text-black/35">{status}</span>
                    )}
                </div>

                <p className="text-xs font-bold text-black/40">
                    심화필수 전공 트랙입니다. 학사일정의 "내 학년·전공 것만" 과 Ask 답에 씁니다.
                    트랙은 3학년 2학기까지 바꿀 수 있어요.
                </p>

                {loading ? (
                    <div className="flex justify-center py-6">
                        <RetroSpinner />
                    </div>
                ) : !info ? (
                    <p className="py-4 text-center text-xs font-bold text-black/40">{error}</p>
                ) : (
                    // 넓은 화면에서 카드 폭을 다 쓰면 트랙 단추 하나가 500px 을 넘어 늘어집니다 — 묻는 창과 같은 폭에서 멈춥니다
                    <div className="max-w-lg space-y-3">
                        {info.suggestion && (
                            <p className="text-xs font-bold text-black/55">
                                수강 이력으로 보면 {info.suggestion.major} 트랙 같아요 (
                                {info.suggestion.courses.join(" · ")}) — 짐작이라 직접 골라야 저장됩니다.
                            </p>
                        )}
                        <MajorPicker
                            options={info.options}
                            value={choice}
                            onChange={setChoice}
                            suggested={info.suggestion?.major}
                            disabled={busy}
                        />
                        {error && <p className="text-xs font-bold text-retro-primary">{error}</p>}
                        <div className="flex flex-wrap justify-end gap-2">
                            {(current !== null || !info.me.answered) && (
                                <RetroButton
                                    type="button"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void save(null)}
                                    className="disabled:pointer-events-none disabled:opacity-40"
                                >
                                    미정으로 두기
                                </RetroButton>
                            )}
                            <RetroButton
                                type="button"
                                size="sm"
                                variant="black"
                                disabled={busy || !choice || choice === current}
                                onClick={() => choice && void save(choice)}
                                className="disabled:pointer-events-none disabled:opacity-40"
                            >
                                {choice && choice !== current
                                    ? `${choice}${particleRo(choice)} 저장`
                                    : "저장"}
                            </RetroButton>
                        </div>
                    </div>
                )}
            </div>
        </RetroCard>
    );
};

export default MajorSettings;

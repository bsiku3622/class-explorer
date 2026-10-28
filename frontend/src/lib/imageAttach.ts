/**
 * `/ai` 이미지 첨부 — 고른·붙여넣은·끌어다 놓은 이미지를 **긴 변 1600px JPEG** data URL 로 줄입니다.
 *
 * 폰 사진은 한 장에 4~8MB 라 그대로 보내면 요청이 무겁고 모델도 느려집니다. 공지 사진·시간표 캡처를
 * 읽는 데는 1600px 이면 충분합니다. 서버는 이미지를 저장하지 않고 그 질문의 모델 호출에만 씁니다.
 */
export const MAX_IMAGES = 3;
const MAX_SIDE = 1600;

export async function shrinkImage(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 붙일 수 있어요");
    // createImageBitmap 이 HEIC 같은 형식을 못 읽으면 여기서 실패합니다
    const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error("이 이미지 형식은 읽지 못했어요 (JPG·PNG 로 바꿔 주세요)");
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지를 처리하지 못했어요");
    ctx.fillStyle = "#fff"; // 투명 PNG 가 JPEG 로 바뀔 때 검게 칠해지지 않게
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
}

/** 클립보드·드롭에서 이미지 파일만 꺼냅니다 */
export function imageFiles(list: FileList | DataTransferItemList | null | undefined): File[] {
    if (!list) return [];
    const out: File[] = [];
    for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
        const file = entry instanceof File ? entry : entry.kind === "file" ? entry.getAsFile() : null;
        if (file && file.type.startsWith("image/")) out.push(file);
    }
    return out;
}

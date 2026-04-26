import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { supabase } from "@/lib/supabase";

export interface AnalyzeResult {
  name: string | null;
  summary: string;
}

/**
 * 이미지를 1024px 장변 기준으로 리사이즈한 JPEG base64 data URL을 반환한다.
 * <canvas>를 사용하므로 외부 라이브러리 불필요.
 */
export async function resizeImageToBase64(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      const { width, height } = img;
      const scale = Math.min(1, MAX / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas context 없음"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/jpeg", 0.8);
      // Android WebView GPU 메모리 명시적 해제
      canvas.width = 0;
      canvas.height = 0;
      img.src = "";
      resolve(result);
    };
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = dataUrl;
  });
}

/**
 * Capacitor Camera로 사진 촬영 또는 갤러리 선택 후 base64 data URL을 반환한다.
 * 사용자가 취소하면 null 반환.
 */
export async function capturePhoto(): Promise<string | null> {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // 촬영/갤러리 선택 시트 표시
      quality: 80,
    });
    return photo.dataUrl ?? null;
  } catch (err) {
    // 사용자 취소는 Error: "User cancelled photos app" 형태로 옴
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("dismissed")) {
      return null;
    }
    throw err;
  }
}

/**
 * Supabase Edge Function `analyze-medication-photo`를 호출해 약 정보를 분석한다.
 * AbortSignal로 타임아웃 제어.
 */
export async function analyzeMedicationPhoto(
  imageBase64: string,
  signal: AbortSignal
): Promise<AnalyzeResult> {
  // signal을 invoke에 직접 전달 — invoke 자체가 취소 시 AbortError를 던짐
  const { data, error } = await supabase.functions.invoke("analyze-medication-photo", {
    body: { imageBase64 },
    signal,
  });

  if (error) throw new Error(error.message ?? "Edge Function 호출 실패");

  const name = typeof data?.name === "string" ? data.name : null;
  const summary = typeof data?.summary === "string" ? data.summary : "";
  return { name, summary };
}

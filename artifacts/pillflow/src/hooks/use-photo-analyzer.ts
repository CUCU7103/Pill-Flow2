import { useState, useCallback, useEffect, useRef } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { toast } from "sonner";
import { capturePhoto, resizeImageToBase64, analyzeMedicationPhoto } from "@/lib/photoAnalyzer";
import type { AnalyzeResult } from "@/lib/photoAnalyzer";

export type AnalyzeStatus = "idle" | "uploading" | "analyzing" | "slow" | "done" | "error";

/** 상태별 사용자 표시 메시지 */
const STATUS_MESSAGES: Record<AnalyzeStatus, string> = {
  idle: "",
  uploading: "사진 업로드 중...",
  analyzing: "약 정보 분석 중...",
  slow: "조금 더 걸리고 있어요...",
  done: "분석 완료",
  error: "분석 실패",
};

interface UsePhotoAnalyzerOpts {
  /** 분석 완료 시 호출 — name이 null이면 약 식별 실패 */
  onResult: (result: AnalyzeResult) => void;
}

interface UsePhotoAnalyzerReturn {
  status: AnalyzeStatus;
  message: string;
  /** 카메라 시트를 열고 전체 분석 흐름을 시작한다 */
  start: () => Promise<void>;
}

const TIMEOUT_MS = 15_000;  // 15초 최대 대기
const SLOW_MS = 5_000;      // 5초 경과 시 "slow" 메시지

export function usePhotoAnalyzer({ onResult }: UsePhotoAnalyzerOpts): UsePhotoAnalyzerReturn {
  const [status, setStatus] = useState<AnalyzeStatus>("idle");
  // status를 ref로 미러링해 useCallback 의존성에서 제거
  const statusRef = useRef<AnalyzeStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** status 상태와 ref를 항상 동기화하여 클로저 스탈 방지 */
  const updateStatus = (s: AnalyzeStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  /** 진행 중인 타이머를 모두 정리한다 (idle 복귀 타이머 포함) */
  const clearTimers = () => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    slowTimerRef.current = null;
    timeoutRef.current = null;
    idleTimerRef.current = null;
  };

  // 언마운트 시 모든 타이머와 진행 중 요청을 정리하여 메모리 누수 방지
  useEffect(() => {
    return () => {
      clearTimers();
      abortRef.current?.abort();
    };
  }, []);

  const start = useCallback(async () => {
    // statusRef로 현재 상태 확인 — useCallback 의존성에서 status 제거
    if (
      statusRef.current !== "idle" &&
      statusRef.current !== "done" &&
      statusRef.current !== "error"
    ) return;

    // 1. 카메라 시트 열기 — 권한 거부 시 Error, 취소 시 null 반환
    let dataUrl: string | null;
    try {
      dataUrl = await capturePhoto();
    } catch {
      toast.error("카메라 권한이 필요해요. 설정에서 허용해주세요.");
      return;
    }

    // 사용자가 직접 취소한 경우 아무 동작 없이 종료
    if (!dataUrl) return;

    // 2. 촬영 완료 — 햅틱 피드백 + uploading 상태 전환
    // 웹/비지원 환경에서 Haptics 실패해도 분석 흐름은 계속 진행
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    updateStatus("uploading");

    // 3. 요청 취소를 위한 AbortController 생성
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    // 4. 5초 후 "slow" 상태로 전환하여 사용자에게 대기 안내
    slowTimerRef.current = setTimeout(() => {
      // statusRef로 현재 상태 직접 확인 — 클로저 스탈 없음
      if (statusRef.current === "analyzing") updateStatus("slow");
    }, SLOW_MS);

    // 5. 15초 초과 시 AbortController로 요청 강제 취소
    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
    }, TIMEOUT_MS);

    try {
      // 6. 이미지를 1024px 장변 기준으로 리사이즈
      const resized = await resizeImageToBase64(dataUrl);

      // 리사이즈 도중 타임아웃이 발생한 경우 즉시 중단
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      updateStatus("analyzing");

      // 7. Supabase Edge Function 호출하여 약 정보 분석
      const result = await analyzeMedicationPhoto(resized, signal);

      clearTimers();
      updateStatus("done");
      onResult(result);

      // 완료 상태를 1초간 표시 후 idle 복귀 — ref로 추적하여 언마운트 시 정리 가능
      idleTimerRef.current = setTimeout(() => updateStatus("idle"), 1_000);
    } catch (err) {
      clearTimers();

      // AbortError: 타임아웃, 그 외: 네트워크/서버 오류
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      toast.error(
        isAbort
          ? "분석 시간이 초과됐어요. 직접 입력해주세요."
          : "분석에 실패했어요. 직접 입력해주세요."
      );
      updateStatus("error");

      // 에러 상태를 3초간 표시 후 idle 복귀 — ref로 추적하여 언마운트 시 정리 가능
      idleTimerRef.current = setTimeout(() => updateStatus("idle"), 3_000);
    }
  }, [onResult]); // status 의존성 제거 — statusRef로 대체하여 불필요한 재생성 방지

  return {
    status,
    message: STATUS_MESSAGES[status],
    start,
  };
}

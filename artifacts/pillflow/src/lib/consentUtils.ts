export const POLICY_VERSION = "2026-09-27";

export type ConsentType = "age_over_14" | "sensitive_health" | "photo_analysis";

export interface ConsentStatus {
  policyVersion: string;
  ageOver14: boolean;
  sensitiveHealth: boolean;
  photoAnalysis: boolean;
}

/** API 응답이 동의 상태 계약을 충족하는지 런타임에서 확인한다. */
export function isConsentStatus(value: unknown): value is ConsentStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  return typeof status.policyVersion === "string"
    && typeof status.ageOver14 === "boolean"
    && typeof status.sensitiveHealth === "boolean"
    && typeof status.photoAnalysis === "boolean";
}

export const CONSENT_VERSION_UPDATE_MESSAGE = "앱을 최신 버전으로 업데이트해 주세요.";

/** 앱 시작에는 연령 확인과 민감정보 동의가 모두 필요하다. */
export function canStartWithConsent(ageOver14: boolean, sensitiveHealth: boolean): boolean {
  return ageOver14 && sensitiveHealth;
}

/** 연령 확인과 민감정보 처리 동의가 모두 현재 상태에 기록됐는지 확인한다. */
export function isConsentComplete(status: Pick<ConsentStatus, "ageOver14" | "sensitiveHealth"> | null | undefined): boolean {
  return typeof status?.ageOver14 === "boolean"
    && typeof status.sensitiveHealth === "boolean"
    && status.ageOver14
    && status.sensitiveHealth;
}

/** 사진 분석에 동의하지 않았다면 촬영 전에 별도 동의를 받는다. */
export function needsPhotoConsent(photoAnalysis: boolean | null | undefined): boolean {
  return !photoAnalysis;
}

/** 필수 동의 API가 현재 정책 버전과 맞지 않는 오류인지 확인한다. */
export function isConsentVersionMismatchError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "CONSENT_VERSION_MISMATCH");
}

/** 사진 동의 저장이 성공한 경우에만 촬영을 시작하고, 저장 실패는 결과로 돌려준다. */
export async function savePhotoConsentThenStart(
  saveConsent: () => Promise<unknown>,
  startPhoto: () => Promise<void>,
): Promise<{ consentSaved: true } | { consentSaved: false; error: unknown }> {
  try {
    await saveConsent();
  } catch (error) {
    return { consentSaved: false, error };
  }

  await startPhoto();
  return { consentSaved: true };
}

/** API 오류 code가 필수 동의 누락인지 확인한다. */
export function isConsentRequiredError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "CONSENT_REQUIRED");
}

export type ConsentGuardAction = "ignore" | "reload" | "show_error" | "reset";

/** 동의 재조회 중인 403은 무시하고, 약 목록 조회가 성공하면 연속 횟수를 초기화한다. */
export function transitionConsentGuard(
  event: "consent_required" | "medications_loaded",
  isReloading: boolean,
  consecutiveFailures: number,
): { action: ConsentGuardAction; consecutiveFailures: number } {
  if (event === "medications_loaded") {
    return { action: "reset", consecutiveFailures: 0 };
  }
  if (isReloading) {
    return { action: "ignore", consecutiveFailures };
  }

  const nextFailures = consecutiveFailures + 1;
  return {
    action: nextFailures >= 2 ? "show_error" : "reload",
    consecutiveFailures: nextFailures,
  };
}

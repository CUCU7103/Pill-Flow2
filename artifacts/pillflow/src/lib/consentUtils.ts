export const POLICY_VERSION = "2026-09-27";

export type ConsentType = "age_over_14" | "sensitive_health" | "photo_analysis";

export interface ConsentStatus {
  policyVersion: string;
  ageOver14: boolean;
  sensitiveHealth: boolean;
  photoAnalysis: boolean;
}

/** 앱 시작에는 연령 확인과 민감정보 동의가 모두 필요하다. */
export function canStartWithConsent(ageOver14: boolean, sensitiveHealth: boolean): boolean {
  return ageOver14 && sensitiveHealth;
}

/** 연령 확인과 민감정보 처리 동의가 모두 현재 상태에 기록됐는지 확인한다. */
export function isConsentComplete(status: Pick<ConsentStatus, "ageOver14" | "sensitiveHealth"> | null | undefined): boolean {
  return Boolean(status?.ageOver14 && status.sensitiveHealth);
}

/** 사진 분석에 동의하지 않았다면 촬영 전에 별도 동의를 받는다. */
export function needsPhotoConsent(photoAnalysis: boolean | null | undefined): boolean {
  return !photoAnalysis;
}

export function isConsentRequiredError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "CONSENT_REQUIRED");
}

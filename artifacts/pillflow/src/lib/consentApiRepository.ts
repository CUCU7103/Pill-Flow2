import { apiRequest } from "@/lib/apiClient";
import { isConsentStatus, POLICY_VERSION, type ConsentStatus, type ConsentType } from "@/lib/consentUtils";

function requireConsentStatus(value: unknown): ConsentStatus {
  if (!isConsentStatus(value)) throw new Error("동의 상태 응답이 올바르지 않습니다.");
  return value;
}

/** API 모드에서는 JWT로 사용자를 식별하므로 userId 인자는 시그니처 호환용이다. */
export async function fetchConsentStatus(userId: string): Promise<ConsentStatus> {
  void userId;
  return requireConsentStatus(await apiRequest<unknown>("/api/v1/consents"));
}

/** 동의 종류와 현재 처리방침 버전을 서버에 기록한다. */
export async function recordConsents(userId: string, types: ConsentType[]): Promise<ConsentStatus> {
  void userId;
  const response = await apiRequest<unknown>("/api/v1/consents", {
    method: "POST",
    body: JSON.stringify({ policyVersion: POLICY_VERSION, types }),
  });
  return requireConsentStatus(response);
}

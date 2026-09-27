import { apiRequest } from "@/lib/apiClient";
import { POLICY_VERSION, type ConsentStatus, type ConsentType } from "@/lib/consentUtils";

/** API 모드에서는 JWT로 사용자를 식별하므로 userId 인자는 시그니처 호환용이다. */
export async function fetchConsentStatus(userId: string): Promise<ConsentStatus> {
  void userId;
  return apiRequest<ConsentStatus>("/api/v1/consents");
}

/** 동의 종류와 현재 처리방침 버전을 서버에 기록한다. */
export async function recordConsents(userId: string, types: ConsentType[]): Promise<ConsentStatus> {
  void userId;
  return apiRequest<ConsentStatus>("/api/v1/consents", {
    method: "POST",
    body: JSON.stringify({ policyVersion: POLICY_VERSION, types }),
  });
}

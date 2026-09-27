import { supabase } from "@/lib/supabase";
import { POLICY_VERSION, type ConsentStatus, type ConsentType } from "@/lib/consentUtils";

/** 현재 버전의 동의 행을 조회해 화면에서 사용하는 상태로 변환한다. */
export async function fetchConsentStatus(userId: string): Promise<ConsentStatus> {
  const { data, error } = await supabase
    .from("user_consents")
    .select("consent_type")
    .eq("user_id", userId)
    .eq("policy_version", POLICY_VERSION);

  if (error) throw error;
  const types = new Set((data ?? []).map((row: { consent_type: string }) => row.consent_type));
  return {
    policyVersion: POLICY_VERSION,
    ageOver14: types.has("age_over_14"),
    sensitiveHealth: types.has("sensitive_health"),
    photoAnalysis: types.has("photo_analysis"),
  };
}

/** 사용자 ID를 명시해 RLS 소유자 정책을 지키고, 중복 동의는 무시한다. */
export async function recordConsents(userId: string, types: ConsentType[]): Promise<ConsentStatus> {
  const rows = types.map((consentType) => ({
    user_id: userId,
    consent_type: consentType,
    policy_version: POLICY_VERSION,
  }));
  const { error } = await supabase
    .from("user_consents")
    .upsert(rows, { onConflict: "user_id,consent_type,policy_version", ignoreDuplicates: true });

  if (error) throw error;
  return fetchConsentStatus(userId);
}

import { apiRequest } from "@/lib/apiClient";
import { getToday } from "@/lib/medicationMapper";
import type { Medication, MedType } from "@/types";

type MedicationInput = {
  name: string;
  dosage: string;
  memo: string;
  times: string[];
  type: MedType;
  color: string;
  days: string[];
};

function toMedication(response: Medication): Medication {
  return { ...response, type: response.type as MedType };
}

/** Kotlin API에서 오늘의 약 목록을 조회한다. userId는 기존 함수 호환용이다. */
export async function fetchMedications(userId: string): Promise<Medication[]> {
  void userId;
  const response = await apiRequest<Medication[]>(`/api/v1/medications?date=${encodeURIComponent(getToday())}`);
  return response.map(toMedication);
}

/** Kotlin API에 약을 추가한다. userId는 JWT 인증과의 시그니처 호환용이다. */
export async function addMedication(userId: string, data: MedicationInput): Promise<Medication> {
  void userId;
  const response = await apiRequest<Medication>("/api/v1/medications", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return toMedication(response);
}

/** Kotlin API에서 약을 삭제한다. */
export async function deleteMedication(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/medications/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 오늘 복용 기록을 추가하거나 삭제한다. userId는 JWT 인증과의 시그니처 호환용이다. */
export async function toggleMedicationLog(id: string, userId: string, wasCompleted: boolean): Promise<void> {
  void userId;
  const date = getToday();
  const method = wasCompleted ? "DELETE" : "PUT";
  await apiRequest<void>(`/api/v1/medications/${encodeURIComponent(id)}/intakes/${date}`, { method });
}

/** 현재 사용자의 약과 복용 기록을 모두 삭제한다. */
export async function resetAllMedications(userId: string): Promise<void> {
  void userId;
  await apiRequest<void>("/api/v1/medications", { method: "DELETE" });
}

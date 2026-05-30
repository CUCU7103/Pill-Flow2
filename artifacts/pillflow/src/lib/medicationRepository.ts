import { supabase } from "@/lib/supabase";
import { toMedication, getToday } from "@/lib/medicationMapper";
import type { Medication, MedType } from "@/types";

/** 약 목록 + 오늘 복용 기록을 함께 조회하여 Medication 배열로 반환 */
export async function fetchMedications(userId: string): Promise<Medication[]> {
  const today = getToday();

  const [medsRes, logsRes] = await Promise.all([
    supabase.from("medications").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("medication_logs").select("medication_id").eq("date", today),
  ]);

  if (medsRes.error) throw medsRes.error;
  if (logsRes.error) throw logsRes.error;

  // 현재 유저의 약 id 목록
  const myMedIds = new Set((medsRes.data ?? []).map((r: { id: string }) => r.id));

  // 오늘 복용 완료된 약 중 현재 유저 소유의 것만 필터
  const completedIds = new Set(
    (logsRes.data ?? [])
      .map((l: { medication_id: string }) => l.medication_id)
      .filter((id) => myMedIds.has(id)),
  );

  return (medsRes.data ?? []).map((row) => toMedication(row, completedIds));
}

/** 새 약을 추가하고 추가된 Medication을 반환 */
export async function addMedication(
  userId: string,
  data: {
    name: string;
    dosage: string;
    memo: string;
    times: string[];
    type: MedType;
    color: string;
    days: string[];
  },
): Promise<Medication> {
  const { data: row, error: err } = await supabase
    .from("medications")
    .insert({
      user_id: userId,
      name: data.name,
      dosage: data.dosage,
      memo: data.memo,
      times: data.times,
      type: data.type,
      color: data.color,
      days: data.days,
    })
    .select()
    .single();

  if (err) throw err;
  return toMedication(row, new Set());
}

/** 약을 삭제 */
export async function deleteMedication(id: string): Promise<void> {
  const { error: err } = await supabase.from("medications").delete().eq("id", id);
  if (err) throw err;
}

/** 복용 상태를 토글 — 오늘 날짜 로그를 삽입하거나 삭제 */
export async function toggleMedicationLog(
  id: string,
  userId: string,
  wasCompleted: boolean,
): Promise<void> {
  const today = getToday();
  if (wasCompleted) {
    // 복용 취소 — 오늘 날짜 로그 삭제
    const { error: delErr } = await supabase
      .from("medication_logs")
      .delete()
      .eq("medication_id", id)
      .eq("date", today);
    if (delErr) throw delErr;
  } else {
    // 복용 완료 — 오늘 날짜 로그 삽입 (user_id 포함, 이미 존재하면 무시)
    const { error: insErr } = await supabase
      .from("medication_logs")
      .insert({ medication_id: id, date: today, user_id: userId });
    // 중복 키 오류(23505)는 이미 복용 완료된 것이므로 정상 처리
    if (insErr && insErr.code !== "23505") throw insErr;
  }
}

/** 현재 유저의 모든 복용 기록과 약 데이터를 삭제 */
export async function resetAllMedications(userId: string): Promise<void> {
  // 현재 유저의 약 id 목록 조회
  const { data: myMeds, error: fetchErr } = await supabase
    .from("medications")
    .select("id")
    .eq("user_id", userId);
  if (fetchErr) throw fetchErr;

  const myMedIds = (myMeds ?? []).map((m: { id: string }) => m.id);

  // 해당 약들의 복용 기록 삭제 (medication_logs → medications 순서)
  if (myMedIds.length > 0) {
    const { error: logsErr } = await supabase
      .from("medication_logs")
      .delete()
      .in("medication_id", myMedIds);
    if (logsErr) throw logsErr;
  }

  // 현재 유저의 약 삭제
  const { error: medsErr } = await supabase
    .from("medications")
    .delete()
    .eq("user_id", userId);
  if (medsErr) throw medsErr;
}

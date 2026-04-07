import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type ScheduleOptions } from "@capacitor/local-notifications";
import type { Medication } from "@/types";

/**
 * 복약 알림을 스케줄링하는 훅
 * - 네이티브 앱(Android/iOS)에서만 동작하며, 웹에서는 아무것도 하지 않음
 * - notif가 false이면 모든 알림을 취소
 * - meds 또는 notif가 변경될 때마다 알림을 재스케줄링
 */
export function useNotifications(meds: Medication[], notif: boolean) {
  useEffect(() => {
    // 웹 환경에서는 Local Notifications API 사용 불가
    if (!Capacitor.isNativePlatform()) return;

    if (notif) {
      scheduleNotifications(meds);
    } else {
      cancelAllNotifications();
    }
  }, [meds, notif]);
}

/** 알림 채널 생성 (Android 8.0+ 필수 - 채널 단위로 소리/진동 설정) */
async function ensureNotificationChannel() {
  // Android 전용 API이며, iOS/웹에서는 무시됨
  try {
    await LocalNotifications.createChannel({
      id: "pillflow-reminders",
      name: "복약 알림",
      description: "복약 시간을 알려주는 알림",
      importance: 5, // IMPORTANCE_HIGH: 상단 배너 + 소리
      sound: "default", // 기기 기본 알림음 사용
      vibration: true,
    });
  } catch {
    // 채널 생성 실패해도 알림 스케줄링은 계속 진행
  }
}

/** 모든 기존 알림을 취소하고 현재 약 목록으로 재스케줄링 */
async function scheduleNotifications(meds: Medication[]) {
  try {
    // 알림 권한 요청 (Android 13+ / iOS는 반드시 필요)
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== "granted") return;

    // Android 채널 생성 (소리/진동 포함)
    await ensureNotificationChannel();

    // 기존 알림을 모두 취소하고 새로 스케줄링 (중복 방지)
    await cancelAllNotifications();

    // 완료되지 않은 약에 대해서만 알림 스케줄링
    const pendingMeds = meds.filter((m) => !m.completed);
    if (pendingMeds.length === 0) return;

    const notifications: ScheduleOptions["notifications"] = pendingMeds.map((med, index) => {
      const [hour, minute] = parseTime(med.time);

      // 알림 시간 계산 - 오늘 해당 시각 (이미 지났으면 내일)
      const now = new Date();
      const scheduled = new Date();
      scheduled.setHours(hour, minute, 0, 0);
      if (scheduled <= now) {
        // 오늘 이미 지난 시간이면 내일 같은 시각으로 설정
        scheduled.setDate(scheduled.getDate() + 1);
      }

      return {
        // id는 양의 정수여야 하며 약 index 기반으로 고유하게 설정
        id: index + 1,
        title: "💊 복약 시간",
        body: `${med.name} ${med.dosage} 복용할 시간입니다`,
        schedule: {
          at: scheduled,
          // 매일 같은 시각 반복
          repeats: true,
          every: "day",
        },
        // Android: 채널에서 소리/진동을 제어하므로 여기선 채널 ID만 지정
        channelId: "pillflow-reminders",
        attachments: undefined,
        actionTypeId: "",
        extra: { medicationId: med.id },
      };
    });

    await LocalNotifications.schedule({ notifications });
  } catch (error) {
    // 알림 권한 거부나 API 오류는 앱 동작에 영향 없이 무시
    console.warn("[PillFlow] 알림 스케줄링 실패:", error);
  }
}

/** 모든 예약된 로컬 알림 취소 */
async function cancelAllNotifications() {
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length > 0) {
      await LocalNotifications.cancel({ notifications });
    }
  } catch (error) {
    console.warn("[PillFlow] 알림 취소 실패:", error);
  }
}

/**
 * "HH:MM" 형식의 시간 문자열을 [hour, minute] 숫자 배열로 파싱
 * 파싱 실패 시 기본값 [8, 0] (오전 8시) 반환
 */
function parseTime(time: string): [number, number] {
  const parts = time.split(":");
  const hour = parseInt(parts[0] ?? "8", 10);
  const minute = parseInt(parts[1] ?? "0", 10);

  if (isNaN(hour) || isNaN(minute)) return [8, 0];
  return [Math.max(0, Math.min(23, hour)), Math.max(0, Math.min(59, minute))];
}

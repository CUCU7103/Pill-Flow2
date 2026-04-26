import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications, type ScheduleOptions } from "@capacitor/local-notifications";
import { DAY_KEYS_SUN_FIRST } from "@/constants";
import type { Medication, NotifCategories } from "@/types";

// 채널 정책(사운드/중요도 등)이 바뀔 때마다 버전을 올려야 한다.
// Android NotificationChannel은 한 번 생성되면 불변이므로, ID를 바꿔야 새 설정이 기존 사용자에게 적용된다.
const CHANNEL_ID = "pillflow-reminders-v2";

/**
 * 복약 알림을 스케줄링하는 훅
 * - 네이티브 앱(Android/iOS)에서만 동작하며, 웹에서는 아무것도 하지 않음
 * - notif가 false이면 모든 알림을 취소
 * - meds 또는 notif가 변경될 때마다 알림을 재스케줄링
 */
export function useNotifications(
  meds: Medication[],
  notif: boolean,
  categories: NotifCategories
) {
  // 최신 meds/notif/categories를 ref에 유지 — 포그라운드 리스너 클로저에서 참조
  const stateRef = useRef({ meds, notif, categories });
  useEffect(() => {
    stateRef.current = { meds, notif, categories };
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (notif) {
      scheduleNotifications(meds, categories);
    } else {
      cancelAllNotifications();
    }
    // 객체 참조 대신 원시값으로 풀어서 불필요한 재실행 방지
  }, [meds, notif, categories.morning, categories.lunch, categories.evening]);

  useEffect(() => {
    // 웹 환경에서는 불필요
    if (!Capacitor.isNativePlatform()) return;

    // 앱이 포그라운드로 돌아올 때 특정 요일 약의 알림 재스케줄 (1회 예약이라 소진됐을 수 있음)
    const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      const { meds: m, notif: n, categories: c } = stateRef.current;
      if (n) scheduleNotifications(m, c);
    });

    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, []);
}

/** 알림 채널 생성 (Android 8.0+ 필수 - 채널 단위로 소리/진동 설정) */
async function ensureNotificationChannel() {
  // Android 전용 API이며, iOS/웹에서는 무시됨
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "복약 알림",
      description: "복약 시간을 알려주는 알림",
      importance: 5, // IMPORTANCE_HIGH: 상단 배너 + 소리
      // sound를 생략하면 Android가 시스템 기본 알림음(DEFAULT_NOTIFICATION_URI)을 사용한다.
      // "default" 문자열을 넣으면 플러그인이 R.raw.default 리소스로 해석해 무음이 된다.
      vibration: true,
    });
  } catch {
    // 채널 생성 실패해도 알림 스케줄링은 계속 진행
  }

  // 구 채널 제거 — Android 시스템 알림 설정 화면에 죽은 채널이 남지 않도록 정리
  try {
    await LocalNotifications.deleteChannel({ id: "pillflow-reminders" });
  } catch {
    // 채널이 없거나 이미 삭제된 경우 무시
  }
}

/** 모든 기존 알림을 취소하고 현재 약 목록으로 재스케줄링 */
async function scheduleNotifications(meds: Medication[], categories: NotifCategories) {
  try {
    // 알림 권한 요청 (Android 13+ / iOS는 반드시 필요)
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== "granted") return;

    // Android 채널 생성 (소리/진동 포함)
    await ensureNotificationChannel();

    // 기존 알림을 모두 취소하고 새로 스케줄링 (중복 방지)
    await cancelAllNotifications();

    // 활성화된 카테고리에 해당하는 약만 스케줄링 (완료 여부는 무시 — 내일도 다시 울려야 함)
    // days 배열에 해당 요일이 포함된 약만 스케줄링
    const activeMeds = meds.filter(
      (m) => categories[m.category] === true && m.days.length > 0
    );
    if (activeMeds.length === 0) return;

    const notifications = activeMeds
      .map((med, index) => {
        const [hour, minute] = parseTime(med.time);

        // 오늘부터 시작해서 해당 약의 요일(days)에 해당하는 가장 가까운 다음 날짜 계산
        const now = new Date();
        const scheduled = new Date();
        scheduled.setHours(hour, minute, 0, 0);

        // 오늘부터 최대 7일 내 가장 가까운 복용 요일 탐색 (DAY_KEYS_SUN_FIRST: 일=0)
        let daysToAdd: number | null = null;
        for (let i = 0; i < 8; i++) {
          const checkDate = new Date(scheduled);
          checkDate.setDate(scheduled.getDate() + i);
          const dayKey = DAY_KEYS_SUN_FIRST[checkDate.getDay()];
          if (dayKey && med.days.includes(dayKey)) {
            // 오늘이면 시간도 확인 (이미 지났으면 다음 해당 요일로)
            if (i === 0 && checkDate <= now) continue;
            daysToAdd = i;
            break;
          }
        }
        // 유효한 요일을 찾지 못하면 (잘못된 days 데이터) skip
        if (daysToAdd === null) return null;
        scheduled.setDate(scheduled.getDate() + daysToAdd);

        // 7일 모두 복용하는 약은 매일 반복, 특정 요일만이면 다음 해당 날에 1회 예약
        // (앱 포그라운드 진입 시 재스케줄링으로 연속성 보장)
        const isEveryDay = med.days.length === 7;

        return {
          // id는 양의 정수여야 하며 약 index 기반으로 고유하게 설정
          id: index + 1,
          title: "💊 복약 시간",
          body: `${med.name} ${med.dosage} 복용할 시간입니다`,
          schedule: isEveryDay
            ? { at: scheduled, repeats: true, every: "day" as const }
            : { at: scheduled },
          // Android: 채널에서 소리/진동을 제어하므로 여기선 채널 ID만 지정
          channelId: CHANNEL_ID,
          attachments: undefined,
          actionTypeId: "",
          extra: { medicationId: med.id },
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);

    if (notifications.length === 0) return;

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

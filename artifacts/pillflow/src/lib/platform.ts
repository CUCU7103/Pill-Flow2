/** Capacitor.getPlatform() 값("web" | "android" | "ios")을 화면 표시용 이름으로 바꾼다. */
export function platformLabel(platform: string): string {
  const labels: Record<string, string> = { web: "웹", android: "Android", ios: "iOS" };
  return labels[platform] ?? platform;
}

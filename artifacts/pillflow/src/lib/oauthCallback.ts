const NATIVE_CALLBACK_URL = "com.pillflow.app://callback";

type OAuthCallback = { code: string } | { error: true };

/** 정확한 네이티브 콜백 주소만 해석하고 URL로 전달된 세션 토큰은 거부한다. */
export function parseOAuthCallback(url: string): OAuthCallback | null {
  if (!url.startsWith(NATIVE_CALLBACK_URL)) return null;

  const suffix = url.slice(NATIVE_CALLBACK_URL.length);
  if (suffix && suffix[0] !== "?" && suffix[0] !== "#") return null;

  const hashIndex = suffix.indexOf("#");
  const query = suffix.startsWith("?")
    ? suffix.slice(1, hashIndex === -1 ? undefined : hashIndex)
    : "";
  const fragment = hashIndex === -1 ? "" : suffix.slice(hashIndex + 1);
  const sections = [new URLSearchParams(query), new URLSearchParams(fragment)];

  const hasToken = sections.some(params => [...params.keys()].some(key => {
    const normalizedKey = key.toLowerCase();
    return normalizedKey.startsWith("access_token") || normalizedKey.startsWith("refresh_token");
  }));
  if (hasToken) {
    return null;
  }
  if (sections.some(params => params.has("error") || params.has("error_description") || params.has("error_code"))) {
    return { error: true };
  }

  const codes = sections.flatMap(params => params.getAll("code"));
  if (codes.length !== 1 || !/^[A-Za-z0-9._~-]{1,512}$/.test(codes[0])) return null;
  return { code: codes[0] };
}

import { assertEquals } from "jsr:@std/assert@1";
import { readBodyWithLimit, toValidatedDataUrl } from "./validation.ts";

const toBase64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
const JPEG = toBase64([0xff, 0xd8, 0xff, 0xe0]);
const PNG = toBase64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = btoa("RIFF\0\0\0\0WEBPVP8 \0\0\0\0");

Deno.test("허용 형식의 data URL과 순수 JPEG base64를 통과시킨다", () => {
  assertEquals(toValidatedDataUrl(`data:image/jpeg;base64,${JPEG}`), `data:image/jpeg;base64,${JPEG}`);
  assertEquals(toValidatedDataUrl(`data:image/png;base64,${PNG}`), `data:image/png;base64,${PNG}`);
  assertEquals(toValidatedDataUrl(`data:image/webp;base64,${WEBP}`), `data:image/webp;base64,${WEBP}`);
  assertEquals(toValidatedDataUrl(JPEG), `data:image/jpeg;base64,${JPEG}`);
});

Deno.test("허용하지 않은 형식·잘못된 base64·시그니처 불일치를 거부한다", () => {
  for (const value of [
    undefined, null, 123, "",
    `data:image/gif;base64,${JPEG}`,
    `data:text/html;base64,${JPEG}`,
    `data:image/jpeg,${JPEG}`,
    `data:image/png;base64,${JPEG}`, // 선언과 실제 형식 불일치
    PNG, // 접두사 없는 값은 JPEG만 허용
    btoa("not an image at all"),
    `${JPEG}!`,
    JPEG.slice(1), // 길이가 4의 배수가 아님
  ]) {
    assertEquals(toValidatedDataUrl(value), null, String(value).slice(0, 40));
  }
});

const requestWith = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://local/", { method: "POST", body, headers });

Deno.test("상한 이하 본문은 그대로 읽는다", async () => {
  assertEquals(await readBodyWithLimit(requestWith('{"a":1}'), 100), { ok: true, text: '{"a":1}' });
});

Deno.test("Content-Length가 상한을 넘으면 읽기 전에 413", async () => {
  let pulled = false;
  const stream = new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 });
  const req = requestWith(stream, { "content-length": "1000" });
  assertEquals(await readBodyWithLimit(req, 100), { ok: false, status: 413 });
  assertEquals(pulled, false);
});

Deno.test("Content-Length 없이 스트림이 상한을 넘으면 즉시 중단하고 413", async () => {
  let chunksPulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunksPulled++;
      controller.enqueue(new Uint8Array(60));
    },
    cancel() { cancelled = true; },
  });
  assertEquals(await readBodyWithLimit(requestWith(stream), 100), { ok: false, status: 413 });
  assertEquals(cancelled, true);
  assertEquals(chunksPulled <= 3, true);
});

Deno.test("본문이 없거나 UTF-8이 아니면 400", async () => {
  assertEquals(await readBodyWithLimit(new Request("http://local/", { method: "POST" }), 100), { ok: false, status: 400 });
  assertEquals(await readBodyWithLimit(requestWith(new Uint8Array([0xff, 0xfe, 0xfd])), 100), { ok: false, status: 400 });
});

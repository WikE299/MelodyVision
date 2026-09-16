import assert from "node:assert/strict";
import test from "node:test";

import { getExternalMusicPlaybackUrl } from "../lib/audio/external-music.ts";
import {
  createAudioProxyResponse,
  getUpstreamAudioHeaders,
} from "../lib/audio/jamendo-audio-proxy.ts";

test("external music playback uses a stable same-origin URL", () => {
  assert.equal(
    getExternalMusicPlaybackUrl("track id/1"),
    "/api/music/download?id=track%20id%2F1"
  );
});

test("music download streams audio and forwards range requests", async () => {
  const request = new Request("http://localhost/audio", { headers: { Range: "bytes=0-3" } });
  assert.equal(getUpstreamAudioHeaders(request).get("range"), "bytes=0-3");

  const upstream = new Response(new Uint8Array([1, 2, 3, 4]), {
    status: 206,
    headers: {
      "content-type": "audio/mpeg",
      "content-length": "4",
      "content-range": "bytes 0-3/2533888",
      "accept-ranges": "bytes",
    },
  });
  const response = createAudioProxyResponse(upstream, "Test track");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 0-3/2533888");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("vary"), "Range");
  assert.match(response.headers.get("cache-control") || "", /s-maxage=86400/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4]);
});

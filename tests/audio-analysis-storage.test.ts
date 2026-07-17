import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  isManagedAudioStoragePath,
  validateAudioUploadTicketRequest,
} from "../lib/storage/audio-analysis.ts";

test("audio upload metadata accepts supported files within the 20 MB limit", () => {
  assert.deepEqual(
    validateAudioUploadTicketRequest({
      fileName: "listening-sample.ogg",
      mimeType: "audio/ogg",
      byteSize: MAX_AUDIO_UPLOAD_BYTES,
    }),
    {
      fileName: "listening-sample.ogg",
      mimeType: "audio/ogg",
      byteSize: MAX_AUDIO_UPLOAD_BYTES,
      extension: "ogg",
    }
  );
});

test("audio upload metadata rejects oversized and unsupported files", () => {
  assert.throws(
    () =>
      validateAudioUploadTicketRequest({
        fileName: "too-large.mp3",
        mimeType: "audio/mpeg",
        byteSize: MAX_AUDIO_UPLOAD_BYTES + 1,
      }),
    /20 MB/
  );
  assert.throws(
    () =>
      validateAudioUploadTicketRequest({
        fileName: "notes.txt",
        mimeType: "application/octet-stream",
        byteSize: 100,
      }),
    /extension/
  );
});

test("audio cleanup only accepts server-generated incoming object paths", () => {
  assert.equal(
    isManagedAudioStoragePath(
      "incoming/2026-07-17/7ca268a0-4704-4cb0-85c2-2715bc4be149.mp3"
    ),
    true
  );
  assert.equal(isManagedAudioStoragePath("../generated/private.mp3"), false);
  assert.equal(isManagedAudioStoragePath("incoming/2026-07-17/not-a-uuid.mp3"), false);
});

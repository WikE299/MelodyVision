import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchThumbnailUrl,
  isAllowedResearchImageUrl,
} from "../lib/research-thumbnail.ts";

test("research thumbnails allow public Supabase storage objects", () => {
  assert.equal(isAllowedResearchImageUrl(
    "https://project.supabase.co/storage/v1/object/public/generated/artworks/example.png"
  ), true);
});

test("research thumbnails reject arbitrary and private URLs", () => {
  assert.equal(isAllowedResearchImageUrl("http://127.0.0.1/private.png"), false);
  assert.equal(isAllowedResearchImageUrl("https://project.supabase.co/auth/v1/settings"), false);
  assert.equal(isAllowedResearchImageUrl("not-a-url"), false);
});

test("research thumbnails accept explicitly configured HTTPS hosts", () => {
  assert.equal(isAllowedResearchImageUrl(
    "https://images.example.org/artwork.png",
    "images.example.org,cdn.example.org"
  ), true);
});

test("research dashboard uses the Supabase image rendering endpoint", () => {
  const result = buildResearchThumbnailUrl(
    "https://project.supabase.co/storage/v1/object/public/generated/artworks/example.png"
  );
  assert.match(result, /\/storage\/v1\/render\/image\/public\//);
  assert.match(result, /width=720/);
  assert.match(result, /quality=60/);
});

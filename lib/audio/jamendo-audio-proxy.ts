export function safeAudioFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "jamendo-track";
}

export function getUpstreamAudioHeaders(request: Request): Headers {
  const headers = new Headers({ Accept: "audio/mpeg,audio/*" });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  return headers;
}

export function createAudioProxyResponse(upstream: Response, filename: string): Response {
  const responseHeaders = new Headers({
    "Content-Type": upstream.headers.get("content-type")?.startsWith("audio/")
      ? upstream.headers.get("content-type")!
      : "audio/mpeg",
    "Content-Disposition": `inline; filename="${safeAudioFilename(filename)}.mp3"`,
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    Vary: "Range",
  });
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

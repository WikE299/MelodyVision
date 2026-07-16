import { timingSafeEqual } from "node:crypto";

export type ExportAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function authorizeExperimentExport(
  headers: Headers,
  configuredToken = process.env.EXPERIMENT_EXPORT_TOKEN?.trim() || ""
): ExportAuthorization {
  if (!configuredToken) {
    return { ok: false, status: 503, error: "Experiment export is not configured" };
  }
  const authorization = headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const suppliedToken = bearerToken || headers.get("x-export-token")?.trim() || "";
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

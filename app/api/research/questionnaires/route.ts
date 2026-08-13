import { isLocalResearchRequest } from "@/lib/research-access";
import {
  buildResearchQuestionnaireWorkbook,
  type QuestionnaireWorkbookDataset,
} from "@/lib/research-questionnaire-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuestionnaireExportRequest {
  dataset?: QuestionnaireWorkbookDataset;
  trialIds?: string[];
  studySessionIds?: string[];
}

export async function POST(request: Request) {
  if (!isLocalResearchRequest(request.headers)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: QuestionnaireExportRequest;
  try {
    body = await request.json() as QuestionnaireExportRequest;
  } catch {
    return Response.json({ error: "请求数据不是有效 JSON" }, { status: 400 });
  }
  if (
    !body.dataset?.source
    || !Array.isArray(body.dataset.trials)
    || !Array.isArray(body.dataset.studySessions)
  ) {
    return Response.json({ error: "缺少研究数据集" }, { status: 400 });
  }
  if (JSON.stringify(body.dataset).length > 12_000_000) {
    return Response.json({ error: "筛选后的问卷数据过大，请缩小筛选范围后重试" }, { status: 413 });
  }

  try {
    const { buffer } = await buildResearchQuestionnaireWorkbook(body.dataset, {
      trialIds: body.trialIds,
      studySessionIds: body.studySessionIds,
    });
    const date = body.dataset.source.capturedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="melodyvision-questionnaires-${date}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[research-questionnaires] export failed", error);
    return Response.json({ error: "生成问卷 Excel 失败" }, { status: 500 });
  }
}

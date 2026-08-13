import ExcelJS from "exceljs";
import {
  getQuestionnaireDefinitions,
  type QuestionnaireDefinition,
  type QuestionnaireInstrument,
  type QuestionnaireQuestion,
} from "./questionnaires/index.ts";

type RawRecord = Record<string, unknown>;

const INSTRUMENT_ORDER: QuestionnaireInstrument[] = [
  "background",
  "image_alignment",
  "csi",
  "agency_ownership",
  "sus",
  "raw_tlx",
  "manipulation_check",
  "session_preference",
  "csi_weighting",
];

const SHEET_NAMES: Record<QuestionnaireInstrument, string> = {
  background: "背景信息",
  image_alignment: "图像契合度",
  csi: "CSI创作体验",
  agency_ownership: "主体感与所有权",
  sus: "SUS可用性",
  raw_tlx: "Raw TLX负荷",
  manipulation_check: "交互检验",
  session_preference: "总体偏好",
  csi_weighting: "CSI权重",
};

type QuestionnaireWorkbookCondition = "multi_agent" | "single_agent" | "unknown";

const CONDITION_LABELS: Record<QuestionnaireWorkbookCondition, string> = {
  multi_agent: "音乐家共同聆听",
  single_agent: "单一共创引导",
  unknown: "跨体验／未记录",
};

const GENERATION_ROLE_LABELS: Record<string, string> = {
  co_created: "共创作品",
  direct_baseline: "音乐直出作品",
};

export interface QuestionnaireWorkbookFilter {
  trialIds?: string[];
  studySessionIds?: string[];
}

export interface QuestionnaireWorkbookTrial {
  id: string;
  dataOrigins?: string[];
  participantId: string;
  studySessionId: string;
  period: number | null;
  condition: QuestionnaireWorkbookCondition;
  protocolVersion?: string;
  status?: string;
  stimulusId?: string;
  musicTitle: string;
  questionnaireResponses: RawRecord[];
  artworkEvaluation?: RawRecord | null;
  comparison?: {
    musicMatchChoice?: string | null;
    imaginationMatchChoice?: string | null;
    overallChoice?: string | null;
    reason?: string;
  } | null;
}

interface QuestionnaireWorkbookSessionTrial {
  id: string;
  condition: QuestionnaireWorkbookCondition;
  musicTitle: string;
  stimulusId?: string;
}

export interface QuestionnaireWorkbookStudySession {
  id: string;
  dataOrigins?: string[];
  participantId: string;
  protocolVersion?: string;
  sequence?: string;
  status?: string;
  complete?: boolean;
  firstSelectedAudio?: RawRecord | null;
  secondSelectedAudio?: RawRecord | null;
  firstTrial?: QuestionnaireWorkbookSessionTrial | null;
  secondTrial?: QuestionnaireWorkbookSessionTrial | null;
  questionnaireResponses: RawRecord[];
}

export interface QuestionnaireWorkbookDataset {
  source: {
    capturedAt: string;
  };
  trials: QuestionnaireWorkbookTrial[];
  studySessions: QuestionnaireWorkbookStudySession[];
}

export interface QuestionnaireWorkbookSheetSummary {
  instrument: QuestionnaireInstrument;
  sheetName: string;
  responseCount: number;
  questionCount: number;
}

export interface QuestionnaireWorkbookSummary {
  participantCount: number;
  responseCount: number;
  sheets: QuestionnaireWorkbookSheetSummary[];
}

interface QuestionnaireExportRow {
  response: RawRecord;
  trial: QuestionnaireWorkbookTrial | null;
  session: QuestionnaireWorkbookStudySession | null;
}

interface ColumnDefinition {
  header: string;
  key: string;
  width: number;
}

const PALETTE = {
  navy: "202536",
  gold: "C89342",
  white: "FFFFFF",
  border: "D7DBE3",
  pale: "F6F7F9",
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function recordValue(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RawRecord
    : {};
}

function safeSpreadsheetValue(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  return /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
}

function responseInstrument(response: RawRecord): QuestionnaireInstrument | null {
  const instrument = text(response.instrument);
  return INSTRUMENT_ORDER.includes(instrument as QuestionnaireInstrument)
    ? instrument as QuestionnaireInstrument
    : null;
}

function questionScale(question: QuestionnaireQuestion): string {
  if (question.kind === "scale" || question.kind === "number") {
    return `${question.min}–${question.max}`;
  }
  if (question.kind === "choice") {
    return question.options.map((option) => `${option.value}=${option.label}`).join("；");
  }
  if (question.kind === "pair") {
    return `${question.left.value}=${question.left.label}；${question.right.value}=${question.right.label}`;
  }
  return "文本";
}

function sessionMusic(
  session: QuestionnaireWorkbookStudySession | null,
  period: number | null
): string {
  if (!session || period === null) return "";
  const selected = period === 1 ? session.firstSelectedAudio : session.secondSelectedAudio;
  return text(selected?.name) || text(selected?.title);
}

function sessionTrial(
  session: QuestionnaireWorkbookStudySession | null,
  period: number
): QuestionnaireWorkbookSessionTrial | null {
  if (!session) return null;
  return period === 1 ? session.firstTrial || null : session.secondTrial || null;
}

function collectRows(
  dataset: QuestionnaireWorkbookDataset,
  filter: QuestionnaireWorkbookFilter
): QuestionnaireExportRow[] {
  const selectedTrialIds = new Set(filter.trialIds || dataset.trials.map((trial) => trial.id));
  const selectedStudySessionIds = new Set(filter.studySessionIds || [
    ...dataset.studySessions.map((session) => session.id),
    ...dataset.trials
      .filter((trial) => selectedTrialIds.has(trial.id))
      .map((trial) => trial.studySessionId)
      .filter(Boolean),
  ]);
  const trialMap = new Map(dataset.trials.map((trial) => [trial.id, trial]));
  const sessionMap = new Map(dataset.studySessions.map((session) => [session.id, session]));
  const rows = new Map<string, QuestionnaireExportRow>();

  const addResponse = (
    response: RawRecord,
    fallbackTrial: QuestionnaireWorkbookTrial | null,
    fallbackSession: QuestionnaireWorkbookStudySession | null
  ) => {
    const trialId = text(response.trial_id) || fallbackTrial?.id || "";
    const studySessionId = text(response.study_session_id) || fallbackSession?.id || fallbackTrial?.studySessionId || "";
    if (trialId && !selectedTrialIds.has(trialId)) return;
    if (!trialId && studySessionId && !selectedStudySessionIds.has(studySessionId)) return;
    const trial = trialMap.get(trialId) || fallbackTrial;
    const session = sessionMap.get(studySessionId) || fallbackSession;
    const id = text(response.id) || `${studySessionId}:${text(response.response_key)}`;
    if (!rows.has(id)) rows.set(id, { response, trial, session });
  };

  for (const trial of dataset.trials) {
    if (!selectedTrialIds.has(trial.id)) continue;
    for (const response of trial.questionnaireResponses) addResponse(response, trial, null);
  }
  for (const session of dataset.studySessions) {
    if (!selectedStudySessionIds.has(session.id)) continue;
    for (const response of session.questionnaireResponses) addResponse(response, null, session);
  }

  return [...rows.values()].sort((left, right) => (
    text(left.response.completed_at).localeCompare(text(right.response.completed_at))
  ));
}

function metadataColumns(instrument: QuestionnaireInstrument): ColumnDefinition[] {
  const sessionScoped = instrument === "background"
    || instrument === "session_preference"
    || instrument === "csi_weighting";
  const columns: ColumnDefinition[] = [
    { header: "实验者编号", key: "participant_id", width: 16 },
    { header: "实验会话ID", key: "study_session_id", width: 38 },
    { header: "数据来源", key: "data_origins", width: 18 },
    { header: "实验版本", key: "protocol_version", width: 34 },
    { header: "路径顺序", key: "session_sequence", width: 28 },
    { header: "会话状态", key: "session_status", width: 14 },
    { header: "会话完整", key: "session_complete", width: 12 },
  ];
  if (sessionScoped) {
    columns.push(
      { header: "体验一条件", key: "period_1_condition", width: 18 },
      { header: "体验一音乐", key: "period_1_music", width: 30 },
      { header: "体验一刺激ID", key: "period_1_stimulus_id", width: 24 },
      { header: "体验二条件", key: "period_2_condition", width: 18 },
      { header: "体验二音乐", key: "period_2_music", width: 30 },
      { header: "体验二刺激ID", key: "period_2_stimulus_id", width: 24 },
    );
  } else {
    columns.push(
      { header: "体验轮次", key: "period", width: 10 },
      { header: "路径条件", key: "condition", width: 18 },
      { header: "路径名称", key: "condition_label", width: 22 },
      { header: "音乐", key: "music_title", width: 34 },
      { header: "刺激ID", key: "stimulus_id", width: 24 },
      { header: "Trial ID", key: "trial_id", width: 38 },
      { header: "Trial状态", key: "trial_status", width: 14 },
    );
  }
  if (instrument === "image_alignment") {
    columns.push(
      { header: "作品类型", key: "generation_role", width: 20 },
      { header: "作品类型名称", key: "generation_role_label", width: 20 },
      { header: "生成Run ID", key: "run_id", width: 38 },
    );
  }
  columns.push(
    { header: "回答ID", key: "response_id", width: 38 },
    { header: "回答唯一键", key: "response_key", width: 38 },
    { header: "问卷版本", key: "questionnaire_version", width: 24 },
    { header: "回答状态", key: "status", width: 12 },
    { header: "提交时间", key: "completed_at", width: 22 },
  );
  return columns;
}

function scoreColumns(definition: QuestionnaireDefinition): ColumnDefinition[] {
  if (definition.instrument === "csi") {
    return [
      { header: "享受_均值", key: "metric_enjoyment_mean", width: 14 },
      { header: "探索_均值", key: "metric_exploration_mean", width: 14 },
      { header: "表达_均值", key: "metric_expressiveness_mean", width: 14 },
      { header: "沉浸_均值", key: "metric_immersion_mean", width: 14 },
      { header: "投入回报_均值", key: "metric_results_worth_effort_mean", width: 16 },
      { header: "CSI加权总分", key: "score_total", width: 16 },
    ];
  }
  if (["sus", "raw_tlx", "image_alignment"].includes(definition.instrument)) {
    return [{ header: "总分／均值", key: "score_total", width: 16 }];
  }
  if (definition.instrument === "csi_weighting") {
    return ["enjoyment", "exploration", "expressiveness", "immersion", "results_worth_effort"]
      .map((key) => ({ header: `${key}_权重`, key: `metric_${key}`, width: 18 }));
  }
  if (definition.instrument === "session_preference") {
    return [{ header: "偏好路径条件", key: "preferred_condition", width: 18 }];
  }
  return [];
}

function responseRow(
  row: QuestionnaireExportRow,
  definition: QuestionnaireDefinition
): Record<string, unknown> {
  const response = row.response;
  const answers = recordValue(response.answers);
  const metrics = recordValue(response.metrics);
  const period = numberOrNull(response.period) ?? row.trial?.period ?? null;
  const condition = (text(response.condition) || row.trial?.condition || "unknown") as QuestionnaireWorkbookCondition;
  const studySessionId = text(response.study_session_id) || row.session?.id || row.trial?.studySessionId || "";
  const session = row.session;
  const firstTrial = sessionTrial(session, 1);
  const secondTrial = sessionTrial(session, 2);
  const preference = text(answers.SESSION_PREFERENCE);
  const preferredCondition = preference === "period_1"
    ? firstTrial?.condition || "unknown"
    : preference === "period_2"
      ? secondTrial?.condition || "unknown"
      : preference === "tie"
        ? "tie"
        : "";
  const result: Record<string, unknown> = {
    participant_id: text(response.participant_id) || row.trial?.participantId || session?.participantId || "",
    study_session_id: studySessionId,
    data_origins: (row.trial?.dataOrigins || session?.dataOrigins || []).join(" | "),
    protocol_version: row.trial?.protocolVersion || session?.protocolVersion || "",
    session_sequence: session?.sequence || "",
    session_status: session?.status || "",
    session_complete: session?.complete ?? null,
    period_1_condition: firstTrial?.condition || "",
    period_1_music: firstTrial?.musicTitle || sessionMusic(session, 1),
    period_1_stimulus_id: firstTrial?.stimulusId || "",
    period_2_condition: secondTrial?.condition || "",
    period_2_music: secondTrial?.musicTitle || sessionMusic(session, 2),
    period_2_stimulus_id: secondTrial?.stimulusId || "",
    period,
    condition,
    condition_label: CONDITION_LABELS[condition] || condition,
    music_title: row.trial?.musicTitle || sessionMusic(session, period),
    stimulus_id: row.trial?.stimulusId || "",
    trial_id: text(response.trial_id) || row.trial?.id || "",
    trial_status: row.trial?.status || "",
    generation_role: text(response.generation_role),
    generation_role_label: GENERATION_ROLE_LABELS[text(response.generation_role)] || "",
    run_id: text(response.run_id),
    response_id: text(response.id),
    response_key: text(response.response_key),
    questionnaire_version: text(response.questionnaire_version),
    status: text(response.status),
    completed_at: text(response.completed_at),
    score_total: numberOrNull(response.score_total),
    preferred_condition: preferredCondition,
  };
  for (const question of definition.questions) result[question.id] = answers[question.id];
  for (const [key, value] of Object.entries(metrics)) result[`metric_${key}`] = value;
  return result;
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(worksheet.columnCount, 1) },
  };
  const header = worksheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: PALETTE.white } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.navy } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "medium", color: { argb: PALETTE.gold } } };
  });
  for (let index = 2; index <= worksheet.rowCount; index += 1) {
    const row = worksheet.getRow(index);
    row.alignment = { vertical: "top" };
    if (index % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.pale } };
    }
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: PALETTE.border } } };
    });
  }
}

function addDictionarySheet(workbook: ExcelJS.Workbook, definitions: QuestionnaireDefinition[]) {
  const worksheet = workbook.addWorksheet("字段说明", { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = [
    { header: "Sheet", key: "sheet", width: 20 },
    { header: "问卷模块", key: "instrument_title", width: 24 },
    { header: "题目ID", key: "item_id", width: 44 },
    { header: "中文题目", key: "prompt", width: 72 },
    { header: "类型", key: "kind", width: 14 },
    { header: "量尺／编码", key: "scale", width: 60 },
    { header: "必答", key: "required", width: 10 },
  ];
  const metadataItems = [
    ["全部量表", "关联字段", "participant_id", "匿名实验者编号", "metadata", "同一被试跨路径配对键", "是"],
    ["全部量表", "关联字段", "study_session_id", "一次完整实验会话ID", "metadata", "同一被试重复参加时用于区分会话", "是"],
    ["全部量表", "关联字段", "response_id", "单次问卷回答ID", "metadata", "回答去重键", "是"],
    ["全部量表", "关联字段", "response_key", "问卷步骤唯一键", "metadata", "同一会话内识别问卷模块和轮次", "是"],
    ["全部量表", "关联字段", "session_sequence", "两条路径的实验顺序", "metadata", "用于检查并控制顺序效应", "是"],
    ["全部量表", "关联字段", "session_complete", "完整走完两次体验及问卷", "metadata", "TRUE=可纳入完整配对主分析", "是"],
    ["路径量表", "关联字段", "period", "体验轮次", "metadata", "1=体验一；2=体验二", "是"],
    ["路径量表", "关联字段", "condition", "真实实验条件", "metadata", "multi_agent／single_agent", "是"],
    ["路径量表", "关联字段", "stimulus_id", "音乐刺激唯一ID", "metadata", "用于检查音乐分配和刺激效应", "是"],
    ["路径量表", "关联字段", "trial_id", "单次路径体验ID", "metadata", "连接过程、作品和问卷", "是"],
    ["图像契合度", "关联字段", "generation_role", "被评价作品类型", "metadata", "co_created／direct_baseline", "是"],
    ["计分量表", "派生分数", "score_total", "系统按量表规则计算的分数", "derived", "缺失保持空白，不按0分处理", "否"],
    ["总体偏好", "派生字段", "preferred_condition", "体验偏好映射后的真实路径", "derived", "multi_agent／single_agent／tie", "否"],
  ];
  for (const item of metadataItems) worksheet.addRow(item);
  for (const definition of definitions) {
    for (const question of definition.questions) {
      worksheet.addRow({
        sheet: SHEET_NAMES[definition.instrument],
        instrument_title: definition.title,
        item_id: question.id,
        prompt: question.prompt,
        kind: question.kind,
        scale: questionScale(question),
        required: question.required ? "是" : "否",
      });
    }
  }
  const legacyResultItems = [
    ["历史-结果页反馈", "历史协议结果页反馈", "music_match_score", "作品与音乐的匹配程度", "scale", "1–5", "是"],
    ["历史-结果页反馈", "历史协议结果页反馈", "imagination_match_score", "作品与个人想象的匹配程度", "scale", "1–5", "是"],
    ["历史-结果页反馈", "历史协议结果页反馈", "agency_score", "创作过程中的主体感", "scale", "1–5", "是"],
    ["历史-结果页反馈", "历史协议结果页反馈", "ownership_score", "对作品的所有权感", "scale", "1–5", "是"],
    ["历史-结果页反馈", "历史协议结果页反馈", "immersion_score", "体验过程的沉浸感", "scale", "1–5", "是"],
    ["历史-结果页反馈", "历史协议结果页反馈", "satisfaction_score", "对最终作品的满意程度", "scale", "1–5", "是"],
    ["历史-作品强制比较", "历史协议作品比较", "music_match_choice", "哪幅作品更符合音乐", "choice", "co_created／direct_baseline／tie", "是"],
    ["历史-作品强制比较", "历史协议作品比较", "imagination_match_choice", "哪幅作品更符合个人想象", "choice", "co_created／direct_baseline／tie", "是"],
    ["历史-作品强制比较", "历史协议作品比较", "overall_choice", "总体更偏好哪幅作品", "choice", "co_created／direct_baseline／tie", "是"],
    ["历史-作品强制比较", "历史协议作品比较", "reason", "选择理由", "text", "文本", "否"],
  ];
  for (const item of legacyResultItems) worksheet.addRow(item);
  worksheet.getColumn("prompt").alignment = { wrapText: true, vertical: "top" };
  worksheet.getColumn("scale").alignment = { wrapText: true, vertical: "top" };
  styleWorksheet(worksheet);
}

function addResultFeedbackSheets(
  workbook: ExcelJS.Workbook,
  trials: QuestionnaireWorkbookTrial[],
  studySessions: QuestionnaireWorkbookStudySession[]
) {
  const sessionMap = new Map(studySessions.map((session) => [session.id, session]));
  const metadata = [
    { header: "实验者编号", key: "participant_id", width: 16 },
    { header: "实验会话ID", key: "study_session_id", width: 38 },
    { header: "数据来源", key: "data_origins", width: 18 },
    { header: "实验版本", key: "protocol_version", width: 34 },
    { header: "路径顺序", key: "session_sequence", width: 28 },
    { header: "会话状态", key: "session_status", width: 14 },
    { header: "会话完整", key: "session_complete", width: 12 },
    { header: "体验轮次", key: "period", width: 10 },
    { header: "路径条件", key: "condition", width: 18 },
    { header: "路径名称", key: "condition_label", width: 22 },
    { header: "音乐", key: "music_title", width: 34 },
    { header: "刺激ID", key: "stimulus_id", width: 24 },
    { header: "Trial ID", key: "trial_id", width: 38 },
    { header: "Trial状态", key: "trial_status", width: 14 },
  ];
  const baseRow = (trial: QuestionnaireWorkbookTrial) => {
    const session = sessionMap.get(trial.studySessionId);
    return {
      participant_id: safeSpreadsheetValue(trial.participantId),
      study_session_id: trial.studySessionId,
      data_origins: (trial.dataOrigins || []).join(" | "),
      protocol_version: trial.protocolVersion || "",
      session_sequence: session?.sequence || "",
      session_status: session?.status || "",
      session_complete: session?.complete ?? null,
      period: trial.period,
      condition: trial.condition,
      condition_label: CONDITION_LABELS[trial.condition],
      music_title: trial.musicTitle,
      stimulus_id: trial.stimulusId || "",
      trial_id: trial.id,
      trial_status: trial.status || "",
    };
  };

  const evaluationSheet = workbook.addWorksheet("历史-结果页反馈");
  evaluationSheet.columns = [
    ...metadata,
    { header: "音乐匹配", key: "music_match_score", width: 14 },
    { header: "想象匹配", key: "imagination_match_score", width: 14 },
    { header: "主体感", key: "agency_score", width: 12 },
    { header: "所有权感", key: "ownership_score", width: 14 },
    { header: "沉浸感", key: "immersion_score", width: 12 },
    { header: "满意度", key: "satisfaction_score", width: 12 },
  ];
  for (const trial of trials.filter((item) => item.artworkEvaluation)) {
    evaluationSheet.addRow({
      ...baseRow(trial),
      ...trial.artworkEvaluation,
    });
  }
  styleWorksheet(evaluationSheet);

  const comparisonSheet = workbook.addWorksheet("历史-作品强制比较");
  comparisonSheet.columns = [
    ...metadata,
    { header: "音乐匹配选择", key: "music_match_choice", width: 20 },
    { header: "想象匹配选择", key: "imagination_match_choice", width: 22 },
    { header: "总体选择", key: "overall_choice", width: 18 },
    { header: "选择理由", key: "reason", width: 60 },
  ];
  for (const trial of trials.filter((item) => item.comparison)) {
    comparisonSheet.addRow({
      ...baseRow(trial),
      music_match_choice: trial.comparison?.musicMatchChoice || "",
      imagination_match_choice: trial.comparison?.imaginationMatchChoice || "",
      overall_choice: trial.comparison?.overallChoice || "",
      reason: safeSpreadsheetValue(trial.comparison?.reason || ""),
    });
  }
  comparisonSheet.getColumn("reason").alignment = { wrapText: true, vertical: "top" };
  styleWorksheet(comparisonSheet);
}

export async function buildResearchQuestionnaireWorkbook(
  dataset: QuestionnaireWorkbookDataset,
  filter: QuestionnaireWorkbookFilter = {}
): Promise<{ buffer: Buffer; summary: QuestionnaireWorkbookSummary }> {
  const rows = collectRows(dataset, filter);
  const definitions = getQuestionnaireDefinitions("zh");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MelodyVision Research Dashboard";
  workbook.created = new Date(dataset.source.capturedAt);
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const summarySheets: QuestionnaireWorkbookSheetSummary[] = [];
  for (const instrument of INSTRUMENT_ORDER) {
    const definition = definitions.find((item) => item.instrument === instrument);
    if (!definition) continue;
    const worksheet = workbook.addWorksheet(SHEET_NAMES[instrument]);
    const columns = [
      ...metadataColumns(instrument),
      ...definition.questions.map((question) => ({
        header: question.id,
        key: question.id,
        width: Math.min(Math.max(question.id.length + 2, 14), 44),
      })),
      ...scoreColumns(definition),
    ];
    worksheet.columns = columns;
    definition.questions.forEach((question, index) => {
      const questionColumn = metadataColumns(instrument).length + index + 1;
      worksheet.getCell(1, questionColumn).note = `${question.prompt}\n量尺／编码：${questionScale(question)}`;
    });
    const instrumentRows = rows.filter((row) => responseInstrument(row.response) === instrument);
    for (const row of instrumentRows) {
      const values = responseRow(row, definition);
      worksheet.addRow(Object.fromEntries(
        columns.map((column) => [column.key, safeSpreadsheetValue(values[column.key])])
      ));
    }
    const completedColumn = worksheet.getColumn("completed_at");
    completedColumn.numFmt = "yyyy-mm-dd hh:mm:ss";
    styleWorksheet(worksheet);
    summarySheets.push({
      instrument,
      sheetName: SHEET_NAMES[instrument],
      responseCount: instrumentRows.length,
      questionCount: definition.questions.length,
    });
  }
  const selectedTrialIds = new Set(filter.trialIds || dataset.trials.map((trial) => trial.id));
  addResultFeedbackSheets(
    workbook,
    dataset.trials.filter((trial) => selectedTrialIds.has(trial.id)),
    dataset.studySessions
  );
  addDictionarySheet(workbook, definitions);

  const participantCount = new Set(rows.map((row) => (
    text(row.response.participant_id) || row.trial?.participantId || row.session?.participantId || ""
  )).filter(Boolean)).size;
  const rawBuffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(rawBuffer),
    summary: {
      participantCount,
      responseCount: rows.length,
      sheets: summarySheets,
    },
  };
}

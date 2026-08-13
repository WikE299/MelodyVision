import assert from "node:assert/strict";
import test from "node:test";
import { CURRENT_STUDY_PROTOCOL_VERSION } from "../lib/contracts/study-trial.ts";

import {
  buildResearchDashboardDataset,
  exportResearchQuestionnaireItemsCsvFromDataset,
  exportResearchStudySessionsCsv,
  exportResearchTrialsCsv,
  mergeResearchDashboardDatasets,
  summarizeResearchTrials,
} from "../lib/research-dashboard.ts";
import {
  buildResearchQuestionnaireWorkbook,
  type QuestionnaireWorkbookDataset,
} from "../lib/research-questionnaire-workbook.ts";
import {
  getQuestionnaireDefinition,
  scoreCsiWithWeights,
  scoreQuestionnaire,
  type QuestionnaireAnswers,
  type QuestionnaireInstrument,
} from "../lib/questionnaires/index.ts";
import ExcelJS from "exceljs";

function fixture() {
  return {
    schemaVersion: 6,
    exportedAt: "2026-07-18T00:00:00.000Z",
    sessions: [],
    studySessions: [
      {
        id: "study-current",
        participant_id: "=unsafe",
        protocol_version: CURRENT_STUDY_PROTOCOL_VERSION,
        sequence: "single_x_then_multi_y",
        status: "period_1",
        current_period: 1,
        selected_musician_ids: ["beethoven"],
        created_at: "2026-07-18T00:00:00.000Z",
        completed_at: null,
      },
    ],
    studyAssignmentBlocks: [],
    sessionComparisons: [],
    audioAnalyses: [
      {
        id: "audio-current",
        trial_id: "trial-current",
        session_id: "session-current",
        created_at: "2026-07-18T00:00:01.000Z",
        mode: "rich",
        source_kind: "preset",
        file_name: "current.mp3",
        music_profile: {
          id: "music-current",
          audio: { name: "Current Song", sourceKind: "preset" },
        },
      },
      {
        id: "audio-legacy",
        trial_id: "trial-legacy",
        session_id: "session-legacy",
        created_at: "2026-07-17T00:00:01.000Z",
        mode: "rich",
        source_kind: "upload",
        file_name: "legacy.mp3",
        music_profile: {
          id: "music-legacy",
          audio: { name: "Legacy Song", sourceKind: "upload" },
        },
      },
    ],
    conversationSnapshots: [],
    visualBriefVersions: [],
    interactionEvents: [] as Array<Record<string, unknown>>,
    runs: [
      {
        id: "co-current",
        trial_id: "trial-current",
        session_id: "session-current",
        generation_role: "co_created",
        created_at: "2026-07-18T00:01:00.000Z",
        image_url: "/generated/co.png",
        timings: { totalMs: 1000 },
      },
      {
        id: "base-current",
        trial_id: "trial-current",
        session_id: "session-current",
        generation_role: "direct_baseline",
        created_at: "2026-07-18T00:01:01.000Z",
        image_url: "/generated/base.png",
        timings: { totalMs: 2000 },
      },
    ],
    feedback: [],
    trials: [
      {
        id: "trial-current",
        participant_id: "=unsafe",
        session_id: "session-current",
        study_session_id: "study-current",
        period: 1,
        stimulus_id: "track-x",
        condition: "single_agent",
        assignment_method: "crossover_block",
        music_profile_id: "music-current",
        co_created_run_id: "co-current",
        baseline_run_id: "base-current",
        protocol_version: CURRENT_STUDY_PROTOCOL_VERSION,
        status: "completed",
        created_at: "2026-07-18T00:00:00.000Z",
        updated_at: "2026-07-18T00:02:00.000Z",
      },
      {
        id: "trial-legacy",
        participant_id: "legacy-user",
        session_id: "session-legacy",
        condition: "single_agent",
        assignment_method: "demo_choice",
        music_profile_id: "music-legacy",
        co_created_run_id: "",
        baseline_run_id: "",
        protocol_version: "v2-13-blind-comparison",
        status: "completed",
        created_at: "2026-07-17T00:00:00.000Z",
        updated_at: "2026-07-17T00:02:00.000Z",
      },
    ],
    baselineJobs: [
      {
        trial_id: "trial-current",
        status: "completed",
        run_id: "base-current",
        error: "",
      },
      {
        trial_id: "trial-legacy",
        status: "failed",
        run_id: null,
        error: "quota",
      },
    ],
    artworkEvaluations: [
      {
        trial_id: "trial-current",
        music_match_score: 5,
        imagination_match_score: 4,
        agency_score: 3,
        ownership_score: 4,
        immersion_score: 5,
        satisfaction_score: 4,
      },
      {
        trial_id: "trial-legacy",
        music_match_score: 2,
        imagination_match_score: 3,
        agency_score: 2,
        ownership_score: 3,
        immersion_score: null,
        satisfaction_score: null,
      },
    ],
    pairwiseComparisons: [
      {
        trial_id: "trial-legacy",
        music_match_choice: "direct_baseline",
        aesthetic_choice: "tie",
        overall_choice: "direct_baseline",
        reason: "",
      },
    ],
    labeledComparisons: [
      {
        trial_id: "trial-current",
        music_match_choice: "co_created",
        imagination_match_choice: "co_created",
        overall_choice: "tie",
        reason: "The image matched.",
      },
    ],
    manipulationChecks: [
      {
        trial_id: "trial-current",
        perspective_multiplicity_score: 4,
        articulation_support_score: 5,
        dialogue_experience_score: 4,
      },
    ],
    questionnaireResponses: [
      ...["csi", "agency_ownership", "sus", "raw_tlx", "manipulation_check"].map((instrument) => ({
        id: `response-${instrument}`,
        response_key: `period:1:${instrument}`,
        participant_id: "=unsafe",
        study_session_id: "study-current",
        trial_id: "trial-current",
        run_id: "co-current",
        period: 1,
        condition: "single_agent",
        generation_role: null,
        instrument,
        questionnaire_version: "mv-questionnaires-1.1",
        scope: "post_period",
        status: "completed",
        answers: {},
        score_total: instrument === "sus" ? 75 : null,
        metrics: instrument === "agency_ownership" ? { agency: 4, ownership: 5 } : {},
        created_at: "2026-07-18T00:03:00.000Z",
      })),
      ...["co_created", "direct_baseline"].map((role) => ({
        id: `response-image-${role}`,
        response_key: `period:1:artwork:${role}`,
        participant_id: "=unsafe",
        study_session_id: "study-current",
        trial_id: "trial-current",
        run_id: role === "co_created" ? "co-current" : "base-current",
        period: 1,
        condition: "single_agent",
        generation_role: role,
        instrument: "image_alignment",
        questionnaire_version: "mv-questionnaires-1.1",
        scope: "artwork",
        status: "completed",
        answers: {},
        score_total: 4,
        metrics: {},
        created_at: "2026-07-18T00:03:00.000Z",
      })),
    ],
  };
}

function worksheetRecords(worksheet: ExcelJS.Worksheet): Array<Record<string, ExcelJS.CellValue>> {
  const headers = new Map<number, string>();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    headers.set(columnNumber, String(cell.value || ""));
  });
  const records: Array<Record<string, ExcelJS.CellValue>> = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const record: Record<string, ExcelJS.CellValue> = {};
    for (const [columnNumber, header] of headers) {
      record[header] = worksheet.getRow(rowNumber).getCell(columnNumber).value;
    }
    records.push(record);
  }
  return records;
}

function syntheticQuestionnaireDataset(participantCount: number): QuestionnaireWorkbookDataset {
  const trials: QuestionnaireWorkbookDataset["trials"] = [];
  const studySessions: QuestionnaireWorkbookDataset["studySessions"] = [];
  const weightingDefinition = getQuestionnaireDefinition("csi_weighting");
  const weightingAnswers = Object.fromEntries(weightingDefinition.questions.map((question) => {
    assert.equal(question.kind, "pair");
    return [question.id, question.left.value];
  })) as QuestionnaireAnswers;
  const weightingScore = scoreQuestionnaire("csi_weighting", weightingAnswers);

  const makeResponse = (input: {
    participantId: string;
    sessionId: string;
    trialId?: string;
    period?: 1 | 2;
    condition?: "multi_agent" | "single_agent";
    generationRole?: "co_created" | "direct_baseline";
    instrument: QuestionnaireInstrument;
    answers: QuestionnaireAnswers;
  }) => {
    const scored = input.instrument === "csi"
      ? scoreCsiWithWeights(input.answers, weightingAnswers)
      : scoreQuestionnaire(input.instrument, input.answers);
    const scope = input.instrument === "background"
      ? "pre_study"
      : ["session_preference", "csi_weighting"].includes(input.instrument)
        ? "post_session"
        : input.instrument === "image_alignment"
          ? "artwork"
          : "post_period";
    const responseKey = input.instrument === "background"
      ? "session:background"
      : input.instrument === "session_preference"
        ? "session:preference"
        : input.instrument === "csi_weighting"
          ? "session:csi_weighting"
          : input.instrument === "image_alignment"
            ? `period:${input.period}:artwork:${input.generationRole}`
            : `period:${input.period}:${input.instrument}`;
    return {
      id: `${input.sessionId}:${responseKey}`,
      response_key: responseKey,
      participant_id: input.participantId,
      study_session_id: input.sessionId,
      trial_id: input.trialId || null,
      run_id: input.generationRole ? `${input.trialId}:${input.generationRole}` : input.trialId || null,
      period: input.period || null,
      condition: input.condition || null,
      generation_role: input.generationRole || null,
      instrument: input.instrument,
      questionnaire_version: "mv-questionnaires-1.1",
      scope,
      status: "completed",
      answers: input.answers,
      score_total: scored.total,
      metrics: input.instrument === "csi_weighting" ? weightingScore.metrics : scored.metrics,
      completed_at: "2026-08-13T12:00:00.000Z",
    };
  };

  for (let index = 1; index <= participantCount; index += 1) {
    const participantId = `P${String(index).padStart(2, "0")}`;
    const sessionId = `study-${participantId}`;
    const firstCondition = index % 2 === 0 ? "multi_agent" : "single_agent";
    const secondCondition = firstCondition === "multi_agent" ? "single_agent" : "multi_agent";
    const sessionResponses = [
      makeResponse({
        participantId,
        sessionId,
        instrument: "background",
        answers: {
          AGE_GROUP: "18-24",
          GENDER: "prefer_not",
          EDUCATION: "undergraduate",
          DISCIPLINE: "design",
          MUSIC_TRAINING_YEARS: 2,
          VISUAL_TRAINING_YEARS: 1,
          GENERATIVE_AI_EXPERIENCE: "weekly",
          MUSIC_VISUALIZATION_EXPERIENCE: "some",
        },
      }),
      makeResponse({
        participantId,
        sessionId,
        instrument: "session_preference",
        answers: { SESSION_PREFERENCE: "period_1", SESSION_PREFERENCE_REASON: "" },
      }),
      makeResponse({
        participantId,
        sessionId,
        instrument: "csi_weighting",
        answers: weightingAnswers,
      }),
    ];
    const sessionTrials: QuestionnaireWorkbookDataset["trials"] = [];
    for (const period of [1, 2] as const) {
      const condition = period === 1 ? firstCondition : secondCondition;
      const trialId = `trial-${participantId}-${period}`;
      const csiAnswers = Object.fromEntries(
        getQuestionnaireDefinition("csi").questions.map((question) => [question.id, period === 1 ? 7 : 6])
      ) as QuestionnaireAnswers;
      const susAnswers = Object.fromEntries(
        getQuestionnaireDefinition("sus").questions.map((question) => [question.id, 3])
      ) as QuestionnaireAnswers;
      const trialResponses = [
        makeResponse({ participantId, sessionId, trialId, period, condition, instrument: "csi", answers: csiAnswers }),
        makeResponse({
          participantId,
          sessionId,
          trialId,
          period,
          condition,
          instrument: "agency_ownership",
          answers: { AGENCY: 4, OWNERSHIP: 5 },
        }),
        makeResponse({ participantId, sessionId, trialId, period, condition, instrument: "sus", answers: susAnswers }),
        makeResponse({
          participantId,
          sessionId,
          trialId,
          period,
          condition,
          instrument: "raw_tlx",
          answers: { TLX_MD: 40, TLX_PD: 20, TLX_TD: 35, TLX_PE: 30, TLX_EF: 45, TLX_FR: 25 },
        }),
        makeResponse({
          participantId,
          sessionId,
          trialId,
          period,
          condition,
          instrument: "manipulation_check",
          answers: { MC_PERSPECTIVES: 4, MC_DEVELOPMENT: 4 },
        }),
        ...(["co_created", "direct_baseline"] as const).map((generationRole) => makeResponse({
          participantId,
          sessionId,
          trialId,
          period,
          condition,
          generationRole,
          instrument: "image_alignment",
          answers: { IMAGE_ALIGNMENT_1: 5, IMAGE_ALIGNMENT_2: 6, IMAGE_ALIGNMENT_3: 5 },
        })),
      ];
      const trial = {
        id: trialId,
        dataOrigins: ["local"],
        participantId,
        studySessionId: sessionId,
        period,
        condition,
        protocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
        status: "completed",
        stimulusId: `track-${period}`,
        musicTitle: `Music ${period}`,
        questionnaireResponses: trialResponses,
        artworkEvaluation: {
          music_match_score: 4,
          imagination_match_score: 4,
          agency_score: 4,
          ownership_score: 4,
          immersion_score: 4,
          satisfaction_score: 4,
        },
        comparison: {
          musicMatchChoice: "co_created",
          imaginationMatchChoice: "co_created",
          overallChoice: "co_created",
          reason: "",
        },
      } satisfies QuestionnaireWorkbookDataset["trials"][number];
      sessionTrials.push(trial);
      trials.push(trial);
    }
    studySessions.push({
      id: sessionId,
      dataOrigins: ["local"],
      participantId,
      protocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
      sequence: firstCondition === "multi_agent" ? "multi_x_then_single_y" : "single_x_then_multi_y",
      status: "completed",
      complete: true,
      firstSelectedAudio: { id: "track-1", name: "Music 1" },
      secondSelectedAudio: { id: "track-2", name: "Music 2" },
      firstTrial: sessionTrials[0],
      secondTrial: sessionTrials[1],
      questionnaireResponses: sessionResponses,
    });
  }
  return {
    source: { capturedAt: "2026-08-13T12:00:00.000Z" },
    trials,
    studySessions,
  };
}

test("dashboard defaults its summary to the current protocol", () => {
  const dataset = buildResearchDashboardDataset(fixture(), "snapshot");
  assert.equal(dataset.trials.length, 2);
  assert.equal(dataset.summary.totalTrials, 1);
  assert.equal(dataset.summary.questionnaireCompleteTrials, 1);
  assert.equal(dataset.summary.artworkScores[0].mean, 5);
  assert.deepEqual(dataset.protocols, [
    "v2-13-blind-comparison",
    CURRENT_STUDY_PROTOCOL_VERSION,
  ]);
  assert.equal(dataset.studySessions.length, 1);
  assert.equal(dataset.studySessions[0].firstTrial?.id, "trial-current");
});

test("legacy missing scores are not treated as zero", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const allSummary = summarizeResearchTrials(dataset.trials);
  const immersion = allSummary.artworkScores.find((metric) => metric.key === "immersion_score");
  assert.equal(immersion?.count, 1);
  assert.equal(immersion?.mean, 5);
});

test("dashboard reports failed baseline and legacy protocol issues", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const legacy = dataset.trials.find((trial) => trial.id === "trial-legacy");
  assert.ok(legacy);
  assert.equal(legacy.questionnaireComplete, true);
  assert.equal(legacy.baselineComplete, false);
  assert.ok(legacy.issues.some((item) => item.code === "baseline_failed"));
  assert.ok(legacy.issues.some((item) => item.code === "legacy_protocol"));
  assert.ok(legacy.issues.some((item) => item.code === "missing_co_created_run"));
});

test("dashboard flags a baseline generated before artwork evaluation", () => {
  const data = fixture();
  data.artworkEvaluations = [];
  data.questionnaireResponses = data.questionnaireResponses.filter((response) => (
    response.response_key !== "period:1:artwork:co_created"
  ));
  const dataset = buildResearchDashboardDataset(data);
  const current = dataset.trials.find((trial) => trial.id === "trial-current");
  assert.ok(current);
  assert.equal(current.questionnaireComplete, false);
  assert.ok(current.issues.some((item) => item.code === "premature_baseline"));
});

test("dashboard CSV is one row per trial and neutralizes formulas", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const csv = exportResearchTrialsCsv(dataset.trials);
  assert.equal(csv.trim().split("\n").length, 3);
  assert.match(csv, /"'=unsafe"/);
  assert.match(csv, /music_match_score/);
  assert.match(csv, /baseline_failed/);
});

test("participant CSV keeps both periods on one row and neutralizes formulas", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const csv = exportResearchStudySessionsCsv(dataset.studySessions);
  assert.equal(csv.trim().split("\n").length, 2);
  assert.match(csv, /"'=unsafe"/);
  assert.match(csv, /period_1_condition/);
  assert.match(csv, /single_agent/);
  assert.match(csv, /background_answers_json/);
  assert.match(csv, /session_preference/);
});

test("raw questionnaire CSV keeps one answer per row with trial and session links", () => {
  const dataset = buildResearchDashboardDataset(fixture());
  const current = dataset.trials.find((trial) => trial.id === "trial-current");
  assert.ok(current);
  const response = current.questionnaireResponses.find((item) => item.instrument === "sus");
  assert.ok(response);
  response.answers = { SUS1: 4, SUS2: 2 };
  const csv = exportResearchQuestionnaireItemsCsvFromDataset(dataset, [current]);
  assert.match(csv, /item_id/);
  assert.match(csv, /SUS1/);
  assert.match(csv, /SUS2/);
  assert.match(csv, /trial-current/);
  assert.equal(csv.trim().split("\n").length, 3);
});

test("questionnaire workbook separates instruments and keeps one response per row", async () => {
  const data = fixture();
  const sus = data.questionnaireResponses.find((response) => response.instrument === "sus");
  assert.ok(sus);
  sus.answers = { SUS1: 4, SUS2: 2 };
  const dataset = buildResearchDashboardDataset(data);
  const { buffer, summary } = await buildResearchQuestionnaireWorkbook(dataset, {
    trialIds: ["trial-current"],
    studySessionIds: ["study-current"],
  });
  assert.equal(summary.participantCount, 1);
  assert.equal(summary.responseCount, 7);
  assert.equal(summary.sheets.find((sheet) => sheet.instrument === "sus")?.responseCount, 1);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "背景信息",
    "图像契合度",
    "CSI创作体验",
    "主体感与所有权",
    "SUS可用性",
    "Raw TLX负荷",
    "交互检验",
    "总体偏好",
    "CSI权重",
    "历史-结果页反馈",
    "历史-作品强制比较",
    "字段说明",
  ]);
  const susSheet = workbook.getWorksheet("SUS可用性");
  assert.ok(susSheet);
  assert.equal(susSheet.rowCount, 2);
  assert.equal(susSheet.getCell("A2").value, "'=unsafe");
  const headers = (susSheet.getRow(1).values as ExcelJS.CellValue[]).map(String);
  assert.equal(headers.includes("SUS1"), true);
  assert.equal(headers.includes("SUS10"), true);
  assert.equal(headers.includes("回答ID"), true);
  assert.equal(headers.includes("路径顺序"), true);
});

test("questionnaire workbook remains paired and analysis-ready for 36 participants", async () => {
  const dataset = syntheticQuestionnaireDataset(36);
  const { buffer, summary } = await buildResearchQuestionnaireWorkbook(dataset);
  assert.equal(summary.participantCount, 36);
  assert.equal(summary.responseCount, 612);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const expectedRows = new Map([
    ["背景信息", 37],
    ["图像契合度", 145],
    ["CSI创作体验", 73],
    ["主体感与所有权", 73],
    ["SUS可用性", 73],
    ["Raw TLX负荷", 73],
    ["交互检验", 73],
    ["总体偏好", 37],
    ["CSI权重", 37],
    ["历史-结果页反馈", 73],
    ["历史-作品强制比较", 73],
  ]);
  for (const [sheetName, rowCount] of expectedRows) {
    assert.equal(workbook.getWorksheet(sheetName)?.rowCount, rowCount, sheetName);
  }

  const csiSheet = workbook.getWorksheet("CSI创作体验");
  const imageSheet = workbook.getWorksheet("图像契合度");
  const preferenceSheet = workbook.getWorksheet("总体偏好");
  assert.ok(csiSheet && imageSheet && preferenceSheet);
  const csiRecords = worksheetRecords(csiSheet);
  const imageRecords = worksheetRecords(imageSheet);
  assert.equal(new Set(csiRecords.map((row) => row["回答ID"])).size, 72);
  assert.equal(new Set(imageRecords.map((row) => row["回答ID"])).size, 144);
  for (let index = 1; index <= 36; index += 1) {
    const participantId = `P${String(index).padStart(2, "0")}`;
    assert.deepEqual(
      csiRecords
        .filter((row) => row["实验者编号"] === participantId)
        .map((row) => row["路径条件"])
        .sort(),
      ["multi_agent", "single_agent"]
    );
    assert.equal(imageRecords.filter((row) => row["实验者编号"] === participantId).length, 4);
  }
  for (const row of worksheetRecords(preferenceSheet)) {
    assert.equal(row["偏好路径条件"], row["体验一条件"]);
    assert.equal(row["会话完整"], true);
  }
});

test("snapshot validation rejects incomplete exports", () => {
  assert.throws(
    () => buildResearchDashboardDataset({ schemaVersion: 3, trials: [] }),
    /schemaVersion 4/
  );
  assert.throws(
    () => buildResearchDashboardDataset({ schemaVersion: 4 }),
    /trials/
  );
});

test("unlinked session records are bounded by adjacent trials", () => {
  const data = fixture();
  data.interactionEvents = [
    {
      id: "before-current",
      session_id: "session-current",
      trial_id: "",
      created_at: "2026-07-17T23:59:59.000Z",
      event_type: "old",
    },
    {
      id: "during-current",
      session_id: "session-current",
      trial_id: "",
      created_at: "2026-07-18T00:00:10.000Z",
      event_type: "current",
    },
  ];
  const dataset = buildResearchDashboardDataset(data);
  const current = dataset.trials.find((trial) => trial.id === "trial-current");
  assert.deepEqual(current?.interactionEvents.map((event) => event.id), ["during-current"]);
});

test("dashboard merges local and online datasets while preserving source labels", () => {
  const localData = fixture();
  const onlineData = fixture();
  onlineData.exportedAt = "2026-07-19T00:00:00.000Z";
  onlineData.trials = [
    {
      ...onlineData.trials[0],
      id: "trial-online",
      participant_id: "online-user",
      session_id: "session-online",
      study_session_id: "",
      music_profile_id: "music-online",
      co_created_run_id: "",
      baseline_run_id: "",
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:02:00.000Z",
    },
  ];
  onlineData.studySessions = [];
  onlineData.audioAnalyses = [];
  onlineData.runs = [];
  onlineData.baselineJobs = [];
  onlineData.artworkEvaluations = [];
  onlineData.labeledComparisons = [];
  onlineData.manipulationChecks = [];
  onlineData.questionnaireResponses = [];

  const local = buildResearchDashboardDataset(localData, "database");
  const online = buildResearchDashboardDataset(onlineData, "remote");
  const merged = mergeResearchDashboardDatasets([local, online]);

  assert.equal(merged.source.kind, "combined");
  assert.equal(merged.trials.length, 3);
  assert.deepEqual(
    merged.trials.find((trial) => trial.id === "trial-current")?.dataOrigins,
    ["local"]
  );
  assert.deepEqual(
    merged.trials.find((trial) => trial.id === "trial-online")?.dataOrigins,
    ["online"]
  );
});

test("dashboard deduplicates matching trial ids and keeps every source label", () => {
  const local = buildResearchDashboardDataset(fixture(), "database");
  const online = buildResearchDashboardDataset(fixture(), "remote");
  const merged = mergeResearchDashboardDatasets([local, online]);

  assert.equal(merged.trials.length, 2);
  assert.deepEqual(
    merged.trials.find((trial) => trial.id === "trial-current")?.dataOrigins,
    ["local", "online"]
  );
  assert.deepEqual(merged.studySessions[0].dataOrigins, ["local", "online"]);
});

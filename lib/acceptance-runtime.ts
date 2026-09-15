import {
  CURRENT_STUDY_PROTOCOL_VERSION,
  type ConversationState,
  type MusicProfile,
  type StudyAudioChoice,
  type StudyPeriodAssignment,
  type StudySession,
  type StudyTrial,
  type VisualBrief,
} from "./contracts";
import {
  continueReflectiveListening,
  createConversationState,
  createReflectivePlan,
  recordMusicianMessage,
  recordReflectiveComment,
  recordUserMessage,
  requestGeneration,
  scheduleMusicianTurn,
  startUserFirstConversation,
} from "./conversation";
import { SINGLE_GUIDE_ID } from "./agents/single-guide";
import { createEmptyVisualBrief, calculateVisualBriefReadiness } from "./visual-brief";
import {
  QUESTIONNAIRE_VERSION,
  resolveStudyQuestionnaireProgress,
  type QuestionnaireAnswers,
  type QuestionnaireResponse,
  type StudyQuestionnaireProgress,
} from "./questionnaires";

const MODE_KEY = "melodyvisionAcceptanceMode";
const STATE_KEY = "melodyvisionAcceptanceState";
const RUNTIME_MARKER = "__melodyvisionAcceptanceFetchInstalled";
const DEVICE_SESSION_ID = "acceptance-device-session";
const STUDY_SESSION_ID = "acceptance-study-session";
const PARTICIPANT_ID = "ACCEPTANCE-TEST";

const CO_CREATED_IMAGES = [
  "/generated/02f50940-e556-4da6-8447-f20448d3fe35.png",
  "/generated/d147c240-ac74-4520-bd58-981a5fceda3c.png",
] as const;
const BASELINE_IMAGES = [
  "/preview/cinema-landscape.jpg",
  "/generated/0885af38-91ce-4257-af33-de10f634d0db.png",
] as const;

const MOCK_COMMENTS: Record<string, string> = {
  boya: "旋律像一条有呼吸的水路，远处安静，近处却一直在回应。",
  jikang: "先放下预设的情绪，只看声音如何聚散，画面会更自由。",
  caiwenji: "我听见了距离和回望，像有一束光穿过很久以前的记忆。",
  abing: "声音有重量，亮处也带着生活留下的痕迹。",
  tandun: "可以把声音当作一种材料，让水、石、金属和空气互相转化。",
  bach: "不同线条彼此托住，空间可以像建筑一样清晰。",
  mozart: "让画面保留轻盈的转折，不必把每个细节都说满。",
  beethoven: "反复出现的动机不是重复，而是在不断争取新的方向。",
  armstrong: "节奏会把画面推起来，让光和线条一起摆动。",
  lennon: "把最私人的那一点感受留下，它会成为别人进入画面的入口。",
};

interface GenerationResult {
  runId: string;
  imageUrl: string;
  prompt: string;
  imageModel: string;
  imageSize: string;
}

interface BaselineJob {
  trialId: string;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  runId: string | null;
  error: string;
  startedAt: string | null;
  updatedAt: string;
}

interface AcceptanceState {
  session: StudySession | null;
  assignments: [StudyPeriodAssignment, StudyPeriodAssignment] | null;
  trials: StudyTrial[];
  profiles: Record<string, MusicProfile>;
  analyses: Record<string, Record<string, unknown>>;
  conversations: Record<string, ConversationState>;
  briefs: Record<string, VisualBrief>;
  responses: QuestionnaireResponse[];
  coCreated: Record<string, GenerationResult>;
  baselines: Record<string, GenerationResult>;
  baselineJobs: Record<string, BaselineJob>;
}

declare global {
  interface Window {
    __melodyvisionAcceptanceFetchInstalled?: boolean;
  }
}

function now() {
  return new Date().toISOString();
}

function emptyState(): AcceptanceState {
  return {
    session: null,
    assignments: null,
    trials: [],
    profiles: {},
    analyses: {},
    conversations: {},
    briefs: {},
    responses: [],
    coCreated: {},
    baselines: {},
    baselineJobs: {},
  };
}

function readState(): AcceptanceState {
  if (typeof window === "undefined") return emptyState();
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) || "null") as AcceptanceState || emptyState();
  } catch {
    return emptyState();
  }
}

function writeState(state: AcceptanceState) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function isAcceptanceMode(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(MODE_KEY) === "1";
}

export function resetAcceptanceRuntime() {
  if (typeof window === "undefined") return;
  sessionStorage.clear();
  sessionStorage.setItem(MODE_KEY, "1");
  writeState(emptyState());
}

export function acceptanceExperimentSessionId(): string | null {
  return isAcceptanceMode() ? DEVICE_SESSION_ID : null;
}

function analyzed<T>(value: T, confidence = 0.82) {
  return { value, confidence, evidenceIds: ["acceptance-signal"] };
}

function mockMusicProfile(input: {
  sessionId: string;
  name: string;
  sourceKind: "upload" | "preset" | "search";
  catalogItemId?: string;
}): MusicProfile {
  return {
    schemaVersion: "2.0.0",
    id: `acceptance-profile-${crypto.randomUUID()}`,
    sessionId: input.sessionId,
    audio: {
      name: input.name,
      sourceKind: input.sourceKind,
      durationSeconds: 45,
      byteSize: 1024,
      mimeType: "audio/mpeg",
      contentHash: "acceptance-audio-hash",
      ...(input.catalogItemId ? { catalogItemId: input.catalogItemId } : {}),
    },
    analyzers: [{ name: "acceptance-fixture", version: "1", role: "signal" }],
    rhythm: {
      bpm: analyzed(96),
      beatStrength: analyzed(0.68),
      onsetDensity: analyzed("medium" as const),
      beatsSeconds: [0, 0.62, 1.25, 1.87],
      tempoCurve: [{ atSeconds: 0, value: 96 }],
      onsetDensityCurve: [{ atSeconds: 0, value: 0.56 }],
    },
    tonality: {
      key: analyzed("G"),
      mode: analyzed("major" as const),
      chromaProfile: [0.7, 0.1, 0.4, 0.1, 0.65, 0.2, 0.5, 0.8, 0.1, 0.4, 0.1, 0.55],
      harmonicChangeCurve: [{ atSeconds: 0, value: 0.34 }],
      harmonicStability: analyzed(0.64),
    },
    dynamics: {
      averageEnergy: analyzed(0.58),
      dynamicComplexity: analyzed(0.47),
      energyCurve: [{ atSeconds: 0, value: 0.42 }, { atSeconds: 22, value: 0.7 }],
      loudnessCurve: [{ atSeconds: 0, value: 0.5 }],
    },
    timbre: {
      brightness: analyzed(0.56),
      warmth: analyzed(0.72),
      roughness: analyzed(0.2),
      noisiness: analyzed(0.12),
    },
    sections: [{
      id: "acceptance-section",
      order: 0,
      startSeconds: 0,
      endSeconds: 45,
      phase: "development",
      boundaryConfidence: 0.9,
      energy: 0.58,
      brightness: 0.56,
      onsetDensity: 0.56,
      dynamicTrend: "rising",
      moods: [{ label: "serene", score: 0.72, evidenceIds: ["acceptance-signal"] }],
      instruments: [],
      textures: [{ label: "smooth", score: 0.75, evidenceIds: ["acceptance-signal"] }],
      motions: [{ label: "flowing", score: 0.8, evidenceIds: ["acceptance-signal"] }],
    }],
    semantics: {
      moods: [{ label: "serene", score: 0.72, evidenceIds: ["acceptance-signal"] }],
      genres: [],
      instruments: [],
      textures: [{ label: "smooth", score: 0.75, evidenceIds: ["acceptance-signal"] }],
      motions: [{ label: "flowing", score: 0.8, evidenceIds: ["acceptance-signal"] }],
      spaces: [{ label: "expansive", score: 0.64, evidenceIds: ["acceptance-signal"] }],
    },
    evidence: [{
      id: "acceptance-signal",
      analyzer: "acceptance-fixture",
      method: "preset",
      description: "Local acceptance fixture",
    }],
    warnings: [],
    createdAt: now(),
  };
}

function createSession(participantId = PARTICIPANT_ID): AcceptanceState {
  const state = emptyState();
  const timestamp = now();
  state.session = {
    id: STUDY_SESSION_ID,
    participantId,
    deviceSessionId: DEVICE_SESSION_ID,
    protocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
    sequence: "multi_x_then_single_y",
    status: "created",
    currentPeriod: 1,
    stimulusXId: "",
    stimulusYId: "",
    stimulusX: null,
    stimulusY: null,
    selectedMusicianIds: [],
    firstTrialId: null,
    secondTrialId: null,
    assignmentBlockId: "acceptance-block",
    assignmentPosition: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
  state.assignments = [
    { period: 1, condition: "multi_agent", stimulusId: "", trialId: null },
    { period: 2, condition: "single_agent", stimulusId: "", trialId: null },
  ];
  return state;
}

function audioForTrial(state: AcceptanceState, trial: StudyTrial): StudyAudioChoice | null {
  if (!state.session) return null;
  return trial.period === 2 ? state.session.stimulusY : state.session.stimulusX;
}

function studyPayload(state: AcceptanceState) {
  if (!state.session || !state.assignments) return null;
  return {
    session: state.session,
    assignments: state.assignments,
    trials: state.trials,
    periodResults: state.trials.map((trial) => {
      const audio = audioForTrial(state, trial);
      return {
        trial,
        audioUrl: audio?.playbackUrl || "",
        musicName: audio?.name || "验收音乐",
        baselineJob: state.baselineJobs[trial.id] || null,
        musicProfile: state.profiles[trial.id] || null,
        compatibilityAnalysis: state.analyses[trial.id] || null,
        conversationState: state.conversations[trial.id] || null,
        visualBrief: state.briefs[trial.id] || null,
        facilitatorPlan: state.conversations[trial.id]
          ? createReflectivePlan(state.conversations[trial.id], state.briefs[trial.id])
          : null,
        coCreated: state.coCreated[trial.id] || null,
        baseline: state.baselines[trial.id] || null,
      };
    }),
    comparison: null,
  };
}

function progressPayload(state: AcceptanceState) {
  if (!state.session) return null;
  const progress = resolveStudyQuestionnaireProgress({
    session: state.session,
    trials: state.trials,
    responses: state.responses,
  });
  const nextStep = progress.nextStep;
  if (nextStep?.runId) {
    const generation = Object.values({ ...state.coCreated, ...state.baselines })
      .find((item) => item.runId === nextStep.runId);
    if (generation) nextStep.imageUrl = generation.imageUrl;
  }
  return { participantId: state.session.participantId, progress };
}

function readyBrief(state: ConversationState, content: string): VisualBrief {
  const empty = createEmptyVisualBrief({
    conversationId: state.id,
    musicProfileId: state.musicProfileId,
  });
  const latestUser = [...state.messages].reverse().find((message) => message.role === "user");
  const source = latestUser ? [{
    id: `source-${latestUser.id}`,
    kind: "user-message" as const,
    sourceId: latestUser.id,
    excerpt: latestUser.content,
  }] : [];
  const fields = {
    subject: { value: content || "一束穿过开阔空间的光", status: "confirmed" as const, sources: source },
    space: { value: "辽阔而有纵深的空间", status: "confirmed" as const, sources: source },
    composition: { value: "由远及近展开", status: "confirmed" as const, sources: source },
    motion: { value: ["流动", "向远处延伸"], status: "confirmed" as const, sources: source },
    materials: { value: ["薄雾", "水面", "微光"], status: "confirmed" as const, sources: source },
    palette: { value: ["深蓝", "暖金"], status: "confirmed" as const, sources: source },
    lighting: { value: "从远处逐渐亮起", status: "confirmed" as const, sources: source },
    atmosphere: { value: ["安静", "开阔"], status: "confirmed" as const, sources: source },
    personalMeaning: { value: "从迟疑走向舒展", status: "confirmed" as const, sources: source },
    mustInclude: { value: ["远处的光"], status: "confirmed" as const, sources: source },
    mustAvoid: { value: ["拥挤的文字"], status: "confirmed" as const, sources: source },
  };
  return {
    ...empty,
    version: 1,
    status: "ready",
    fields,
    readiness: calculateVisualBriefReadiness(fields),
    updatedAt: now(),
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function bodyJson(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return JSON.parse(init.body) as Record<string, unknown>;
  if (input instanceof Request) return await input.clone().json() as Record<string, unknown>;
  return {};
}

function updateSessionAfterQuestionnaire(state: AcceptanceState, progress: StudyQuestionnaireProgress) {
  if (!state.session) return;
  if (progress.nextAction === "experience" && state.trials.some((trial) => trial.period === 1)) {
    state.session.currentPeriod = 2;
    state.session.status = "between_periods";
  } else if (progress.nextAction === "complete") {
    state.session.status = "completed";
    state.session.completedAt = now();
  }
  state.session.updatedAt = now();
}

function startBaseline(state: AcceptanceState, trial: StudyTrial) {
  const periodIndex = (trial.period || 1) - 1;
  const runId = `acceptance-baseline-${trial.period || 1}`;
  const result: GenerationResult = {
    runId,
    imageUrl: BASELINE_IMAGES[periodIndex],
    prompt: "预置音乐直出提示词，仅用于本地验收。",
    imageModel: "acceptance-fixture",
    imageSize: "1696*960",
  };
  trial.baselineRunId = runId;
  state.baselines[trial.id] = result;
  state.baselineJobs[trial.id] = {
    trialId: trial.id,
    status: "completed",
    attempts: 1,
    runId,
    error: "",
    startedAt: now(),
    updatedAt: now(),
  };
  return result;
}

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const path = url.pathname;

  if (path === "/api/experiment/session") return json({ sessionId: DEVICE_SESSION_ID });
  if (path === "/api/experiment/event" || path === "/api/experiment/audio-analysis") {
    return json({ saved: false, acceptanceMode: true });
  }
  if ((path === "/api/analyze" || path === "/analyze" || path === "/api/audio-profile") && method === "POST") {
    let name = "验收音乐.mp3";
    let sourceKind: "upload" | "preset" | "search" = "preset";
    let catalogItemId: string | undefined;
    if (init?.body instanceof FormData) {
      const file = init.body.get("audio");
      if (file instanceof File) name = file.name;
      sourceKind = String(init.body.get("sourceKind") || "preset") as typeof sourceKind;
      catalogItemId = String(init.body.get("catalogItemId") || "") || undefined;
    } else {
      const body = await bodyJson(input, init);
      name = String(body.fileName || name);
      sourceKind = String(body.sourceKind || sourceKind) as typeof sourceKind;
      catalogItemId = typeof body.catalogItemId === "string" ? body.catalogItemId : undefined;
    }
    return json(mockMusicProfile({ sessionId: DEVICE_SESSION_ID, name, sourceKind, catalogItemId }));
  }
  if (["/health", "/api/analyze/health"].includes(path) || url.searchParams.get("warm") === "1") {
    return json({ status: "ready", acceptanceMode: true });
  }

  if (path === "/api/experiment/study-session") {
    if (method === "GET") {
      const state = readState();
      const payload = studyPayload(state);
      return payload ? json(payload) : json({ error: "Study session not found" }, 404);
    }
    const body = await bodyJson(input, init);
    if (body.action === "create") {
      const state = createSession(typeof body.participantId === "string" ? body.participantId : PARTICIPANT_ID);
      writeState(state);
      return json(studyPayload(state), 201);
    }
    const state = readState();
    if (!state.session || !state.assignments) return json({ error: "Study session not found" }, 404);
    if (body.action === "select_audio") {
      const first = body.first as StudyAudioChoice;
      const second = body.second as StudyAudioChoice;
      state.session.stimulusXId = first.id;
      state.session.stimulusYId = second.id;
      state.session.stimulusX = first;
      state.session.stimulusY = second;
      state.assignments[0].stimulusId = first.id;
      state.assignments[1].stimulusId = second.id;
    } else if (body.action === "select_musicians") {
      state.session.selectedMusicianIds = Array.isArray(body.selectedMusicianIds)
        ? body.selectedMusicianIds.filter((item): item is string => typeof item === "string")
        : [];
    }
    state.session.updatedAt = now();
    writeState(state);
    return json(studyPayload(state));
  }

  if (path === "/api/experiment/trial") {
    if (method === "GET") {
      const state = readState();
      const trial = state.trials.find((item) => item.id === url.searchParams.get("trialId"));
      return trial ? json({ trial }) : json({ error: "Trial not found" }, 404);
    }
    const body = await bodyJson(input, init);
    const state = readState();
    if (!state.session || !state.assignments) return json({ error: "Study session not found" }, 404);
    const period = body.period === 2 ? 2 : 1;
    const existing = state.trials.find((item) => item.period === period);
    if (existing) return json({ trial: existing });
    const assignment = state.assignments[period - 1];
    const trial: StudyTrial = {
      id: `acceptance-trial-${period}`,
      participantId: state.session.participantId,
      sessionId: String(body.sessionId || DEVICE_SESSION_ID),
      studySessionId: state.session.id,
      period,
      stimulusId: assignment.stimulusId,
      condition: assignment.condition,
      assignmentMethod: "crossover_block",
      musicProfileId: String(body.musicProfileId || `acceptance-profile-${period}`),
      coCreatedRunId: null,
      baselineRunId: null,
      protocolVersion: CURRENT_STUDY_PROTOCOL_VERSION,
      comparisonOrder: null,
      status: "created",
      createdAt: now(),
      updatedAt: now(),
    };
    state.trials.push(trial);
    assignment.trialId = trial.id;
    if (period === 1) {
      state.session.firstTrialId = trial.id;
      state.session.status = "period_1";
    } else {
      state.session.secondTrialId = trial.id;
      state.session.status = "period_2";
    }
    const pendingProfile = JSON.parse(sessionStorage.getItem("musicProfile") || "null") as MusicProfile | null;
    if (pendingProfile) state.profiles[trial.id] = pendingProfile;
    state.analyses[trial.id] = JSON.parse(sessionStorage.getItem("musicAnalysis") || "{}") as Record<string, unknown>;
    state.session.updatedAt = now();
    writeState(state);
    return json({ trial }, 201);
  }

  if (path === "/api/experiment/questionnaire") {
    const state = readState();
    if (method === "GET") {
      const payload = progressPayload(state);
      return payload ? json(payload) : json({ error: "Study session not found" }, 404);
    }
    const body = await bodyJson(input, init);
    const payload = progressPayload(state);
    const step = payload?.progress.nextStep;
    if (!payload || !step || body.responseKey !== step.key) {
      return json({ error: "This questionnaire is not the current study step" }, 409);
    }
    const response: QuestionnaireResponse = {
      id: `acceptance-response-${step.key}`,
      responseKey: step.key,
      participantId: state.session?.participantId || PARTICIPANT_ID,
      studySessionId: STUDY_SESSION_ID,
      trialId: step.trialId,
      runId: step.runId,
      period: step.period,
      condition: step.condition,
      generationRole: step.generationRole,
      instrument: step.instrument,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      scope: step.scope,
      status: method === "POST" ? "completed" : "draft",
      answers: (body.answers || {}) as QuestionnaireAnswers,
      totalScore: null,
      metrics: {},
      startedAt: now(),
      updatedAt: now(),
      completedAt: method === "POST" ? now() : null,
    };
    state.responses = state.responses.filter((item) => item.responseKey !== step.key);
    state.responses.push(response);
    const nextPayload = progressPayload(state)!;
    updateSessionAfterQuestionnaire(state, nextPayload.progress);
    writeState(state);
    return json({ saved: false, acceptanceMode: true, response, ...progressPayload(state) });
  }

  if (path === "/api/conversation/start") {
    const body = await bodyJson(input, init);
    const selectedMusicianIds = Array.isArray(body.selectedMusicianIds)
      ? body.selectedMusicianIds.filter((item): item is string => typeof item === "string")
      : [];
    const condition = body.condition === "single_agent" ? "single_agent" : "multi_agent";
    const initial = createConversationState({
      trialId: String(body.trialId),
      sessionId: String(body.sessionId),
      musicProfileId: String(body.musicProfileId),
      selectedMusicianIds,
      condition,
      turnPolicy: {
        maxUserRounds: 2,
        maxMusiciansPerResponse: 4,
        maxConsecutiveMusicianMessages: 4,
        userMayGenerateEarly: condition === "multi_agent",
        userMayInterrupt: condition !== "multi_agent",
      },
      ...(condition === "single_agent" ? { guideId: SINGLE_GUIDE_ID } : {}),
    });
    const conversation = startUserFirstConversation(initial);
    const state = readState();
    state.conversations[conversation.trialId] = conversation;
    writeState(state);
    return json({ state: conversation, facilitatorPlan: createReflectivePlan(conversation) });
  }

  if (path === "/api/conversation/respond") {
    const body = await bodyJson(input, init);
    const current = body.conversationState as ConversationState;
    let next = recordUserMessage(current, String(body.content || ""));
    const brief = readyBrief(next, String(body.content || ""));
    if (next.condition === "multi_agent") {
      if (next.completedUserRounds >= 2 && next.selectedMusicianIds.every((id) => (next.musicianMemory[id]?.publicTurnCount || 0) > 0)) {
        next = requestGeneration(next);
      } else {
        next = scheduleMusicianTurn(next, {
          speakerIds: next.selectedMusicianIds,
          stageSubtitle: "音乐家会沿着你的画面依次回应。",
          userInvitation: "听完他们的回应后，再补上一点最想保留的画面。",
        });
      }
    } else {
      next = continueReflectiveListening(next, undefined, next.completedUserRounds >= 2);
    }
    next = { ...next, visualBriefRef: { id: brief.id, version: brief.version } };
    const state = readState();
    state.conversations[next.trialId] = next;
    state.briefs[next.trialId] = brief;
    writeState(state);
    return json({ state: next, facilitatorPlan: createReflectivePlan(next, brief), visualBrief: brief });
  }

  if (path === "/api/conversation/reflection/comment") {
    const body = await bodyJson(input, init);
    const current = body.conversationState as ConversationState;
    const speakerId = String(body.speakerId || "");
    const comment = MOCK_COMMENTS[speakerId] || "这段音乐让我看见一片逐渐展开的空间。";
    const next = recordReflectiveComment(current, { speakerId, content: comment });
    const state = readState();
    state.conversations[next.trialId] = next;
    writeState(state);
    return json({ state: next, comment, model: "acceptance-fixture", profileVersion: "acceptance" });
  }

  if (path === "/api/conversation/turn") {
    const body = await bodyJson(input, init);
    const current = body.conversationState as ConversationState;
    const speakerId = current.queuedSpeakerIds[0];
    const comment = MOCK_COMMENTS[speakerId] || "这段音乐让我看见一片逐渐展开的空间。";
    const next = recordMusicianMessage(current, { speakerId, content: comment });
    const state = readState();
    state.conversations[next.trialId] = next;
    writeState(state);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "meta", speakerId, speakerName: speakerId })}\n`));
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", speakerId, delta: comment })}\n`));
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "complete", speakerId, comment, model: "acceptance-fixture", state: next })}\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
  }

  if (path === "/api/conversation/brief") {
    const body = await bodyJson(input, init);
    const current = body.conversationState as ConversationState;
    const latestUser = [...current.messages].reverse().find((message) => message.role === "user");
    const brief = readyBrief(current, latestUser?.content || "一片流动的开阔空间");
    const state = readState();
    state.briefs[current.trialId] = brief;
    writeState(state);
    return json({
      visualBrief: brief,
      visualBriefRef: { id: brief.id, version: brief.version },
      meta: { model: "acceptance-fixture", attempts: 1, fallback: false },
    });
  }

  if (path === "/api/conversation/generate") {
    const body = await bodyJson(input, init);
    const next = requestGeneration(body.conversationState as ConversationState);
    const state = readState();
    state.conversations[next.trialId] = next;
    writeState(state);
    return json({ state: next });
  }

  if (path === "/api/generate") {
    const body = await bodyJson(input, init);
    const state = readState();
    const trial = state.trials.find((item) => item.id === body.trialId);
    if (!trial) return json({ error: "Trial not found" }, 404);
    const role = body.generationRole === "direct_baseline" ? "direct_baseline" : "co_created";
    const result = role === "direct_baseline"
      ? startBaseline(state, trial)
      : {
          runId: `acceptance-co-created-${trial.period || 1}`,
          imageUrl: CO_CREATED_IMAGES[(trial.period || 1) - 1],
          prompt: "预置共创提示词，仅用于本地验收。",
          imageModel: "acceptance-fixture",
          imageSize: "1696*960",
        };
    if (role === "co_created") {
      trial.coCreatedRunId = result.runId;
      trial.status = "evaluating";
      state.coCreated[trial.id] = result;
    }
    trial.updatedAt = now();
    writeState(state);
    return json({
      ...result,
      trialId: trial.id,
      generationRole: role,
      sessionId: trial.sessionId,
      provider: "local-fixture",
      model: "acceptance-fixture",
      promptSource: "acceptance",
      timings: { totalMs: 250 },
    });
  }

  if (path === "/api/experiment/baseline") {
    const state = readState();
    const trialId = url.searchParams.get("trialId") || String((await bodyJson(input, init)).trialId || "");
    const trial = state.trials.find((item) => item.id === trialId);
    if (!trial) return json({ error: "Trial not found" }, 404);
    if (method === "GET") {
      return json({ trial, job: state.baselineJobs[trial.id] || null, result: state.baselines[trial.id] || null });
    }
    const result = startBaseline(state, trial);
    writeState(state);
    return json({ trial, acquired: true, job: state.baselineJobs[trial.id], ...result }, 201);
  }

  if (path === "/api/experiment/evaluation") {
    if (method === "GET") return json({});
    return json({ saved: false, acceptanceMode: true });
  }

  if (path.startsWith("/api/")) {
    return json({
      error: "本地验收模式已阻止未预置的接口调用",
      path,
    }, 503);
  }
  return null;
}

export function installAcceptanceRuntime() {
  if (typeof window === "undefined" || window[RUNTIME_MARKER]) return;
  if (window.location.pathname === "/acceptance" || window.location.search.includes("acceptance=1")) {
    sessionStorage.setItem(MODE_KEY, "1");
  }
  if (!isAcceptanceMode()) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const mocked = await mockFetch(input, init);
    return mocked || nativeFetch(input, init);
  };
  window[RUNTIME_MARKER] = true;
}

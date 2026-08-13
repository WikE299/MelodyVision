import type {
  QuestionnaireDefinition,
  QuestionnaireLanguage,
  QuestionnaireOption,
  QuestionnaireQuestion,
} from "./types.ts";

export const QUESTIONNAIRE_VERSION = "mv-questionnaires-1.2";
export const NOT_APPLICABLE_VALUE = "not_applicable";

type LocalizedText = { zh: string; en: string };

interface LocalizedOption {
  value: string;
  label: LocalizedText;
}

function text(language: QuestionnaireLanguage, value: LocalizedText): string {
  return value[language];
}

function options(language: QuestionnaireLanguage, values: LocalizedOption[]): QuestionnaireOption[] {
  return values.map((value) => ({ value: value.value, label: text(language, value.label) }));
}

const agreement = {
  zh: { min: "非常不同意", max: "非常同意", na: "不适用" },
  en: { min: "Strongly disagree", max: "Strongly agree", na: "Not applicable" },
};

const CSI_ITEMS: Array<{ id: string; factor: string; prompt: LocalizedText; allowNA?: boolean }> = [
  {
    id: "CSI_EJ1",
    factor: "enjoyment",
    prompt: {
      zh: "我愿意经常使用这个系统或工具。",
      en: "I would be happy to use this system or tool on a regular basis.",
    },
  },
  {
    id: "CSI_EJ2",
    factor: "enjoyment",
    prompt: {
      zh: "我享受使用这个系统或工具的过程。",
      en: "I enjoyed using the system or tool.",
    },
  },
  {
    id: "CSI_EXPL1",
    factor: "exploration",
    prompt: {
      zh: "我很容易探索许多不同的想法、选项、设计或结果。",
      en: "It was easy to explore many different ideas, options, designs, or outcomes.",
    },
  },
  {
    id: "CSI_EXPL2",
    factor: "exploration",
    prompt: {
      zh: "这个系统或工具有助于我跟踪不同的想法、结果或可能性。",
      en: "The system or tool helped me track different ideas, outcomes, or possibilities.",
    },
  },
  {
    id: "CSI_EXPR1",
    factor: "expressiveness",
    prompt: {
      zh: "完成活动时，我能够充分发挥创造力。",
      en: "I was able to be very creative while completing the activity.",
    },
  },
  {
    id: "CSI_EXPR2",
    factor: "expressiveness",
    prompt: {
      zh: "这个系统或工具让我能够充分表达自己。",
      en: "The system or tool allowed me to be very expressive.",
    },
  },
  {
    id: "CSI_IM1",
    factor: "immersion",
    prompt: {
      zh: "我的注意力完全集中在活动上，以至于忘记了正在使用系统或工具。",
      en: "My attention was fully focused on the activity, and I forgot about the system or tool.",
    },
  },
  {
    id: "CSI_IM2",
    factor: "immersion",
    prompt: {
      zh: "我非常投入这项活动，以至于忘记了正在使用系统或工具。",
      en: "I became so absorbed in the activity that I forgot about the system or tool.",
    },
  },
  {
    id: "CSI_RWE1",
    factor: "results_worth_effort",
    prompt: {
      zh: "我的产出值得我为此付出的努力。",
      en: "What I produced was worth the effort I put into it.",
    },
  },
  {
    id: "CSI_RWE2",
    factor: "results_worth_effort",
    prompt: {
      zh: "我对从这个系统或工具中获得的结果感到满意。",
      en: "I was satisfied with what I got out of the system or tool.",
    },
  },
];

export const CSI_FACTOR_ITEMS = Object.fromEntries(
  CSI_ITEMS.map((item) => [item.id, item.factor])
) as Record<string, string>;

const CSI_FACTORS: LocalizedOption[] = [
  { value: "enjoyment", label: { zh: "享受使用系统或工具", en: "Enjoy using the system or tool" } },
  { value: "exploration", label: { zh: "探索不同的想法和可能性", en: "Explore different ideas and possibilities" } },
  { value: "expressiveness", label: { zh: "表达自己的创造性想法", en: "Express my creative ideas" } },
  { value: "immersion", label: { zh: "沉浸于活动之中", en: "Become immersed in the activity" } },
  { value: "results_worth_effort", label: { zh: "获得值得投入努力的结果", en: "Produce results worth the effort" } },
];

function backgroundDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  const ageOptions: LocalizedOption[] = ["18-24", "25-34", "35-44", "45-54", "55+"]
    .map((value) => ({ value, label: { zh: value, en: value } }));
  return {
    instrument: "background",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "实验前背景信息", en: "Background information" }),
    shortTitle: text(language, { zh: "背景问卷", en: "Background" }),
    intro: text(language, {
      zh: "这些信息只用于描述参与者构成，不计算背景总分。",
      en: "These responses describe the participant sample and are not combined into a score.",
    }),
    pageSize: 4,
    questions: [
      { id: "AGE_GROUP", kind: "choice", required: true, prompt: text(language, { zh: "你的年龄范围是？", en: "What is your age range?" }), options: options(language, ageOptions) },
      { id: "GENDER", kind: "choice", required: true, prompt: text(language, { zh: "你的性别是？", en: "What is your gender?" }), options: options(language, [
        { value: "woman", label: { zh: "女性", en: "Woman" } },
        { value: "man", label: { zh: "男性", en: "Man" } },
        { value: "other", label: { zh: "其他", en: "Another identity" } },
        { value: "prefer_not", label: { zh: "不愿回答", en: "Prefer not to answer" } },
      ]) },
      { id: "EDUCATION", kind: "choice", required: true, prompt: text(language, { zh: "你的最高学历是？", en: "What is your highest level of education?" }), options: options(language, [
        { value: "high_school", label: { zh: "高中及以下", en: "High school or below" } },
        { value: "undergraduate", label: { zh: "本科", en: "Bachelor's degree" } },
        { value: "master", label: { zh: "硕士", en: "Master's degree" } },
        { value: "doctorate", label: { zh: "博士及以上", en: "Doctorate or above" } },
      ]) },
      { id: "DISCIPLINE", kind: "text", required: true, prompt: text(language, { zh: "你的专业、职业或主要学习领域是？", en: "What is your discipline, occupation, or main field of study?" }), placeholder: text(language, { zh: "例如：计算机、音乐、设计", en: "For example: computing, music, design" }), maxLength: 120 },
      { id: "MUSIC_TRAINING_YEARS", kind: "number", required: true, prompt: text(language, { zh: "你接受正规音乐训练的累计年数是？", en: "How many years of formal music training have you completed?" }), min: 0, max: 80, step: 1, suffix: text(language, { zh: "年", en: "years" }) },
      { id: "VISUAL_TRAINING_YEARS", kind: "number", required: true, prompt: text(language, { zh: "你接受视觉艺术或设计训练的累计年数是？", en: "How many years of visual art or design training have you completed?" }), min: 0, max: 80, step: 1, suffix: text(language, { zh: "年", en: "years" }) },
      { id: "GENERATIVE_AI_EXPERIENCE", kind: "choice", required: true, prompt: text(language, { zh: "你使用生成式图像或对话式AI的频率是？", en: "How often do you use generative image or conversational AI tools?" }), options: options(language, [
        { value: "never", label: { zh: "从未", en: "Never" } },
        { value: "occasionally", label: { zh: "偶尔", en: "Occasionally" } },
        { value: "monthly", label: { zh: "每月数次", en: "Several times a month" } },
        { value: "weekly", label: { zh: "每周数次", en: "Several times a week" } },
        { value: "daily", label: { zh: "几乎每天", en: "Almost every day" } },
      ]) },
      { id: "MUSIC_VISUALIZATION_EXPERIENCE", kind: "choice", required: true, prompt: text(language, { zh: "你接触音乐可视化或音乐生成图像作品的频率是？", en: "How often have you used or viewed music visualization or music-to-image work?" }), options: options(language, [
        { value: "none", label: { zh: "没有", en: "Never" } },
        { value: "some", label: { zh: "少量", en: "A little" } },
        { value: "often", label: { zh: "经常", en: "Often" } },
      ]) },
    ],
  };
}

function csiDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  return {
    instrument: "csi",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "刚才的创作体验", en: "The creative experience you just completed" }),
    shortTitle: "CSI",
    intro: text(language, { zh: "请只评价刚刚完成的这一种体验。", en: "Please evaluate only the experience you just completed." }),
    pageSize: 4,
    questions: CSI_ITEMS.map((item) => ({
      id: item.id,
      kind: "scale",
      required: true,
      prompt: text(language, item.prompt),
      min: 0,
      max: 10,
      step: 1,
      minLabel: agreement[language].min,
      maxLabel: agreement[language].max,
      allowNotApplicable: item.allowNA,
      presentation: "buttons",
    })),
  };
}

function susDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  const prompts: LocalizedText[] = [
    { zh: "我愿意经常使用这个系统。", en: "I think that I would like to use this system frequently." },
    { zh: "我发现这个系统太复杂。", en: "I found the system unnecessarily complex." },
    { zh: "我认为这个系统使用起来很容易。", en: "I thought the system was easy to use." },
    { zh: "我认为我需要技术人员的帮助才能使用这个系统。", en: "I think that I would need the support of a technical person to use this system." },
    { zh: "我发现这个系统很好地集成了各种功能。", en: "I found the various functions in this system were well integrated." },
    { zh: "在使用该系统的过程中，我发现很多操作结果和预想功能不一致。", en: "I thought there was too much inconsistency in this system." },
    { zh: "我想大多数用户能很快学会使用该系统。", en: "I would imagine that most people would learn to use this system very quickly." },
    { zh: "我发现这个系统使用起来很别扭。", en: "I found the system very cumbersome to use." },
    { zh: "我对熟练掌握这个系统很有信心。", en: "I felt very confident using the system." },
    { zh: "在使用这个系统之前，我需要学习很多知识。", en: "I needed to learn a lot of things before I could get going with this system." },
  ];
  return {
    instrument: "sus",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "刚才的使用感受", en: "Your experience using the system" }),
    shortTitle: "SUS",
    intro: text(language, { zh: "请根据第一反应作答，不需要反复斟酌。", en: "Answer from your first impression without overthinking each item." }),
    pageSize: 5,
    questions: prompts.map((prompt, index) => ({
      id: `SUS${index + 1}`,
      kind: "scale",
      required: true,
      prompt: text(language, prompt),
      min: 1,
      max: 5,
      step: 1,
      minLabel: agreement[language].min,
      maxLabel: agreement[language].max,
      presentation: "buttons",
    })),
  };
}

function agencyOwnershipDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  return {
    instrument: "agency_ownership",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "我与这幅作品的关系", en: "My relationship with this artwork" }),
    shortTitle: text(language, { zh: "主体感与所有权", en: "Agency and ownership" }),
    intro: text(language, {
      zh: "请评价刚才的创作过程和共创作品。",
      en: "Rate the creative process and the co-created artwork you just completed.",
    }),
    pageSize: 2,
    questions: [
      {
        id: "AGENCY",
        kind: "scale",
        required: true,
        prompt: text(language, {
          zh: "我对画面内容产生了实际影响。",
          en: "I had a real influence on the content of the artwork.",
        }),
        min: 1,
        max: 5,
        step: 1,
        minLabel: agreement[language].min,
        maxLabel: agreement[language].max,
        presentation: "buttons",
      },
      {
        id: "OWNERSHIP",
        kind: "scale",
        required: true,
        prompt: text(language, {
          zh: "我把这幅画视为自己参与完成的作品。",
          en: "I regard this artwork as something I helped create.",
        }),
        min: 1,
        max: 5,
        step: 1,
        minLabel: agreement[language].min,
        maxLabel: agreement[language].max,
        presentation: "buttons",
      },
    ],
  };
}

function tlxDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  const items: Array<{ id: string; prompt: LocalizedText; min: LocalizedText; max: LocalizedText }> = [
    { id: "TLX_MD", prompt: { zh: "完成任务需要多少思考、判断、记忆或注意？", en: "How much mental and perceptual activity was required?" }, min: { zh: "很低", en: "Very low" }, max: { zh: "很高", en: "Very high" } },
    { id: "TLX_PD", prompt: { zh: "完成任务需要多少身体或操作活动？", en: "How much physical activity was required?" }, min: { zh: "很低", en: "Very low" }, max: { zh: "很高", en: "Very high" } },
    { id: "TLX_TD", prompt: { zh: "任务节奏让你感到多大时间压力？", en: "How much time pressure did you feel due to the task pace?" }, min: { zh: "很低", en: "Very low" }, max: { zh: "很高", en: "Very high" } },
    { id: "TLX_PE", prompt: { zh: "你认为自己完成任务目标的表现如何？", en: "How successful were you in accomplishing the task goals?" }, min: { zh: "完美", en: "Perfect" }, max: { zh: "失败", en: "Failure" } },
    { id: "TLX_EF", prompt: { zh: "为了达到当前结果，你付出了多少努力？", en: "How hard did you have to work to accomplish your level of performance?" }, min: { zh: "很低", en: "Very low" }, max: { zh: "很高", en: "Very high" } },
    { id: "TLX_FR", prompt: { zh: "过程中你感到多大挫败、焦虑、烦躁或不安？", en: "How insecure, discouraged, irritated, stressed, and annoyed were you?" }, min: { zh: "很低", en: "Very low" }, max: { zh: "很高", en: "Very high" } },
  ];
  return {
    instrument: "raw_tlx",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "刚才任务的负荷", en: "Workload during the task" }),
    shortTitle: "Raw NASA-TLX",
    intro: text(language, { zh: "请评价刚才完成任务时的真实负荷。", en: "Rate the workload you experienced while completing the task." }),
    pageSize: 3,
    questions: items.map((item) => ({
      id: item.id,
      kind: "scale",
      required: true,
      prompt: text(language, item.prompt),
      min: 0,
      max: 100,
      step: 5,
      minLabel: text(language, item.min),
      maxLabel: text(language, item.max),
      presentation: "slider",
    })),
  };
}

function manipulationDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  return {
    instrument: "manipulation_check",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "回顾刚才的引导", en: "Reflect on the guidance" }),
    shortTitle: text(language, { zh: "交互检验", en: "Interaction check" }),
    intro: text(language, { zh: "请评价刚才实际感受到的互动过程。", en: "Rate the interaction you actually experienced." }),
    pageSize: 2,
    questions: [
      { id: "MC_PERSPECTIVES", kind: "scale", required: true, prompt: text(language, { zh: "我感受到了多个彼此不同的听觉视角。", en: "I experienced multiple distinct perspectives on the music." }), min: 1, max: 5, step: 1, minLabel: agreement[language].min, maxLabel: agreement[language].max, presentation: "buttons" },
      { id: "MC_DEVELOPMENT", kind: "scale", required: true, prompt: text(language, { zh: "引导促使我进一步发展或调整最初的画面想象。", en: "The guidance prompted me to develop or revise my initial visual imagery." }), min: 1, max: 5, step: 1, minLabel: agreement[language].min, maxLabel: agreement[language].max, presentation: "buttons" },
    ],
  };
}

function csiWeightingDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  const factorOptions = options(language, CSI_FACTORS);
  const questions: QuestionnaireQuestion[] = [];
  for (let left = 0; left < factorOptions.length; left += 1) {
    for (let right = left + 1; right < factorOptions.length; right += 1) {
      const leftFactor = factorOptions[left];
      const rightFactor = factorOptions[right];
      questions.push({
        id: `CSI_WEIGHT_${leftFactor.value}_${rightFactor.value}`,
        kind: "pair",
        required: true,
        prompt: text(language, { zh: "完成这项创作任务时，对我更重要的是能够……", en: "When completing this creative task, it was more important that I could..." }),
        left: leftFactor,
        right: rightFactor,
      });
    }
  }
  return {
    instrument: "csi_weighting",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "这次创作中什么更重要", en: "What mattered most in this creative task" }),
    shortTitle: text(language, { zh: "CSI因子权重", en: "CSI weighting" }),
    intro: text(language, { zh: "每组请选择更重要的一项。这里没有正确答案。", en: "Choose the more important option in each pair. There are no correct answers." }),
    pageSize: 5,
    questions,
  };
}

function imageAlignmentDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  const prompts: LocalizedText[] = [
    { zh: "这幅画准确传达了音乐的整体感受。", en: "This artwork accurately conveys the overall feeling of the music." },
    { zh: "这幅画接近我聆听音乐时形成的意象。", en: "This artwork is close to the imagery I formed while listening." },
    { zh: "画面中的视觉元素与音乐表达协调一致。", en: "The visual elements are coherent with the musical expression." },
  ];
  return {
    instrument: "image_alignment",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "评价这幅作品", en: "Rate this artwork" }),
    shortTitle: text(language, { zh: "图像契合度", en: "Image alignment" }),
    intro: text(language, { zh: "请根据音乐和你形成的画面意象独立评价。", en: "Rate the artwork independently against the music and your own imagery." }),
    pageSize: 3,
    questions: prompts.map((prompt, index) => ({
      id: `IMAGE_ALIGNMENT_${index + 1}`,
      kind: "scale",
      required: true,
      prompt: text(language, prompt),
      min: 1,
      max: 7,
      step: 1,
      minLabel: agreement[language].min,
      maxLabel: agreement[language].max,
      presentation: "buttons",
    })),
  };
}

function preferenceDefinition(language: QuestionnaireLanguage): QuestionnaireDefinition {
  return {
    instrument: "session_preference",
    version: QUESTIONNAIRE_VERSION,
    title: text(language, { zh: "回顾两次创作体验", en: "Compare the two creative experiences" }),
    shortTitle: text(language, { zh: "总体偏好", en: "Overall preference" }),
    intro: text(language, { zh: "请根据两次完整体验作答，不需要判断系统采用了什么技术。", en: "Consider both complete experiences without trying to infer how the system worked." }),
    pageSize: 2,
    questions: [
      { id: "SESSION_PREFERENCE", kind: "choice", required: true, prompt: text(language, { zh: "总体而言，我更偏好哪一次创作体验？", en: "Overall, which creative experience did you prefer?" }), options: options(language, [
        { value: "period_1", label: { zh: "体验一", en: "Experience 1" } },
        { value: "period_2", label: { zh: "体验二", en: "Experience 2" } },
        { value: "tie", label: { zh: "差不多", en: "About the same" } },
      ]) },
      { id: "SESSION_PREFERENCE_REASON", kind: "text", required: false, multiline: true, maxLength: 1200, prompt: text(language, { zh: "可以简单说说原因。", en: "You may briefly explain your choice." }), placeholder: text(language, { zh: "选填", en: "Optional" }) },
    ],
  };
}

export function getQuestionnaireDefinitions(language: QuestionnaireLanguage): QuestionnaireDefinition[] {
  return [
    backgroundDefinition(language),
    csiDefinition(language),
    agencyOwnershipDefinition(language),
    susDefinition(language),
    tlxDefinition(language),
    manipulationDefinition(language),
    csiWeightingDefinition(language),
    imageAlignmentDefinition(language),
    preferenceDefinition(language),
  ];
}

export function getQuestionnaireDefinition(
  instrument: QuestionnaireDefinition["instrument"],
  language: QuestionnaireLanguage = "zh"
): QuestionnaireDefinition {
  const definition = getQuestionnaireDefinitions(language).find(
    (item) => item.instrument === instrument
  );
  if (!definition) throw new Error(`Unknown questionnaire instrument: ${instrument}`);
  return definition;
}

export const MUSICIAN_PROFILE_VERSION = "2.0.0" as const;

export interface ListeningLens {
  name: string;
  attendsTo: string;
  interpretiveQuestion: string;
}

export interface MusicianAgentProfile {
  id: string;
  displayName: string;
  identityContext: string;
  listeningLenses: ListeningLens[];
  interpretiveTensions: string[];
  visualSensibilities: string[];
  conversationalStyle: {
    tone: string;
    cadence: string;
    invitation: string;
  };
  avoidPatterns: string[];
  temperature: number;
}

export interface MusicianAgentInput {
  profile: MusicianAgentProfile;
  musicContext: string;
  userNote?: string;
}

export interface MusicianAgentResult {
  comment: string;
  model: string;
  profileVersion: typeof MUSICIAN_PROFILE_VERSION;
  attempts: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

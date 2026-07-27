export interface GenerationActivity {
  generating: boolean;
  submittingUserNote: boolean;
  hasPendingUserMessage: boolean;
  loadingCount: number;
  streamingCount: number;
}

export function isGenerationActionBlocked(activity: GenerationActivity): boolean {
  return (
    activity.generating ||
    activity.submittingUserNote ||
    activity.hasPendingUserMessage ||
    activity.loadingCount > 0 ||
    activity.streamingCount > 0
  );
}

export function hasAllSelectedMusicianComments(
  selectedMusicianIds: readonly string[],
  comments: Readonly<Record<string, string>>
): boolean {
  return (
    selectedMusicianIds.length > 0 &&
    selectedMusicianIds.every((characterId) => Boolean(comments[characterId]?.trim()))
  );
}

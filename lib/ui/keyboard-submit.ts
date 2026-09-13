interface SubmitKeyEvent {
  key: string;
  shiftKey?: boolean;
  nativeEvent?: {
    isComposing?: boolean;
  };
}

export function shouldSubmitOnEnter(event: SubmitKeyEvent): boolean {
  return event.key === "Enter"
    && !event.shiftKey
    && !event.nativeEvent?.isComposing;
}

interface ClipboardWriter {
  writeText: (text: string) => Promise<void>;
}

/** A copy is successful only after the browser acknowledges the write. */
export async function copyTextToClipboard(text: string, clipboard?: ClipboardWriter): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

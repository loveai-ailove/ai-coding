"use client";

export async function readSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: any) => void
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushBuffer = (force = false) => {
    const normalized = buffer.replace(/\r\n/g, "\n");
    const blocks = normalized.split("\n\n");

    if (!force) {
      buffer = blocks.pop() || "";
    } else {
      buffer = "";
    }

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      let eventName = "";
      const dataLines: string[] = [];

      for (const line of trimmed.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (!eventName || dataLines.length === 0) continue;

      try {
        onEvent(eventName, JSON.parse(dataLines.join("\n")));
      } catch {
        // Ignore malformed event payloads to keep stream consumption resilient.
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      flushBuffer(true);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    flushBuffer(false);
  }
}

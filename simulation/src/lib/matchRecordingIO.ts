// Browser-side save/load of match recordings as gzipped JSON files.
// The CLI writes the same format using Node's zlib (see CLIRunner).

import { MatchRecording } from "./replayTypes";

/**
 * Serialize a match recording to gzipped JSON and trigger a browser download.
 */
export async function downloadRecording(recording: MatchRecording): Promise<void> {
  const json = JSON.stringify(recording);
  const compressedStream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const blob = await new Response(compressedStream).blob();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `doomspire-match-${timestamp}.json.gz`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read a match recording from a file (gzipped or plain JSON).
 * Throws if the file is not a valid match recording.
 */
export async function readRecordingFromFile(file: File): Promise<MatchRecording> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Gzip files start with the magic bytes 0x1f 0x8b
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

  let json: string;
  if (isGzip) {
    const decompressedStream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    json = await new Response(decompressedStream).text();
  } else {
    json = new TextDecoder().decode(bytes);
  }

  const recording = JSON.parse(json) as MatchRecording;
  if (!recording || !Array.isArray(recording.snapshots) || !Array.isArray(recording.gameLog) || recording.snapshots.length === 0) {
    throw new Error("The file is not a valid match recording");
  }
  return recording;
}

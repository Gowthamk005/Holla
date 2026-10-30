import { spawn } from "child_process";

export function probe(file) {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json", file,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", () => resolve(null)); // FFmpeg not installed
    p.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const j = JSON.parse(out);
        const s = (j.streams || [])[0] || {};
        resolve({
          width: s.width || 0,
          height: s.height || 0,
          duration: parseFloat(j.format?.duration) || 0,
        });
      } catch {
        resolve(null);
      }
    });
  });
}
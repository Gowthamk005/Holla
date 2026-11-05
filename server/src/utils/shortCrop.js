import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

/*
 * Turns a landscape (16:9) clip into a vertical 9:16 Short (1080x1920).
 * It keeps the middle of the picture and cuts the sides, like a phone crop.
 * Needs FFmpeg on the server (set FFMPEG_PATH if it is not on the PATH).
 * Returns { fileName, size } of the new mp4 and removes the original upload.
 */
export function cropToVertical(inputPath) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const tmp = path.join(dir, `${base}-916.tmp.mp4`);
  const out = path.join(dir, `${base}.mp4`);
  const args = [
    "-y",
    "-i", inputPath,
    "-vf", "crop=ih*9/16:ih,scale=1080:1920",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    tmp,
  ];

  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let log = "";
    p.stderr.on("data", (d) => {
      log = (log + d).slice(-600);
    });
    p.on("error", (err) => reject(err));
    p.on("close", async (code) => {
      try {
        if (code !== 0) {
          await fs.unlink(tmp).catch(() => {});
          return reject(new Error("FFmpeg could not crop the video: " + log.slice(-200)));
        }
        await fs.rename(tmp, out);
        if (out !== inputPath) await fs.unlink(inputPath).catch(() => {});
        const { size } = await fs.stat(out);
        resolve({ fileName: path.basename(out), size });
      } catch (err) {
        reject(err);
      }
    });
  });
}

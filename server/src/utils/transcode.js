import { spawn } from "child_process";
import path from "path";
import { config } from "../config.js";
import { Video } from "../models/Video.js";

const HEIGHTS = [1080, 720, 480, 360, 240, 144];

function probeHeight(file) {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=height", "-of", "csv=p=0", file]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", () => resolve(0));
    p.on("close", () => resolve(parseInt(out, 10) || 0));
  });
}

function run(args) {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/* makes one smaller copy per size that is not bigger than the original */
export async function makeRenditions(videoId) {
  const video = await Video.findById(videoId);
  if (!video || !video.videoFile) return;

  const input = path.join(config.uploadsDir, "videos", video.videoFile);
  const sourceHeight = await probeHeight(input);
  if (!sourceHeight) return; // FFmpeg not installed, or the file could not be read

  const renditions = [];
  for (const h of HEIGHTS.filter((h) => h <= sourceHeight)) {
    const name = `${video._id}-${h}p.mp4`;
    const out = path.join(config.uploadsDir, "videos", name);
    const ok = await run([
      "-y", "-i", input,
      "-vf", `scale=-2:${h}`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      out,
    ]);
    if (ok) renditions.push({ label: `${h}p`, height: h, url: `/uploads/videos/${name}` });
  }
  await Video.updateOne({ _id: video._id }, { renditions });
}
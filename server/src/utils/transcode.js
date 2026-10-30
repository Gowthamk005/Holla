import { spawn } from "child_process";
import path from "path";
import { config } from "../config.js";
import { Video } from "../models/Video.js";
import { probe } from "./probe.js";

const HEIGHTS = [1080, 720, 480, 360, 240, 144];

function run(args) {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/* runs in the background after upload: thumbnail if none, then 144p to 1080p copies */
export async function processVideo(videoId) {
  const video = await Video.findById(videoId);
  if (!video || !video.videoFile) return;

  const input = path.join(config.uploadsDir, "videos", video.videoFile);
  const info = await probe(input);
  if (!info) return; // FFmpeg missing: nothing to do

  const update = {};
  if (!video.duration && info.duration) update.duration = Math.round(info.duration);

  // automatic thumbnail from the middle of the video (or 1 second in)
  if (!video.thumbnailUrl) {
    const name = `${video._id}-auto.jpg`;
    const out = path.join(config.uploadsDir, "thumbs", name);
    const at = Math.min(1, Math.max(0, (info.duration || 2) / 2));
    const ok = await run(["-y", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", out]);
    if (ok) {
      update.thumbnailUrl = `/uploads/thumbs/${name}`;
      update.thumbFile = name;
    }
  }

  const renditions = [];
  for (const h of HEIGHTS.filter((h) => h <= info.height)) {
    const name = `${video._id}-${h}p.mp4`;
    const out = path.join(config.uploadsDir, "videos", name);
    const ok = await run([
      "-y", "-i", input, "-vf", `scale=-2:${h}`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
    ]);
    if (ok) renditions.push({ label: `${h}p`, height: h, url: `/uploads/videos/${name}` });
  }
  update.renditions = renditions;

  await Video.updateOne({ _id: video._id }, update);
}
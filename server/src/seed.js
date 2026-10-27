/* Demo data: creators, subscriptions and sample videos that stream from the internet. Run once: npm run seed */
import bcrypt from "bcryptjs";
import { connectDB } from "./db.js";
import { User } from "./models/User.js";
import { Video } from "./models/Video.js";
import { Subscription } from "./models/Subscription.js";
import { config } from "./config.js";
import mongoose from "mongoose";

const SAMPLE_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

const creators = [
  { username: "olla_music", name: "Olla Music", bio: "Live concerts and studio sessions.", interests: ["music"] },
  { username: "olla_travel", name: "Olla Travel", bio: "Cinematic journeys across India.", interests: ["travel", "food"] },
  { username: "pixel_pulse", name: "Pixel Pulse", bio: "Gaming tips and challenges.", interests: ["gaming"] },
  { username: "laugh_lane", name: "Laugh Lane", bio: "Stand-up and sketches.", interests: ["comedy"] },
];

const videos = [
  ["olla_music", "music", "Live Concert: Chennai Nights", img("1493225457124-a3eb161ffa5f")],
  ["olla_music", "music", "Lo-fi Beats to Study and Relax", img("1524368535928-5b5e00ddc76b")],
  ["olla_travel", "travel", "Beautiful Tamil Nadu - Cinematic Journey", img("1470214304380-aadaedcfff1b")],
  ["olla_travel", "food", "Amazing Street Food in India", img("1552566626-52f8b828add9")],
  ["pixel_pulse", "gaming", "Pro Tips: Climb Ranked Faster", img("1511512578047-dfb367046420")],
  ["pixel_pulse", "gaming", "Retro Games That Defined a Generation", img("1550745165-9bc0b252726f")],
  ["laugh_lane", "comedy", "Stand-up Special: Office Life", img("1527224857830-43a7acc85260")],
  ["laugh_lane", "comedy", "Try Not To Laugh Challenge", img("1492619375914-88005aa9e8fb")],
];

async function run() {
  await connectDB();

  // remove only previous demo content, never real users
  const demoUsers = await User.find({ username: { $in: creators.map((c) => c.username) } }).select("_id");
  await Video.deleteMany({ owner: { $in: demoUsers.map((u) => u._id) } });
  await Subscription.deleteMany({ channel: { $in: demoUsers.map((u) => u._id) } });
  await User.deleteMany({ _id: { $in: demoUsers.map((u) => u._id) } });

  const passwordHash = await bcrypt.hash("password123", 10);
  const created = await User.insertMany(creators.map((c) => ({ ...c, passwordHash })));

  for (const [owner, category, title, thumb] of videos) {
    const u = created.find((c) => c.username === owner);
    await Video.create({
      owner: u._id,
      title,
      description: "Sample video for testing Olla.",
      category,
      videoUrl: SAMPLE_VIDEO,
      thumbnailUrl: thumb,
      duration: 600,
      views: Math.floor(Math.random() * 90000) + 1000,
      likesCount: Math.floor(Math.random() * 900),
    });
  }

  // admin account from ADMIN_USERNAMES (or "admin")
  const adminName = config.adminUsernames[0] || "admin";
  if (!(await User.exists({ username: adminName }))) {
    await User.create({ username: adminName, name: "Olla Admin", passwordHash: await bcrypt.hash("admin12345", 10), role: "admin" });
    console.log(`Created admin: ${adminName} / admin12345  (change this password!)`);
  }

  console.log(`Seeded ${created.length} creators (password: password123) and ${videos.length} videos.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});

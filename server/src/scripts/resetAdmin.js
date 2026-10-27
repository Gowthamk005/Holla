/*
 * Set (or reset) an admin login.
 *   npm run reset-admin -- <username> <new-password>
 * Example:
 *   npm run reset-admin -- admin MyNewPass123
 * The password must be at least 8 characters.
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { User } from "../models/User.js";
import { config } from "../config.js";

const [, , argUser, argPass] = process.argv;
const username = (argUser || config.adminUsernames[0] || "admin").toLowerCase();

if (!argPass || argPass.length < 8) {
  console.log("Usage: npm run reset-admin -- <username> <new-password (8+ characters)>");
  process.exit(1);
}

await connectDB();
const passwordHash = await bcrypt.hash(argPass, 10);
await User.findOneAndUpdate(
  { username },
  { $set: { passwordHash, role: "admin", disabled: false }, $setOnInsert: { name: "Admin" } },
  { upsert: true }
);
console.log(`Admin ready. Log in with username "${username}" and the password you just set.`);
await mongoose.disconnect();

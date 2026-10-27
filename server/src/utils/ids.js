import mongoose from "mongoose";

export const isId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;

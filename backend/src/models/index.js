import mongoose from "mongoose";
const { Schema } = mongoose;
const registration =
  /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
export const userSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user" },
  },
  { timestamps: true },
);
export const vehicleSchema = new Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      match: registration,
    },
    make: { type: String, default: "", maxlength: 80 },
    model: { type: String, default: "", maxlength: 80 },
    vehicleClass: { type: String, default: "", maxlength: 80 },
    fuelType: { type: String, default: "", maxlength: 40 },
    registrationStatus: {
      type: String,
      enum: ["unknown", "active", "expired", "suspended"],
      default: "unknown",
    },
    registrationSource: {
      type: String,
      default: "Unverified local entry",
      maxlength: 200,
    },
    authorizationStatus: {
      type: String,
      enum: ["authorised", "unauthorised", "blacklisted"],
      default: "unauthorised",
    },
    ownerLabel: { type: String, default: "", maxlength: 80 },
    dataSource: {
      type: String,
      enum: ["Local database", "Demonstration data"],
      default: "Local database",
    },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const logSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inputMethod: {
      type: String,
      enum: ["manual", "image_upload", "mobile_camera", "webcam"],
      required: true,
    },
    recognizedRegistrationNumber: { type: String, default: "" },
    correctedRegistrationNumber: { type: String, default: "" },
    registrationNumber: { type: String, default: "", index: true },
    confidence: { type: Number, min: 0, max: 1 },
    detectorConfidence: { type: Number, min: 0, max: 1 },
    recognitionStatus: {
      type: String,
      enum: ["manual", "pending_confirmation", "confirmed", "failed"],
      required: true,
    },
    failureCode: String,
    candidates: { type: [Schema.Types.Mixed], default: [] },
    localLookupResult: {
      type: String,
      enum: ["not_attempted", "found", "not_found"],
      default: "not_attempted",
    },
    externalLookupStatus: { type: String, default: "not_attempted" },
    resultSource: { type: String, default: "Not looked up" },
    expiresAt: { type: Date, required: true },
    confirmedAt: Date,
  },
  { timestamps: true },
);
logSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const cacheSchema = new Schema(
  {
    registrationNumber: { type: String, required: true },
    providerId: { type: String, required: true },
    fields: { type: Schema.Types.Mixed, required: true },
    retrievedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
cacheSchema.index({ registrationNumber: 1, providerId: 1 }, { unique: true });
cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const User = mongoose.model("User", userSchema);
export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
export const RecognitionLog = mongoose.model("RecognitionLog", logSchema);
export const ExternalCache = mongoose.model("ExternalCache", cacheSchema);

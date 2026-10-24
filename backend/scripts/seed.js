import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "../src/config.js";
import { User, Vehicle } from "../src/models/index.js";
const c = config();
const email = process.env.ADMIN_EMAIL?.toLowerCase(),
  password = process.env.ADMIN_PASSWORD;
if (
  !email ||
  !password ||
  password.length < 12 ||
  password.startsWith("REPLACE_")
)
  throw Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in backend/.env. No default password is provided.",
  );
await mongoose.connect(c.MONGODB_URI);
try {
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: "Project administrator",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
    });
    console.log("Administrator created.");
  } else if (existing.role !== "admin")
    throw Error(
      "This email belongs to an existing user; choose a different admin email.",
    );
  else console.log("Administrator already exists; password unchanged.");
  for (const d of [
    {
      registrationNumber: "PB10AB1234",
      make: "Demo Motors",
      model: "Campus One",
      vehicleClass: "Demo car",
      fuelType: "Electric",
      authorizationStatus: "authorised",
    },
    {
      registrationNumber: "DL01CA5678",
      make: "Example Mobility",
      model: "City Two",
      vehicleClass: "Demo motorcycle",
      fuelType: "Petrol",
      authorizationStatus: "unauthorised",
    },
    {
      registrationNumber: "MH12AB9012",
      make: "Fictional Auto",
      model: "Lab Three",
      vehicleClass: "Demo car",
      fuelType: "Diesel",
      authorizationStatus: "blacklisted",
    },
  ]) {
    await Vehicle.updateOne(
      { registrationNumber: d.registrationNumber },
      {
        $setOnInsert: {
          ...d,
          ownerLabel: "Fictional demonstration record",
          dataSource: "Demonstration data",
          isDemo: true,
          registrationStatus: "unknown",
          registrationSource: "Not verified — fictional demonstration data",
        },
      },
      { upsert: true, runValidators: true },
    );
  }
  console.log(
    "Three fictional demonstration vehicles seeded. Existing records were preserved.",
  );
} finally {
  await mongoose.disconnect();
}

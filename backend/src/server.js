import mongoose from "mongoose";
import { config } from "./config.js";
import { createApp } from "./app.js";
const c = config();
await mongoose.connect(c.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const server = createApp(c).listen(c.PORT, "0.0.0.0", () =>
  console.log(`PlateWatch API listening on ${c.PORT}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }),
  );

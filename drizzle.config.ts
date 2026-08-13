import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "mysql://orbis:orbis@127.0.0.1:3306/orbis",
  },
});

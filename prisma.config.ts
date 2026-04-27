import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

/**
 * Read .env files manually — avoids dotenv's `#` comment-parsing bug
 * that breaks URLs containing `#` characters in passwords.
 */
function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const envLocal = readEnvFile(path.join(__dirname, ".env.local"));
const envFile = readEnvFile(path.join(__dirname, ".env"));
const env = { ...envFile, ...envLocal }; // .env.local overrides .env

/**
 * URL-encode password in PostgreSQL connection string.
 */
function encodeDatabaseUrl(url: string): string {
  if (!url) return "";
  const match = url.match(/^(postgresql|postgres):\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) return url;
  const [, protocol, user, password, rest] = match;
  const encodedPassword = encodeURIComponent(password);
  return `${protocol}://${user}:${encodedPassword}@${rest}`;
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: encodeDatabaseUrl(env.DIRECT_URL || env.DATABASE_URL || ""),
  },
});

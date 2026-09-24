import { z } from "zod";

export function parseEnvBoolean(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return value;
}

export const envBoolean = z.preprocess(
  parseEnvBoolean,
  z.boolean(),
);
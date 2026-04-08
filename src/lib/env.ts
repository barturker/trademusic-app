const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MIN_SECRET_SALT_LENGTH = 32;

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSecretSalt(): string {
  const value = getEnvVar("SECRET_SALT");
  if (IS_PRODUCTION && value.length < MIN_SECRET_SALT_LENGTH) {
    throw new Error(
      `SECRET_SALT must be at least ${MIN_SECRET_SALT_LENGTH} characters in production`,
    );
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return getEnvVar("DATABASE_URL");
  },
  get SECRET_SALT() {
    return getSecretSalt();
  },
  get ENCRYPTION_KEK() {
    return getEnvVar("ENCRYPTION_KEK");
  },
  get ADMIN_SECRET() {
    return getEnvVar("ADMIN_SECRET");
  },
  get ADMIN_PATH() {
    return process.env.ADMIN_PATH ?? "d/overview";
  },
  get IRON_SESSION_PASSWORD() {
    return getEnvVar("IRON_SESSION_PASSWORD");
  },
  get ADMIN_GATE_KEY() {
    return getEnvVar("ADMIN_GATE_KEY");
  },
} as const;

export const publicEnv = {
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001",
  UPLOAD_URL: process.env.NEXT_PUBLIC_UPLOAD_URL ?? "http://localhost:8080/uploads",
  CF_BEACON_TOKEN: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "",
} as const;

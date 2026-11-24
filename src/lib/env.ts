import { z } from "zod";

const booleanString = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatória")
    .refine((value) => value.startsWith("postgres"), "DATABASE_URL deve ser uma URL PostgreSQL"),
  DIRECT_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  POMODORO_MINUTES: z.coerce.number().int().min(1).max(180).default(25),
  CHALLENGE_EXPIRES_MINUTES: z.coerce.number().int().min(5).max(10_080).default(1440),
  SEED_DEMO: booleanString,
  VERCEL_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Configuração de ambiente inválida: ${details}`);
}

export const env = parsed.data;

export const githubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

export const trustedOrigins = [
  env.BETTER_AUTH_URL,
  ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
];

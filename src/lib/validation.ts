import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres.").max(80).optional(),
    theme: themeSchema.optional(),
    isPublic: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

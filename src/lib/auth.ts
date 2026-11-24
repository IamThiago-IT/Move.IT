import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env, githubConfigured, trustedOrigins } from "@/lib/env";
import { prisma } from "@/lib/prisma";

interface GitHubProfile {
  id: number | string;
  login?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export function normalizeUsername(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 39);

  return normalized || fallback;
}

async function mapGitHubProfile(profile: GitHubProfile) {
  const githubId = String(profile.id);
  const baseUsername = normalizeUsername(
    profile.login ?? profile.name ?? `user-${githubId}`,
    `user-${githubId}`,
  );

  // GitHub logins can be renamed and later claimed by another account. Keep
  // the public URL stable and unique without ever failing a login.
  const usernameTaken = await prisma.user.findFirst({
    where: {
      username: baseUsername,
      NOT: { githubId },
    },
    select: { id: true },
  });

  const username = usernameTaken
    ? normalizeUsername(`${baseUsername}-${githubId}`, `user-${githubId}`)
    : baseUsername;

  return {
    username,
    githubId,
    name: profile.name?.trim() || profile.login || `GitHub ${githubId}`,
    email:
      profile.email ??
      `${githubId}+${baseUsername}@users.noreply.github.com`,
    image: profile.avatar_url ?? null,
  };
}

export const auth = betterAuth({
  appName: "move.it",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: githubConfigured
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID as string,
          clientSecret: env.GITHUB_CLIENT_SECRET as string,
          mapProfileToUser: mapGitHubProfile,
        },
      }
    : {},
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: true,
        returned: true,
      },
      githubId: {
        type: "string",
        required: false,
        input: true,
        returned: false,
      },
      totalExperience: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
        returned: true,
      },
      currentExperience: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
        returned: true,
      },
      level: {
        type: "number",
        required: false,
        defaultValue: 1,
        input: false,
        returned: true,
      },
      challengesCompleted: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
        returned: true,
      },
      theme: {
        type: "string",
        required: false,
        defaultValue: "system",
        input: false,
        returned: true,
      },
      isPublic: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
        returned: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  plugins: [nextCookies()],
});

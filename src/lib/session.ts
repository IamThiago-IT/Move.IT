import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { ProgressStats } from "@/lib/experience";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export async function getSession(): Promise<AuthSession | null> {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getSessionFromRequest(request: Request): Promise<AuthSession | null> {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function requireSession(nextPath = "/"): Promise<AuthSession> {
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}

export interface AppUser extends ProgressStats {
  id: string;
  name: string;
  email: string;
  image: string | null;
  username: string | null;
  githubId: string | null;
  theme: string;
  isPublic: boolean;
  createdAt: Date;
}

export function toProgressStats(user: ProgressStats): ProgressStats {
  return {
    level: user.level,
    currentExperience: user.currentExperience,
    totalExperience: user.totalExperience,
    challengesCompleted: user.challengesCompleted,
  };
}

export function displayName(user: Pick<AppUser, "name" | "username">): string {
  return user.name || user.username || "Pessoa move.it";
}

export function profilePath(user: Pick<AppUser, "username" | "id">): string | null {
  return user.username ? `/u/${encodeURIComponent(user.username)}` : null;
}

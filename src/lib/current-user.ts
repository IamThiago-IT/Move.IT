import { prisma } from "@/lib/prisma";
import { getSession, type AppUser } from "@/lib/session";

const appUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  username: true,
  githubId: true,
  level: true,
  currentExperience: true,
  totalExperience: true,
  challengesCompleted: true,
  theme: true,
  isPublic: true,
  createdAt: true,
} as const;

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: appUserSelect,
  });
}

export async function getUserById(id: string): Promise<AppUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: appUserSelect,
  });
}

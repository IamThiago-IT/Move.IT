import type { ChallengeAttempt, PomodoroCycle } from "@/generated/prisma/client";
import { experienceForLevel, type ProgressStats } from "@/lib/experience";

export interface ProgressDTO extends ProgressStats {
  experienceToNextLevel: number;
}

export interface CycleDTO {
  id: string;
  status: PomodoroCycle["status"];
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  remainingSeconds: number;
}

export interface ChallengeDTO {
  id: string;
  challengeId: string;
  type: "body" | "eye";
  description: string;
  amount: number;
  status: ChallengeAttempt["status"];
  issuedAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface ProgressSnapshotDTO {
  progress: ProgressDTO;
  cycle: CycleDTO | null;
  challenge: ChallengeDTO | null;
}

export interface MutationResultDTO extends ProgressSnapshotDTO {
  leveledUp?: boolean;
  levelsGained?: number;
  message?: string;
}

export function toProgressDTO(progress: ProgressStats): ProgressDTO {
  return {
    ...progress,
    experienceToNextLevel: experienceForLevel(progress.level),
  };
}

export function toCycleDTO(cycle: PomodoroCycle | null, now = Date.now()): CycleDTO | null {
  if (!cycle) {
    return null;
  }

  return {
    id: cycle.id,
    status: cycle.status,
    startedAt: cycle.startedAt.toISOString(),
    endsAt: cycle.endsAt.toISOString(),
    completedAt: cycle.completedAt?.toISOString() ?? null,
    abandonedAt: cycle.abandonedAt?.toISOString() ?? null,
    remainingSeconds: Math.max(0, Math.ceil((cycle.endsAt.getTime() - now) / 1000)),
  };
}

export function toChallengeDTO(challenge: ChallengeAttempt | null, now = Date.now()): ChallengeDTO | null {
  if (!challenge) {
    return null;
  }

  return {
    id: challenge.id,
    challengeId: challenge.challengeId,
    type: challenge.type === "eye" ? "eye" : "body",
    description: challenge.description,
    amount: challenge.amount,
    status: challenge.status,
    issuedAt: challenge.issuedAt.toISOString(),
    expiresAt: challenge.expiresAt.toISOString(),
    expired: challenge.expiresAt.getTime() <= now,
  };
}

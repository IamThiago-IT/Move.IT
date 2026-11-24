import { randomInt } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { pickRandomChallenge } from "@/lib/challenges";
import { toChallengeDTO, toCycleDTO, toProgressDTO, type MutationResultDTO, type ProgressSnapshotDTO } from "@/lib/dto";
import { env } from "@/lib/env";
import { ConflictError, GoneError, NotFoundError } from "@/lib/errors";
import { applyExperience } from "@/lib/experience";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

const progressSelect = {
  level: true,
  currentExperience: true,
  totalExperience: true,
  challengesCompleted: true,
} satisfies Prisma.UserSelect;

function uniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function snapshot(db: DbClient, userId: string, now: number): Promise<ProgressSnapshotDTO> {
  const [user, cycle, challenge] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: progressSelect,
    }),
    db.pomodoroCycle.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    }),
    db.challengeAttempt.findFirst({
      where: { userId, status: "PENDING" },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  if (!user) {
    throw new NotFoundError("Usuário não encontrado.");
  }

  return {
    progress: toProgressDTO(user),
    cycle: toCycleDTO(cycle, now),
    challenge: toChallengeDTO(challenge, now),
  };
}

export async function getProgressSnapshot(userId: string): Promise<ProgressSnapshotDTO> {
  return snapshot(prisma, userId, Date.now());
}

export async function startCycle(userId: string): Promise<ProgressSnapshotDTO> {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const pendingChallenge = await tx.challengeAttempt.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { issuedAt: "desc" },
      });

      if (pendingChallenge) {
        if (pendingChallenge.expiresAt.getTime() > now.getTime()) {
          throw new ConflictError(
            "Resolva o desafio atual antes de iniciar outro ciclo.",
            "CHALLENGE_PENDING",
          );
        }

        await tx.challengeAttempt.update({
          where: { id: pendingChallenge.id },
          data: { status: "EXPIRED" },
        });
      }

      const activeCycle = await tx.pomodoroCycle.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
      });

      if (activeCycle) {
        if (activeCycle.endsAt.getTime() > now.getTime()) {
          throw new ConflictError("Já existe um ciclo em andamento.", "CYCLE_ACTIVE");
        }

        await tx.pomodoroCycle.update({
          where: { id: activeCycle.id },
          data: { status: "EXPIRED", activeCycleKey: null },
        });
      }

      await tx.pomodoroCycle.create({
        data: {
          userId,
          startedAt: now,
          endsAt: new Date(now.getTime() + env.POMODORO_MINUTES * 60_000),
          activeCycleKey: userId,
        },
      });

      return snapshot(tx, userId, now.getTime());
    });
  } catch (error) {
    if (uniqueConstraint(error)) {
      throw new ConflictError("Já existe um ciclo em andamento.", "CYCLE_ACTIVE");
    }

    throw error;
  }
}

export async function completeCycle(userId: string): Promise<MutationResultDTO> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.pomodoroCycle.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { challenge: true },
      orderBy: { startedAt: "desc" },
    });

    if (!cycle) {
      const existing = await tx.challengeAttempt.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { issuedAt: "desc" },
      });

      if (existing) {
        return snapshot(tx, userId, now.getTime());
      }

      throw new NotFoundError("Nenhum ciclo ativo para finalizar.");
    }

    if (cycle.endsAt.getTime() > now.getTime()) {
      throw new ConflictError("O ciclo ainda está em andamento.", "CYCLE_RUNNING");
    }

    const claimed = await tx.pomodoroCycle.updateMany({
      where: { id: cycle.id, status: "ACTIVE" },
      data: {
        status: "COMPLETED",
        completedAt: now,
        activeCycleKey: null,
      },
    });

    if (claimed.count === 0) {
      throw new ConflictError("Este ciclo já foi finalizado.", "CYCLE_ALREADY_COMPLETED");
    }

    let challenge = cycle.challenge;

    if (challenge?.status === "PENDING" && challenge.expiresAt.getTime() > now.getTime()) {
      // A pending, unexpired challenge already exists for this cycle.
    } else {
      if (challenge?.status === "PENDING") {
        await tx.challengeAttempt.update({
          where: { id: challenge.id },
          data: { status: "EXPIRED" },
        });
      }

      const picked = pickRandomChallenge((max) => randomInt(max));

      challenge = await tx.challengeAttempt.create({
        data: {
          cycleId: cycle.id,
          userId,
          challengeId: picked.id,
          type: picked.type,
          description: picked.description,
          amount: picked.amount,
          issuedAt: now,
          expiresAt: new Date(now.getTime() + env.CHALLENGE_EXPIRES_MINUTES * 60_000),
        },
      });
    }

    const result = await snapshot(tx, userId, now.getTime());

    return {
      ...result,
      challenge: toChallengeDTO(challenge, now.getTime()),
      message: "Ciclo concluído! Seu desafio está pronto.",
    };
  });
}

export async function abandonCycle(userId: string): Promise<ProgressSnapshotDTO> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.pomodoroCycle.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });

    if (!cycle) {
      const existing = await tx.challengeAttempt.findFirst({
        where: { userId, status: "PENDING" },
      });

      if (existing) {
        throw new ConflictError(
          "Resolva o desafio atual antes de iniciar outro ciclo.",
          "CHALLENGE_PENDING",
        );
      }

      return snapshot(tx, userId, now.getTime());
    }

    await tx.pomodoroCycle.update({
      where: { id: cycle.id },
      data: {
        status: "ABANDONED",
        abandonedAt: now,
        activeCycleKey: null,
      },
    });

    await tx.challengeAttempt.updateMany({
      where: { cycleId: cycle.id, status: "PENDING" },
      data: { status: "FAILED" },
    });

    return snapshot(tx, userId, now.getTime());
  });
}

export async function completeChallenge(
  userId: string,
  challengeId: string,
): Promise<MutationResultDTO> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const challenge = await tx.challengeAttempt.findFirst({
      where: { id: challengeId, userId },
    });

    if (!challenge) {
      throw new NotFoundError("Desafio não encontrado.");
    }

    if (challenge.status === "COMPLETED") {
      return snapshot(tx, userId, now.getTime());
    }

    if (challenge.status !== "PENDING") {
      throw new ConflictError("Este desafio não está mais disponível.", "CHALLENGE_UNAVAILABLE");
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      await tx.challengeAttempt.update({
        where: { id: challenge.id },
        data: { status: "EXPIRED" },
      });

      throw new GoneError("Este desafio expirou. Complete outro ciclo para receber um novo.");
    }

    const claimed = await tx.challengeAttempt.updateMany({
      where: { id: challenge.id, userId, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: now },
    });

    if (claimed.count === 0) {
      throw new ConflictError("Este desafio já foi processado.", "CHALLENGE_ALREADY_PROCESSED");
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: progressSelect,
    });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado.");
    }

    const result = applyExperience(user, challenge.amount);

    await tx.user.update({
      where: { id: userId },
      data: {
        level: result.level,
        currentExperience: result.currentExperience,
        totalExperience: result.totalExperience,
        challengesCompleted: result.challengesCompleted,
      },
    });

    const current = await snapshot(tx, userId, now.getTime());

    return {
      ...current,
      leveledUp: result.leveledUp,
      levelsGained: result.levelsGained,
      message: result.leveledUp
        ? `Você subiu para o level ${result.level}!`
        : `+${challenge.amount} XP adicionados ao seu progresso.`,
    };
  });
}

export async function failChallenge(
  userId: string,
  challengeId: string,
): Promise<ProgressSnapshotDTO> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const challenge = await tx.challengeAttempt.findFirst({
      where: { id: challengeId, userId },
    });

    if (!challenge) {
      throw new NotFoundError("Desafio não encontrado.");
    }

    if (challenge.status === "COMPLETED") {
      throw new ConflictError("Este desafio já foi concluído.", "CHALLENGE_ALREADY_COMPLETED");
    }

    if (challenge.status === "PENDING") {
      await tx.challengeAttempt.update({
        where: { id: challenge.id },
        data: { status: "FAILED" },
      });
    }

    return snapshot(tx, userId, now.getTime());
  });
}

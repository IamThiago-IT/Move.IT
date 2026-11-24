import { z } from "zod";

import { applyExperience, toProgressStats, type ProgressStats } from "@/lib/experience";
import { pickRandomChallenge, type Challenge } from "@/lib/challenges";

export const GUEST_STORAGE_KEY = "moveit:guest-progress:v2";

export interface GuestCycle {
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
}

export interface GuestChallenge extends Challenge {
  challengeId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface GuestState extends ProgressStats {
  version: 2;
  cycle: GuestCycle | null;
  challenge: GuestChallenge | null;
}

export interface GuestActionResult {
  state: GuestState;
  error?: string;
  leveledUp?: boolean;
}

const guestCycleSchema = z.object({
  startedAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

const guestChallengeSchema = z.object({
  id: z.string().min(1),
  challengeId: z.string().min(1),
  type: z.enum(["body", "eye"]),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

const guestStateSchema = z.object({
  version: z.literal(2),
  level: z.number().int().positive(),
  currentExperience: z.number().int().nonnegative(),
  totalExperience: z.number().int().nonnegative(),
  challengesCompleted: z.number().int().nonnegative(),
  cycle: guestCycleSchema.nullable(),
  challenge: guestChallengeSchema.nullable(),
});

export function createInitialGuestState(): GuestState {
  return {
    version: 2,
    ...toProgressStats(null),
    cycle: null,
    challenge: null,
  };
}

export function parseGuestState(raw: string | null): GuestState {
  if (!raw) {
    return createInitialGuestState();
  }

  try {
    const parsed = guestStateSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : createInitialGuestState();
  } catch {
    return createInitialGuestState();
  }
}

export function loadGuestState(storage: Pick<Storage, "getItem"> | null = getStorage()): GuestState {
  if (!storage) {
    return createInitialGuestState();
  }

  return parseGuestState(storage.getItem(GUEST_STORAGE_KEY));
}

export function saveGuestState(
  state: GuestState,
  storage: Pick<Storage, "setItem"> | null = getStorage(),
): void {
  if (!storage) {
    return;
  }

  storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
}

export function clearGuestState(storage: Pick<Storage, "removeItem"> | null = getStorage()): void {
  storage?.removeItem(GUEST_STORAGE_KEY);
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isCycleActive(cycle: GuestCycle | null, now = Date.now()): boolean {
  return Boolean(cycle && !cycle.completedAt && Date.parse(cycle.endsAt) > now);
}

export function isCycleFinished(cycle: GuestCycle | null, now = Date.now()): boolean {
  return Boolean(cycle && !cycle.completedAt && Date.parse(cycle.endsAt) <= now);
}

export function isChallengeExpired(challenge: GuestChallenge | null, now = Date.now()): boolean {
  return Boolean(challenge && Date.parse(challenge.expiresAt) <= now);
}

export function startGuestCycle(
  state: GuestState,
  now: number,
  pomodoroMinutes: number,
): GuestActionResult {
  if (state.challenge) {
    if (isChallengeExpired(state.challenge, now)) {
      return {
        state: { ...state, cycle: null, challenge: null },
        error: "O desafio anterior expirou. Tente novamente.",
      };
    }

    return { state, error: "Resolva o desafio atual antes de iniciar outro ciclo." };
  }

  if (isCycleActive(state.cycle, now)) {
    return { state, error: "Já existe um ciclo em andamento." };
  }

  const startedAt = new Date(now).toISOString();
  const endsAt = new Date(now + pomodoroMinutes * 60_000).toISOString();

  return {
    state: {
      ...state,
      cycle: { startedAt, endsAt, completedAt: null },
      challenge: null,
    },
  };
}

export function completeGuestCycle(
  state: GuestState,
  now: number,
  challengeExpiresMinutes: number,
  randomInt: (max: number) => number = (max) => Math.floor(Math.random() * max),
): GuestActionResult {
  if (!state.cycle || state.cycle.completedAt) {
    return { state, error: "Nenhum ciclo em andamento para finalizar." };
  }

  if (Date.parse(state.cycle.endsAt) > now) {
    return { state, error: "O ciclo ainda está em andamento." };
  }

  if (state.challenge && !isChallengeExpired(state.challenge, now)) {
    return { state };
  }

  const challenge = pickRandomChallenge(randomInt);
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + challengeExpiresMinutes * 60_000).toISOString();

  return {
    state: {
      ...state,
      cycle: { ...state.cycle, completedAt: issuedAt },
      challenge: {
        ...challenge,
        challengeId: challenge.id,
        issuedAt,
        expiresAt,
      },
    },
  };
}

export function completeGuestChallenge(state: GuestState, now: number): GuestActionResult {
  if (!state.challenge) {
    return { state, error: "Nenhum desafio ativo." };
  }

  if (isChallengeExpired(state.challenge, now)) {
    return {
      state: { ...state, challenge: null, cycle: null },
      error: "Este desafio expirou. Complete o próximo ciclo para receber outro.",
    };
  }

  const result = applyExperience(state, state.challenge.amount);

  return {
    state: {
      ...state,
      level: result.level,
      currentExperience: result.currentExperience,
      totalExperience: result.totalExperience,
      challengesCompleted: result.challengesCompleted,
      cycle: null,
      challenge: null,
    },
    leveledUp: result.leveledUp,
  };
}

export function failGuestChallenge(state: GuestState): GuestActionResult {
  if (!state.challenge) {
    return { state, error: "Nenhum desafio ativo." };
  }

  return {
    state: { ...state, challenge: null, cycle: null },
  };
}

export function abandonGuestCycle(state: GuestState): GuestActionResult {
  if (!state.cycle || state.cycle.completedAt) {
    return { state, error: "Nenhum ciclo ativo para abandonar." };
  }

  return {
    state: { ...state, cycle: null, challenge: null },
  };
}

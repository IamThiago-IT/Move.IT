export interface ProgressStats {
  level: number;
  currentExperience: number;
  totalExperience: number;
  challengesCompleted: number;
}

export interface ExperienceResult extends ProgressStats {
  leveledUp: boolean;
  levelsGained: number;
  experienceToNextLevel: number;
}

export const INITIAL_PROGRESS: ProgressStats = {
  level: 1,
  currentExperience: 0,
  totalExperience: 0,
  challengesCompleted: 0,
};

/**
 * The original Move.it curve: level 1 needs 64 XP, level 2 needs 144 XP, etc.
 * Keeping the same curve preserves the identity and expectations of 1.0.
 */
export function experienceForLevel(level: number): number {
  const safeLevel = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;

  return ((safeLevel + 1) * 4) ** 2;
}

export function progressPercent(currentExperience: number, experienceToNextLevel: number): number {
  if (!Number.isFinite(currentExperience) || !Number.isFinite(experienceToNextLevel) || experienceToNextLevel <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((currentExperience / experienceToNextLevel) * 1000) / 10));
}

/**
 * Applies a server-validated XP amount. The caller must load `progress` from
 * the database and must never accept level/XP values from the client.
 */
export function applyExperience(progress: ProgressStats, amount: number): ExperienceResult {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("A quantidade de XP deve ser um inteiro positivo.");
  }

  let level = Math.max(1, Math.floor(progress.level));
  let currentExperience = Math.max(0, Math.floor(progress.currentExperience)) + amount;
  let experienceToNextLevel = experienceForLevel(level);
  let levelsGained = 0;

  while (currentExperience >= experienceToNextLevel) {
    currentExperience -= experienceToNextLevel;
    level += 1;
    levelsGained += 1;
    experienceToNextLevel = experienceForLevel(level);
  }

  return {
    level,
    currentExperience,
    totalExperience: Math.max(0, Math.floor(progress.totalExperience)) + amount,
    challengesCompleted: Math.max(0, Math.floor(progress.challengesCompleted)) + 1,
    leveledUp: levelsGained > 0,
    levelsGained,
    experienceToNextLevel,
  };
}

export function toProgressStats(value: Partial<ProgressStats> | null | undefined): ProgressStats {
  return {
    level: positiveInteger(value?.level, 1),
    currentExperience: nonNegativeInteger(value?.currentExperience, 0),
    totalExperience: nonNegativeInteger(value?.totalExperience, 0),
    challengesCompleted: nonNegativeInteger(value?.challengesCompleted, 0),
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

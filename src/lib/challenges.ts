import { z } from "zod";

import rawChallenges from "@/data/challenges.json";

export const challengeTypeSchema = z.enum(["body", "eye"]);

export const challengeSchema = z.object({
  id: z.string().min(1),
  type: challengeTypeSchema,
  description: z.string().min(1).max(500),
  amount: z.number().int().min(10).max(500),
});

export type Challenge = z.infer<typeof challengeSchema>;

export const challenges: Challenge[] = z
  .array(challengeSchema)
  .min(1)
  .parse(rawChallenges)
  .filter((challenge, index, list) => list.findIndex((item) => item.id === challenge.id) === index);

const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));

export function getChallengeById(id: string): Challenge | undefined {
  return challengeById.get(id);
}

/**
 * Picks a challenge. The optional `randomInt` callback must return an integer
 * in [0, max). Server routes pass crypto.randomInt; guests use Math.random.
 */
export function pickRandomChallenge(
  randomInt: (max: number) => number = (max) => Math.floor(Math.random() * max),
): Challenge {
  const index = randomInt(challenges.length);
  const challenge = challenges[index] ?? challenges[0];

  return challenge;
}

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string | null;
  name: string;
  image: string | null;
  level: number;
  totalExperience: number;
  challengesCompleted: number;
  isCurrentUser: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  currentUserEntry: LeaderboardEntry | null;
  currentUserIsPublic: boolean;
}

interface RankedRow {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  level: number;
  totalExperience: number;
  challengesCompleted: number;
  rank: bigint | number;
}

const RANKING_ORDER =
  '"totalExperience" DESC, "level" DESC, "challengesCompleted" DESC, "createdAt" ASC';

function toEntry(row: RankedRow, currentUserId?: string): LeaderboardEntry {
  return {
    id: row.id,
    rank: Number(row.rank),
    username: row.username,
    name: row.name,
    image: row.image,
    level: row.level,
    totalExperience: row.totalExperience,
    challengesCompleted: row.challengesCompleted,
    isCurrentUser: row.id === currentUserId,
  };
}

export async function getLeaderboard(
  page = 1,
  pageSize = 10,
  currentUserId?: string,
): Promise<LeaderboardData> {
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const total = await prisma.user.count({ where: { isPublic: true } });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const offset = (safePage - 1) * safePageSize;

  const rows = await prisma.$queryRaw<RankedRow[]>`
    SELECT
      "id",
      "username",
      "name",
      "image",
      "level",
      "totalExperience",
      "challengesCompleted",
      "rank"
    FROM (
      SELECT
        "id",
        "username",
        "name",
        "image",
        "level",
        "totalExperience",
        "challengesCompleted",
        RANK() OVER (ORDER BY ${Prisma.raw(RANKING_ORDER)}) AS "rank"
      FROM "user"
      WHERE "isPublic" = true
    ) AS "ranked"
    ORDER BY "rank" ASC, "username" ASC
    LIMIT ${safePageSize}
    OFFSET ${offset}
  `;

  const entries = rows.map((row) => toEntry(row, currentUserId));

  let currentUserEntry: LeaderboardEntry | null = null;
  let currentUserIsPublic = false;

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        username: true,
        name: true,
        image: true,
        level: true,
        totalExperience: true,
        challengesCompleted: true,
        isPublic: true,
      },
    });

    currentUserIsPublic = Boolean(currentUser?.isPublic);

    if (currentUser?.isPublic) {
      const rankRows = await prisma.$queryRaw<Array<{ rank: bigint | number }>>`
        SELECT "rank"
        FROM (
          SELECT "id", RANK() OVER (ORDER BY ${Prisma.raw(RANKING_ORDER)}) AS "rank"
          FROM "user"
          WHERE "isPublic" = true
        ) AS "ranked"
        WHERE "id" = ${currentUserId}
      `;

      const rank = rankRows[0]?.rank;

      currentUserEntry = {
        id: currentUser.id,
        rank: rank === undefined ? entries.length + offset + 1 : Number(rank),
        username: currentUser.username,
        name: currentUser.name,
        image: currentUser.image,
        level: currentUser.level,
        totalExperience: currentUser.totalExperience,
        challengesCompleted: currentUser.challengesCompleted,
        isCurrentUser: true,
      };
    }
  }

  return {
    entries,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    currentUserEntry,
    currentUserIsPublic,
  };
}

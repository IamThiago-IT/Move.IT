import { AppError } from "@/lib/errors";
import { errorResponse, noStore } from "@/lib/http";
import { getLeaderboard } from "@/lib/leaderboard";
import { getSessionFromRequest } from "@/lib/session";
import { leaderboardQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = leaderboardQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("Parâmetros de paginação inválidos.", 422, "VALIDATION_ERROR");
    }

    const session = await getSessionFromRequest(request);
    const data = await getLeaderboard(
      parsed.data.page,
      parsed.data.pageSize,
      session?.user.id,
    );

    return noStore(data);
  } catch (error) {
    return errorResponse(error);
  }
}

import { completeChallenge } from "@/lib/cycle-service";
import { UnauthorizedError } from "@/lib/errors";
import { errorResponse, noStore } from "@/lib/http";
import { getSessionFromRequest } from "@/lib/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      throw new UnauthorizedError();
    }

    const { id } = await context.params;

    return noStore(await completeChallenge(session.user.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}

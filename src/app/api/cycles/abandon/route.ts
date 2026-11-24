import { abandonCycle } from "@/lib/cycle-service";
import { UnauthorizedError } from "@/lib/errors";
import { errorResponse, noStore } from "@/lib/http";
import { getSessionFromRequest } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      throw new UnauthorizedError();
    }

    return noStore(await abandonCycle(session.user.id));
  } catch (error) {
    return errorResponse(error);
  }
}

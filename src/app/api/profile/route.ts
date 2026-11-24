import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { errorResponse, noStore, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { profileUpdateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      throw new UnauthorizedError();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
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
      },
    });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado.");
    }

    return noStore({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      throw new UnauthorizedError();
    }

    const data = await parseJson(request, profileUpdateSchema);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        image: true,
        username: true,
        theme: true,
        isPublic: true,
        level: true,
        currentExperience: true,
        totalExperience: true,
        challengesCompleted: true,
      },
    });

    return noStore({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

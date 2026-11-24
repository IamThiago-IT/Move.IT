import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { AppError } from "@/lib/errors";

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("[api]", error);

  return NextResponse.json(
    { error: "Não foi possível concluir a solicitação. Tente novamente.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AppError("Corpo da requisição inválido.", 400, "INVALID_JSON");
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";

    throw new AppError(message, 422, "VALIDATION_ERROR");
  }

  return parsed.data;
}

export function noStore<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

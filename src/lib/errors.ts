export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Faça login para continuar.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "A ação não pode ser concluída agora.", code = "CONFLICT") {
    super(message, 409, code);
  }
}

export class GoneError extends AppError {
  constructor(message = "Este recurso expirou.") {
    super(message, 410, "GONE");
  }
}

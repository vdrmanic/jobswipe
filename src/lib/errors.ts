export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super('AUTH_ERROR', message, 401);
    this.name = 'AuthError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network error') {
    super('NETWORK_ERROR', message, 0);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, 422);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export const handleError = (error: any): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error?.message?.includes('network') || error?.message?.includes('offline')) {
    return new NetworkError(error.message);
  }

  if (error?.status === 401 || error?.code === 'PGRST301') {
    return new AuthError('Sesija je istekla. Prijavite se ponovo.');
  }

  if (error?.status === 404) {
    return new NotFoundError(error.message);
  }

  if (error?.status === 422 || error?.status === 400) {
    return new ValidationError(error.message);
  }

  return new AppError(
    'UNKNOWN_ERROR',
    error?.message || 'Greška. Pokušajte ponovo.',
    error?.status || 500,
  );
};

export const getErrorMessage = (error: any): string => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'Nepoznata greška.';
};

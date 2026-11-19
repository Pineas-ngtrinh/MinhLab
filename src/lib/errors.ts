/** Only deliberate application errors may be sent to API clients. */
export class AppError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

import { AppError } from '../middleware/errorHandler';

export class DatabaseError extends Error implements AppError {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ValidationError extends Error implements AppError {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class ConfigError extends Error implements AppError {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    this.statusCode = 500;
  }
}

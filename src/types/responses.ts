export interface ErrorResponse {
  success: false;
  error: string;
  code: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ErrorResponse | SuccessResponse<T>;

export interface JWTResponse {
  accessToken: string;
  systemId: string;
  timestamp: number;
}

// Export common response types
export type EmptyResponse = ApiResponse<null>;
export type StringResponse = ApiResponse<string>;
export type NumberResponse = ApiResponse<number>;
export type BooleanResponse = ApiResponse<boolean>;
export type ObjectResponse<T> = ApiResponse<T>;
export type ArrayResponse<T> = ApiResponse<T[]>;

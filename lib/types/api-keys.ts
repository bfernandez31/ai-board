export type APIProvider = 'ANTHROPIC' | 'OPENAI';

export interface APIKeyStatus {
  provider: APIProvider;
  configured: boolean;
  preview: string | null;
  updatedAt: string | null;
}

export interface SaveAPIKeyRequest {
  provider: APIProvider;
  apiKey: string;
  skipValidation?: boolean;
}

export interface ValidateAPIKeyRequest {
  provider: APIProvider;
  apiKey: string;
}

export interface SaveAPIKeyResponse {
  provider: APIProvider;
  configured: boolean;
  preview: string;
  validated: boolean;
  message: string;
}

export interface ValidateAPIKeyResponse {
  valid: boolean;
  message: string;
  unreachable?: boolean;
}

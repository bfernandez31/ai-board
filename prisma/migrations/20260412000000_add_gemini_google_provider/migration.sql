-- Add Gemini as an agent and Google as a credential provider
ALTER TYPE "public"."Agent" ADD VALUE 'GEMINI';
ALTER TYPE "public"."CredentialProvider" ADD VALUE 'GOOGLE';

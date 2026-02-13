// This file is needed to support autocomplete for process.env
export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // app base url
      NEXT_PUBLIC_APP_BASE_URL: string;

      // supabase project and keys
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      NEXT_PUBLIC_SUPABASE_IMAGES_BUCKET?: string;
    }
  }
}

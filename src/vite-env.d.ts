/// <reference types="vite/client" />

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

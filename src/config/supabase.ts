const PLACEHOLDER = 'YOUR-SUPABASE-ANON-KEY';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function isMissing(value: string | undefined): boolean {
  return value == null || value.trim() === '' || value === PLACEHOLDER;
}

export function getSupabaseConfig(): SupabaseConfig {
  // Each variable must be written out in full (process.env.EXPO_PUBLIC_…).
  // Expo copies EXPO_PUBLIC_ values into release builds only where they are
  // referenced like this; a dynamic lookup such as process.env[name] works in
  // development but is empty in an APK.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (isMissing(url) || isMissing(anonKey)) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
        '(client-safe project URL + publishable anon key).',
    );
  }

  return { url: url as string, anonKey: anonKey as string };
}

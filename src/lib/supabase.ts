import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';

let clientInstance: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false // Disable session persistence for server context
      }
    });
  }
  return clientInstance;
}

// Export a Proxy that behaves exactly like the SupabaseClient but initializes lazily on first access
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    const client = getClient();
    return Reflect.set(client, prop, value);
  }
});

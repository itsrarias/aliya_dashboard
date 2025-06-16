import {
  createClient,
  SupabaseClient,
  Session,
  AuthChangeEvent,
  User,
} from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Missing Supabase environment variables (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)'
  );
}

// 1) Initialize Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// 2) Types
export interface Credentials {
  email: string;
  password: string;
}

export interface AuthResult {
  /** true if a new account was created */
  created: boolean;
  /** true if the user is fully confirmed and signed-in */
  confirmed: boolean;
  data: { session: Session | null; user: User | null } | null;
  error: Error | null;
}

// 3) Unified sign-in / sign-up
export async function loginOrRegister(
  { email, password }: Credentials
): Promise<AuthResult> {
  // Enforce corporate domain
  if (!email.toLowerCase().endsWith('@aliyacapitalpartners.com')) {
    return {
      created: false,
      confirmed: false,
      data: null,
      error: new Error('Use an @aliyacapitalpartners.com email'),
    };
  }

  // 1) Try signing in first
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (!signInError) {
    // ✅ Logged in successfully
    return { created: false, confirmed: true, data: signInData, error: null };
  }

  // 2) Check for “wrong credentials” (Supabase uses 400 + “Invalid login credentials”)
  if (signInError.status === 400 &&
      signInError.message.toLowerCase().includes('invalid login credentials')) {
    return {
      created: false,
      confirmed: false,
      data: null,
      error: new Error('Invalid email or password.'),
    };
  }

  // 3) At this point, it wasn’t “invalid credentials” – assume new user:
  //    (your existing signup code goes here)

  // 3a) Validate password strength...
  const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{6,}$/;
  if (!pwdRegex.test(password)) {
    return {
      created: false,
      confirmed: false,
      data: null,
      error: new Error(
        'Password must be at least 6 characters and include a symbol, uppercase and lowercase letters.'
      ),
    };
  }

  // 3b) Attempt sign-up
  const { data: signUpData, error: signUpError } =
    await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });

  // 3c) Handle sign-up errors
  if (signUpError) {
    // existing-but-unconfirmed user
    if (
      signUpError.status === 400 &&
      signUpError.message.includes('User already registered')
    ) {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      return {
        created: true,
        confirmed: false,
        data: null,
        error: resendError
          ? new Error('Couldn’t resend confirmation link: ' + resendError.message)
          : new Error('Confirmation link resent — check your inbox!'),
      };
    }

    // other sign-up error
    return {
      created: true,
      confirmed: false,
      data: signUpData,
      error: signUpError,
    };
  }

  // 3d) New user created (unconfirmed)
  return {
    created: true,
    confirmed: false,
    data: signUpData,
    error: null,
  };
}

// 4) Sign out
export async function signOut(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// 5) Get current user
export async function getUser(): Promise<{ data: User | null; error: Error | null }> {
  const { data, error } = await supabase.auth.getUser();
  return { data: data.user, error };
}

// 6) Listen to auth state (SIGNED_IN, SIGNED_OUT, etc.)
//    Returns a subscription; call `.unsubscribe()` when cleaning up
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}

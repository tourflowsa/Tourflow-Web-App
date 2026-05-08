
export function getFriendlyAuthError(error: any, fallback?: string): string {
  if (!error) return fallback || 'Something went wrong. Please try again.';

  const message = typeof error === 'string' 
    ? error.toLowerCase() 
    : (error.message || '').toLowerCase();

  // Mapping based on common Supabase/Auth error strings
  if (message.includes('email') && message.includes('domain')) {
    return 'We could not verify this email domain. Please use a valid email address.';
  }

  if (
    message.includes('user already registered') || 
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('duplicate key value') ||
    message.includes('violates unique constraint') ||
    (error && (error.code === '23505' || String(error.code) === '23505'))
  ) {
    return 'Account request received. Please check your inbox if this is a new account. If you already have an account, sign in instead.';
  }

  if (
    (message.includes('email') && message.includes('invalid')) || 
    message.includes('email address is invalid')
  ) {
    return 'Please enter a valid email address.';
  }

  if (message.includes('unauthorized redirect')) {
    return 'Password reset is not configured correctly. Please contact support.';
  }

  if (
    message.includes('row-level security') || 
    message.includes('permission denied') ||
    (error && error.code === '42501')
  ) {
    return 'Your account was created, but we could not finish setting up your profile. Please contact support.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please check your inbox and confirm your email before signing in.';
  }

  if (message.includes('weak password')) {
    return 'Please choose a stronger password.';
  }

  if (message.includes('password should be at least')) {
    return 'Your password is too short. Please use a longer password.';
  }

  if (message.includes('auth session missing') || message.includes('session not found')) {
    return 'Your reset session has expired. Please request a new reset link.';
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (message.includes('network')) {
    return 'Connection error. Please check your internet and try again.';
  }

  if (message.includes('database error saving profile')) {
    return 'Your account was created, but we could not finish setting up your profile. Please contact support.';
  }

  return fallback || 'Something went wrong. Please try again.';
}

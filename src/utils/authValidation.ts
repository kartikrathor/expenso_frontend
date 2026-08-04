export type AuthField = 'name' | 'email' | 'password';

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const NAME_RE = /^[\p{L}\p{M}\s.'-]{2,50}$/u;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function validateLogin(input: {
  email: string;
  password: string;
}): { ok: true; email: string; password: string } | { ok: false; errors: AuthFieldErrors } {
  const errors: AuthFieldErrors = {};
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, email, password };
}

export function validateRegister(input: {
  name: string;
  email: string;
  password: string;
}): { ok: true; name: string; email: string; password: string } | { ok: false; errors: AuthFieldErrors } {
  const errors: AuthFieldErrors = {};
  const name = input.name.trim().replace(/\s+/g, ' ');
  const email = input.email.trim().toLowerCase();
  const { password } = input;

  if (!name) {
    errors.name = 'Name is required';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (name.length > 50) {
    errors.name = 'Name must be under 50 characters';
  } else if (!NAME_RE.test(name)) {
    errors.name = 'Name can only contain letters, spaces, and . \' -';
  }

  if (!email) {
    errors.email = 'Email is required';
  } else if (email.length > 100) {
    errors.email = 'Email is too long';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  } else if (password.length > 72) {
    errors.password = 'Password is too long';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, name, email, password };
}

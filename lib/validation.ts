export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string) {
  return password.length >= 8;
}

export function validateRequiredText(value: string, min = 1, max = 2000) {
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

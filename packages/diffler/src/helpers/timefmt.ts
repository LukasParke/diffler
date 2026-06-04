function parseIso(value: string): Date | null {
  if (!value) return null;
  try {
    const cleaned = value.replace("Z", "+00:00");
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function humanize(value: string): string {
  const dt = parseIso(value);
  if (!dt) return value;

  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 0) return "in the future";
  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
  if (seconds < 2592000) {
    const weeks = Math.floor(seconds / 604800);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  if (seconds < 31536000) {
    const months = Math.floor(seconds / 2592000);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  }
  const years = Math.floor(seconds / 31536000);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

export function shortDate(value: string): string {
  const dt = parseIso(value);
  if (!dt) return value;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

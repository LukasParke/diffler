export function shield(label: string, message: string, color = "blue", style = "flat"): string {
  const encodedLabel = encodeURIComponent(String(label).replace(/-/g, "--"));
  const encodedMessage = encodeURIComponent(String(message).replace(/-/g, "--"));
  const url = `https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${color}?style=${style}`;
  return `![${label}](${url})`;
}

export function social(icon: string, url: string, label?: string): string {
  const text = label || icon.charAt(0).toUpperCase() + icon.slice(1);
  return `[${text}](${url})`;
}

export function licenseBadge(repo: string, username?: string): string {
  const fullRepo = username ? `${username}/${repo}` : repo;
  return `![License](https://img.shields.io/github/license/${fullRepo})`;
}

export function versionBadge(pkg: string, manager = "pypi"): string {
  if (manager === "pypi") return `![PyPI](https://img.shields.io/pypi/v/${pkg})`;
  if (manager === "npm") return `![npm](https://img.shields.io/npm/v/${pkg})`;
  return "";
}

export function githubStatsCard(username: string, theme = "default"): string {
  const url = `https://github-readme-stats.vercel.app/api?username=${username}&theme=${theme}`;
  return `![GitHub Stats](${url})`;
}

export function topLangs(username: string, theme = "default"): string {
  const url = `https://github-readme-stats.vercel.app/api/top-langs/?username=${username}&layout=compact&theme=${theme}`;
  return `![Top Languages](${url})`;
}

export function streakStats(username: string, theme = "default"): string {
  const url = `https://github-readme-streak-stats.herokuapp.com/?user=${username}&theme=${theme}`;
  return `![GitHub Streak](${url})`;
}

export function typingSvg(text: string, duration = 5000): string {
  const encoded = encodeURIComponent(text);
  const url = `https://readme-typing-svg.herokuapp.com?duration=${duration}&lines=${encoded}`;
  return `![Typing SVG](${url})`;
}

export function skillIcons(technologies: string[], theme = "dark"): string {
  const icons = technologies.join(",");
  const url = `https://skillicons.dev/icons?i=${icons}&theme=${theme}`;
  return `![Skills](${url})`;
}

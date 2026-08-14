# Diffler

> A powerful, extensible engine for generating and managing GitHub profile READMEs.

[![Node.js](https://img.shields.io/badge/node-20%2B-blue)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Diffler** automatically generates and updates your GitHub profile README—the special repository at `username/username` that appears at the top of your GitHub profile. It combines the power of **Nunjucks templating**, rich **GitHub API integration**, and an extensive library of **Markdown & CSS helpers** to let you build a profile that stands out.

Inspired by tools like [readme-scribe](https://github.com/muesli/readme-scribe), Diffler goes further with template-driven data collection, a unified stats engine with heavy caching, native helpers for every GitHub Markdown trick, and rock-solid reliability.

---

## ✨ Features

- **🎨 Nunjucks Templates** — Full template inheritance, macros, custom filters, and includes
- **📊 Unified Stats Engine** — GraphQL + REST collection with multi-year contribution caching, rate-limit budgeting, and resumable backfill
- **🛡️ Markdown & CSS Helpers** — Native support for badges, stats cards, progress bars, collapsible sections, typing SVGs, skill icons, and every GitHub-flavored trick
- **⚙️ Flexible Configuration** — YAML config with environment variable overrides and Zod validation
- **🤖 GitHub Actions Native** — Drop-in Action for scheduled or event-driven profile updates
- **🎬 Remotion Integration** — Export stats for animated WebP/GIF card generation
- **🧪 Rock Solid** — Two-tier caching, retries, dry-run mode, template validation, and atomic commits

---

## 🚀 Quick Start

### Install

```bash
npm install -g @lukasparke/diffler
```

### Initialize your profile project

```bash
diffler init
```

This scaffolds a `.github/diffler.yml` config and starter templates in `.github/diffler/`.

### Preview your README

```bash
diffler render
```

### Update your profile repository

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
diffler update
```

---

## 📁 Example Template

```jinja2
{# .github/diffler/profile.md.j2 #}
<div align="center">

# {{ profile.name }}

*{{ profile.bio }}*

</div>

## 📊 Stats

| Metric | Value |
|--------|-------|
| Contributions | {{ contributions.totalContributions }} |
| Current Streak | {{ contributions.currentStreak }} days |
| Repositories | {{ repositories | length }} |
| Stars Earned | {{ stats.repoMetrics.starCount }} |
| PRs | {{ activity.totalPullRequests }} |
| Issues Closed | {{ activity.closedIssues }} |

## 🏆 Top Languages

{% for lang in stats.repoMetrics.topLanguages[:5] -%}
- **{{ lang.languageName }}** — {{ lang.percentage }}%
{% endfor %}

## 🎯 Highlights

{% for h in stats.highlights[:3] -%}
- {{ h.label }}: {{ h.value }}
{% endfor %}
```

### 📋 Rendered Output

<!-- DIFFLER-EXAMPLE-START -->

<div align="center">

# Luke Parke

*Hi 👋  I'm a Software Engineer, passionate about Identity and Developer Experience.

I love Svelte, Tailwind, TypeScript, and GO*

</div>

## 📊 Stats

| Metric | Value |
|--------|-------|
| Contributions | 2050 |
| Current Streak | 1 days |
| Repositories | 134 |
| Stars Earned | 498 |
| PRs | 139 |
| Issues Closed | 25 |

## 🏆 Top Languages

- **Python** — 50.69%
- **Java** — 20.45%
- **TypeScript** — 14.69%
- **Go** — 5.87%
- **C#** — 4.56%


## 🎯 Highlights

- ⭐ Popular: 498 stars
- 🌐 Contributor: 19 repos
- 📈 Growth: +12.9%

<!-- DIFFLER-EXAMPLE-END -->

*This example is auto-generated from live GitHub data and updated daily.*

---

## 🔧 Configuration

Diffler is configured via a YAML file (default: `.github/diffler.yml`):

```yaml
version: "1"

github:
  username: "octocat"
  token: "${GITHUB_TOKEN}"

templates:
  main: "profile.md.j2"
  directory: ".github/diffler"

helpers:
  stats:
    enabled: true
  badges:
    style: "for-the-badge"

cache:
  ttl: 3600
```

---

## 🤖 GitHub Actions

Add `.github/workflows/profile.yml` to your profile repository:

```yaml
name: Update Profile README

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: LukasParke/diffler/packages/diffler@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "🤖 Auto-update profile README"
```

---

## 🧩 Built-in Helpers

| Category | Helpers |
|----------|---------|
| **Badges** | `shield()`, `social()`, `license_badge()`, `version_badge()` |
| **Stats** | `github_stats_card()`, `top_langs()`, `streak_stats()`, `trophy()` |
| **Layout** | `details()`, `columns()`, `center()`, `table()` |
| **CSS Tricks** | `progress_bar()`, `typing_svg()`, `skill_icons()`, `contrib_snake()` |
| **Integrations** | `wakatime_stats()`, `spotify_now_playing()`, `devto_posts()`, `codewars_badge()` |

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and check out the [good first issue](https://github.com/diffler/diffler/labels/good%20first%20issue) label.

---

## 📄 License

Diffler is released under the [MIT License](LICENSE).

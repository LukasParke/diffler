"""Command-line interface for Diffler."""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel

from diffler import __version__
from diffler.collectors.cache import DEFAULT_CACHE_DIR, DEFAULT_CACHE_FILE, DEFAULT_VOLATILE_FILE
from diffler.config import DEFAULT_CONFIG_PATH, DifflerConfig
from diffler.core.engine import Engine
from diffler.core.renderer import Renderer

app = typer.Typer(
    name="diffler",
    help="A powerful engine for generating and managing GitHub profile READMEs.",
    no_args_is_help=True,
    invoke_without_command=True,
)
console = Console()


def _load_config(config_path: Path | None) -> DifflerConfig:
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    if config_path.exists():
        return DifflerConfig.from_file(config_path)
    return DifflerConfig.from_env()


@app.callback()
def callback(
    ctx: typer.Context,
    version: bool = typer.Option(False, "--version", help="Show version and exit."),
) -> None:
    if version:
        console.print(f"diffler [bold cyan]{__version__}[/bold cyan]")
        raise typer.Exit()
    if ctx.invoked_subcommand is None:
        console.print(ctx.get_help())
        raise typer.Exit()


@app.command()
def init(
    directory: Path = typer.Option(
        ".github/diffler",
        "--dir",
        "-d",
        help="Directory to scaffold templates into.",
    ),
    config: Path = typer.Option(
        ".github/diffler.yml",
        "--config",
        "-c",
        help="Path to the configuration file to create.",
    ),
) -> None:
    """Scaffold a new Diffler project with config and starter templates."""
    directory.mkdir(parents=True, exist_ok=True)

    config_path = Path(config)
    config_path.parent.mkdir(parents=True, exist_ok=True)

    if not config_path.exists():
        config_path.write_text(
            "version: \"1\"\n\n"
            "github:\n"
            "  username: \"your-username\"\n"
            "  token: \"${GITHUB_TOKEN}\"\n"
            "  # For multi-profile aggregation with separate tokens:\n"
            "  # profiles:\n"
            "  #   - username: \"personal\"\n"
            "  #     token: \"${GITHUB_TOKEN_PERSONAL}\"\n"
            "  #   - username: \"work\"\n"
            "  #     token: \"${GITHUB_TOKEN_WORK}\"\n\n"
            "templates:\n"
            "  main: \"profile.md.j2\"\n"
            "  directory: \".github/diffler\"\n\n"
            "cache:\n"
            "  enabled: true\n"
            "  ttl: 3600\n",
            encoding="utf-8",
        )
        console.print(f"[green]Created[/green] {config_path}")
    else:
        console.print(f"[yellow]Skipped[/yellow] {config_path} (already exists)")

    main_template = directory / "profile.md.j2"
    if not main_template.exists():
        main_template.write_text(
            '<div align="center">\n\n'
            "# Hi, I'm {{ github.user.name }} 👋\n\n"
            '{% if github.user.bio %}\n'
            '*{{ github.user.bio }}*\n'
            '{% endif %}\n\n'
            '{{ typing_svg("Welcome to my GitHub profile") }}\n\n'
            '</div>\n\n'
            '## 📊 GitHub Stats\n\n'
            '<div align="center">\n\n'
            '{{ github_stats_card(github.user.login) }}\n\n'
            '{{ top_langs(github.user.login) }}\n\n'
            '</div>\n\n'
            '## 🛠️ Tech Stack\n\n'
            '{{ skill_icons(["python", "javascript", "docker", "git"]) }}\n\n'
            '## 📌 Pinned Repositories\n\n'
            '{% if github.user.pinned_repositories %}\n'
            '{{ pinned_repos_grid(github.user.pinned_repositories) }}\n'
            '{% else %}\n'
            '_No pinned repositories yet._\n'
            '{% endif %}\n\n'
            '## 📂 All Projects\n\n'
            '{% set all_repos = filter_repos(github.user.repositories, exclude_forks=true, exclude_archived=true, sort_by="stars", limit=20) -%}\n'
            '{% for repo in all_repos -%}\n'
            '- [{{ repo.name }}]({{ repo.url }}){% if repo.description %} - {{ repo.description }}{% endif %}\n'
            '{% endfor %}\n\n'
            '## 📫 Connect\n\n'
            'Feel free to reach out!\n',
            encoding="utf-8",
        )
        console.print(f"[green]Created[/green] {main_template}")
    else:
        console.print(f"[yellow]Skipped[/yellow] {main_template} (already exists)")

    console.print(Panel("Diffler project initialized! Run `diffler render` to preview.", style="green"))


@app.command()
def render(
    config_path: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to the diffler configuration file.",
    ),
    output: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Write rendered output to a file instead of stdout.",
    ),
) -> None:
    """Render the profile README to stdout (or a file)."""
    config = _load_config(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    try:
        result = engine.render()
    except Exception as exc:
        console.print(f"[bold red]Error:[/bold red] {exc}")
        raise typer.Exit(1) from exc

    if output:
        output.write_text(result, encoding="utf-8")
        console.print(f"[green]Rendered to[/green] {output}")
    else:
        console.print(result, markup=False)


@app.command()
def validate(
    config_path: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to the diffler configuration file.",
    ),
) -> None:
    """Validate configuration and templates without rendering."""
    config = _load_config(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    try:
        engine.validate()
        console.print("[bold green]Validation passed![/bold green]")
    except Exception as exc:
        console.print(f"[bold red]Validation failed:[/bold red] {exc}")
        raise typer.Exit(1) from exc


@app.command()
def update(
    config_path: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to the diffler configuration file.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        "-n",
        help="Render but do not commit changes.",
    ),
    message: str = typer.Option(
        "🤖 Auto-update profile README",
        "--message",
        "-m",
        help="Commit message template.",
    ),
) -> None:
    """Render and commit the updated profile README."""
    config = _load_config(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    try:
        engine.update(dry_run=dry_run, message=message)
        if dry_run:
            console.print("[yellow]Dry run complete. No changes committed.[/yellow]")
        else:
            console.print("[bold green]Profile README updated successfully![/bold green]")
    except Exception as exc:
        console.print(f"[bold red]Update failed:[/bold red] {exc}")
        raise typer.Exit(1) from exc


@app.command()
def cache_clear() -> None:
    """Clear the local API response cache."""
    removed = 0
    for path in (DEFAULT_CACHE_FILE, DEFAULT_VOLATILE_FILE):
        if path.exists():
            path.unlink()
            removed += 1
            console.print(f"[green]Removed[/green] {path}")
    if removed == 0:
        console.print("[yellow]No cache files found.[/yellow]")
    else:
        console.print(f"[bold green]Cache cleared ({removed} files).[/bold green]")


@app.command("export-remotion")
def export_remotion(
    config_path: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to the diffler configuration file.",
    ),
    output: Path = typer.Option(
        "remotion-input.json",
        "--output",
        "-o",
        help="Output path for remotion input.json.",
    ),
) -> None:
    """Generate remotion input.json from collected GitHub stats."""
    import json

    from diffler.helpers.remotion import remotion_input

    config = _load_config(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    template_source = renderer.read_template_source()
    context = engine.context_builder.build(template_source)
    stats = context.get("stats", {})
    remotion = remotion_input(stats)

    output.write_text(json.dumps(remotion, indent=2), encoding="utf-8")
    console.print(f"[green]Remotion config written to[/green] {output}")


@app.command("export-remotion-scenes")
def export_remotion_scenes(
    config_path: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to the diffler configuration file.",
    ),
    template_path: Path | None = typer.Option(
        None,
        "--template",
        "-t",
        help="Path to a Jinja2 scene template (.j2). Uses default if omitted.",
    ),
    output: Path = typer.Option(
        "remotion-scenes.json",
        "--output",
        "-o",
        help="Output path for remotion scene manifest.",
    ),
) -> None:
    """Generate remotion scene manifest from collected GitHub stats.

    Supports custom Jinja2 templates for conditional scene inclusion,
    custom durations, and theme overrides.
    """
    import json

    from diffler.helpers.remotion import remotion_scene_manifest

    config = _load_config(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    template_source = renderer.read_template_source()
    context = engine.context_builder.build(template_source)
    stats = context.get("stats", {})
    config_dict = context.get("config", {})
    if hasattr(config_dict, "model_dump"):
        config_dict = config_dict.model_dump()

    scene_template = None
    if template_path and template_path.exists():
        scene_template = template_path.read_text(encoding="utf-8")

    manifest = remotion_scene_manifest(stats, scene_template=scene_template, config=config_dict)
    output.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    console.print(f"[green]Remotion scene manifest written to[/green] {output}")
    console.print(f"[dim]Scenes: {', '.join(s['id'] for s in manifest.get('scenes', []))}[/dim]")


@app.command("export-remotion-input")
def export_remotion_input(
    config_path: Path | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to the diffler configuration file.",
    ),
    target: Path = typer.Option(
        "../github-stats-remotion/input.json",
        "--target",
        "-t",
        help="Output path for remotion input.json (can be outside this repo).",
    ),
    allow_private: bool = typer.Option(
        False,
        "--allow-private",
        help="Include private repository details in the output.",
    ),
) -> None:
    """Generate remotion input.json with inline stats for local dev.

    Writes a JSON file that github-stats-remotion can consume directly
    via --props, bypassing the remote fetch.
    """
    import json

    config = _load_config(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    template_source = renderer.read_template_source()
    context = engine.context_builder.build(template_source)
    stats = context.get("stats", {})
    username = stats.get("username") or config.github.username or "unknown"

    usernames = config.github.get_usernames()
    output: dict[str, Any] = {
        "username": username,
        "stats": stats,
        "allowPrivateRepositoryDetails": allow_private,
    }

    if len(usernames) > 1:
        output["usernames"] = usernames

    target.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")
    console.print(f"[green]Remotion input written to[/green] {target}")
    if len(usernames) > 1:
        console.print(f"[dim]Multi-profile: {', '.join(usernames)}[/dim]")
    console.print(f"[dim]Scenes available: {len(stats.get('presentation', {}).get('remotion', {}).get('topLanguages', []))} languages[/dim]")

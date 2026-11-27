# VHS Tape Cookbook

A fuller reference for writing `.tape` files for [vhs](https://github.com/charmbracelet/vhs). Commands below were checked against a locally installed `vhs 0.11.0` (`vhs new` prints the same reference as its built-in documentation) — if a newer vhs adds commands this doesn't cover, `vhs new some-file.tape` always regenerates the current in-tool reference.

## File shape

Every `.tape` file is a flat list of commands, executed top to bottom. `Output` and `Set` commands are usually grouped at the top, then the recorded actions follow.

```tape
Output demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 600
Set Theme "Dracula"
Set TypingSpeed 60ms
Set Padding 20

Type "echo hello"
Enter
Sleep 2s
```

## Output

```tape
Output demo.gif      # animated GIF
Output demo.mp4       # MP4 video
Output demo.webm      # WebM video
```

You can list more than one `Output` line to render multiple formats from a single recording in one run.

## Settings (`Set ...`)

Put these before any `Type`/`Enter`/etc. commands — they configure the terminal vhs launches.

| Command | Purpose |
|---|---|
| `Set Shell "bash"` | Shell to run inside the recorded terminal |
| `Set FontSize <number>` | Terminal font size in px |
| `Set FontFamily "<name>"` | Terminal font family |
| `Set Width <number>` / `Set Height <number>` | Terminal window size in px |
| `Set LetterSpacing <float>` | Font tracking |
| `Set LineHeight <float>` | Font line height |
| `Set Theme "<name>"` or a JSON object | Color theme — run `vhs themes` for the full list (348 on vhs 0.11.0, including `Dracula`, `nord`, `Monokai Pro`, `Catppuccin Mocha`, `GitHub Dark`). Names are case-sensitive and often don't match the tool's own casing or naming — `Set Theme "Nord"` and `Set Theme "Monokai"` both fail at render time (not caught by `vhs validate`); confirm the exact string with `vhs themes \| grep -i <name>` first |
| `Set Padding <number>` | Inner padding around the terminal content |
| `Set Margin <number>` | Outer margin (needs `MarginFill` to be visible) |
| `Set MarginFill "<file|#hex>"` | Color or image to fill the margin with |
| `Set BorderRadius <number>` | Rounds the terminal window corners |
| `Set WindowBar <type>` | Adds a fake window title bar: `Rings`, `RingsRight`, `Colorful`, `ColorfulRight` |
| `Set WindowBarSize <number>` | Height of the window bar in px (default 40) |
| `Set Framerate <number>` | Capture framerate |
| `Set PlaybackSpeed <float>` | Speed multiplier applied to the final render (e.g. `2` renders at 2x speed) |
| `Set LoopOffset <float>%` | Shifts which frame the GIF loop starts on — useful so the loop point doesn't visibly jump |
| `Set TypingSpeed <time>` | Per-keystroke delay for `Type` commands, default `50ms` |

## Typing and keys

```tape
Type "your-cli --help"          # types the string at the current TypingSpeed
Type@100ms "slow and clear"      # override typing speed for this one command
Enter                            # press Enter
Enter 3                          # press Enter 3 times
Backspace 5                      # delete 5 characters
Tab
Space
Left / Right / Up / Down
PageUp / PageDown
Escape
Delete
Insert
Ctrl+C                           # modifier + key
```

Every key command accepts an optional `@<time>` (delay before executing) and an optional trailing repeat count.

## Timing and waiting

```tape
Sleep 2s              # pause capture for a fixed duration (accepts ms or s)
Sleep 500ms
```

`Sleep` is the workhorse for pacing a demo — put one after any command whose output needs a moment to be readable before the next action starts.

## Hiding setup

Use `Hide` / `Show` to run commands that shouldn't appear in the final recording — clearing the terminal, `cd`-ing into a demo directory, seeding fixture data, sourcing a `.env`:

```tape
Hide
Type "cd demo-project && clear"
Enter
Sleep 500ms
Show

Type "your-cli run"
Enter
Sleep 3s
```

Anything between `Hide` and `Show` still executes, it just isn't captured. This is the standard way to get a demo that starts clean without needing a separate throwaway setup script.

## Scrolling

```tape
ScrollUp 3
ScrollDown 3
```

Useful when a command produces more output than fits the terminal height and you want to show the reader scrolling through it, rather than just letting it fly by.

## Screenshots mid-recording

```tape
Screenshot step-1.png
```

Grabs a still PNG at that point in the tape — handy for pulling a poster frame for the README's `<img>` fallback, or for docs screenshots reusing the same script as the GIF.

## Requiring dependencies

```tape
Require your-cli
Require git
```

Fails fast with a clear error if a program the tape depends on isn't on PATH, instead of silently recording a "command not found" into the GIF.

## Multi-command flows

A realistic tape mixes hidden setup, paced typing, and sleeps long enough to read the output:

```tape
Output demo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 650
Set Theme "Dracula"
Set Padding 20
Set WindowBar Colorful

Require your-cli

Hide
Type "cd /tmp/demo && clear"
Enter
Sleep 500ms
Show

Type "your-cli init my-project"
Sleep 500ms
Enter
Sleep 2s

Type "cd my-project && your-cli build"
Sleep 500ms
Enter
Sleep 3s

Type "your-cli run"
Sleep 500ms
Enter
Sleep 4s
```

Note the `Sleep 500ms` before each `Enter` — it separates "typing finished" from "command submitted" visually, which reads more naturally than an instant Enter right after the last character.

## Typing cadence guidance

- `Set TypingSpeed 40ms`-`80ms` reads as natural human typing. Below ~30ms starts to look like a screen-recording bug (too smooth); above ~120ms feels slow to watch.
- For a long command you don't want the viewer to read character-by-character (a URL, a generated ID), use `Type@10ms` to blast it in fast, so the pacing stays on the parts worth reading.
- Prefer fewer, more deliberate commands over many small ones. Three or four commands with real Sleep time between them makes a better demo than ten commands typed in a blur.

## Validating before you render

```
vhs validate demo.tape
```

Parses the tape and checks syntax without actually rendering — the fastest way to catch a typo before spending render time. It does **not** check `Require`d binaries or whether `ttyd`/`ffmpeg` are on PATH (confirmed against vhs 0.11.0: a tape with `Require some-binary-not-on-path` still passes `validate` and only fails when actually rendered). Check dependencies directly (`ttyd --version`, `ffmpeg -version`, or whatever `Require` names) before rendering if you're unsure they're installed.

## Installing vhs

| Platform | Command |
|---|---|
| macOS | `brew install vhs` |
| Windows | `scoop install vhs` (also installs `ttyd`/`ffmpeg` as dependencies) or `winget install charmbracelet.vhs` |
| Debian/Ubuntu | Not in the default apt repos — add charm's repo first: `curl -fsSL https://repo.charm.sh/apt/gpg.key \| sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg`, then `echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" \| sudo tee /etc/apt/sources.list.d/charm.list`, then `sudo apt update && sudo apt install vhs ffmpeg`. Install `ttyd` separately from its [GitHub releases](https://github.com/tsl0922/ttyd/releases) — apt doesn't carry it. |
| Arch | `pacman -S vhs` |
| Nix | `nix-env -iA nixpkgs.vhs` |
| Go (any OS) | `go install github.com/charmbracelet/vhs@latest` |
| Docker | `docker run --rm -v $PWD:/vhs ghcr.io/charmbracelet/vhs demo.tape` |

vhs shells out to **ttyd** (to run the actual terminal) and **ffmpeg** (to encode the output) — both need to be on PATH even if you installed vhs itself successfully. If a rendered GIF comes out blank, that's the first thing to check.

## Fallback: asciinema + agg

If vhs isn't installable on the target machine (locked-down CI, unsupported platform), record a live terminal session with [asciinema](https://asciinema.org/) and convert it with [agg](https://github.com/asciinema/agg):

```bash
asciinema rec demo.cast
# ... do the demo interactively ...
# Ctrl+D or `exit` to stop recording

agg demo.cast demo.gif \
  --theme monokai \
  --font-size 16 \
  --speed 1.5 \
  --idle-time-limit 2 \
  --fps-cap 15
```

Flags confirmed against agg's official docs (not run locally in this environment — verify against `agg --help` on the target machine before relying on exact defaults):

- `--theme <name>` — built-in themes include `asciinema`, `dracula`, `monokai`, `github-dark`, `github-light`, `nord`, `solarized-dark`/`solarized-light`, `gruvbox-dark`, `kanagawa`, and more.
- `--font-family`, `--font-size`, `--line-height` — text rendering controls.
- `--speed <float>` — playback speed multiplier.
- `--fps-cap <number>` — caps output frame rate (use this to hit the 10-15fps guidance from the main SKILL.md).
- `--idle-time-limit <seconds>` — caps how long any pause in the recording is allowed to run, so dead air (thinking time while recording) doesn't bloat the GIF.
- `--last-frame-duration <seconds>` — how long the final frame holds before the GIF loops.
- `--cols` / `--rows` — override terminal geometry when re-rendering.
- `--renderer <swash|resvg>` — text rendering backend, `swash` is the default.
- `--no-loop` — disable GIF looping.

Trade-off versus vhs: an asciinema recording is a live take, not a script — there's no re-runnable source of truth to regenerate the demo later when the tool's output changes. Use vhs whenever it's available; treat this as the fallback it is.

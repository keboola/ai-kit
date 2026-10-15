# Example vhs tape for a generic CLI tool demo.
# Adapt the `your-cli` commands below to the tool you're actually demoing.
# Render with: vhs cli-demo.tape
# Validate without rendering: vhs validate cli-demo.tape

Output demo.gif
Output demo.mp4

Require your-cli

Set Shell "bash"
Set FontSize 20
Set FontFamily "JetBrains Mono"
Set Width 1200
Set Height 650
Set Theme "Dracula"
Set Padding 20
Set WindowBar Colorful
Set TypingSpeed 60ms

# Hidden setup: start from a clean directory without showing the cd/clear.
Hide
Type "cd /tmp/demo-project && clear"
Enter
Sleep 500ms
Show

# Show the tool's help first so the viewer knows what they're looking at.
Type "your-cli --help"
Sleep 500ms
Enter
Sleep 3s

Hide
Type "clear"
Enter
Show

# Then walk through the core flow: init, do the thing, see the result.
Type "your-cli init my-project"
Sleep 500ms
Enter
Sleep 2s

Type "cd my-project"
Sleep 500ms
Enter
Sleep 500ms

Type "your-cli run --watch"
Sleep 500ms
Enter
Sleep 4s

# Hold on the final state so the GIF doesn't cut off mid-output,
# and so the loop point (end -> start) doesn't feel abrupt.
Sleep 2s

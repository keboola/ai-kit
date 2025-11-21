#!/bin/bash

# Read JSON input
input=$(cat)

# Extract values from JSON
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
session_id=$(echo "$input" | jq -r '.session_id')
transcript=$(echo "$input" | jq -r '.transcript_path')

cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' 2>/dev/null)
total_duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0' 2>/dev/null)

# Calculate burn rate ($/hour)
if [ "$total_duration_ms" -gt 0 ]; then
    burn_rate=$(echo "scale=2; $cost_usd / $total_duration_ms * 3600000" | bc)
else
    burn_rate="0"
fi

# Shorten directory path if too long
short_cwd="$cwd"
if [ ${#cwd} -gt 35 ]; then
    short_cwd="...${cwd: -32}"
fi

# Build status line: cwd | cost | burn rate
printf '\033[34m%s\033[0m \033[90m|\033[0m \033[32m$%.3f\033[0m \033[90m|\033[0m \033[33m$%.2f/h\033[0m\n\n' \
    "$short_cwd" "$cost_usd" "$burn_rate"

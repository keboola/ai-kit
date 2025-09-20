# Claude Coding Assistant Agents

This directory contains prompts specifically designed to be used as agents in your local `.claude/agents` setup. They are optimized for common software development tasks like debugging, refactoring, and code generation.

---
## How to Sync These Prompts Locally

There are two primary methods to keep your local agents up-to-date. Choose the one that best fits your workflow.

### Method 1: The Sync Script (Recommended for Simplicity) ⚡

This method is best if you just want to download the latest versions of the prompt files into a directory. It's clean, fast, and doesn't create a Git repository or extra parent folders.

#### First-Time Setup
1.  **Create the Sync Script**: In the local directory where you want your agents (e.g., `~/.claude/agents/`), create a new file named `sync_prompts.sh`.

2.  **Add the Following Content**: Copy this code into `sync_prompts.sh`. Make sure to update the `REPO_URL` with the correct URL for our company's prompt-hub.
    ```bash
    #!/bin/bash
    # --- Configuration ---
    REPO_URL="[https://github.com/your-company/prompt-hub.git](https://github.com/your-company/prompt-hub.git)"
    SUBFOLDER_PATH="coding-assistants/.claude/agents"
    # --- End of Configuration ---

    echo "Syncing latest Claude agents from the prompt hub..."
    git archive --remote=$REPO_URL HEAD:$SUBFOLDER_PATH | tar -x -v
    echo "Sync complete."
    ```

3.  **Make the Script Executable**: You only need to do this once.
    ```bash
    chmod +x sync_prompts.sh
    ```

#### Daily Updates
To get the latest prompts, simply run the script:
```bash
./sync_prompts.sh
```

---
### Method 2: Git Integration with Sparse-Checkout (Advanced) 🌲

This method is for users who want a proper local Git repository to track history or contribute back. **Note:** This method will create the full parent directory structure (e.g., `coding-assistants/.claude/agents/`).

#### First-Time Setup
1.  **Clone the Repository**: Run this from the directory where you want to store the local repo (e.g., `~/.claude/`).
    ```bash
    # Clone the repo BUT without checking out any files yet
    git clone --depth 1 --no-checkout [https://github.com/your-company/prompt-hub.git](https://github.com/your-company/prompt-hub.git)

    # Navigate into the new, empty repository directory
    cd prompt-hub
    ```

2.  **Configure Sparse-Checkout**: Tell Git you only want the coding agents folder.
    ```bash
    git sparse-checkout init --cone
    git sparse-checkout set coding-assistants/.claude/agents
    ```

3.  **Download the Files**: Finally, pull down the files for your selected folder.
    ```bash
    git checkout main
    ```

#### Daily Updates
To get the latest prompts, navigate to your local repo and pull the changes:
```bash
cd ~/.claude/prompt-hub
git pull
```

---
## Which Method Should I Choose?

* **Use Method 1 (Sync Script)** if you just want the prompt files copied to your machine. It's the simplest and cleanest option.
* **Use Method 2 (Sparse-Checkout)** if you want a local Git repository to see commit history or manage changes, and you are okay with the nested folder structure.

---
## Usage
Once synced, these prompts will be available as agents in your Claude command-line tool or integrated development environment.

---
## Contributing
To add a new coding assistant prompt, please follow the main contribution guide located in the `CONTRIBUTING.md` file at the root of the `prompt-hub` repository.
# Welcome to the Company-Wide Prompt Hub 🚀

This repository is the central library for all AI prompts used across the organization. Its purpose is to foster collaboration, maintain high standards, and accelerate our work by sharing effective and well-tested prompts.

## Repository Structure

The hub is organized into several key directories to make prompts easy to find:

- **`/coding-assistants`**: Contains specialized prompts and agent configurations for development tasks. This includes a `.claude/agents` subdirectory designed for local syncing.
- **`/by-department`**: Holds prompts that are specific to the needs of individual departments like Sales, Marketing, or HR.
- **`/by-task`**: A collection of general-purpose prompts for common tasks like summarization, translation, or data analysis.
- **`README.md`**: (This file) The main entry point and guide for the repository.
- **`CONTRIBUTING.md`**: (Coming soon) A detailed guide on the standards and process for contributing new prompts.

## How to Contribute

We encourage everyone to contribute! A great prompt can save your colleagues hours of work. The basic workflow is:

1.  **Create a New Branch**: Always start by creating a new branch for your changes (`git checkout -b your-feature-name`).
2.  **Add or Edit a Prompt**: Find the most logical folder for your prompt and create a new `.md` file. Follow the structure of existing prompts.
3.  **Commit Your Changes**: Write a clear commit message describing your contribution.
4.  **Submit a Pull Request (PR)**: Push your branch to GitHub and open a Pull Request to merge it into the `main` branch.
5.  **Request a Review**: Assign a colleague or your team lead to review your PR for quality and clarity.

## Using Prompts in Your Projects

You can use these prompts by cloning the repository. For development use cases, like syncing coding agents, it's best to clone only the specific subdirectory you need. See the `README.md` file within the `coding-assistants/.claude/agents` folder for detailed instructions on how to do this.

MIT licensed, see [LICENSE](./LICENSE) file.

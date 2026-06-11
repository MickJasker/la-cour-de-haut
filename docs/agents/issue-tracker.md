# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`
- **Set blocked-by relationship** (use this instead of writing "Blocked by" in the issue body): use the native GitHub GraphQL `addBlockedBy` mutation:

  ```bash
  # Get node IDs first
  gh api repos/{owner}/{repo}/issues/{number} --jq '.node_id'

  # Then set the relationship — issueId = the blocked issue, blockingIssueId = the blocker
  gh api graphql -f query='
  mutation {
    addBlockedBy(input: {
      issueId: "<blocked-issue-node-id>",
      blockingIssueId: "<blocking-issue-node-id>"
    }) {
      issue { number }
      blockingIssue { number }
    }
  }'
  ```

  To remove: use `removeBlockedBy` with the same input shape. Never write "Blocked by" as plain text in the issue body — use this relationship instead.

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

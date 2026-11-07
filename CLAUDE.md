# Notes for Claude

## Always pull before making changes

Before you edit anything, even if you aren't asked to, bring your branch up to date
with the latest `main` from GitHub:

```sh
git fetch origin main
git merge origin/main        # into the branch you're working on
```

- If the pull request for your branch has already been merged, start the branch
  again from the latest `main` (`git checkout -B <branch> origin/main`) rather than
  adding new commits on top of the old ones.
- If the merge has conflicts, resolve them, then run the tests before going on.
- Do this again before you push, in case `main` has moved while you were working.

## Checks to run before pushing

- Server: `cd server && npm test`
- Client: `cd client && npx vitest run && npm run build`

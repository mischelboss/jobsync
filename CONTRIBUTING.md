# Contributing to JobSync

Thanks for your interest! This is a personal hobby project (a fork of [Gsync/jobsync](https://github.com/Gsync/jobsync)), so reviews happen when I have time — but pull requests are welcome.

Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start

- **Issues are turned off** on this repository, so pull requests are the way to contribute.
- **Bugs:** a pull request with the fix and a test is ideal. Describe how to reproduce the problem, the expected vs. actual behavior, and your environment (OS, Node.js version, Docker or native, browser).
- **Features and larger changes:** open a draft pull request that describes the idea first, so we can agree on the approach before you invest time in the code.
- **Is it an upstream bug?** If the problem is in code that comes from the original project, report it at [Gsync/jobsync](https://github.com/Gsync/jobsync/issues).
- **Security problems:** do not open a public pull request — see [Security notes](./README.md#security-notes).

## Local setup

Requires Node.js 20 and npm.

```bash
git clone https://github.com/<your-username>/jobsync.git
cd jobsync
npm install
cp .env.example .env        # then uncomment and set AUTH_SECRET and ENCRYPTION_KEY
npx prisma migrate dev
npm run dev                 # http://localhost:3737
```

Generate the two secrets with `openssl rand -base64 32`.

## Making a change

1. Fork the repository and create a branch from `main` (`feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…` or `chore/…`).
2. Keep the change focused: one concern per pull request, and preferably under ~400 changed lines (not counting lockfiles, migrations and generated files).
3. Add or update tests for behavior you change.
4. Run the checks below, then open a pull request against `main` with a short description of **what** changed and **why**.

```bash
npm run lint        # must pass
npm test            # must pass
npm run test:e2e    # optional; Playwright starts the dev server itself
```

CI runs lint, `prisma generate` and the unit tests on every pull request.

If you change `prisma/schema.prisma`, include a migration (`npx prisma migrate dev`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(optional scope): <summary>`, with types `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Write the summary in the imperative mood and keep it under 72 characters.

```
feat(automations): add Run now to the automations list
fix(ai): recover structured output from a fenced JSON answer
```

## Code conventions

ESLint and TypeScript strict mode enforce most of the style (`npm run lint`). In addition:

- Use `@/` absolute imports, grouped external → internal → relative.
- PascalCase for components, camelCase for functions and variables, kebab-case for file names.
- Types live in `src/models/*.model.ts`, Zod schemas in `src/models/*.schema.ts`.
- Server actions validate the user with `getCurrentUser()`, scope every database query to that user, and return errors through `handleError()`.
- Keep files focused; split a file that grows past roughly 200 lines into a directory of modules with an `index.ts`.
- Comments are for the *why*, not the *what*.

## Tests

Unit and component tests (Vitest) live in `__tests__/`; end-to-end tests (Playwright) in `e2e/`. Mock external dependencies such as AI providers and the database. Prompt quality is covered separately by the model evals in [`evals/`](./evals/README.md).

```bash
npm test                              # all unit tests
npm run test:watch                    # watch mode
npm test -- path/to/file.spec.ts      # one file
```

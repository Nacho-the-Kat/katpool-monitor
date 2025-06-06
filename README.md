# katpool-monitor

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

This project was created using `bun init` in bun v1.1.20. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

### Available Scripts

- `bun run start` - Start the application
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix ESLint issues
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting

### Create env variables

create .env file

```
POSTGRES_USER=<db-user>
POSTGRES_PASSWORD=<db-passwd>
POSTGRES_DB=<db-name>
POSTGRES_HOSTNAME='katpool-db' # Configure the hostname.
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOSTNAME}:5432/${POSTGRES_DB}"
```

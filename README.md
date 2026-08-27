# Asteria Bank

Asteria Bank is a compact online banking portal for local product development. It includes account balances, transfers, profile management, support requests, statements, and an operations console backed by SQLite.

## Requirements

- Node.js 22.5 or newer
- No external services or containers are required

## Start

```powershell
npm start
```

Open <http://127.0.0.1:3000> and sign in with one of the seeded accounts:

| Username | Password |
|---|---|
| `alice` | `Spring2026!` |
| `bob` | `River2026!` |
| `ops` | `Operations2026!` |

The application binds to `127.0.0.1` by default. Set `HOST` and `PORT` to change the listener.

## Data

The SQLite database is created at `data/asteria.db` on first launch. The Data Activity view shows balances, ledger entries, and database operations as they happen.

Reset the sample data with:

```powershell
npm run reset-db
```

Run the automated checks with:

```powershell
npm test
```


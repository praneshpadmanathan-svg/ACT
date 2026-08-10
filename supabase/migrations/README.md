# Migrations

These replace what used to be a single `supabase/schema.sql`. That file was
fine while the schema never changed, and stopped being fine the moment it did:
one flat file records what the database should look like _now_ and nothing
about how it got there, so there is no way to tell a fresh project from a stale
one, and no rollback path when a change turns out to be wrong.

Run them **in filename order**. There is no migration runner wired up — this is
a project with one table, and pasting two files into the SQL editor is honest
about the scale. What matters is that each file is numbered, immutable once
applied, and describes one change.

| File                                 | What it does                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `0001_initial_schema.sql`            | The `progress` table, its four RLS policies, the 256 KB row cap and the `updated_at` index.         |
| `0002_push_progress_concurrency.sql` | `push_progress()` — a compare-and-set write, so a second device cannot overwrite work it never saw. |

## Rules

**Never edit a file that has been applied.** Add a new one. An edited migration
is a migration that means different things on different databases, which is the
problem this directory exists to prevent.

**Write them to be re-runnable.** `create table if not exists`, `drop policy if
exists` before `create policy`, `create or replace function`. Someone will paste
the wrong one twice, and the deployment that already has the table has to be
able to adopt the history without dropping anything.

**RLS is not optional.** The anon key ships in the browser bundle — that is what
it is for. Row-level security is the only thing between one student's progress
and another's. Any new table needs `enable row level security` and its policies
in the same migration that creates it, never in a follow-up.

## Restoring from a backup

`.github/workflows/backup.yml` dumps the `public` schema nightly to a private
GitHub Actions artifact. What it deliberately does **not** contain is
`auth.users`: dumping the auth schema would put every student's email and
password hash into CI storage, which is a worse outcome than the one the backup
protects against.

That shapes the restore. `progress.user_id` is a foreign key into `auth.users`,
so rows cannot be loaded back until the accounts exist again:

1. Apply the migrations to the target project, so the table and policies exist.
2. Restore the data with the constraint deferred or the rows filtered to
   accounts that still exist:

   ```
   pg_restore --data-only --table=progress --dbname="$SUPABASE_DB_URL" progress-YYYY-MM-DD.dump
   ```

3. Rows whose `user_id` no longer has an auth user will be rejected by the
   foreign key. That is correct behaviour, not a failed restore — those accounts
   are gone and their data is unreachable by anyone.

The realistic disaster this covers is a bad migration or a mistaken `delete`
against a project whose auth users are all still there. A total project loss is
not fully recoverable on the free tier, and pretending otherwise would be worse
than saying so.

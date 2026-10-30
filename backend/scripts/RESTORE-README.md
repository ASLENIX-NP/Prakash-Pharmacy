# Prakash Pharmacy Database Restore Procedure

## Purpose

This is the versioned operational disaster-recovery procedure for a **native PostgreSQL custom-format dump** (`pg_dump --format=custom`).

The downloadable application JSON backup is a sanitized reporting/export artifact. It intentionally excludes password hashes and is **not** the authoritative database-recovery artifact.

## Safety rules

1. Never restore directly over a running production database.
2. Restore into a separate database first.
3. Verify the backup file, target database name, and PostgreSQL server before execution.
4. The script requires an exact confirmation string: `RESTORE <TargetDatabase>`.
5. Existing databases are not replaced unless `-ReplaceExisting` is explicitly supplied.
6. After restore, point a non-production application instance at the restored database and run smoke/regression checks before any cutover.

## Example: disposable recovery validation

```powershell
Set-Location "D:\Desktop\Prakash-Pharmacy\backend"

$adminUrl = "postgresql://postgres:<PASSWORD>@localhost:5432/postgres"

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File ".\scripts\restore-database.ps1" `
  -BackupFile "D:\Backups\prakash-pharmacy.dump" `
  -TargetDatabase "prakash_pharmacy_restore_validation" `
  -AdminDatabaseUrl $adminUrl `
  -Confirmation "RESTORE prakash_pharmacy_restore_validation" `
  -ReplaceExisting
```

## Production recovery

For a real production incident:

1. Stop application writes.
2. Preserve the damaged/current database before any destructive action.
3. Restore the selected backup into a separate recovery database.
4. Validate schema, row counts, financial reports, inventory totals, audit history, and application smoke tests.
5. Only after validation should infrastructure/database routing be changed to the recovered database.
6. Record who performed the recovery, which backup was used, when validation completed, and the final cutover time.

Do not treat the application JSON export as a substitute for the native PostgreSQL dump.

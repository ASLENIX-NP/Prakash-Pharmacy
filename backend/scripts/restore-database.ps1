[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$BackupFile,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$TargetDatabase,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$AdminDatabaseUrl,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Confirmation,

    [switch]$ReplaceExisting
)

$ErrorActionPreference = "Stop"

function Stop-Restore {
    param([string]$Message)
    throw "RESTORE SAFETY STOP: $Message"
}

Write-Host "============================================================"
Write-Host " PRAKASH PHARMACY - GUARDED DATABASE RESTORE"
Write-Host "============================================================"
Write-Host "This script restores a native PostgreSQL custom-format dump."
Write-Host "It does NOT restore from the sanitized JSON report export."
Write-Host ""

if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
    Stop-Restore "Backup file does not exist: $BackupFile"
}

$backup = Get-Item -LiteralPath $BackupFile
if ($backup.Length -le 0) {
    Stop-Restore "Backup file is empty."
}

$expectedConfirmation = "RESTORE $TargetDatabase"
if ($Confirmation -cne $expectedConfirmation) {
    Stop-Restore "Confirmation must exactly equal: $expectedConfirmation"
}

# Additional guard for the normal production-style database name.
if (
    $TargetDatabase -ieq "prakash_pharmacy" -and
    $Confirmation -cne "RESTORE prakash_pharmacy"
) {
    Stop-Restore "Production-style target requires exact explicit confirmation."
}

Write-Host "===== 1. LOCATE POSTGRESQL TOOLS ====="

$candidateBins = @()

foreach ($name in @("pg_restore.exe","psql.exe")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) {
        $candidateBins += (Split-Path $cmd.Source -Parent)
    }
}

$candidateBins += @(
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin"
)

$pgBin = $candidateBins |
    Where-Object {
        (Test-Path (Join-Path $_ "pg_restore.exe")) -and
        (Test-Path (Join-Path $_ "psql.exe"))
    } |
    Select-Object -First 1

if (-not $pgBin) {
    Stop-Restore "PostgreSQL pg_restore/psql tools were not found."
}

$pgRestore = Join-Path $pgBin "pg_restore.exe"
$psql = Join-Path $pgBin "psql.exe"

Write-Host "PostgreSQL tools: $pgBin"

Write-Host ""
Write-Host "===== 2. BUILD GUARDED TARGET URL ====="

# Use Node's URL parser so passwords/special characters are preserved safely.
$targetUrl = (
    node -e "const u=new URL(process.argv[1]); u.pathname='/' + process.argv[2]; u.search=''; console.log(u.toString())" `
      $AdminDatabaseUrl `
      $TargetDatabase
).Trim()

$adminUrl = (
    node -e "const u=new URL(process.argv[1]); u.pathname='/postgres'; u.search=''; console.log(u.toString())" `
      $AdminDatabaseUrl
).Trim()

if (-not $targetUrl -or -not $adminUrl) {
    Stop-Restore "Could not derive PostgreSQL connection URLs."
}

Write-Host "Target database: $TargetDatabase"
Write-Host "Backup bytes:    $($backup.Length)"

Write-Host ""
Write-Host "===== 3. CHECK TARGET DATABASE ====="

$existsOutput = & $psql `
    $adminUrl `
    -t `
    -A `
    -v ON_ERROR_STOP=1 `
    -c "SELECT 1 FROM pg_database WHERE datname='$TargetDatabase';"

if ($LASTEXITCODE -ne 0) {
    Stop-Restore "Could not inspect PostgreSQL database catalog."
}

$targetExists = ($existsOutput | Out-String).Trim() -eq "1"

if ($targetExists -and -not $ReplaceExisting) {
    Stop-Restore "Target database already exists. Re-run with -ReplaceExisting only after verifying the target."
}

if ($targetExists -and $ReplaceExisting) {
    Write-Host "Replacing existing target database..."
    & $psql `
      $adminUrl `
      -v ON_ERROR_STOP=1 `
      -c "DROP DATABASE `"$TargetDatabase`" WITH (FORCE);"

    if ($LASTEXITCODE -ne 0) {
        Stop-Restore "Could not drop existing target database."
    }
}

Write-Host ""
Write-Host "===== 4. CREATE EMPTY TARGET DATABASE ====="

& $psql `
  $adminUrl `
  -v ON_ERROR_STOP=1 `
  -c "CREATE DATABASE `"$TargetDatabase`";"

if ($LASTEXITCODE -ne 0) {
    Stop-Restore "Could not create target database."
}

$restoreSucceeded = $false

try {
    Write-Host ""
    Write-Host "===== 5. RESTORE NATIVE BACKUP ====="

    & $pgRestore `
      --dbname=$targetUrl `
      --no-owner `
      --no-privileges `
      --exit-on-error `
      $BackupFile

    if ($LASTEXITCODE -ne 0) {
        Stop-Restore "pg_restore returned a non-zero exit code."
    }

    Write-Host ""
    Write-Host "===== 6. VERIFY RESTORED DATABASE ====="

    $verification = & $psql `
      $targetUrl `
      -t `
      -A `
      -v ON_ERROR_STOP=1 `
      -c @"
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='_prisma_migrations'
  ) THEN 1 ELSE 0 END
  || ':' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='inventory_tbl'
  ) THEN 1 ELSE 0 END
  || ':' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='bill_tbl'
  ) THEN 1 ELSE 0 END
  || ':' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='purchase_invoice_tbl'
  ) THEN 1 ELSE 0 END;
"@

    if ($LASTEXITCODE -ne 0) {
        Stop-Restore "Post-restore verification query failed."
    }

    if (($verification | Out-String).Trim() -ne "1:1:1:1") {
        Stop-Restore "Required application tables were not restored."
    }

    $restoreSucceeded = $true

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " RESTORE COMPLETED SUCCESSFULLY"
    Write-Host "============================================================"
    Write-Host "Target database: $TargetDatabase"
    Write-Host "Required application tables verified."
    Write-Host ""
    Write-Host "Next operational step:"
    Write-Host "  Point a NON-PRODUCTION application instance at this database and run smoke/regression checks."
}
catch {
    Write-Host ""
    Write-Warning "Restore did not complete successfully."

    if (-not $restoreSucceeded) {
        Write-Warning "The newly created target database may be incomplete: $TargetDatabase"
        Write-Warning "Review logs and remove/retry it before use."
    }

    throw
}

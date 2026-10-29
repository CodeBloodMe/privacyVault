# PrivacyVault — PostgreSQL Database Restore Script (pg_restore)
# Authors: KRISH (24BCE0846) & PARV (24BCE0870)

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path -Path $BackupFile)) {
    Write-Error "Backup file does not exist: $BackupFile"
    exit 1
}

$FileName = Split-Path -Leaf $BackupFile
Write-Host "======================================================================"
Write-Host "PRIVACYVAULT: Initiating Native PostgreSQL Restore (pg_restore)"
Write-Host "Target Backup: $BackupFile"
Write-Host "======================================================================"

# Copy dump into container
docker cp $BackupFile "privacyvault-postgres:/tmp/$FileName"

# Execute pg_restore with clean and schema rebuild
docker exec -t privacyvault-postgres pg_restore -U privacyvault_admin -d privacyvault --clean --if-exists -v "/tmp/$FileName"

docker exec -t privacyvault-postgres rm -f "/tmp/$FileName"
Write-Host "SUCCESS: Database restored successfully from: $BackupFile"

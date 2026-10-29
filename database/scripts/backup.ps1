# PrivacyVault — PostgreSQL Database Backup Script (pg_dump)
# Authors: KRISH (24BCE0846) & PARV (24BCE0870)

param (
    [string]$OutputFile = "privacyvault_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
)

$BackupPath = Join-Path -Path $PSScriptRoot -ChildPath "..\backups"
if (-not (Test-Path -Path $BackupPath)) {
    New-Item -ItemType Directory -Path $BackupPath | Out-Null
}

$FullPath = Join-Path -Path $BackupPath -ChildPath $OutputFile

Write-Host "======================================================================"
Write-Host "PRIVACYVAULT: Initiating Native PostgreSQL Backup (pg_dump)"
Write-Host "Output File: $FullPath"
Write-Host "======================================================================"

docker exec -t privacyvault-postgres pg_dump -U privacyvault_admin -F c -b -v -f "/tmp/$OutputFile" privacyvault

if ($LASTEXITCODE -eq 0) {
    docker cp "privacyvault-postgres:/tmp/$OutputFile" $FullPath
    docker exec -t privacyvault-postgres rm -f "/tmp/$OutputFile"
    Write-Host "SUCCESS: Database backup created successfully at: $FullPath"
} else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
}

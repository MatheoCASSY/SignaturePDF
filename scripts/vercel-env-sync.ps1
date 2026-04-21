param(
  [string]$EnvFile = ".env.local",
  [string]$Target = "production"
)

if (-not (Test-Path $EnvFile)) {
  Write-Error "Fichier introuvable: $EnvFile"
  exit 1
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) {
    return
  }

  $parts = $line -split "=", 2
  if ($parts.Count -lt 2) {
    return
  }

  $key = $parts[0].Trim()
  $value = $parts[1]

  if ([string]::IsNullOrWhiteSpace($key)) {
    return
  }

  $value | npx vercel env add $key $Target | Out-Null
  Write-Host "[OK] $key -> $Target"
}

Write-Host "Synchronisation terminee depuis $EnvFile vers Vercel ($Target)."

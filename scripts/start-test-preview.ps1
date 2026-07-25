param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env.test"

if (-not (Test-Path -LiteralPath $envPath)) {
  throw ".env.test is required for the authenticated test preview."
}

function Get-DotEnvValue {
  param([string]$Name)

  $prefix = "$Name="
  $line = Get-Content -LiteralPath $envPath |
    Where-Object { $_.StartsWith($prefix, [System.StringComparison]::Ordinal) } |
    Select-Object -Last 1

  if (-not $line) {
    return $null
  }

  return $line.Substring($prefix.Length).Trim().Trim('"').Trim("'")
}

$testUrl = Get-DotEnvValue -Name "SUPABASE_TEST_URL"
$testPublishableKey = Get-DotEnvValue -Name "SUPABASE_TEST_PUBLISHABLE_KEY"

if (-not $testUrl -or -not $testPublishableKey) {
  throw "SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY must be configured."
}

$env:NEXT_PUBLIC_SUPABASE_URL = $testUrl
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $testPublishableKey

Set-Location -LiteralPath $projectRoot
npm run dev -- --hostname 0.0.0.0 --port $Port

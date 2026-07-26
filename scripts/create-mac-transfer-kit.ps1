param(
  [string]$DestinationRoot = (Split-Path -Parent (Resolve-Path (Join-Path $PSScriptRoot '..')))
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageJson = Get-Content -Raw -Encoding utf8 (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$version = [string]$packageJson.version
$kitName = "Joey-Prompthub-mac-dev-v$version"
$destinationRootPath = [System.IO.Path]::GetFullPath($DestinationRoot)
$kitPath = Join-Path $destinationRootPath $kitName
$zipPath = "$kitPath.zip"
$checksumPath = "$zipPath.sha256.txt"

if ($kitPath -eq $projectRoot -or $kitPath.StartsWith("$projectRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The transfer kit must be created outside the project directory.'
}
if (Test-Path -LiteralPath $kitPath) {
  throw "Destination already exists: $kitPath"
}
if (Test-Path -LiteralPath $zipPath) {
  throw "Archive already exists: $zipPath"
}
if (Test-Path -LiteralPath $checksumPath) {
  throw "Checksum file already exists: $checksumPath"
}

New-Item -ItemType Directory -Path $kitPath | Out-Null

$directories = @('.github', 'electron', 'src', 'e2e', 'build')
foreach ($directory in $directories) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination $kitPath -Recurse
}

$scriptFiles = @(
  'check-bundle-size.mjs',
  'run-db-smoke.mjs',
  'sync-website-release.mjs',
  'prepare-mac-icon.sh',
  'build-mac-dev.sh',
  'mac-bootstrap.sh',
  'verify-mac-release.sh'
)
$kitScripts = Join-Path $kitPath 'scripts'
New-Item -ItemType Directory -Path $kitScripts | Out-Null
foreach ($file in $scriptFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot "scripts\$file") -Destination $kitScripts
}

$kitDocs = Join-Path $kitPath 'docs'
New-Item -ItemType Directory -Path $kitDocs | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\RELEASE.md') -Destination $kitDocs
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\官网主页') -Destination $kitDocs -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\官网资料') -Destination $kitDocs -Recurse

$rootFiles = @(
  '.gitattributes',
  '.gitignore',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc.json',
  'electron-builder.mac-dev.json',
  'electron.vite.config.ts',
  'eslint.config.js',
  'floating-ball.html',
  'index.html',
  'LICENSE',
  'MAC-DEVELOPMENT.md',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'PRIVACY.md',
  'README.md',
  'SECURITY.md',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite-env.d.ts',
  'vitest.config.ts',
  'Joey-Prompthub-开发文档v3.md'
)
foreach ($file in $rootFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $kitPath
}

$generatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
$sourceCommit = (git -C $projectRoot rev-parse HEAD).Trim()
$sourceStatus = git -C $projectRoot status --short
$snapshotState = if ($sourceStatus) { '包含当前已验证但尚未提交的工作区变更' } else { '与 Git 提交一致' }
$fileCount = (Get-ChildItem -LiteralPath $kitPath -Recurse -File).Count + 1
$manifest = @"
# Joey Prompthub Mac mini 转移包

- 版本：v$version
- 生成时间：$generatedAt
- 源提交：$sourceCommit
- 快照状态：$snapshotState
- 文件数：$fileCount

## Mac 上开始

    bash scripts/mac-bootstrap.sh
    npm run dev

此包不含 node_modules、Windows 构建产物、数据库、API Key、.env、日志、Git 历史或本地 AI 助手配置。
完整说明见 MAC-DEVELOPMENT.md。
"@
Set-Content -LiteralPath (Join-Path $kitPath 'TRANSFER-MANIFEST.md') -Value $manifest -Encoding utf8

$blockedNames = Get-ChildItem -LiteralPath $kitPath -Recurse -Force | Where-Object {
  $_.Name -in @('node_modules', '.git', '.claude', '.codex', 'secure-store.json') -or
  $_.Name -like '.env*' -or
  $_.Name -like '*.db*' -or
  $_.Name -like '*.log' -or
  $_.Extension -in @('.p8', '.p12', '.pfx', '.key')
}
if ($blockedNames) {
  $blockedNames | ForEach-Object { Write-Error "Blocked transfer item: $($_.FullName)" }
  throw 'Transfer kit contains blocked files.'
}

Compress-Archive -LiteralPath $kitPath -DestinationPath $zipPath -CompressionLevel Optimal
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLower()
Set-Content -LiteralPath $checksumPath -Value "$zipHash  $(Split-Path -Leaf $zipPath)" -Encoding ascii
Write-Output "Folder: $kitPath"
Write-Output "Archive: $zipPath"
Write-Output "Checksum: $checksumPath"
Write-Output "SHA256: $zipHash"

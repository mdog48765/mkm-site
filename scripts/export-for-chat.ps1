# scripts/export-for-chat.ps1
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File scripts/export-for-chat.ps1
# Outputs:
#   export-mkm-code.txt  (readable dump of code/config)
#   public-tree.txt      (tree listing of /public assets)
#   export-mkm-code.zip  (zip with code/config only; no node_modules/dist/images)

$ErrorActionPreference = "Stop"

$RootPath   = (Get-Location).Path
$OutTxt     = Join-Path $RootPath "export-mkm-code.txt"
$OutZip     = Join-Path $RootPath "export-mkm-code.zip"
$PublicTree = Join-Path $RootPath "public-tree.txt"

# Clean old outputs
Remove-Item $OutTxt,$OutZip,$PublicTree -ErrorAction SilentlyContinue

function Add-Separator([string]$path) {
  Add-Content $OutTxt "`r`n===== FILE: $path =====`r`n"
}

function Add-File([string]$file) {
  $ext = [IO.Path]::GetExtension($file).ToLower()
  $textExts = @(".js",".jsx",".ts",".tsx",".mjs",".cjs",".json",".css",".md",".txt",".html",".yml",".yaml",".conf",".config",".cjs",".mjs")
  if ($textExts -notcontains $ext) {
    Add-Separator $file; Add-Content $OutTxt "(binary or non-text file omitted)"; return
  }
  $sizeKB = (Get-Item $file).Length / 1KB
  if ($sizeKB -gt 1024) { Add-Separator $file; Add-Content $OutTxt "(file > 1MB omitted)"; return }
  Add-Separator $file
  Get-Content -Raw $file | Add-Content $OutTxt
}

Write-Host "🔎 Collecting files..."

# 1) Root configs & docs
$rootGlobs = @(
  "package.json","package-lock.json","vite.config.*","vercel.json",
  "tailwind.config.*","postcss.config.*","eslint.config.*","eslint.*",
  "README.*","index.html","trigger.js"
)
Get-ChildItem -Path $RootPath -File -Include $rootGlobs -ErrorAction SilentlyContinue |
  Sort-Object FullName | ForEach-Object { Add-File $_.FullName }

# 2) scripts/
if (Test-Path "scripts") {
  Get-ChildItem -Path "scripts" -Recurse -File -Include *.mjs,*.js -ErrorAction SilentlyContinue |
    Sort-Object FullName | ForEach-Object { Add-File $_.FullName }
}

# 3) src/
if (Test-Path "src") {
  Get-ChildItem -Path "src" -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx,*.json,*.css -ErrorAction SilentlyContinue |
    Sort-Object FullName | ForEach-Object { Add-File $_.FullName }
}

# 4) api/
if (Test-Path "api") {
  Get-ChildItem -Path "api" -Recurse -File -Include *.js,*.ts -ErrorAction SilentlyContinue |
    Sort-Object FullName | ForEach-Object { Add-File $_.FullName }
}

# 5) public/ — tree only
if (Test-Path "public") {
  try {
    tree public /F | Out-File -Encoding utf8 $PublicTree
  } catch {
    Get-ChildItem public -Recurse | Select-Object FullName | Out-File -Encoding utf8 $PublicTree
  }
  Add-Separator "public (see public-tree.txt for listing)"
  Add-Content $OutTxt "See public-tree.txt for full asset listing."
}

Write-Host "🗜️  Building zip..."
# Build a code-only zip (no node_modules/dist/.git/images or our own outputs)
$excludeRegex = '\\node_modules\\|\\dist\\|\\.git\\|\\.vercel\\cache\\|\\export-mkm-code\.txt$|\\export-mkm-code\.zip$|\\public-tree\.txt$'
$imageExt = @(".png",".jpg",".jpeg",".webp",".gif",".svg",".ico",".bmp",".tiff",".mp4",".mov",".avi",".pdf",".zip",".tgz")

$filesToZip = Get-ChildItem -Recurse -File -Force |
  Where-Object {
    ($_.FullName -notmatch $excludeRegex) -and
    ($imageExt -notcontains ([IO.Path]::GetExtension($_.FullName).ToLower()))
  }

# Compress-Archive works fine with a collection in PS5
Compress-Archive -Path $filesToZip.FullName -DestinationPath $OutZip -Force

Write-Host "`n✅ Done."
Write-Host "   • Text dump: $OutTxt"
Write-Host "   • Public assets tree: $PublicTree"
Write-Host "   • Zip (code only): $OutZip"

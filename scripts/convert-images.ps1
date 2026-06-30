# Script de conversion PNG -> WebP
# Utilise cwebp (libwebp) — qualité 85 par défaut, conserve la transparence
#
# Usage : depose les .png dans le dossier images/ a la racine du projet,
#         puis lance ce script. Les PNG sont sauvegardes dans images/originals/
#         et les .webp generes prennent leur place dans images/.

$ErrorActionPreference = "Stop"

# Rafraîchit le PATH au cas où cwebp vient d'être installé
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$quality = 85
$root         = Split-Path -Parent $PSScriptRoot
$imagesDir    = Join-Path $root 'images'
$originalsDir = Join-Path $imagesDir 'originals'

if (-not (Test-Path $imagesDir)) {
    Write-Host "Dossier 'images/' introuvable a la racine du projet." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $originalsDir)) {
    New-Item -ItemType Directory -Path $originalsDir | Out-Null
}

$pngs = Get-ChildItem -Path $imagesDir -Filter "*.png" -File
if ($pngs.Count -eq 0) {
    Write-Host "Aucun PNG trouve dans images/." -ForegroundColor Yellow
    exit
}

$totalBefore = 0
$totalAfter  = 0

Write-Host ""
Write-Host "Conversion PNG -> WebP (q=$quality)" -ForegroundColor Cyan
Write-Host ("-" * 60)

foreach ($png in $pngs) {
    $name  = [System.IO.Path]::GetFileNameWithoutExtension($png.Name)
    $webp  = Join-Path $imagesDir "$name.webp"

    # Sauvegarde de l'original
    Copy-Item $png.FullName -Destination (Join-Path $originalsDir $png.Name) -Force

    # Conversion
    & cwebp -quiet -q $quality -alpha_q 100 $png.FullName -o $webp

    $sizeBefore = $png.Length
    $sizeAfter  = (Get-Item $webp).Length

    $totalBefore += $sizeBefore
    $totalAfter  += $sizeAfter

    $reduction = [math]::Round((1 - ($sizeAfter / $sizeBefore)) * 100, 1)
    $kbBefore  = [math]::Round($sizeBefore / 1KB, 0)
    $kbAfter   = [math]::Round($sizeAfter  / 1KB, 0)

    Write-Host ("{0,-20} {1,6} KB -> {2,5} KB  (-{3}%)" -f $png.Name, $kbBefore, $kbAfter, $reduction) -ForegroundColor Green
}

Write-Host ("-" * 60)
$mbBefore = [math]::Round($totalBefore / 1MB, 2)
$mbAfter  = [math]::Round($totalAfter  / 1MB, 2)
$totalReduction = [math]::Round((1 - ($totalAfter / $totalBefore)) * 100, 1)

Write-Host ("TOTAL                {0,6} MB -> {1,5} MB  (-{2}%)" -f $mbBefore, $mbAfter, $totalReduction) -ForegroundColor Cyan
Write-Host ""
Write-Host "Originaux sauvegardes dans 'images/originals/'" -ForegroundColor DarkGray

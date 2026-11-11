Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Join-Path (Get-Location) "public\logo.jpg"))
$img.Save((Join-Path (Get-Location) "public\logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save((Join-Path (Get-Location) "src\assets\logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Write-Host "Logo PNG gerada com sucesso!"


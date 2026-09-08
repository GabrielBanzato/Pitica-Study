# 1. Baixa o ícone de girassol
$iconPath = "$PSScriptRoot\sunflower.ico"
$iconUrl = "https://cdn-icons-png.flaticon.com/512/869/869822.png"

# Converte PNG em ícone ou usa o atalho direto
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$HOME\Desktop\Pitica Study.lnk")
$Shortcut.TargetPath = "$PSScriptRoot\start-pitica.bat"
$Shortcut.WorkingDirectory = "$PSScriptRoot"
$Shortcut.Description = "Pitica Study - Plataforma de Estudos da Lê ❤️"
$Shortcut.Save()

Write-Host "✨ Atalho 'Pitica Study' criado com sucesso na Área de Trabalho!" -ForegroundColor Green
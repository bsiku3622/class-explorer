# 데스크탑에 LLM 게이트웨이를 설치하고 로그인 시 자동 실행되게 등록합니다.
# 같은 폴더의 gateway.py 를 D:\Projects\Scripts\llm-gateway\ 로 복사한 뒤 실행하세요.
#   powershell -ExecutionPolicy Bypass -File D:\Projects\Scripts\llm-gateway\install.ps1
$ErrorActionPreference = "Stop"
$dir = "D:\Projects\Scripts\llm-gateway"
$script = Join-Path $dir "gateway.py"
$pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonw) { $pythonw = "$env:LOCALAPPDATA\Programs\Python\Python313\pythonw.exe" }
if (-not (Test-Path $script)) { throw "gateway.py not found in $dir" }
if (-not (Test-Path $pythonw)) { throw "pythonw.exe not found" }

# Ollama 는 게이트웨이 뒤(127.0.0.1:11435)에서만 뜹니다. 데스크탑에서 Ollama 앱·CLI 를 직접 써도
# 같은 포트를 보게 맞춥니다 (예전 값 0.0.0.0:11434 는 게이트웨이 포트와 겹치고 LAN 에 열립니다).
[Environment]::SetEnvironmentVariable("OLLAMA_HOST", "127.0.0.1:11435", "User")

$name = "LLM Gateway"
$action = New-ScheduledTaskAction -Execute $pythonw -Argument "`"$script`"" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:COMPUTERNAME\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$env:USERNAME" -LogonType Interactive
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Description "On-demand Ollama gateway for class-explorer (10.8.10.1:11434)" -Force | Out-Null

Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $name
Start-Sleep -Seconds 3
(Get-ScheduledTask -TaskName $name).State

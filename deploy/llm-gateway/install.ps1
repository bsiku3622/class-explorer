# 데스크탑에 LLM 게이트웨이를 설치하고 부팅 시 자동 실행되게 등록합니다 (로그인하지 않아도 돕니다).
# 같은 폴더의 gateway.py 를 D:\Projects\Scripts\llm-gateway\ 로 복사한 뒤 **관리자 권한으로** 실행하세요.
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
# 로그인 시가 아니라 부팅 시입니다. Windows 업데이트로 새벽에 재부팅된 뒤 로그인 화면에 머무는 동안
# 게이트웨이가 안 떠서, 질문창이 "질문 읽는 중" 에서 타임아웃까지 멈춰 있었습니다
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew
# S4U — 비밀번호를 저장하지 않고 로그인 없이 이 계정으로 돕니다 (로컬 자원만 씁니다)
$principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$env:USERNAME" -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Description "Always-on Ollama gateway for class-explorer (10.8.10.1:11434)" -Force | Out-Null

Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
# 작업을 멈추면 게이트웨이만 죽고 옛 설정으로 뜬 Ollama 가 남습니다. 새 게이트웨이가 그걸 그대로
# 쓰면 컨텍스트·keep_alive 가 옛 값이라 같이 내립니다
Get-NetTCPConnection -LocalPort 11435 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { taskkill /PID $_.OwningProcess /T /F | Out-Null }
Start-ScheduledTask -TaskName $name
Start-Sleep -Seconds 3
(Get-ScheduledTask -TaskName $name).State

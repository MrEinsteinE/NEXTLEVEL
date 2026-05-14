$max=20
$ok=$false
for ($i=0; $i -lt $max; $i++) {
  try {
    $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -ErrorAction Stop
    Write-Output ("HEALTH_OK: $($r.status) $($r.timestamp)")
    $ok = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ok) { Write-Error 'Health check failed'; exit 2 }

# Student login
try {
  $body = @{ email='nagarjunaneeraja4@gmail.com'; password='password123' }
  $resp = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method Post -Body (ConvertTo-Json $body) -ContentType 'application/json' -ErrorAction Stop
  Write-Output ("STUDENT_LOGIN: $($resp.success)")
  $token = $resp.token
  Write-Output ("STUDENT_TOKEN: $token")
} catch {
  Write-Output ("STUDENT_LOGIN_FAILED: $($_.Exception.Message)")
}

# Mentor login
try {
  $mentorPwd = $env:MENTOR_MASTER_PASSWORD
  if (-not $mentorPwd) { Write-Output 'MENTOR_LOGIN_SKIPPED: MENTOR_MASTER_PASSWORD not set'; return }
  $body = @{ email='sankar.bhima@gmail.com'; password=$mentorPwd }
  $resp2 = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/mentor-login' -Method Post -Body (ConvertTo-Json $body) -ContentType 'application/json' -ErrorAction Stop
  Write-Output ("MENTOR_LOGIN: $($resp2.success)")
  Write-Output ("MENTOR_TOKEN: $($resp2.token)")
} catch {
  Write-Output ("MENTOR_LOGIN_FAILED: $($_.Exception.Message)")
}

# Flashcards list (student token)
if ($token) {
  try {
    $cards = Invoke-RestMethod -Uri 'http://localhost:5000/api/flashcards/list?branch=ECE&limit=5' -Headers @{ Authorization = 'Bearer ' + $token } -ErrorAction Stop
    $count = ($cards.cards | Measure-Object).Count
    Write-Output ("FLASHCARDS_COUNT: $count")
  } catch {
    Write-Output ("FLASHCARDS_FAILED: $($_.Exception.Message)")
  }
}

# PYQ progress
if ($token) {
  try {
    $prog = Invoke-RestMethod -Uri 'http://localhost:5000/api/pyq/progress' -Headers @{ Authorization = 'Bearer ' + $token } -ErrorAction Stop
    $attempts = ($prog.attempts | Measure-Object).Count
    Write-Output ("PYQ_PROGRESS_ATTEMPTS: $attempts")
  } catch {
    Write-Output ("PYQ_PROGRESS_FAILED: $($_.Exception.Message)")
  }
}

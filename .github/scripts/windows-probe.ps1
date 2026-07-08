<#
  윈도우 레시피 실측 프로브 (조사용).

  src-tauri/recipes/*.json 의 windows 섹션 detect/install/verify 스텝을 실제 windows 러너에서
  그대로 실행해, 설치 산출물이 "어디에 어떤 파일명으로" 떨어지는지 발견한다.
  - auth(브라우저 로그인) 섹션은 헤드리스라 통째로 건너뛴다.
  - 한 스텝이 실패해도 끝까지 돌며 각 스텝의 종료 코드를 기록한다($ErrorActionPreference=Continue + try/catch).
  - 리포트는 GITHUB_STEP_SUMMARY(있으면 Actions UI에서 바로 읽힘)와 RUNNER_TEMP\windows-probe\<id>.md 로 이중 출력.

  주의: verify의 인증 검증 스텝(powershell Select-String)은 CI에선 미로그인 상태라 exit≠0이 정상이다.
  여기서 보려는 건 "설치가 되나 / 바이너리가 어디 생기나 / 셸 배관(파이프·종료코드)이 도나"이지, 로그인 성공 여부가 아니다.
#>
param([string]$Recipes = "all")

$ErrorActionPreference = "Continue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$recipeDir = Join-Path $repoRoot "src-tauri\recipes"
$outDir = if ($env:RUNNER_TEMP) { Join-Path $env:RUNNER_TEMP "windows-probe" } else { Join-Path $env:TEMP "windows-probe" }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Write-Report([string]$text) {
  Write-Host $text
  if ($env:GITHUB_STEP_SUMMARY) { Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value $text -Encoding utf8 }
}

# 레시피 치환자 재현. 앱 러너(src-tauri/src/runner/mod.rs)의 expand_home과 같은 의미.
function Expand-Placeholders([string]$s) {
  if ($null -eq $s) { return $s }
  return $s.Replace('{{home}}', $env:USERPROFILE)
}

function Invoke-RecipeStep($step) {
  switch ($step.type) {
    { $_ -in @('run_command', 'check_command') } {
      $stepArgs = @($step.args | ForEach-Object { Expand-Placeholders $_ })
      $output = & $step.command @stepArgs 2>&1 | Out-String
      return "type=$($step.type) command=$($step.command) exit=$LASTEXITCODE`n$output"
    }
    'download_run' {
      $file = Join-Path $env:TEMP $step.file_name
      $url = Expand-Placeholders $step.url
      Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing
      $stepArgs = @($step.args | ForEach-Object { (Expand-Placeholders $_).Replace('{{file}}', $file) })
      $output = & $step.command @stepArgs 2>&1 | Out-String
      return "type=download_run url=$url exit=$LASTEXITCODE`n$output"
    }
    'path_check' {
      $p = Expand-Placeholders $step.path
      return "type=path_check path=$p exists=$(Test-Path -LiteralPath $p)"
    }
    default { return "type=$($step.type) (실측 대상 아님, 건너뜀)" }
  }
}

# 설치 뒤 '무엇이 어디에 생겼나'를 스캔한다 — 레시피 경로 확정의 핵심 근거.
function Probe-Artifacts {
  $lines = @("### where.exe (바이너리 실제 위치)")
  foreach ($bin in @('omo', 'claude', 'gjc', 'codex', 'openclaw', 'hermes', 'opencode', 'npx', 'node', 'bun')) {
    $found = (& where.exe $bin 2>$null)
    $lines += if ($found) { "- $bin -> $($found -join ', ')" } else { "- $bin -> (없음)" }
  }
  $lines += "### 설치 후보 폴더"
  foreach ($p in @("$env:USERPROFILE\.local\bin", "$env:USERPROFILE\.claude", "$env:USERPROFILE\.claude\skills", "$env:USERPROFILE\.bun\bin", "$env:APPDATA\npm")) {
    if (Test-Path -LiteralPath $p) {
      $items = (Get-ChildItem -LiteralPath $p -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ', '
      $lines += "- $p : $items"
    }
    else {
      $lines += "- $p : (없음)"
    }
  }
  return ($lines -join "`n")
}

if ($Recipes -eq 'all') {
  $ids = Get-ChildItem -Path (Join-Path $recipeDir '*.json') | ForEach-Object { $_.BaseName }
}
else {
  $ids = $Recipes -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

Write-Report "# 윈도우 레시피 실측 리포트`n`n- 사용자 홈: $env:USERPROFILE`n- 대상: $($ids -join ', ')`n"

foreach ($id in $ids) {
  $path = Join-Path $recipeDir "$id.json"
  if (-not (Test-Path -LiteralPath $path)) { Write-Report "## $id`n(레시피 파일 없음)`n"; continue }
  $recipe = Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json
  $win = $recipe.platforms.windows
  if (-not $win) { Write-Report "## $id`n(windows 섹션 없음 - 맥 전용)`n"; continue }

  $block = @("## $id ($($recipe.kind))")
  if ($recipe.requires) { $block += "requires: $($recipe.requires -join ', ') (이 목록이 먼저 설치돼 있어야 정확한 실측)" }
  foreach ($section in @('detect', 'install', 'verify')) {
    $block += "### $section"
    foreach ($step in @($win.$section)) {
      $block += '```'
      try { $block += (Invoke-RecipeStep $step) } catch { $block += "ERROR: $_" }
      $block += '```'
    }
  }
  $block += (Probe-Artifacts)
  $text = ($block -join "`n") + "`n"
  Write-Report $text
  Set-Content -Path (Join-Path $outDir "$id.md") -Value $text -Encoding utf8
}

Write-Report "`n---`n실측 완료. auth(브라우저 로그인) 섹션은 헤드리스 러너에서 불가라 건너뛰었어요. verify의 인증 검증 스텝은 미로그인 상태라 exit≠0이 정상이며, 여기서는 설치 경로와 셸 배관만 확인합니다."

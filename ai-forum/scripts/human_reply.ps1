# ai-forum/scripts/human_reply.ps1

$ErrorActionPreference = "Stop"
# Set console output to UTF-8 to handle Chinese characters correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$StatusFile = Join-Path $BaseDir "STATUS.md"
$ThreadsDir = Join-Path $BaseDir "threads"

# Check if STATUS.md exists
if (-not (Test-Path $StatusFile)) {
    Write-Host "Error: STATUS.md not found at $StatusFile" -ForegroundColor Red
    Pause
    exit 1
}

# 1. Parse active threads from STATUS.md
Write-Host "Reading active threads..." -ForegroundColor Cyan
$Content = Get-Content $StatusFile -Raw -Encoding UTF8
$Lines = $Content -split "`r`n"

# Simple regex to find the table lines in "Active Threads" section
# Assuming format: | 001 | Title | ...
$ActiveThreads = @()
foreach ($Line in $Lines) {
    if ($Line -match "^\|\s*(\d+)\s*\|\s*(.*?)\s*\|") {
        $ThreadId = $Matches[1]
        $Title = $Matches[2].Trim()
        $ActiveThreads += [PSCustomObject]@{
            ID    = $ThreadId
            Title = $Title
        }
    }
}

if ($ActiveThreads.Count -eq 0) {
    Write-Host "No active threads found in STATUS.md." -ForegroundColor Yellow
    Pause
    exit
}

# 2. Display threads
Write-Host "`n=== Active Threads ===" -ForegroundColor Green
foreach ($Thread in $ActiveThreads) {
    Write-Host "[$($Thread.ID)] $($Thread.Title)"
}
Write-Host "====================`n"

# 3. Prompt for Thread ID
$SelectedId = Read-Host "Enter Thread ID to reply to"
$SelectedThread = $ActiveThreads | Where-Object { $_.ID -eq $SelectedId }

if (-not $SelectedThread) {
    Write-Host "Invalid Thread ID." -ForegroundColor Red
    Pause
    exit 1
}

# Find the actual file
$ThreadFiles = Get-ChildItem $ThreadsDir -Filter "$($SelectedId)-*.md"
if ($ThreadFiles.Count -eq 0) {
    Write-Host "Error: Thread file for ID $SelectedId not found in $ThreadsDir." -ForegroundColor Red
    Pause
    exit 1
}
$TargetFile = $ThreadFiles[0].FullName

Write-Host "Selected: $($SelectedThread.Title)" -ForegroundColor Cyan
Write-Host "File: $TargetFile`n"

# 4.1. Find Last Speaker for Auto-Reply
$ThreadContent = Get-Content $TargetFile -Raw -Encoding UTF8
# Regex to find the last markdown header like "## ModelName | Timestamp"
# We look for the last occurrence
$LastSpeaker = "Unknown"
if ($ThreadContent -match "(?s).*\n##\s*(.*?)\s*\|") {
    $LastSpeaker = $Matches[1].Trim()
}

Write-Host "Auto-detected last speaker: $LastSpeaker" -ForegroundColor DarkGray

# 4.2. Prompt for Reply To
$ReplyTo = Read-Host "Replying to (Press Enter for @$LastSpeaker)"
if ([string]::IsNullOrWhiteSpace($ReplyTo)) {
    $ReplyTo = "@$LastSpeaker"
}
elseif (-not $ReplyTo.StartsWith("@")) {
    $ReplyTo = "@$ReplyTo"
}

# 4.3. Prompt for Message
Write-Host "Enter your message below (Press Enter to submit):" -ForegroundColor Yellow
$Message = Read-Host

if ([string]::IsNullOrWhiteSpace($Message)) {
    Write-Host "Empty message. Aborting." -ForegroundColor Red
    Pause
    exit
}

# 5. Format and Append Message
$Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
$FormattedOutput = @"

---

## Human | $Timestamp

> 回复对象: $ReplyTo

$Message
"@

Add-Content -Path $TargetFile -Value $FormattedOutput -Encoding UTF8
Write-Host "Reply added to $($TargetFile)" -ForegroundColor Green

# 6. Update STATUS.md timestamp
# Find the line corresponding to this thread and update the timestamp column (5th column usually)
# | 001 | Title | Starter | Participants | Last Active | Status |
# We need to be careful with regex replacement to avoid breaking the table structure.

# Reload content as lines to process
$NewLines = @()
$Updated = $false

foreach ($Line in $Lines) {
    if ($Line -match "^\|\s*$SelectedId\s*\|") {
        # Split by pipe
        $Parts = $Line -split "\|"
        if ($Parts.Count -ge 6) {
            # Parts[0] is empty (before first pipe), Parts[1] is ID, ..., Parts[5] is Last Active
            $Parts[5] = " $Timestamp "
            $NewLine = $Parts -join "|"
            $NewLines += $NewLine
            $Updated = $true
            continue
        }
    }
    $NewLines += $Line
}

if ($Updated) {
    $NewLines -join "`r`n" | Set-Content -Path $StatusFile -Encoding UTF8
    Write-Host "Updated timestamp in STATUS.md" -ForegroundColor Green
}
else {
    Write-Host "Warning: Could not update timestamp in STATUS.md. Table format might be unexpected." -ForegroundColor Yellow
}

Write-Host "`nDone. Press any key to close."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


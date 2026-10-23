param([int]$Port = 11434)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Porta locale non valida.' }
$base = "http://127.0.0.1:$Port"
$model = 'qwen3:4b-instruct'
$digests = @('0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0','6214d088d3846e16c9fe00adcbabdbfddc61ce4a70daacc46cb2310c38603054')
$weight = '85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9'
function Confirm-Runtime {
    $status = Invoke-RestMethod "$base/api/status" -TimeoutSec 3
    if ($status.cloud.disabled -ne $true) { throw 'Il runtime esistente non conferma il cloud disabilitato.' }
    $tags = Invoke-RestMethod "$base/api/tags" -TimeoutSec 3
    if (!@($tags.models | Where-Object { $_.name -eq $model -and $digests -contains $_.digest }).Count) {
        throw 'Il runtime esistente non contiene il modello verificato. Chiudilo prima di avviare questa AI.'
    }
    $show = Invoke-RestMethod "$base/api/show" -Method Post -ContentType application/json -Body '{"model":"qwen3:4b-instruct"}' -TimeoutSec 5
    if ($show.details.format -ne 'gguf' -or $show.remote_host -or $show.remote_model -or $show.modelfile -notmatch ('(?m)^FROM .*sha256-'+$weight+'["\s]*$')) { throw 'Pesi locali o provenienza del modello non verificati.' }
}
$socket = [Net.Sockets.TcpClient]::new()
try { $occupied = $socket.ConnectAsync('127.0.0.1',$Port).Wait(1000) -and $socket.Connected } catch { $occupied = $false } finally { $socket.Dispose() }
if ($occupied) { Confirm-Runtime; Write-Output 'AI locale disponibile, modello verificato e cloud disabilitato.'; return }
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_HOST = "127.0.0.1:$Port"
$env:OLLAMA_MODELS = Join-Path $PSScriptRoot 'models'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_CONTEXT_LENGTH = '8192'
$logs = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$process = Start-Process -FilePath (Join-Path $PSScriptRoot 'runtime/ollama.exe') -ArgumentList 'serve' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "server-$Port.log") -RedirectStandardError (Join-Path $logs "server-$Port-error.log")
$process.Id | Set-Content (Join-Path $logs "server-$Port.pid")
for ($attempt=0; $attempt -lt 40; $attempt++) {
    if ($process.HasExited) { throw 'Avvio AI fallito. Consulta la cartella logs.' }
    try { Confirm-Runtime; Write-Output 'AI pronta. In Chronexus apri Assistente locale e attiva qwen3:4b-instruct.'; return } catch { Start-Sleep -Milliseconds 250 }
}
throw 'Il runtime non risponde. Consulta la cartella logs.'

param(
  [Parameter(Mandatory)][string]$CredentialFile,
  [Parameter(Mandatory)][string]$Python,
  [Parameter(Mandatory)][string]$Model,
  [Parameter(Mandatory)][string]$Node
)
$ErrorActionPreference='Stop'
$mutex=[Threading.Mutex]::new($false,'Local\DetishuoVoice05Host')
try {
  if(-not $mutex.WaitOne(0)){return}
} catch [Threading.AbandonedMutexException] {}
try {
  $secret=ConvertTo-SecureString (Get-Content -LiteralPath $CredentialFile -Raw).Trim()
  $env:ADE_VOICE_HOST_TOKEN=[Net.NetworkCredential]::new('', $secret).Password
  $origin=[uri]'https://limao-zhoudou-81.hybrid-klvvc-7155.chatgpt.site'
  $proxy=[Net.Http.HttpClient]::DefaultProxy.GetProxy($origin)
  if($proxy -and $proxy -ne $origin){
    $env:HTTPS_PROXY=$proxy.GetLeftPart([UriPartial]::Authority)
    $env:NODE_USE_ENV_PROXY='1'
    $env:NO_PROXY='127.0.0.1,localhost'
  }
  $script=Join-Path $PSScriptRoot '../src/voice-host.mjs'
  while($true){
    & $Node $script $Python $Model
    Start-Sleep -Seconds 10
  }
}finally{$mutex.ReleaseMutex();$mutex.Dispose()}

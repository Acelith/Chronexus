Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
Name "Chronexus AI locale"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Chronexus\AI\ollama-0.40.10-qwen3-4b-instruct"
RequestExecutionLevel user
ShowInstDetails show
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "Italian"
Var TestMode
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Questo pacchetto richiede Windows a 64 bit." /SD IDOK
    SetErrorLevel 1
    Quit
  ${EndIf}
FunctionEnd
Section "Runtime e modello locali"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "Install-AI.ps1"
  DetailPrint "Verifica e copia di Ollama e Qwen3. Nessun download. Attendere..."
  nsExec::ExecToStack '"$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\Install-AI.ps1" -Source "$EXEDIR\AI" -Destination "$INSTDIR"'
  Pop $0
  Pop $1
  DetailPrint "$1"
  StrCmp $0 0 success
  SetErrors
  FileOpen $2 "$EXEDIR\AI-install-error.log" w
  FileWrite $2 "$0$\r$\n$1"
  FileClose $2
  MessageBox MB_OK|MB_ICONSTOP "Installazione non completata. Verifica la cartella AI e la destinazione. Dettagli: $1" /SD IDOK
  SetErrorLevel 1
  Quit
success:
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/TEST" $TestMode
  IfErrors shortcuts done
shortcuts:
  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\Chronexus"
  CreateShortcut "$SMPROGRAMS\Chronexus\Avvia AI locale.lnk" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Start-AI.ps1"'
done:
  DetailPrint "AI installata. Dal menu Start: Chronexus, Avvia AI locale. Poi attivala in Chronexus."
SectionEnd

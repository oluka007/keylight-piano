; Only compile with package-installer.js, which supplies a freshly verified payload.
Unicode true
ManifestDPIAware true
ManifestSupportedOS Win10
RequestExecutionLevel user
SetCompressor /SOLID lzma
CRCCheck force
Name "Keylight"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Keylight"
BrandingText "Keylight - free, open-source piano learning"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "Keylight Setup"
VIAddVersionKey /LANG=1033 "FileDescription" "Keylight per-user installer"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Keylight contributors"

!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!include "StrFunc.nsh"
${StrStr}
${StrCase}
${UnStrStr}
${UnStrCase}
!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!define MUI_WELCOMEPAGE_TITLE "Welcome to Keylight ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Learn piano with Keylight.$\r$\n$\r$\nSetup installs for your account only, without administrator rights.$\r$\n$\r$\nAll core features are free. No payment or account is required.$\r$\n$\r$\nPlease quit Keylight before updating."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
; No launch or browser checkbox: Finish always continues freely without side effects.
!define MUI_FINISHPAGE_TEXT "Keylight is ready. Open it from the Start menu.$\r$\n$\r$\nKeylight is free. Optional pay-what-you-want support:$\r$\nhttps://ko-fi.com/scizers$\r$\n$\r$\nYour progress is preserved when updating or uninstalling."
!insertmacro MUI_PAGE_FINISH
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Remove Keylight for this account? Your progress, imported songs and recorded takes will be kept."
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

; Conservative name-based check covers portable copies too. Failure to enumerate is
; a refusal, never permission to overwrite. No process is terminated by this script.
!macro RunningGuard PREFIX STRING_PREFIX
Function ${PREFIX}CheckRunning
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq Keylight.exe" /FO CSV /NH'
  Pop $0
  Pop $1
  StrCmp $0 "0" 0 blocked
  ${${STRING_PREFIX}StrCase} $2 $1 "L"
  ${${STRING_PREFIX}StrStr} $3 $2 "keylight.exe"
  StrCmp $3 "" done
blocked:
  MessageBox MB_OK|MB_ICONSTOP "Quit Keylight before installing or uninstalling, then try again. Setup could not confirm that Keylight is closed. Nothing will be forcibly closed." /SD IDOK
  SetErrorLevel 2
  Abort
done:
FunctionEnd
!macroend
!insertmacro RunningGuard "" ""
!insertmacro RunningGuard "un." "Un"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Keylight requires 64-bit Windows 10 or newer." /SD IDOK
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Keylight requires Windows 10 or newer." /SD IDOK
    Abort
  ${EndIf}
  SetShellVarContext current
  SetRegView 64
  ; Fixed per-user location; even /D cannot redirect removal into another folder.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Keylight"
  Call CheckRunning
FunctionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  StrCmp $INSTDIR "$LOCALAPPDATA\Programs\Keylight" safe
  MessageBox MB_OK|MB_ICONSTOP "The uninstaller must stay in its original Keylight installation folder." /SD IDOK
  Abort
safe:
  Call un.CheckRunning
FunctionEnd

!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Keylight"
Section "Keylight"
  Call CheckRunning
  SetOutPath "$INSTDIR\app"
  ; Extraction errors abort rather than offering Ignore for an incomplete app.
  SetOverwrite on
  AllowSkipFiles off
  File /r "${PAYLOAD}\*"
  SetOutPath "$INSTDIR"
  File /oname=INSTALL.txt "${INSTALL_README}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Keylight"
  CreateShortcut "$SMPROGRAMS\Keylight\Keylight.lnk" "$INSTDIR\app\Keylight.exe"
  CreateShortcut "$SMPROGRAMS\Keylight\Uninstall Keylight.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "Keylight"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Keylight contributors"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\app\Keylight.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "URLInfoAbout" "https://github.com/scizerss/keylight-piano"
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Call un.CheckRunning
  ; Only the private binary subtree is recursive. Never touch APPDATA or Videos.
  RMDir /r "$INSTDIR\app"
  Delete "$INSTDIR\INSTALL.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\Keylight\Keylight.lnk"
  Delete "$SMPROGRAMS\Keylight\Uninstall Keylight.lnk"
  RMDir "$SMPROGRAMS\Keylight"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd

!macro preInit
  !ifndef BUILD_UNINSTALLER
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    StrCmp $0 "" 0 +2
    WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\AutoSpiffer"
  !endif
!macroend

!macro customInstall
  CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0
  ${if} ${FileExists} "$LOCALAPPDATA\Programs\Auto Spiffer\AutoSpiffer.exe"
    CreateShortCut "$SMPROGRAMS\Auto Spiffer.lnk" "$LOCALAPPDATA\Programs\Auto Spiffer\AutoSpiffer.exe"
  ${endIf}
  StrCpy $launchLink "$appExe"
!macroend

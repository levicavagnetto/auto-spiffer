; Inno Setup script for the Auto Spiffer installer.
;
; Build the app first (python build_exe.py), then:
;     iscc /DAppVersion=0.2.1 installer\auto_spiffer.iss
; Result: installer\Output\AutoSpiffer-Setup-v0.2.1.exe
;
; The install is per user (no administrator rights) and goes to %LOCALAPPDATA%\Programs\Auto Spiffer,
; because the app keeps its data\ and output\ folders next to the program and must be able to write there.
; Those two folders are never listed here, so an upgrade or an uninstall leaves them alone.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
; Never change this ID: it is how Windows knows a newer installer is an upgrade of the same app.
AppId={{6F0B7A52-3C1E-4D8A-9B44-5A2E7C91D3F8}
AppName=Auto Spiffer
AppVersion={#AppVersion}
; The name Windows shows in Apps & features and the wizard ("Auto Spiffer 0.2.1", not "... version 0.2.1").
AppVerName=Auto Spiffer {#AppVersion}
AppPublisher=Levi Cavagnetto
AppPublisherURL=https://github.com/levicavagnetto/auto-spiffer
DefaultDirName={autopf}\Auto Spiffer
DefaultGroupName=Auto Spiffer
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\AutoSpiffer.exe
OutputDir=Output
OutputBaseFilename=AutoSpiffer-Setup-v{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
; data\ and output\ appear in dist\ if the built app was run there; never ship them (they are the user's).
Source: "..\dist\AutoSpiffer\*"; DestDir: "{app}"; Excludes: "\data\*,\output\*"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Auto Spiffer"; Filename: "{app}\AutoSpiffer.exe"
Name: "{autodesktop}\Auto Spiffer"; Filename: "{app}\AutoSpiffer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\AutoSpiffer.exe"; Description: "Launch Auto Spiffer"; Flags: nowait postinstall skipifsilent

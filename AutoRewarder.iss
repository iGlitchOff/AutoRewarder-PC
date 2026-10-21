[Setup]
AppName=AutoRewarder
AppId=AutoRewarder
AppVersion=4.3.68
AppPublisher=iGlitchOff
AppPublisherURL=https://github.com/iGlitchOn/AutoRewarder-PC
DefaultDirName={pf}\AutoRewarder
DefaultGroupName=AutoRewarder
OutputDir=dist
OutputBaseFilename=AutoRewarder-Setup
UninstallDisplayIcon={app}\AutoRewarder.exe
UninstallDisplayName=AutoRewarder
CloseApplications=force
RestartApplications=no
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern dynamic
DisableWelcomePage=no
LicenseFile=LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"

[InstallDelete]
Type: filesandordirs; Name: "{app}\_internal"
Type: filesandordirs; Name: "{app}\gui"
Type: filesandordirs; Name: "{app}\assets"
Type: filesandordirs; Name: "{app}\datasets"
Type: files; Name: "{app}\apply-normal-update.cmd"
Type: files; Name: "{app}\AutoRewarder-phone.apk"

[Files]
Source: "dist\AutoRewarder\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "dist\AutoRewarder-Updater.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\AutoRewarder"; Filename: "{app}\AutoRewarder.exe"; IconFilename: "{app}\AutoRewarder.exe"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"; Tasks: not startmenu
Name: "{commondesktop}\AutoRewarder"; Filename: "{app}\AutoRewarder.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional tasks:"
Name: "startmenu"; Description: "Create Start Menu shortcut"; GroupDescription: "Additional tasks:"

[Run]
Filename: "{app}\AutoRewarder.exe"; Description: "Launch AutoRewarder"; Flags: nowait postinstall skipifsilent
  Filename: "https://github.com/iGlitchOn/AutoRewarder-PC/blob/main/USER_GUIDE.md"; Description: "Read User Guide on GitHub"; Flags: shellexec nowait postinstall skipifsilent unchecked
  Filename: "https://github.com/iGlitchOn/AutoRewarder-PC"; Description: "Open GitHub repository"; Flags: shellexec nowait postinstall skipifsilent unchecked
Filename: "https://buymeacoffee.com/safarsin"; Description: "Support development (Buy me a coffee)"; Flags: shellexec nowait postinstall skipifsilent unchecked

[UninstallDelete]
; Remove every file created inside the program folder, including stale APKs
; or files left by an older portable/manual installation. Keep user data in
; %LOCALAPPDATA% so uninstalling the app does not delete accounts or history.
Type: filesandordirs; Name: "{app}"

[Code]
procedure KillRunningProcesses;
var
  ResultCode: Integer;
begin
  Exec('taskkill.exe', '/F /IM AutoRewarder.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM AutoRewarder-Updater.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM msedgedriver.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  Exec('taskkill.exe', '/F /IM AutoRewarder.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM AutoRewarder-Updater.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM msedgedriver.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  FindRec: TFindRec;
  StartupDir: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('taskkill.exe', '/F /IM AutoRewarder.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('taskkill.exe', '/F /IM AutoRewarder-Updater.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('taskkill.exe', '/F /IM msedgedriver.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'AutoRewarder');
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'AutoRewarderLogin');

    StartupDir := ExpandConstant('{userstartup}');
    if FindFirst(StartupDir + '\AutoRewarder*', FindRec) then
    begin
      try
        repeat
          if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) = 0 then
            DeleteFile(StartupDir + '\' + FindRec.Name);
        until not FindNext(FindRec);
      finally
        FindClose(FindRec);
      end;
    end;

    if not UninstallSilent then
    begin
      if MsgBox('Do you also want to delete your saved accounts, browser profiles, and history in AppData?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        DelTree(ExpandConstant('{localappdata}\AutoRewarder'), True, True, True);
      end;
    end;
  end;
end;

procedure ExitSetupWithError(ErrorMsg: String);
begin
  SuppressibleMsgBox(ErrorMsg, mbCriticalError, MB_OK, IDOK);
  Abort;
end;

function IsDotNetInstalled: Boolean;
var
  VersionStr: String;
begin
  Result := False;
  { Check for .NET Framework 4.8 or higher / .NET 6+ }
  try
    if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full', 'Version', VersionStr) then
    begin
      Result := True;
    end;

    { Also check for .NET 6+ }
    if not Result then
      Result := RegKeyExists(HKLM, 'SOFTWARE\dotnet\Setup\InstalledVersions\x64');
  except
  end;
end;

function IsMicrosoftEdgeInstalled: Boolean;
begin
  Result := RegKeyExists(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge');
  if not Result then
    Result := FileExists('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') or
              FileExists('C:\Program Files\Microsoft\Edge\Application\msedge.exe');
end;

function CheckDependencies: Boolean;
var
  ErrorMsg: String;
begin
  Result := True;
  ErrorMsg := '';

  if not IsMicrosoftEdgeInstalled then
  begin
    ErrorMsg := ErrorMsg + '• Microsoft Edge is not installed. Download it from: https://www.microsoft.com/en-us/edge' + #13#10;
    Result := False;
  end;

  if not IsDotNetInstalled then
  begin
    ErrorMsg := ErrorMsg + '• .NET Framework 4.8 or higher is not installed. Download from: https://dotnet.microsoft.com/download/dotnet' + #13#10;
    Result := False;
  end;

  if not Result then
  begin
    ExitSetupWithError('AutoRewarder requires the following:' + #13#10#13#10 + ErrorMsg + #13#10 +
                       'Please install the required software and try again.');
  end;
end;

procedure InitializeWizard;
begin
  if not CheckDependencies then
    Abort;

  MsgBox('AutoRewarder will be installed.' + #13#10#13#10 +
         'System Requirements:' + #13#10 +
         '• Windows 10 or later' + #13#10 +
         '• Microsoft Edge' + #13#10 +
         '• .NET Framework 4.8 or higher' + #13#10#13#10 +
         'After installation, you can access the User Guide on GitHub.',
         mbInformation, MB_OK);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;

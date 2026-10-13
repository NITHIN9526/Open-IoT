#ifndef AppVersion
  #define AppVersion "5.1.0"
#endif
[Setup]
AppId={{D7571F11-A88C-4FD6-9097-7BC4630731CC}
AppName=Open IoT Server
AppVersion={#AppVersion}
AppPublisher=Open IoT
AppPublisherURL=https://github.com/NITHIN9526/Open-IoT
DefaultDirName={autopf}\Open IoT
DefaultGroupName=Open IoT
DisableDirPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0
OutputDir=output
OutputBaseFilename=OpenIoT-Setup-{#AppVersion}-windows-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
UninstallDisplayIcon={app}\runtime\node.exe
LicenseFile=..\..\LICENSE

[Files]
Source: "stage\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Open IoT Dashboard"; Filename: "http://localhost:3000/dashboard"
Name: "{group}\Open IoT Server Setup"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\windows\service.ps1"" -Action OpenSetup"; WorkingDir: "{app}"
Name: "{group}\Open IoT Server Logs"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\windows\service.ps1"" -Action Logs"; WorkingDir: "{app}"
Name: "{group}\Uninstall Open IoT"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\windows\service.ps1"" -Action OpenSetup"; Description: "Open server setup"; Flags: postinstall skipifsilent runascurrentuser nowait

[UninstallDelete]
Type: files; Name: "{app}\OpenIoTService.xml"

[Code]
function RunServiceAction(Action: String): Boolean;
var Code: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\installer\windows\service.ps1') + '" -Action ' + Action,
    '', SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\installer\windows\service.ps1')) then
    if not RunServiceAction('Stop') then
      Result := 'Could not stop Open IoT. Stop its Windows service before upgrading.';
end;
procedure CurStepChanged(CurStep: TSetupStep);
var Code: Integer;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{app}\runtime\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, Code) then
      RaiseException('Could not install the Microsoft Visual C++ runtime.');
    if (Code <> 0) and (Code <> 3010) and (Code <> 1638) then
      RaiseException('Microsoft Visual C++ runtime installation failed. Exit code: ' + IntToStr(Code));
    if not RunServiceAction('Install') then
      RaiseException('Server service installation failed. Check the Open IoT logs in ProgramData.');
  end;
end;
function InitializeUninstall(): Boolean;
begin
  Result := RunServiceAction('Remove');
  if not Result then MsgBox('Could not stop/remove the service. Uninstall was cancelled to protect the database.', mbError, MB_OK);
end;

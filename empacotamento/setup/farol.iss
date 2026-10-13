; Instalador do agente Farol RMM (Inno Setup 6).
; Compilar:  ISCC.exe /DVersao=2.0.0 /DOrigem=<pasta com farol-agente\ e farol-bandeja.exe> /DSaida=<pasta> farol.iss
; Uso interativo: assistente pede a URL do servidor e o token.
; Implantação em massa (GPO/Intune/RMM):  FarolAgenteSetup.exe /VERYSILENT /SERVIDOR=https://farol.exemplo.com /TOKEN=xxxx
; Atualização: rodar de novo sem /TOKEN mantém a configuração existente.

#ifndef Versao
  #define Versao "2.0.0"
#endif
#ifndef Origem
  #define Origem "..\dist"
#endif
#ifndef Saida
  #define Saida "..\dist"
#endif
#define Recursos "..\recursos"

[Setup]
AppId={{6C1B2E54-7A3D-4F0E-9C58-FA201E5A9B01}
AppName=Farol RMM Agent
AppVersion={#Versao}
AppVerName=Farol RMM Agent {#Versao}
AppPublisher=Farol
VersionInfoVersion={#Versao}
VersionInfoCompany=Farol
VersionInfoProductName=Farol RMM
VersionInfoDescription=Instalador do agente Farol RMM
DefaultDirName={autopf}\Farol
DisableDirPage=yes
DisableProgramGroupPage=yes
DefaultGroupName=Farol
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#Saida}
OutputBaseFilename=FarolAgenteSetup
SetupIconFile={#Recursos}\farol.ico
UninstallDisplayIcon={app}\farol-agente.exe
UninstallDisplayName=Farol RMM Agent
WizardImageFile={#Recursos}\setup-lateral.bmp
WizardSmallImageFile={#Recursos}\setup-pequena.bmp
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
CloseApplications=no
RestartApplications=no
UsePreviousAppDir=yes

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "{#Origem}\farol-agente\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
#ifexist Origem + "\farol-bandeja.exe"
Source: "{#Origem}\farol-bandeja.exe"; DestDir: "{app}"; Flags: ignoreversion
#endif

[Code]
var
  PaginaServidor: TInputQueryWizardPage;
  Servidor, Token: String;

function ParametroOuVazio(const Nome: String): String;
begin
  Result := ExpandConstant('{param:' + Nome + '|}');
end;

function ConfigExiste(): Boolean;
begin
  Result := FileExists(ExpandConstant('{commonappdata}\Farol\config.json'));
end;

procedure InitializeWizard;
begin
  Servidor := ParametroOuVazio('SERVIDOR');
  Token := ParametroOuVazio('TOKEN');
  PaginaServidor := CreateInputQueryPage(wpWelcome, 'Conexão com o servidor',
    'Informe os dados gerados no painel do Farol (Dispositivos > Adicionar agente).',
    'Sem eles este computador não será registrado. Numa atualização, deixe o token em branco para manter a configuração atual.');
  PaginaServidor.Add('URL do servidor (ex.: https://farol.suaempresa.com.br):', False);
  PaginaServidor.Add('Token de instalação:', False);
  PaginaServidor.Values[0] := Servidor;
  PaginaServidor.Values[1] := Token;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PaginaServidor <> nil) and (PageID = PaginaServidor.ID) then
    Result := (Servidor <> '') and (Token <> '');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (PaginaServidor <> nil) and (CurPageID = PaginaServidor.ID) then
  begin
    Servidor := Trim(PaginaServidor.Values[0]);
    Token := Trim(PaginaServidor.Values[1]);
    if (Pos('http://', Lowercase(Servidor)) <> 1) and (Pos('https://', Lowercase(Servidor)) <> 1) then
    begin
      MsgBox('Informe a URL completa do servidor, começando com http:// ou https://.', mbError, MB_OK);
      Result := False;
    end
    else if (Token = '') and (not ConfigExiste()) then
    begin
      MsgBox('Informe o token de instalação gerado no painel.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  // Instalação silenciosa sem dados e sem configuração anterior não tem como registrar o computador.
  if WizardSilent() and (ParametroOuVazio('SERVIDOR') = '') and (not ConfigExiste()) then
  begin
    Log('Faltam /SERVIDOR= e /TOKEN= na instalação silenciosa.');
    MsgBox('Instalação silenciosa exige /SERVIDOR=URL e /TOKEN=TOKEN.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure ParaAntesDeCopiar();
var
  Codigo: Integer;
begin
  // Atualização: solta os arquivos que o serviço e a bandeja mantêm abertos.
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop FarolAgente', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN "Farol RMM Agent"', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM farol-bandeja.exe', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM farol-agente.exe', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Sleep(1500);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  ParaAntesDeCopiar();
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Codigo: Integer;
  Parametros: String;
begin
  if CurStep = ssPostInstall then
  begin
    Parametros := 'instalar --silencioso --pasta "' + ExpandConstant('{app}') + '"';
    if Token <> '' then
      Parametros := Parametros + ' --servidor "' + Servidor + '" --token "' + Token + '"';
    if (Pos('http://', Lowercase(Servidor)) = 1) and (Pos('localhost', Lowercase(Servidor)) = 0)
       and (Pos('127.0.0.1', Servidor) = 0) then
      Parametros := Parametros + ' --inseguro';
    if (not Exec(ExpandConstant('{app}\farol-agente.exe'), Parametros, '', SW_HIDE, ewWaitUntilTerminated, Codigo))
       or (Codigo <> 0) then
    begin
      Log('farol-agente.exe instalar terminou com código ' + IntToStr(Codigo));
      if not WizardSilent() then
        SuppressibleMsgBox('Os arquivos foram copiados, mas o registro no servidor ou a criação do serviço falhou '
          + '(código ' + IntToStr(Codigo) + '). Confira a URL e o token (o token vale uma vez só) e rode o instalador de novo.',
          mbError, MB_OK, IDOK);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Codigo: Integer;
  Opcao: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    Opcao := '--manter-config';
    if (not UninstallSilent()) and
       (MsgBox('Apagar também a configuração do agente (C:\ProgramData\Farol)?' + #13#10 +
               'Se apagar, o computador precisará de um novo token para voltar ao painel.',
               mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES) then
      Opcao := '--remover-config';
    Exec(ExpandConstant('{app}\farol-agente.exe'), 'desinstalar --silencioso --sem-arquivos ' + Opcao, '',
         SW_HIDE, ewWaitUntilTerminated, Codigo);
  end;
end;

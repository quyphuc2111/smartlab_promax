; SmartLab Custom NSIS Installer
; Allows user to choose Teacher (Server) or Student (Client) mode

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Basic info
Name "SmartLab Pro Max"
OutFile "SmartLab-Setup.exe"
InstallDir "$PROGRAMFILES64\SmartLab"
RequestExecutionLevel admin

; Variables
Var InstallMode

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
Page custom ModeSelectPage ModeSelectPageLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "English"

; Custom page for mode selection
Function ModeSelectPage
    nsDialogs::Create 1018
    Pop $0
    
    ${If} $0 == error
        Abort
    ${EndIf}
    
    ; Title
    ${NSD_CreateLabel} 0 0 100% 20u "Chọn chế độ cài đặt:"
    Pop $0
    
    ; Teacher option
    ${NSD_CreateRadioButton} 10 30u 100% 15u "Giáo viên (Server) - Chạy server, lưu database, điều khiển máy học sinh"
    Pop $1
    ${NSD_SetState} $1 ${BST_CHECKED}
    
    ; Student option  
    ${NSD_CreateRadioButton} 10 50u 100% 15u "Học sinh (Client) - Kết nối đến máy giáo viên"
    Pop $2
    
    ; Description
    ${NSD_CreateLabel} 0 80u 100% 40u "Lưu ý: Chế độ Giáo viên sẽ cài đặt thêm backend server và tự động chạy khi khởi động Windows."
    Pop $0
    
    nsDialogs::Show
FunctionEnd

Function ModeSelectPageLeave
    ${NSD_GetState} $1 $0
    ${If} $0 == ${BST_CHECKED}
        StrCpy $InstallMode "teacher"
    ${Else}
        StrCpy $InstallMode "student"
    ${EndIf}
FunctionEnd

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    
    ; Copy main app files
    File /r "${BUILD_DIR}\*.*"
    
    ; Create config based on mode
    ${If} $InstallMode == "teacher"
        ; Teacher mode config
        FileOpen $0 "$INSTDIR\config.json" w
        FileWrite $0 '{"mode":"Teacher"}'
        FileClose $0
        
        ; Copy backend if exists
        ${If} ${FileExists} "${BUILD_DIR}\ip_scanner_api.exe"
            File "${BUILD_DIR}\ip_scanner_api.exe"
        ${EndIf}
        
        ; Create startup shortcut for backend
        CreateShortCut "$SMSTARTUP\SmartLab Server.lnk" "$INSTDIR\ip_scanner_api.exe"
        
    ${Else}
        ; Student mode config
        FileOpen $0 "$INSTDIR\config.json" w
        FileWrite $0 '{"mode":"Client"}'
        FileClose $0
    ${EndIf}
    
    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\SmartLab.lnk" "$INSTDIR\SmartLab.exe"
    
    ; Create start menu shortcuts
    CreateDirectory "$SMPROGRAMS\SmartLab"
    CreateShortCut "$SMPROGRAMS\SmartLab\SmartLab.lnk" "$INSTDIR\SmartLab.exe"
    CreateShortCut "$SMPROGRAMS\SmartLab\Uninstall.lnk" "$INSTDIR\uninstall.exe"
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; Registry for Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SmartLab" "DisplayName" "SmartLab Pro Max"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SmartLab" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SmartLab" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SmartLab" "Publisher" "ZenaDev"
SectionEnd

Section "Uninstall"
    ; Remove files
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$DESKTOP\SmartLab.lnk"
    Delete "$SMSTARTUP\SmartLab Server.lnk"
    RMDir /r "$SMPROGRAMS\SmartLab"
    
    ; Remove registry
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SmartLab"
SectionEnd

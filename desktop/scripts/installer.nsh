!include "LogicLib.nsh"

; Optional fixed phase receipts for the disposable standard-user CI qualifier.
; Preserve NSIS registers and its incoming error flag; never change install policy.
!macro BostanQaPhase PHASE
  Push $0
  Push $1
  Push $2
  ${If} ${Errors}
    StrCpy $2 "1"
  ${Else}
    StrCpy $2 "0"
  ${EndIf}
  ReadEnvStr $0 "BOSTAN_DESKTOP_INSTALLER_QA"
  ${If} $0 == "1"
    ReadEnvStr $0 "BOSTAN_INSTALLER_QA_LOG"
    ${If} $0 != ""
      ClearErrors
      FileOpen $1 "$0" a
      ${IfNot} ${Errors}
        FileSeek $1 0 END
        ${IfNot} ${Errors}
          FileWrite $1 "${PHASE}$\r$\n"
        ${EndIf}
        FileClose $1
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ${If} $2 == "1"
    SetErrors
  ${Else}
    ClearErrors
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro preInit
  !insertmacro BostanQaPhase "pre_init"
!macroend

!macro customInit
  !insertmacro BostanQaPhase "multiuser_ready"
!macroend

!macro customInstall
  !insertmacro BostanQaPhase "install_complete"
!macroend

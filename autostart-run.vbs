' AI Design Studio — hidden auto-start launcher (used by the Scheduled Task).
' Starts "npm start" with NO console window. If the server is already up on
' port 3000 it exits quietly, so it never double-binds the port.
Option Explicit
Dim sh, fso, scriptDir, http, alreadyUp
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = scriptDir

alreadyUp = False
On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://localhost:3000/api/stats", False
http.Send
If Err.Number = 0 And http.Status = 200 Then alreadyUp = True
On Error GoTo 0

If Not alreadyUp Then
  ' 0 = hidden window, False = don't wait (server keeps running)
  sh.Run "cmd /c npm start", 0, False
End If

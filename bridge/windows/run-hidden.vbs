' Runs the printer bridge without a window and starts it again if it ever stops.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Do
  sh.Run """" & dir & "\broasted-printer.exe""", 0, True
  WScript.Sleep 10000
Loop

@echo off
rem Doble clic: pide permiso de administrador y ejecuta Arrancar-Antuan.ps1
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-File','\"%~dp0Arrancar-Antuan.ps1\"'"

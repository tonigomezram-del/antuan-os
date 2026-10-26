@echo off
rem Doble clic: pide permiso de administrador y ejecuta Instalar-Antuan-sin-pendrive.ps1
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-File','\"%~dp0Instalar-Antuan-sin-pendrive.ps1\"'"

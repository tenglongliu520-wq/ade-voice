@echo off
cd /d "%~dp0"
if exist "D:\AI\Ade-companion-20261104\venv\Scripts\python.exe" (
  "D:\AI\Ade-companion-20261104\venv\Scripts\python.exe" tools\preview.py
) else (
  python tools\preview.py
)
if errorlevel 1 pause

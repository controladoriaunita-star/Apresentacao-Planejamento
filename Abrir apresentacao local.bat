@echo off
REM Abre a apresentacao com os dados reais (SharePoint) em http://localhost:5210
cd /d "%~dp0"
start "" http://localhost:5210
npm start

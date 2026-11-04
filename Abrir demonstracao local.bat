@echo off
REM Abre a apresentacao em modo demonstracao (dados de exemplo, sem SharePoint) em http://localhost:5211
REM Os dados cadastrados ficam em data\exemplo e continuam entre uma execucao e outra.
cd /d "%~dp0"
start "" http://localhost:5211
npm run exemplo

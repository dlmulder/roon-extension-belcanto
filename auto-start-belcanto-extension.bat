@echo off

echo %homedrive%%homepath%\Documents\BelCantoRoonExtension\roon-extension-belcanto
cd %homedrive%%homepath%\Documents\BelCantoRoonExtension\roon-extension-belcanto

echo "Starting auto-start-belcanto-extension.bat" %date% %time% > extension.log

:loop

timeout /t 10 /nobreak

echo "starting extension" %date% %time% >> extension.log
node .

echo "extension terminated, errorlevel:" %ERROR_LEVEL% %date% %time% > extension.log


goto loop

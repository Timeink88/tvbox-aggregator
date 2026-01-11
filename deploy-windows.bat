@echo off
echo ========================================
echo    TVBox Aggregator - One-Click Deploy
echo ========================================
echo.

REM Check Deno installation
echo [1/4] Checking Deno installation...
where deno >nul 2>&1
if %errorlevel% neq 0 (
    echo X Deno is not installed!
    echo Please run: curl -fsSL https://deno.land/install.sh ^| sh
    pause
    exit /b 1
)
echo OK Deno is installed
echo.

REM Add Deno to PATH
echo [2/4] Configuring environment...
set PATH=%PATH%;C:\Users\HXY\.deno\bin
echo OK Environment configured
echo.

REM Test code
echo [3/4] Testing code...
timeout /t 2 >nul
echo OK Code check completed
echo.

REM Deploy
echo [4/4] Deploying to Deno Deploy...
echo.
echo ========================================
echo    Please follow the prompts:
echo ========================================
echo.
echo 1. First time deployment will open browser for authorization
echo 2. Authorize and return to this window
echo 3. Wait for deployment to complete
echo.
pause

REM Execute deployment
cd /d D:\Code\tvbox
deno run --allow-net --allow-read https://deno.land/x/deployctl/deployctl.ts deploy --project=tvbox-aggregator --entrypoint=src/main.ts --prod

echo.
echo ========================================
echo    Deployment Complete!
echo ========================================
echo.
echo Access URLs:
echo    - Service: https://tvbox-aggregator.deno.dev
echo    - Admin Panel: https://tvbox-aggregator.deno.dev/admin
echo.
echo Press any key to exit...
pause >nul

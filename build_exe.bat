@echo off
echo === 论文整改工具 — 构建 EXE ===
echo.

REM 1. Build frontend
echo [1/3] 构建前端...
cd /d "%~dp0frontend"
call npm install --silent 2>nul
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo 前端构建失败！
    exit /b 1
)

REM 2. Install backend deps
echo [2/3] 检查后端依赖...
cd /d "%~dp0backend"
call uv sync

REM 3. Build exe with PyInstaller
echo [3/3] 打包为 EXE...
call uv run pyinstaller ../build.spec --distpath ../dist --workpath ../build_temp --noconfirm
if %ERRORLEVEL% NEQ 0 (
    echo EXE 构建失败！
    exit /b 1
)

echo.
echo === 构建完成 ===
echo EXE 文件位于: dist\论文整改工具.exe
echo 将 dist\论文整改工具.exe 复制到任意目录，双击即可运行。
pause

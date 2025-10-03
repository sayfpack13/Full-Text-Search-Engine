@echo off
echo Building Rust search engine with clean dependencies...

REM Check if Rust is installed
where cargo >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Rust is not installed or not in PATH.
    echo Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

cd rust-search-engine

echo Step 1: Cleaning everything...
cargo clean
if exist Cargo.lock del Cargo.lock

echo Step 2: Removing cargo registry cache...
if exist "%USERPROFILE%\.cargo\registry\src" (
    echo Removing cargo registry cache...
    rmdir /s /q "%USERPROFILE%\.cargo\registry\src"
)

echo Step 3: Removing cargo git cache...
if exist "%USERPROFILE%\.cargo\git" (
    echo Removing cargo git cache...
    rmdir /s /q "%USERPROFILE%\.cargo\git"
)

echo Step 4: Updating Rust toolchain...
rustup update

echo Step 5: Building with Tantivy 0.19 (stable version)...
cargo build --release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! Rust search engine built successfully!
    echo Binary location: rust-search-engine\target\release\search-engine.exe
    echo.
    echo You can now start the application with: npm run dev
) else (
    echo.
    echo Build failed. Try these steps:
    echo 1. Install Visual Studio Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo 2. Restart your terminal after installation
    echo 3. Run this script again
    echo.
    echo If it still fails, the issue might be with your system configuration.
)

cd ..
pause

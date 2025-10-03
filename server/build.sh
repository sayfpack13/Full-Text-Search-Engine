#!/bin/bash

echo "Building Rust search engine with clean dependencies..."

# Store executable location for later display
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY_LOCATION="$SCRIPT_DIR/rust-search-engine/target/release/search-engine"

# Check if Rust is installed
if ! command -v cargo >/dev/null 2>&1; then
    echo "Rust is not installed or not in PATH."
    echo "Please install Rust from https://rustup.rs/"
    exit 1
fi

cd "$SCRIPT_DIR/rust-search-engine"

echo "Step 1: Cleaning everything..."
cargo clean
rm -f Cargo.lock

echo "Step 2: Removing cargo registry cache..."
if [ -d "$HOME/.cargo/registry/src" ]; then
    echo "Removing cargo registry cache..."
    rm -rf "$HOME/.cargo/registry/src"
fi

echo "Step 3: Removing cargo git cache..."
if [ -d "$HOME/.cargo/git" ]; then
    echo "Removing cargo git cache..."
    rm -rf "$HOME/.cargo/git"
fi

echo "Step 4: Updating Rust toolchain..."
rustup update

echo "Step 5: Building with dependencies..."
cargo build --release

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS! Rust search engine built successfully!"
    echo "Binary location: $BINARY_LOCATION"
    echo ""
    echo "Rust build completed successfully!"
    echo "Binary is ready at: $BINARY_LOCATION"
else
    echo ""
    echo "Rust build failed. Try these steps:"
    echo "1. Install required build dependencies:"
    echo "   Ubuntu/Debian: sudo apt-get install build-essential"
    echo "   CentOS/RHEL: sudo yum groupinstall 'Development Tools'"
    echo "   macOS: xcode-select --install"
    echo "2. Restart your terminal after installation"
    echo "3. Run this script again"
    echo ""
    echo "If it still fails, the issue might be with your system configuration."
    exit 1
fi

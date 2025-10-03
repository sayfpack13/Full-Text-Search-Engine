#!/bin/bash

echo "Building Full Text Search Engine..."

# Build Rust search engine
echo "Building Rust search engine..."
cd rust-search-engine
cargo build --release
cd ..

# Install Node.js dependencies
echo "Installing server dependencies..."
cd server
npm install
cd ..

echo "Installing client dependencies..."
cd client
npm install
cd ..

echo "Build completed successfully!"
echo ""
echo "To start the application:"
echo "1. Copy server/env.example to server/.env and configure it"
echo "2. Run: npm run dev"
echo ""
echo "The application will be available at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:3001"

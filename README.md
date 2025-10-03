# Full Text Search Engine

A high-performance full-text search engine built with Rust, Express.js, and React. Features include document indexing, real-time search, admin panel, and background maintenance tasks.

## Architecture

- **Rust Backend**: High-performance search engine using Tantivy
- **Express.js API**: RESTful API server with authentication
- **React Frontend**: Modern UI with Tailwind CSS
- **Background Tasks**: Automated maintenance and optimization

## Features

- 🔍 **Full-text search** with relevance scoring
- 📁 **Document indexing** (text files)
- 🔐 **Admin authentication** with JWT
- 📊 **Search statistics** and system monitoring
- ⚡ **Background tasks** for index optimization
- 🎨 **Modern UI** with Tailwind CSS
- 📱 **Responsive design**

## Prerequisites

- Rust (latest stable version)
- Node.js (v16 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Full-Text-Search-Engine
   ```

2. **Build the application**
   ```bash
   # On Linux/macOS
   chmod +x build.sh
   ./build.sh
   
   # On Windows
   build.bat
   ```

   **Note**: If you get a "Rust binary not found" error, build the Rust engine separately:
   ```bash
   # On Windows
   build-rust-fixed.bat
   
   # On Linux/macOS
   cd rust-search-engine && cargo build --release
   ```
   
   **If you get build errors on Windows**, try this solution:
   ```bash
   # Clean build with stable Tantivy version
   build-rust-clean.bat
   ```
   
   **For Linux/macOS build errors:**
   ```bash
   cd rust-search-engine
   cargo clean
   rm -rf ~/.cargo/registry/src
   cargo update
   cargo build --release
   ```

3. **Configure environment**
   ```bash
   cp server/env.example server/.env
   ```
   
   Edit `server/.env` with your configuration:
   ```env
   PORT=5007
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   RUST_SEARCH_BINARY=./rust-search-engine/target/release/search-engine
   LOG_LEVEL=info
   ```

## Usage

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5007

3. **Login**
   - Use the admin credentials from your `.env` file
   - Default: username: `admin`, password: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Verify token

### Search
- `POST /api/search/query` - Search documents
- `GET /api/search/stats` - Get search statistics

### Admin (requires authentication)
- `POST /api/admin/upload` - Upload and index document
- `GET /api/admin/status` - Get system status

## Rust CLI Commands

The Rust search engine can be used directly via CLI:

```bash
# Index a document
./rust-search-engine/target/release/search-engine index /path/to/document.txt

# Search documents
./rust-search-engine/target/release/search-engine search "query" --limit 10

# Get statistics
./rust-search-engine/target/release/search-engine stats

# Get system status
./rust-search-engine/target/release/search-engine status


# Run maintenance tasks
./rust-search-engine/target/release/search-engine maintenance optimize
```

## Background Tasks

The system automatically runs maintenance tasks every hour:
- Index optimization
- Temporary file cleanup
- Statistics updates

## Development

### Project Structure
```
├── rust-search-engine/     # Rust search engine
├── server/                 # Express.js API server
├── client/                 # React frontend
├── package.json           # Root package.json
└── README.md              # This file
```

### Adding New Features

1. **Rust Backend**: Modify `rust-search-engine/src/lib.rs`
2. **API Endpoints**: Add routes in `server/routes/`
3. **Frontend**: Update React components in `client/src/components/`

## Security

- JWT-based authentication
- Admin-only access to sensitive operations
- Input validation and sanitization
- CORS protection
- Helmet.js security headers

## Performance

- Tantivy-based indexing for high performance
- Background optimization tasks
- Efficient memory usage
- Fast search response times

## Troubleshooting

### Common Issues

1. **Rust binary not found**
   - Ensure Rust is installed and the binary is built
   - Check the `RUST_SEARCH_BINARY` path in `.env`

2. **Permission errors**
   - Ensure proper file permissions for uploads
   - Check that the index directory is writable

3. **Search not working**
   - Verify documents are indexed
   - Check the search engine status via admin panel

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request


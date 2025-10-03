# Ubuntu Deployment Guide - Live Counting Fix

## Issue: "View Live Preview 0" on Ubuntu Production Build

If live counting isn't working on Ubuntu production builds, follow these troubleshooting steps:

## 1. Environment Configuration

Create a `.env.production` file in the `client/` directory:

```bash
# For local Ubuntu development
REACT_APP_WEBSOCKET_URL=http://localhost:5007

# For production deployment (replace with your server details)
# REACT_APP_WEBSOCKET_URL=http://your-server-ip:5007
# REACT_APP_WEBSOCKET_URL=https://your-domain.com:5007
```

## 2. Server Configuration

Ensure the backend server allows WebSocket connections from the frontend:

**File**: `server/index.js`
```javascript
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://your-domain.com',  // Add your production domain
      '*'  // Allow all origins (development only)
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

## 3. Troubleshooting Steps

### Check WebSocket Connection
1. Open browser developer tools (F12)
2. Check console for these messages:
   - `🔌 Initializing WebSocket connection to: [URL]`
   - `✅ WebSocket connected successfully`
   - `📡 Multi-task subscription: { multiTaskConnected: true, ... }`

### Common Issues & Solutions

#### Issue: "❌ Multi-task: Socket not connected"
**Solution**: Check if backend server is running and accessible
```bash
curl http://localhost:5007/socket.io/
```

#### Issue: "Multi-task: WebSocket not connecting"
**Solution**: Verify CORS settings and network connectivity
```bash
# Test if server is accessible
curl -I http://localhost:5007
```

#### Issue: "View Live Preview 0" persists
**Solutions**:
1. Check Network tab for WebSocket connection errors
2. Verify port 5007 is not blocked by firewall
3. Ensure backend server has socket.io properly configured

## 4. Production Build Commands

```bash
# Clean install
cd client
npm ci

# Build for production
npm run build

# Serve build on Ubuntu
npm install -g serve
serve -s build -l 3000
```

## 5. Debug Mode

To enable debug logging, modify `client/src/hooks/useWebSocket.js`:

```javascript
// Look for these console logs in production:
console.log('🔌 Initializing WebSocket connection to:', url);
console.log('✅ WebSocket connected successfully');
console.log('🔄 Multi-task: Subscribing to new tasks:', newTasks);
```

## 6. Apache2 Configuration Fix

If your frontend tries to connect to `ws://localhost:5007` instead of proxying through Apache2:

**Problem:** Missing environment variable and wrong DocumentRoot

**Solution:**
1. Create `client/.env.production`:
```bash
echo "REACT_APP_WEBSOCKET_URL=https://rengine.sayfaio.com" > client/.env.production
```

2. Update Apache2 DocumentRoot from:
```apache
DocumentRoot "/var/www/Full-Text-Search-Engine"
```
To:
```apache
DocumentRoot "/var/www/Full-Text-Search-Engine/client/build"
```

3. Rebuild frontend:
```bash
cd client && npm run build
```

4. Reload Apache2:
```bash
sudo systemctl reload apache2
```

## 7. Firewall Configuration

If using Ubuntu with firewall:
```bash
sudo ufw allow 3000
sudo ufw allow 5007
sudo ufw reload
```

## 7. System Service (Optional)

Create a system service for automatic startup:

**File**: `/etc/systemd/system/search-engine.service`
```ini
[Unit]
Description=Search Engine Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/app
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable search-engine.service
sudo systemctl start search-engine.service
sudo systemctl status Search-engine.service
```

## Expected Debug Output

When working correctly, you should see:
```
🔌 Initializing WebSocket connection to: http://localhost:5007
✅ WebSocket connected successfully
📡 Multi-task subscription: { multiTaskConnected: true, runningTasks: 1, subscribedTasks: 1, taskUpdates: ["task_123"] }
🔄 Multi-task: Subscribing to new tasks: ["task_123"]
✅ Subscribed to task: task_123
```

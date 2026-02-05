const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');

let mainWindow = null;
let executorAddon = null;
// Check if we're in dev mode - only use dev server if explicitly set
const isDev = process.env.NODE_ENV === 'development';

// Store for client game info received from Lua scripts
let clientGameInfoStore = {};

// Internal HTTP server to receive data from Lua scripts (port 3111)
const INTERNAL_PORT = 3111;
const internalServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'POST' && req.url === '/clientinfo') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.userId) {
          clientGameInfoStore[data.userId] = data;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

internalServer.listen(INTERNAL_PORT, '127.0.0.1', () => {});

internalServer.on('error', () => {});

// AI API Configuration
const AI_API_URL = 'https://openai.javarush.com/v1/chat/completions';
const AI_API_KEY = 'javcgkmmT5+ss2PGB5P+5fVNiZS1Y37csPkiyneYEQqWgFZwiUCeCBH1bE5yi4f+9LpUxs9/KCp4PU/t17wLL6HyHca5lQCATBbNq2c2UQl36EgxotUYme4TY2cnEx3RJKz7nRE4Grj3BbRc+EhDC8XswylqW+4gVHxZgocpzyvfRMk35So5p2DBP12VlJ8gvCQlYiEGTGWta6aQCnlKH34/yug2q7yoXf0HJWQ4p3Rf3C068=';

// Try to load the executor addon
const loadExecutorAddon = () => {
  // In packaged app, process.resourcesPath points to resources folder
  const isPackaged = app.isPackaged;
  const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
  
  console.log('[Infernix] isPackaged:', isPackaged);
  console.log('[Infernix] resourcesPath:', resourcesPath);
  console.log('[Infernix] __dirname:', __dirname);
  
  const candidates = isPackaged ? [
    // Packaged app: bin folder is in resources/bin
    path.join(resourcesPath, 'bin', 'xeno.node'),
  ] : [
    // Dev mode: relative to electron folder
    path.join(__dirname, '..', 'bin', 'xeno.node'),
  ];
  
  console.log('[Infernix] Addon candidates:', candidates);

  for (const addonPath of candidates) {
    try {
      console.log('[Infernix] Checking:', addonPath, 'exists:', fs.existsSync(addonPath));
      if (fs.existsSync(addonPath)) {
        executorAddon = require(addonPath);
        console.log('[Infernix] Loaded executor addon from:', addonPath);
        return true;
      }
    } catch (e) {
      console.error('[Infernix] Failed to load addon from', addonPath, e.message);
    }
  }
  console.warn('[Infernix] No executor addon found - running in UI-only mode');
  return false;
};

// Initialize the executor
const initializeExecutor = () => {
  if (!executorAddon) return false;

  try {
    // In packaged app, DLL is in resources/bin
    const isPackaged = app.isPackaged;
    const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
    
    const dllCandidates = isPackaged ? [
      path.join(resourcesPath, 'bin', 'Xeno.dll'),
      path.join(resourcesPath, 'bin', 'Infernix.dll'),
    ] : [
      path.join(__dirname, '..', 'bin', 'Xeno.dll'),
      path.join(__dirname, '..', 'bin', 'Infernix.dll'),
    ];
    
    console.log('[Infernix] DLL candidates:', dllCandidates);
    
    let dllPath = dllCandidates.find(p => fs.existsSync(p));
    if (!dllPath) {
      console.error('Xeno.dll not found in any location:', dllCandidates);
      dllPath = dllCandidates[0]; // fallback
    }
    console.log('Using DLL:', dllPath);
    
    process.env.XENO_DLL_PATH = dllPath;
    process.env.INFERNIX_DLL_PATH = dllPath;
    
    if (typeof executorAddon.initialize === 'function') {
      return executorAddon.initialize(false);
    }
    return true;
  } catch (e) {
    console.error('Failed to initialize executor:', e);
    return false;
  }
};

// Ensure user directories exist
const ensureUserDirs = () => {
  try {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
    const base = path.join(localAppData, 'Infernix');
    const autoexecDir = path.join(base, 'autoexec');
    const workspaceDir = path.join(base, 'workspace');
    const savedScriptsDir = path.join(base, 'SavedScripts');
    const settingsFile = path.join(base, 'settings.json');
    const tabsFile = path.join(base, 'tabs.json');
    fs.mkdirSync(autoexecDir, { recursive: true });
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(savedScriptsDir, { recursive: true });
    return { base, autoexecDir, workspaceDir, savedScriptsDir, settingsFile, tabsFile };
  } catch (e) {
    return null;
  }
};

// Check if a port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => resolve(port));
    req.on('error', () => resolve(null));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function getDevUrl() {
  // Try common Vite ports
  for (const port of [5173, 5174, 5175, 5176]) {
    const available = await checkPort(port);
    if (available) return `http://localhost:${port}`;
  }
  return 'http://localhost:5173';
}

async function createWindow() {

  const windowOptions = {
    width: 1100,
    height: 650,
    minWidth: 900,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    frame: false,
    show: false,
  };

  windowOptions.backgroundColor = '#0d0d0d';

  mainWindow = new BrowserWindow(windowOptions);

  if (isDev) {
    const devUrl = await getDevUrl();
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();

    // Check if debug console is enabled
    try {
      const dirs = ensureUserDirs();
      if (dirs && fs.existsSync(dirs.settingsFile)) {
        const settings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
        if (settings.debugConsole) {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    } catch {}
    
    // Auto-update check on startup
    setTimeout(async () => {
      try {
          console.log('[Infernix] Checking for updates...');
        const updateInfo = await checkForUpdates();
          console.log('[Infernix] Update check result:', JSON.stringify(updateInfo));
        if (updateInfo.hasUpdate && updateInfo.downloadUrl) {
          console.log('[Infernix] Update available: v' + updateInfo.latestVersion);
          // Send to renderer to show update notification
          mainWindow.webContents.send('update-available', updateInfo);
          
          // Update UI handled by renderer - no native dialog
        }
      } catch (e) {
        console.error('[Infernix] Auto-update check failed:', e.message);
      }
    }, 2000); // Check 2 seconds after startup
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', async () => {
  // Kill Xeno notifications before closing
  try {
    await executeNotificationKiller();
    console.log('Killed Xeno notifications on close');
  } catch (e) {}
  if (mainWindow) mainWindow.close();
});

// AI Chat Completion Handler
ipcMain.handle('ai-generate', async (event, { messages }) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    });

    const url = new URL(AI_API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'API Error'));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
});

// ScriptBlox API Handler (for ScriptHub)
ipcMain.handle('scriptblox-fetch', async (event, { endpoint, query }) => {
  try {
    const baseUrl = new URL(`https://scriptblox.com/api/${endpoint}`);
    if (query && typeof query === 'object') {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          baseUrl.searchParams.append(key, String(value));
        }
      });
    }
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: baseUrl.hostname,
        port: 443,
        path: baseUrl.pathname + baseUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Infernix/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error('Failed to parse ScriptBlox response'));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`ScriptBlox request failed: ${e.message}`));
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('ScriptBlox request timeout'));
      });

      req.end();
    });
  } catch (error) {
    console.error('ScriptBlox request failed:', error);
    throw error;
  }
});

// ==========================================
// STARTUP NOTIFICATION - Discord Webhook + API
// ==========================================
const sendStartupNotification = async () => {
    const os = require('os');
    const dirs = ensureUserDirs();
    let username = os.userInfo().username;
    
    // Try to load Discord username from settings
    try {
      if (dirs && fs.existsSync(dirs.settingsFile)) {
        const settings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
        if (settings.discordUsername && settings.discordUsername.trim()) {
          username = settings.discordUsername.trim();
        }
      }
    } catch (e) {}
    
    const version = CURRENT_VERSION;
  
  // Discord Webhook URL - set this in .env or hardcode
  const webhookUrl = 'https://discord.com/api/webhooks/1468802632905654333/wowl972jtWQU_h3lYt-hVKlJFHGJf8g7cdpSsNHKWYitEn8K6mYsGFarusFj8uQeRjAX';
  
  if (webhookUrl) {
    const embed = {
      embeds: [{
        color: 0xF97316,
        title: ' Infernix Launched',
        fields: [
          { name: ' User', value: username, inline: true },
          { name: ' Version', value: 'v' + version, inline: true },
          { name: ' Time', value: new Date().toLocaleString(), inline: true },
        ],
        footer: { text: 'Infernix Executor' },
        timestamp: new Date().toISOString(),
      }]
    };

    try {
      const webhookData = JSON.stringify(embed);
      const webhookUrlObj = new URL(webhookUrl);
      
      const req = https.request({
        hostname: webhookUrlObj.hostname,
        path: webhookUrlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(webhookData),
        }
      });
      req.on('error', () => {});
      req.write(webhookData);
      req.end();
      console.log('[Infernix] Sent startup notification to Discord');
    } catch (e) {
      console.log('[Infernix] Webhook error:', e.message);
    }
  }

  // Send to webpage API for live feed
  try {
    const apiData = JSON.stringify({ username, version });
    
    const req = https.request({
      hostname: 'infernix-webpage.vercel.app',
      path: '/api/recent-users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(apiData),
      }
    });
    req.on('error', () => {});
    req.write(apiData);
    req.end();
  } catch (e) {}
};
app.whenReady().then(() => {
  ensureUserDirs();
  loadExecutorAddon();
  initializeExecutor();
  createWindow();
  // Send startup notification to Discord webhook and webpage API
  sendStartupNotification();
  
  // Broadcast client updates every 200ms like Xeno does
  // We also fetch detailed info from Xeno's local HTTP server for placeId/game info
  let lastDetailedClients = [];
  
  const fetchDetailedClients = () => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3110,
        path: '/clients',
        method: 'GET',
        timeout: 500
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.end();
    });
  };
  
  // Fetch detailed clients less frequently (every 1s) to reduce load
  setInterval(async () => {
    try {
      const detailed = await fetchDetailedClients();
      if (detailed && detailed.length > 0) {
        lastDetailedClients = detailed;
      }
    } catch {}
  }, 1000);
  
  // Fetch game info via Lua script (after attach)
  // Trigger Lua script to send client info (every 2s on attached clients)
  setInterval(async () => {
    try {
      // Check if any clients are attached (status 3)
      if (executorAddon && typeof executorAddon.getClients === 'function') {
        const clientsJson = executorAddon.getClients();
        const clients = JSON.parse(clientsJson || '[]');
        
        // Get attached client PIDs
        const attachedPids = clients
          .filter(c => (Array.isArray(c) ? c[3] : c.status) === 3)
          .map(c => Array.isArray(c) ? String(c[0]) : String(c.pid));
        
        if (attachedPids.length === 0) return;
        
        // Execute Lua script to get game info - it sends data to our internal server
        const script = GET_CLIENT_INFO_SCRIPT;
        const clientsHeader = JSON.stringify(attachedPids);
        const options = {
          hostname: 'localhost',
          port: 3110,
          path: '/o',
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength(script),
            'clients': clientsHeader
          },
          timeout: 500
        };
        
        const req = http.request(options, () => {});
        req.on('error', () => {});
        req.write(script);
        req.end();
      }
    } catch {}
  }, 2000);
  
  // Track game joins for AutoExec
  const gameJoinedClients = new Set();

  // Broadcast merged client data every 200ms
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      if (executorAddon && typeof executorAddon.getClients === 'function') {
        const clientsJson = executorAddon.getClients();
        const clients = JSON.parse(clientsJson || '[]');
        
        // Merge with detailed data and game info from our internal server
        const mergedClients = clients.map(client => {
          const pid = Array.isArray(client) ? String(client[0]) : String(client.pid);
          const username = Array.isArray(client) ? client[1] : client.username;
          const detailed = lastDetailedClients.find(d => String(d.pid) === pid);
          const status = Array.isArray(client) ? client[3] : client.status;
          
          // Find game info from store by username
          let gameInfo = null;
          if (status === 3) {
            // Look in the store for matching username
            for (const info of Object.values(clientGameInfoStore)) {
              if (info.username === username) {
                gameInfo = info;
                break;
              }
            }
          }
          
          if (Array.isArray(client)) {
            // Array format: [pid, username, playerName, status, version, placeId]
            return [
              client[0],
              gameInfo?.username || detailed?.username || client[1],
              gameInfo?.displayName || detailed?.playerName || detailed?.displayName || client[2],
              client[3],
              client[4],
              gameInfo?.placeId || detailed?.placeId || detailed?.PlaceId || client[5] || 0
            ];
          } else {
            // Object format
            return {
              ...client,
              username: gameInfo?.username || detailed?.username || client.username,
              playerName: gameInfo?.displayName || detailed?.playerName || detailed?.displayName || client.playerName,
              placeId: gameInfo?.placeId || detailed?.placeId || detailed?.PlaceId || client.placeId || 0
            };
          }
        });

        mainWindow.webContents.send('executor-clients', mergedClients);

        // Game Join Detection for AutoExec
        // Track when attached clients get a placeId (meaning they joined a game)
        mergedClients.forEach(client => {
          const pid = Array.isArray(client) ? String(client[0]) : String(client.pid);
          const status = Array.isArray(client) ? client[3] : client.status;
          const placeId = Array.isArray(client) ? client[5] : client.placeId;
          
          if (status === 3 && placeId && placeId > 0) {
            const key = pid + '-' + placeId;
            if (!gameJoinedClients.has(key)) {
              gameJoinedClients.add(key);
              console.log('[Infernix] Client ' + pid + ' joined game ' + placeId + ' - triggering AutoExec in 3 seconds...');
              // Delay execution by 3 seconds to allow game to fully load
              setTimeout(() => {
                runAutoExecScripts().catch(e => console.error('[Infernix] AutoExec error:', e.message));
              }, 3000);
            }
          }
        });
        
        // Clean up old entries for clients that no longer exist or left the game
        const currentPids = new Set(mergedClients.map(c => Array.isArray(c) ? String(c[0]) : String(c.pid)));
        
        // Track current placeIds for each client
        const currentClientGames = new Map();
        mergedClients.forEach(client => {
          const pid = Array.isArray(client) ? String(client[0]) : String(client.pid);
          const placeId = Array.isArray(client) ? client[5] : client.placeId;
          currentClientGames.set(pid, placeId || 0);
        });
        
        for (const key of gameJoinedClients) {
          const [pid, storedPlaceId] = key.split('-');
          // Remove if client doesn't exist anymore
          if (!currentPids.has(pid)) {
            gameJoinedClients.delete(key);
            continue;
          }
          // Remove if client left the game (placeId is now 0 or different)
          const currentPlaceId = currentClientGames.get(pid);
          if (!currentPlaceId || currentPlaceId === 0 || String(currentPlaceId) !== storedPlaceId) {
            gameJoinedClients.delete(key);
            // Also clear the stored game info for this client
            const username = mergedClients.find(c => {
              const cPid = Array.isArray(c) ? String(c[0]) : String(c.pid);
              return cPid === pid;
            });
            if (username) {
              const uname = Array.isArray(username) ? username[1] : username.username;
              for (const [storeKey, info] of Object.entries(clientGameInfoStore)) {
                if (info.username === uname) {
                  delete clientGameInfoStore[storeKey];
                }
              }
            }
          }
        }
      }
    } catch (e) {}
  }, 200);

  // Auto-attach polling - check for unattached clients and attach them
  let lastKnownPids = new Set();
  setInterval(async () => {
    try {
      // Check if autoAttach is enabled in settings
      const dirs = ensureUserDirs();
      if (!dirs) return;
      
      let settings = {};
      try {
        if (fs.existsSync(dirs.settingsFile)) {
          settings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
        }
      } catch {}
      
      if (!settings.autoAttach) return;
      
      if (executorAddon && typeof executorAddon.getClients === 'function') {
        const clientsJson = executorAddon.getClients();
        const clients = JSON.parse(clientsJson || '[]');
        
        // Find clients that are not attached (status !== 3) and are new
        const unattached = clients.filter(c => {
          const status = Array.isArray(c) ? c[3] : c.status;
          const pid = Array.isArray(c) ? c[0] : c.pid;
          return status !== 3 && !lastKnownPids.has(pid);
        });
        
        // Update known PIDs
        clients.forEach(c => {
          const pid = Array.isArray(c) ? c[0] : c.pid;
          lastKnownPids.add(pid);
        });
        
        // If there are new unattached clients, auto-attach
        if (unattached.length > 0 && typeof executorAddon.attach === 'function') {
          console.log('[Infernix] Auto-attaching to ' + unattached.length + ' new client(s)...');
          executorAddon.attach();
          
          // Wait for attach, then run autoexec
          setTimeout(async () => {
            await executeNotificationKiller();
            
            // AutoExec now runs on game join, not attach
          }, 1000);
        }
      }
    } catch (e) {
      console.error('[Infernix] Auto-attach error:', e.message);
    }
  }, 2000);
});

// Script to completely disable Xeno notifications
const KILL_XENO_NOTIFICATIONS = `
-- Kill all Xeno notifications completely
local function killXenoNotifications()
    local coreGui = game:GetService("CoreGui")

    -- Function to destroy Xeno GUI elements
    local function destroyXeno(obj)
        if obj.Name and (obj.Name:find("Xeno") or obj.Name:find("xeno") or obj.Name:find("XENO")) then
            pcall(function() obj:Destroy() end)
            return true
        end
        if obj:IsA("TextLabel") or obj:IsA("TextButton") then
            if obj.Text and obj.Text:find("Xeno") then
                pcall(function() obj.Parent:Destroy() end)
                return true
            end
        end
        return false
    end
    
    -- Kill existing Xeno elements
    for _, v in pairs(coreGui:GetDescendants()) do
        pcall(destroyXeno, v)
    end
    
    -- Kill any new Xeno elements instantly
    coreGui.DescendantAdded:Connect(function(d)
        task.defer(function() pcall(destroyXeno, d) end)
    end)
    
    -- Disable the Xeno.Notify function completely
    if getgenv then
        if getgenv().Xeno then
            getgenv().Xeno.Notify = function() end
        end
        -- Create silent Infernix namespace
        getgenv().Infernix = getgenv().Xeno or {}
        getgenv().Infernix.Notify = function() end
    end
end
pcall(killXenoNotifications)
`;

// Script to get client game info - sends data to our internal server
const GET_CLIENT_INFO_SCRIPT = `
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local placeId = game.PlaceId
local gameId = game.GameId

local info = {
    userId = player.UserId,
    username = player.Name,
    displayName = player.DisplayName,
    placeId = placeId,
    gameId = gameId
}

-- Send to our internal server on port 3111
pcall(function()
    local data = HttpService:JSONEncode(info)
    -- Use request function if available (executor environment)
    if request then
        request({
            Url = "http://127.0.0.1:3111/clientinfo",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = data
        })
    elseif http_request then
        http_request({
            Url = "http://127.0.0.1:3111/clientinfo",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = data
        })
    elseif syn and syn.request then
        syn.request({
            Url = "http://127.0.0.1:3111/clientinfo",
            Method = "POST",
            Headers = {["Content-Type"] = "application/json"},
            Body = data
        })
    end
end)
`;

// Function to execute the notification killer
const executeNotificationKiller = () => {
  return new Promise((resolve) => {
    const postData = KILL_XENO_NOTIFICATIONS;
    const options = {
      hostname: 'localhost',
      port: 3110,
      path: '/o',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
};

// Store for client game info (fetched via Lua)
let clientGameInfo = {};

// Function to fetch client info via Lua script execution
const fetchClientGameInfo = async () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3110,
      path: '/o',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(GET_CLIENT_INFO_SCRIPT)
      },
      timeout: 1000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // The response might be the JSON string returned by the Lua script
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(GET_CLIENT_INFO_SCRIPT);
    req.end();
  });
};

// Function to run all autoexec scripts
const runAutoExecScripts = async () => {
  const dirs = ensureUserDirs();
  if (!dirs) return;

  try {
    // Check if autoExecute is enabled in settings
    let settings = {};
    try {
      if (fs.existsSync(dirs.settingsFile)) {
        settings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
      }
    } catch {}

    // autoExecute defaults to false, but if explicitly true, run
    if (settings.autoExecute !== true) {
      console.log('[Infernix] AutoExec not enabled in settings');
      return;
    }

    const files = fs.readdirSync(dirs.autoexecDir);
    const scripts = files.filter(f => f.endsWith('.lua') || f.endsWith('.txt'));

    if (scripts.length === 0) {
      console.log('[Infernix] No autoexec scripts found');
      return;
    }

    console.log('[Infernix] Running ' + scripts.length + ' autoexec scripts...');

    for (const scriptFile of scripts) {
      const scriptPath = path.join(dirs.autoexecDir, scriptFile);
      try {
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        
        // Execute directly using the addon (more reliable than HTTP)
        if (executorAddon && typeof executorAddon.execute === 'function' && typeof executorAddon.getClients === 'function') {
          try {
            const clientsJson = executorAddon.getClients();
            const clients = JSON.parse(clientsJson || '[]');
            // Get all attached clients (status 3)
            const attachedClients = clients.filter(c => {
              const status = Array.isArray(c) ? c[3] : c.status;
              return status === 3;
            });
            
            console.log('[Infernix] AutoExec targeting ' + attachedClients.length + ' attached clients');
            
            // Send to all attached clients via HTTP (same as regular execute)
            const clientPids = attachedClients.map(c => Array.isArray(c) ? String(c[0]) : String(c.pid));
            console.log('[Infernix] AutoExec sending to PIDs:', clientPids, 'script:', scriptContent.substring(0, 50));

            const http = require('http');
            const postData = scriptContent;
            const clientsHeader = JSON.stringify(clientPids);
            
            const options = {
              hostname: 'localhost',
              port: 3110,
              path: '/o',
              method: 'POST',
              headers: {
                'Content-Type': 'text/plain',
                'Content-Length': Buffer.byteLength(postData),
                'clients': clientsHeader
              }
            };

            const req = http.request(options, (res) => {
              let body = '';
              res.on('data', chunk => body += chunk);
              res.on('end', () => {
                console.log('[Infernix] AutoExec HTTP response: ' + res.statusCode);
              });
            });
            req.on('error', (err) => {
              console.log('[Infernix] AutoExec HTTP error: ' + err.message);
            });
            req.write(postData);
            req.end();
          } catch (execErr) {
            console.error('[Infernix] AutoExec addon error:', execErr.message);
          }
        } else {
          console.log('[Infernix] AutoExec: No addon execute function available');
        }

        console.log('[Infernix] Executed autoexec: ' + scriptFile);
      } catch (e) {
        console.error('[Infernix] Failed to execute autoexec: ' + scriptFile);
      }
    }
  } catch (e) {
    console.error('[Infernix] AutoExec error:', e.message);
  }
};

// Executor IPC Handlers
// Unattach from client - kills all injected UI and detaches
// Unattach from client - kills all injected UI and detaches
ipcMain.handle('executor-unattach', async (event, clientPid) => {
  if (!executorAddon) return { ok: false, error: 'No addon loaded' };
  try {
    // Execute a script to destroy all injected UIs
    const cleanupScript = "-- Infernix Unattach Cleanup\n" +
      "for _, gui in pairs(game:GetService('CoreGui'):GetChildren()) do\n" +
      "  if gui.Name ~= 'RobloxGui' and gui.Name ~= 'PlayerList' then\n" +
      "    pcall(function() gui:Destroy() end)\n" +
      "  end\n" +
      "end\n" +
      "for _, gui in pairs(game:GetService('Players').LocalPlayer:WaitForChild('PlayerGui'):GetChildren()) do\n" +
      "  pcall(function() gui:Destroy() end)\n" +
      "end\n" +
      "print('[Infernix] Cleaned up injected content')";

    const clients = clientPid ? [clientPid] : [];
    await new Promise((resolve) => {
      const postData = cleanupScript;
      const options = {
        hostname: 'localhost',
        port: 3110,
        path: '/o',
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(postData),
          'Clients': JSON.stringify(clients)
        }
      };
      const req = http.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(true));
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
      req.write(postData);
      req.end();
    });

    console.log('[Infernix] Unattached from client:', clientPid || 'all');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('executor-attach', async () => {
  if (!executorAddon) return { ok: false, error: 'No addon loaded' };
  try {
    if (typeof executorAddon.attach === 'function') {
      executorAddon.attach();

      // Wait a moment for Xeno to fully attach, then kill notifications and run autoexec
      setTimeout(async () => {
        await executeNotificationKiller();
        console.log('Xeno notifications disabled');
        
        // AutoExec now runs on game join, not attach
      }, 500);

      return { ok: true };
    }
    return { ok: false, error: 'Attach not available' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Execute via HTTP to Xeno's local server (port 3110)
ipcMain.handle('executor-execute', async (event, { script, clients }) => {
  if (!script || typeof script !== 'string') {
    return { ok: false, error: 'Script must be a string' };
  }
  
  try {
    // Xeno uses a local HTTP server on port 3110 for execution
    const clientPids = Array.isArray(clients) ? clients : [];
    
    return new Promise((resolve) => {
      const postData = script;
      const options = {
        hostname: 'localhost',
        port: 3110,
        path: '/o',
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(postData),
          'Clients': JSON.stringify(clientPids)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, error: `HTTP ${res.statusCode}` });
          }
        });
      });

      req.on('error', (e) => {
        // Fallback to addon if HTTP fails
        if (executorAddon && typeof executorAddon.execute === 'function') {
          try {
            const clientsJson = executorAddon.getClients();
            const allClients = JSON.parse(clientsJson || '[]');
            const targetClients = clientPids.length > 0 
              ? allClients.filter(c => clientPids.includes(c.pid))
              : allClients;
            
            for (const client of targetClients) {
              executorAddon.execute(client.pid, script);
            }
            resolve({ ok: true });
          } catch (err) {
            resolve({ ok: false, error: err.message });
          }
        } else {
          resolve({ ok: false, error: `Connection failed: ${e.message}` });
        }
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ ok: false, error: 'Request timeout' });
      });

      req.write(postData);
      req.end();
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('executor-get-clients', async () => {
  if (!executorAddon) return [];
  try {
    if (typeof executorAddon.getClients === 'function') {
      const json = executorAddon.getClients();
      return JSON.parse(json || '[]');
    }
    return [];
  } catch (e) {
    return [];
  }
});

ipcMain.handle('executor-kill-roblox', async () => {
  try {
    if (executorAddon && typeof executorAddon.killRoblox === 'function') {
      executorAddon.killRoblox();
      return { ok: true, killed: true };
    }
    // Fallback to taskkill
    return new Promise((resolve) => {
      exec('taskkill /F /IM RobloxPlayerBeta.exe /T', (error) => {
        resolve({ ok: true, killed: !error });
      });
    });
  } catch (e) {
    return { ok: false, killed: false };
  }
});

// Kill specific process by PID
ipcMain.handle('kill-process', async (event, pid) => {
  try {
    return new Promise((resolve) => {
      exec(`taskkill /F /PID ${pid}`, (error) => {
        resolve({ ok: !error, pid });
      });
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('executor-version', async () => {
  if (!executorAddon) return 'UI Only';
  try {
    if (typeof executorAddon.version === 'function') {
      return executorAddon.version() || '1.0.0';
    }
    return '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
});

// Directory handlers
ipcMain.handle('open-autoexec-dir', async () => {
  const dirs = ensureUserDirs();
  if (dirs) {
    await shell.openPath(dirs.autoexecDir);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('open-workspace-dir', async () => {
  const dirs = ensureUserDirs();
  if (dirs) {
    await shell.openPath(dirs.workspaceDir);
    return { ok: true };
  }
  return { ok: false };
});

// Open SavedScripts directory
ipcMain.handle('open-scripts-dir', async () => {
  const dirs = ensureUserDirs();
  if (dirs) {
    await shell.openPath(dirs.savedScriptsDir);
    return { ok: true };
  }
  return { ok: false };
});

// Save a script to SavedScripts folder
ipcMain.handle('save-script', async (event, { name, description, content }) => {
  const dirs = ensureUserDirs();
  if (!dirs) return { ok: false, error: 'Failed to access directories' };
  
  try {
    // Create a safe filename
    const safeName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Untitled';
    const fileName = `${safeName}.txt`;
    const filePath = path.join(dirs.savedScriptsDir, fileName);
    
    // Create metadata header
    const metadata = `--[[\n  Name: ${name}\n  Description: ${description || 'No description'}\n  Saved: ${new Date().toISOString()}\n]]--\n\n`;
    const fullContent = metadata + content;
    
    fs.writeFileSync(filePath, fullContent, 'utf-8');
    
    // Also save metadata separately for faster loading
    const metaPath = path.join(dirs.savedScriptsDir, `${safeName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({ name, description, savedAt: Date.now() }), 'utf-8');
    
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Get list of saved scripts
ipcMain.handle('get-saved-scripts', async () => {
  const dirs = ensureUserDirs();
  if (!dirs) return [];
  
  try {
    const files = fs.readdirSync(dirs.savedScriptsDir);
    const scripts = [];
    
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const baseName = file.replace('.txt', '');
        const metaPath = path.join(dirs.savedScriptsDir, `${baseName}.meta.json`);
        const scriptPath = path.join(dirs.savedScriptsDir, file);
        
        let metadata = { name: baseName, description: '', savedAt: 0 };
        if (fs.existsSync(metaPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          } catch {}
        }
        
        const stats = fs.statSync(scriptPath);
        scripts.push({
          fileName: file,
          path: scriptPath,
          name: metadata.name || baseName,
          description: metadata.description || '',
          savedAt: metadata.savedAt || stats.mtimeMs,
          size: stats.size
        });
      }
    }
    
    // Sort by most recent
    scripts.sort((a, b) => b.savedAt - a.savedAt);
    return scripts;
  } catch (e) {
    return [];
  }
});

// Load a saved script
ipcMain.handle('load-script', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Remove metadata header if present
    const cleanContent = content.replace(/^--\[\[\s*[\s\S]*?\]\]--\s*\n*/m, '');
    return { ok: true, content: cleanContent };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Delete a saved script
ipcMain.handle('delete-script', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    // Also delete metadata file if exists
    const metaPath = filePath.replace('.txt', '.meta.json');
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  const dirs = ensureUserDirs();
  if (!dirs) return { ok: false };
  
  try {
    fs.writeFileSync(dirs.settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Load settings
ipcMain.handle('load-settings', async () => {
  const dirs = ensureUserDirs();
  if (!dirs) return null;
  
  try {
    if (fs.existsSync(dirs.settingsFile)) {
      return JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
    }
    return null;
  } catch (e) {
    return null;
  }
});


// Reset settings to defaults
ipcMain.handle('reset-settings', async () => {
  const dirs = ensureUserDirs();
  if (!dirs) return { ok: false };

  try {
    if (fs.existsSync(dirs.settingsFile)) {
      fs.unlinkSync(dirs.settingsFile);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Restart the app
ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// Save tabs state
ipcMain.handle('save-tabs', async (event, tabs) => {
  const dirs = ensureUserDirs();
  if (!dirs) return { ok: false };
  
  try {
    fs.writeFileSync(dirs.tabsFile, JSON.stringify(tabs, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Load tabs state
ipcMain.handle('load-tabs', async () => {
  const dirs = ensureUserDirs();
  if (!dirs) return null;
  
  try {
    if (fs.existsSync(dirs.tabsFile)) {
      return JSON.parse(fs.readFileSync(dirs.tabsFile, 'utf-8'));
    }
    return null;
  } catch (e) {
    return null;
  }
});

// Roblox API Proxy - to avoid CORS issues
ipcMain.handle('roblox-get-user-info', async (event, username) => {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ usernames: [username], excludeBannedUsers: false });
    const options = {
      hostname: 'users.roblox.com',
      path: '/v1/usernames/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data?.[0] || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
});

ipcMain.handle('roblox-get-avatar', async (event, userId) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'thumbnails.roblox.com',
      path: `/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      method: 'GET'
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data?.[0]?.imageUrl || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
});

ipcMain.handle('roblox-get-game-info', async (event, placeId) => {
  return new Promise(async (resolve) => {
    try {
      // Get universe ID first
      const universeData = await new Promise((res) => {
        const options = {
          hostname: 'apis.roblox.com',
          path: `/universes/v1/places/${placeId}/universe`,
          method: 'GET'
        };
        const req = https.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try { res(JSON.parse(data)); } catch { res(null); }
          });
        });
        req.on('error', () => res(null));
        req.end();
      });
      
      if (!universeData?.universeId) {
        resolve(null);
        return;
      }
      
      const universeId = universeData.universeId;
      
      // Get game details
      const gameData = await new Promise((res) => {
        const options = {
          hostname: 'games.roblox.com',
          path: `/v1/games?universeIds=${universeId}`,
          method: 'GET'
        };
        const req = https.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try { res(JSON.parse(data)); } catch { res(null); }
          });
        });
        req.on('error', () => res(null));
        req.end();
      });
      
      // Get game thumbnail
      const thumbData = await new Promise((res) => {
        const options = {
          hostname: 'thumbnails.roblox.com',
          path: `/v1/games/icons?universeIds=${universeId}&size=150x150&format=Png`,
          method: 'GET'
        };
        const req = https.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try { res(JSON.parse(data)); } catch { res(null); }
          });
        });
        req.on('error', () => res(null));
        req.end();
      });
      
      const game = gameData?.data?.[0];
      if (game) {
        resolve({
          universeId,
          name: game.name || 'Unknown Game',
          creator: game.creator?.name || 'Unknown',
          thumbnail: thumbData?.data?.[0]?.imageUrl || null,
          playing: game.playing || 0
        });
      } else {
        resolve(null);
      }
    } catch (e) {
      resolve(null);
    }
  });
});

// Fetch detailed client info from Xeno's local server
ipcMain.handle('fetch-client-details', async () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3110,
      path: '/clients',
      method: 'GET',
      timeout: 2000
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
});


// AutoExec Management
ipcMain.handle('get-autoexec-scripts', async () => {
  const dirs = ensureUserDirs();
  if (!dirs) return [];

  try {
    const files = fs.readdirSync(dirs.autoexecDir);
    return files
      .filter(f => f.endsWith('.lua') || f.endsWith('.txt'))
      .map(f => ({
        name: f,
        path: path.join(dirs.autoexecDir, f)
      }));
  } catch (e) {
    return [];
  }
});

ipcMain.handle('add-to-autoexec', async (event, { name, content }) => {
  const dirs = ensureUserDirs();
  if (!dirs) return { ok: false, error: 'Failed to access directories' };

  try {
    // Create safe filename
    const safeName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Script';
    const fileName = safeName.endsWith('.lua') ? safeName : `${safeName}.lua`;
    const filePath = path.join(dirs.autoexecDir, fileName);

    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('remove-from-autoexec', async (event, scriptName) => {
  const dirs = ensureUserDirs();
  if (!dirs) return { ok: false };

  try {
    const filePath = path.join(dirs.autoexecDir, scriptName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ==========================================
// V1.0.8 FEATURES
// ==========================================

// Current version for update checking
const CURRENT_VERSION = '1.1.9';
const GITHUB_REPO = 'aauuzyy/Xeno-x-Infernix';

// A/ANS - Admin/Owner Notification System Lua Script
const ADMIN_NOTIFICATION_SCRIPT = `
-- Infernix A/ANS (Admin Notification System)
-- Notifies when game owner/admin joins

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local LocalPlayer = Players.LocalPlayer

-- Get game creator info
local creatorId = game.CreatorId
local creatorType = game.CreatorType

local function getGameOwners()
    local owners = {}
    
    if creatorType == Enum.CreatorType.User then
        owners[creatorId] = true
    elseif creatorType == Enum.CreatorType.Group then
        -- Group games - owner is group owner and admins
        pcall(function()
            local groupInfo = game:GetService("GroupService"):GetGroupInfoAsync(creatorId)
            if groupInfo and groupInfo.Owner then
                owners[groupInfo.Owner.Id] = true
            end
        end)
    end
    
    return owners
end

local gameOwners = getGameOwners()

local function checkIfAdmin(player)
    -- Check if player is game owner
    if gameOwners[player.UserId] then
        return true, "Game Owner"
    end
    
    -- Check if in group and has high rank (250-255 = owners/admins)
    if creatorType == Enum.CreatorType.Group then
        local success, result = pcall(function()
            local rank = player:GetRankInGroup(creatorId)
            if rank >= 250 then
                return true, "Group Owner/Admin (Rank " .. rank .. ")"
            elseif rank >= 200 then
                return true, "Group Moderator (Rank " .. rank .. ")"
            end
            return false, nil
        end)
        if success and result then
            return result, "High Rank"
        end
    -- Send notification to Infernix
    pcall(function()
        local data = HttpService:JSONEncode({
            type = "admin_join",
            username = player.Name,
            displayName = player.DisplayName,
            userId = player.UserId,
            adminType = adminType,
            placeId = game.PlaceId,
            timestamp = os.time()
        })
        
        if request then
            request({
                Url = "http://127.0.0.1:3111/adminnotify",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
        elseif http_request then
            http_request({
                Url = "http://127.0.0.1:3111/adminnotify",
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
        end
    end)
    
    -- Also show in-game notification
    game:GetService("StarterGui"):SetCore("SendNotification", {
        Title = "?? ADMIN ALERT",
        Text = adminType .. " joined: " .. player.DisplayName,
        Duration = 10,
        Icon = "rbxassetid://6031071053"
    })
end

-- Check existing players
for _, player in pairs(Players:GetPlayers()) do
    if player ~= LocalPlayer then
        local isAdmin, adminType = checkIfAdmin(player)
        if isAdmin then
            notifyAdmin(player, adminType)
        end
    end
end

-- Monitor new players
Players.PlayerAdded:Connect(function(player)
    task.wait(1) -- Wait for player data to load
    local isAdmin, adminType = checkIfAdmin(player)
    if isAdmin then
        notifyAdmin(player, adminType)
    end
end)

print("[Infernix A/ANS] Admin Notification System active")
`;

// Store for admin notifications
let adminNotifications = [];

// Handle admin notifications from Lua
internalServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/adminnotify') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        adminNotifications.push(data);
        
        // Send to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('admin-notification', data);
        }
        
        console.log('[Infernix A/ANS] Admin detected:', data.displayName, '-', data.adminType);
        
        // Check if auto-shutdown on admin join is enabled
        const dirs = ensureUserDirs();
        if (dirs) {
          try {
            const settings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
            if (settings.ansAutoShutdown) {
              console.log('[Infernix A/ANS] Auto-shutdown triggered! Admin/Owner joined.');
              // Kill Roblox and close
              if (executorAddon?.killRoblox) {
                executorAddon.killRoblox();
              } else {
                exec('taskkill /F /IM RobloxPlayerBeta.exe /T');
              }
              setTimeout(() => app.quit(), 2000);
            }
          } catch (e) {}
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
    return;
  }
});

// IPC handler to enable A/ANS
ipcMain.handle('enable-ans', async () => {
  try {
    // Execute the admin notification script on all attached clients
    return new Promise((resolve) => {
      const postData = ADMIN_NOTIFICATION_SCRIPT;
      const options = {
        hostname: 'localhost',
        port: 3110,
        path: '/o',
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve({ ok: true }));
      });
      req.on('error', () => resolve({ ok: false, error: 'Failed to execute' }));
      req.write(postData);
      req.end();
    });
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('get-admin-notifications', async () => {
  return adminNotifications;
});

ipcMain.handle('clear-admin-notifications', async () => {
  adminNotifications = [];
  return { ok: true };
});

// ==========================================
// AUTOMATIC UPDATE SYSTEM
// ==========================================

const checkForUpdates = async () => {
  return new Promise((resolve) => {
    const makeRequest = (url, redirectCount = 0) => {
      if (redirectCount > 5) {
        resolve({ hasUpdate: false, error: 'Too many redirects' });
        return;
      }
      
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Infernix-Executor',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log('[Infernix] Following redirect to:', res.headers.location);
          makeRequest(res.headers.location, redirectCount + 1);
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            console.log('[Infernix] GitHub API response tag:', release.tag_name);
            const latestVersion = release.tag_name?.replace('v', '') || '0.0.0';
            const downloadUrl = release.assets?.[0]?.browser_download_url || null;

            const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0;

            resolve({
              hasUpdate,
              currentVersion: CURRENT_VERSION,
              latestVersion,
              downloadUrl,
              releaseNotes: release.body || '',
              releaseName: release.name || `v${latestVersion}`
            });
          } catch (e) {
            console.log('[Infernix] Parse error:', e.message, 'Data:', data.substring(0, 200));
            resolve({ hasUpdate: false, error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (e) => {
        console.log('[Infernix] Request error:', e.message);
        resolve({ hasUpdate: false, error: 'Network error' });
      });
      req.setTimeout(10000, () => { req.destroy(); resolve({ hasUpdate: false, error: 'Timeout' }); });
      req.end();
    };
    
    makeRequest(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
  });
};

// Simple version comparison
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

ipcMain.handle('check-updates', async () => {
  return await checkForUpdates();
});

ipcMain.handle('get-current-version', async () => {
  return CURRENT_VERSION;
});

// Download update with progress tracking
ipcMain.handle('download-update', async (event, downloadUrl) => {
  if (!downloadUrl) {
    mainWindow?.webContents.send('update-error', 'No download URL');
    return { ok: false, error: 'No download URL' };
  }

  try {
    const tempDir = path.join(app.getPath('temp'), 'infernix-update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const installerPath = path.join(tempDir, 'Infernix-Setup.exe');
    
    // Start download with progress
    const downloadWithProgress = (url, filePath) => {
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        
        const makeRequest = (requestUrl) => {
          const protocol = requestUrl.startsWith('https') ? https : http;
          const urlObj = new URL(requestUrl);
          
          const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Infernix-Executor'
            }
          };
          
          const req = protocol.request(options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              makeRequest(res.headers.location);
              return;
            }
            
            const totalSize = parseInt(res.headers['content-length'], 10) || 0;
            let downloadedSize = 0;
            
            res.on('data', (chunk) => {
              downloadedSize += chunk.length;
              file.write(chunk);
              
              if (totalSize > 0) {
                const percent = (downloadedSize / totalSize) * 100;
                mainWindow?.webContents.send('update-progress', { 
                  percent, 
                  downloaded: downloadedSize, 
                  total: totalSize 
                });
              }
            });
            
            res.on('end', () => {
              file.end();
              resolve(filePath);
            });
            
            res.on('error', (err) => {
              file.destroy();
              fs.unlinkSync(filePath);
              reject(err);
            });
          });
          
          req.on('error', (err) => {
            file.destroy();
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            reject(err);
          });
          
          req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Download timeout'));
          });
          
          req.end();
        };
        
        makeRequest(url);
      });
    };
    
    await downloadWithProgress(downloadUrl, installerPath);

    // Launch the installer and quit
    mainWindow?.webContents.send('update-complete');

    // Use spawn with detached to properly run installer independently
    const { spawn } = require('child_process');

    // Spawn a detached cmd process that waits then runs the installer
    // Write a batch file that waits then runs installer silently
    const batchPath = path.join(tempDir, 'update-infernix.bat');
    const batchContent = `@echo off
ping 127.0.0.1 -n 4 > nul
"${installerPath}" /S
del "%~f0"
`;
    fs.writeFileSync(batchPath, batchContent);

    // Spawn the batch file detached
    const child = spawn('cmd', ['/c', batchPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    // Unref so parent can exit independently
    child.unref();

    // Quit after a short delay
    setTimeout(() => {
      app.quit();
    }, 500);

    return { ok: true };
  } catch (e) {
    mainWindow?.webContents.send('update-error', e.message);
    return { ok: false, error: e.message };
  }
});

// Quit the app
ipcMain.handle('quit-app', async () => {
  app.quit();
});

// ==========================================
// ABS - ANTI BANWAVE SYSTEM
// ==========================================

let banwaveStatus = { active: false, lastCheck: null, source: null };
let absEnabled = true;

// Check multiple community sources for banwave alerts
const checkBanwaveStatus = async () => {
  // Check various community APIs/sources for banwave status
  // This is a simplified version - in production, you'd check multiple sources
  
  return new Promise((resolve) => {
    // Check a community status endpoint (you can replace with actual API)
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${GITHUB_REPO}/main/banwave-status.json`,
      method: 'GET',
      headers: { 'User-Agent': 'Infernix-Executor' }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const status = JSON.parse(data);
          banwaveStatus = {
            active: status.banwave_active || false,
            lastCheck: Date.now(),
            source: 'github',
            message: status.message || null,
            severity: status.severity || 'unknown'
          };
          resolve(banwaveStatus);
        } catch (e) {
          // No banwave file = no banwave
          banwaveStatus = { active: false, lastCheck: Date.now(), source: 'github' };
          resolve(banwaveStatus);
        }
      });
    });

    req.on('error', () => {
      banwaveStatus = { active: false, lastCheck: Date.now(), error: 'Network error' };
      resolve(banwaveStatus);
    });
    req.setTimeout(5000, () => { req.destroy(); resolve({ active: false, error: 'Timeout' }); });
    req.end();
  });
};

// Auto-check banwave status every 5 minutes
setInterval(async () => {
  if (!absEnabled) return;
  
  const status = await checkBanwaveStatus();
  
  if (status.active && mainWindow && !mainWindow.isDestroyed()) {
    // Alert the user
    mainWindow.webContents.send('banwave-alert', status);
    
    // Load settings to check if auto-shutdown is enabled
    const dirs = ensureUserDirs();
    if (dirs) {
      try {
        const settings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
        if (settings.absAutoShutdown) {
          console.log('[Infernix ABS] Banwave detected! Auto-shutdown enabled.');
          // Kill Roblox and close
          if (executorAddon?.killRoblox) {
            executorAddon.killRoblox();
          } else {
            exec('taskkill /F /IM RobloxPlayerBeta.exe /T');
          }
          setTimeout(() => app.quit(), 2000);
        }
      } catch {}
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

ipcMain.handle('check-banwave', async () => {
  return await checkBanwaveStatus();
});

ipcMain.handle('get-banwave-status', async () => {
  return banwaveStatus;
});

ipcMain.handle('set-abs-enabled', async (event, enabled) => {
  absEnabled = enabled;
  return { ok: true, enabled };
});

ipcMain.handle('abs-emergency-shutdown', async () => {
  console.log('[Infernix ABS] Emergency shutdown triggered!');
  
  // Kill Roblox
  if (executorAddon?.killRoblox) {
    executorAddon.killRoblox();
  } else {
    exec('taskkill /F /IM RobloxPlayerBeta.exe /T');
  }
  
  setTimeout(() => app.quit(), 1000);
  return { ok: true };
});

// ==========================================
// END V1.0.8 FEATURES
// ==========================================

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  // Send startup notification to Discord webhook and webpage API
  sendStartupNotification();
  }
});















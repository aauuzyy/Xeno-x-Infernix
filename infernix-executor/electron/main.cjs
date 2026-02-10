const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { exec } = require('child_process');

let mainWindow = null;
let executorAddon = null;
// Check if we're in dev mode - only use dev server if explicitly set
const isDev = process.env.NODE_ENV === 'development';

// VirusTotal API Configuration
const VIRUSTOTAL_API_KEY = '0bbe658ca1c2c83aa406c708c5d81364c25ab03b4a2e266d8b995066395ad49a';
const VIRUSTOTAL_SCAN_CACHE = new Map(); // Cache scan results
const VIRUSTOTAL_CACHE_TTL = 3600000; // 1 hour cache

// Store for client game info received from Lua scripts
let clientGameInfoStore = {};
// Execution History Storage
const EXECUTION_HISTORY_FILE = 'execution-history.json';
let executionHistory = [];
const MAX_HISTORY_ITEMS = 100;

const loadExecutionHistory = () => {
  try {
    const dirs = ensureUserDirs();
    if (!dirs) return [];
    const historyPath = path.join(dirs.appDataDir, EXECUTION_HISTORY_FILE);
    if (fs.existsSync(historyPath)) {
      executionHistory = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (e) {
    executionHistory = [];
  }
  return executionHistory;
};

const saveExecutionHistory = () => {
  try {
    const dirs = ensureUserDirs();
    if (!dirs) return;
    const historyPath = path.join(dirs.appDataDir, EXECUTION_HISTORY_FILE);
    fs.writeFileSync(historyPath, JSON.stringify(executionHistory.slice(-MAX_HISTORY_ITEMS), null, 2));
  } catch (e) {}
};

const addToExecutionHistory = (scriptName, script, success, client = null) => {
  const entry = {
    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
    scriptName: scriptName || 'Untitled Script',
    script: script.substring(0, 2000),
    success: success,
    timestamp: Date.now(),
    client: client
  };
  executionHistory.push(entry);
  if (executionHistory.length > MAX_HISTORY_ITEMS) {
    executionHistory = executionHistory.slice(-MAX_HISTORY_ITEMS);
  }
  saveExecutionHistory();
  return entry;
};


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
  }    // Clipboard endpoint - Lua scripts POST here to copy text
    if (req.method === 'POST' && req.url === '/clipboard') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.text) {
            clipboard.writeText(data.text);
            console.log('[Infernix] Clipboard set:', data.text.substring(0, 50) + (data.text.length > 50 ? '...' : ''));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.writeHead(400);
            res.end('Missing text');
          }
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

    // Report usage to website (anonymous - just for "recently used" display)
    setTimeout(async () => {
      try {
        const username = require('os').userInfo().username || 'User';
        await fetch('https://infernix.vercel.app/api/recent-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.slice(0, 3) + '...',
            version: APP_VERSION,
          }),
        });
      } catch (e) {
        // Silent fail - not critical
      }
    }, 3000);

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

// ===== VirusTotal Script Scanning =====

// Calculate SHA-256 hash of script content
function calculateScriptHash(script) {
  return crypto.createHash('sha256').update(script, 'utf8').digest('hex');
}

// Scan script with VirusTotal
async function scanScriptWithVirusTotal(script, scriptName = 'script.lua') {
  const hash = calculateScriptHash(script);
  
  // Check cache first
  const cached = VIRUSTOTAL_SCAN_CACHE.get(hash);
  if (cached && (Date.now() - cached.timestamp) < VIRUSTOTAL_CACHE_TTL) {
    console.log('[VirusTotal] Using cached result for', scriptName);
    return cached.result;
  }

  return new Promise((resolve) => {
    // First, try to look up by hash (faster, no upload needed)
    const options = {
      hostname: 'www.virustotal.com',
      path: `/api/v3/files/${hash}`,
      method: 'GET',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            const stats = json.data?.attributes?.last_analysis_stats || {};
            const analysisResults = json.data?.attributes?.last_analysis_results || {};
            
            // Extract detection names from engines that flagged the file
            const detections = [];
            for (const [engineName, engineResult] of Object.entries(analysisResults)) {
              if (engineResult.category === 'malicious' || engineResult.category === 'suspicious') {
                detections.push({
                  engine: engineName,
                  category: engineResult.category,
                  result: engineResult.result || engineResult.category,
                });
              }
            }
            
            const result = {
              scanned: true,
              hash,
              malicious: stats.malicious || 0,
              suspicious: stats.suspicious || 0,
              harmless: stats.harmless || 0,
              undetected: stats.undetected || 0,
              totalEngines: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
              safe: (stats.malicious || 0) === 0 && (stats.suspicious || 0) === 0,
              verdict: (stats.malicious || 0) > 0 ? 'malicious' :
                       (stats.suspicious || 0) > 0 ? 'suspicious' : 'clean',
              detections: detections,
            };

            // Cache result
            VIRUSTOTAL_SCAN_CACHE.set(hash, { result, timestamp: Date.now() });
            resolve(result);
          } else if (res.statusCode === 404) {
            // File not in database, upload it for scanning
            uploadAndScanScript(script, scriptName, hash).then(resolve);
          } else {
            resolve({ scanned: false, error: 'API error', statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ scanned: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ scanned: false, error: e.message });
    });

    req.end();
  });
}

// Upload script to VirusTotal for scanning
async function uploadAndScanScript(script, scriptName, hash) {
  return new Promise((resolve) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const scriptBuffer = Buffer.from(script, 'utf-8');
    
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="${scriptName}"\r\n`),
      Buffer.from('Content-Type: text/plain\r\n\r\n'),
      scriptBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const options = {
      hostname: 'www.virustotal.com',
      path: '/api/v3/files',
      method: 'POST',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            const analysisId = json.data?.id;
            
            if (analysisId) {
              // Poll for results (VT takes time to scan)
              const result = {
                scanned: true,
                pending: true,
                hash,
                analysisId,
                verdict: 'scanning',
                message: 'Script uploaded for scanning. Results pending.',
              };
              VIRUSTOTAL_SCAN_CACHE.set(hash, { result, timestamp: Date.now() });
              resolve(result);
            } else {
              resolve({ scanned: false, error: 'No analysis ID returned' });
            }
          } else {
            resolve({ scanned: false, error: 'Upload failed', statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ scanned: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ scanned: false, error: e.message });
    });

    req.write(body);
    req.end();
  });
}

// Check analysis status for pending scans
async function checkVirusTotalAnalysis(analysisId) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.virustotal.com',
      path: `/api/v3/analyses/${analysisId}`,
      method: 'GET',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const status = json.data?.attributes?.status;
          const stats = json.data?.attributes?.stats || {};
          
          if (status === 'completed') {
            resolve({
              completed: true,
              malicious: stats.malicious || 0,
              suspicious: stats.suspicious || 0,
              harmless: stats.harmless || 0,
              undetected: stats.undetected || 0,
              safe: (stats.malicious || 0) === 0 && (stats.suspicious || 0) === 0,
              verdict: (stats.malicious || 0) > 0 ? 'malicious' : 
                       (stats.suspicious || 0) > 0 ? 'suspicious' : 'clean',
            });
          } else {
            resolve({ completed: false, status });
          }
        } catch (e) {
          resolve({ completed: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ completed: false, error: e.message });
    });

    req.end();
  });
}

// IPC Handler for script scanning
ipcMain.handle('virustotal-scan', async (event, { script, scriptName }) => {
  console.log('[VirusTotal] Scanning script:', scriptName);
  return await scanScriptWithVirusTotal(script, scriptName);
});

// IPC Handler to check pending analysis
ipcMain.handle('virustotal-check', async (event, { analysisId }) => {
  return await checkVirusTotalAnalysis(analysisId);
});

// IPC Handler to get cached result by hash
ipcMain.handle('virustotal-cached', async (event, { script }) => {
  const hash = calculateScriptHash(script);
  const cached = VIRUSTOTAL_SCAN_CACHE.get(hash);
  if (cached && (Date.now() - cached.timestamp) < VIRUSTOTAL_CACHE_TTL) {
    return cached.result;
  }
  return null;
});

// IPC Handler for URL scanning
ipcMain.handle('virustotal-scan-url', async (event, { url }) => {
  console.log('[VirusTotal] Scanning URL:', url);
  return await scanUrlWithVirusTotal(url);
});

// Scan URL with VirusTotal
async function scanUrlWithVirusTotal(urlToScan) {
  // Check cache first
  const urlHash = crypto.createHash('sha256').update(urlToScan).digest('hex');
  const cached = VIRUSTOTAL_SCAN_CACHE.get('url:' + urlHash);
  if (cached && (Date.now() - cached.timestamp) < VIRUSTOTAL_CACHE_TTL) {
    return cached.result;
  }

  return new Promise((resolve) => {
    // Encode URL for API
    const encodedUrl = Buffer.from(urlToScan).toString('base64').replace(/=/g, '');
    
    const options = {
      hostname: 'www.virustotal.com',
      path: `/api/v3/urls/${encodedUrl}`,
      method: 'GET',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            const stats = json.data?.attributes?.last_analysis_stats || {};
            const result = {
              scanned: true,
              url: urlToScan,
              malicious: stats.malicious || 0,
              suspicious: stats.suspicious || 0,
              harmless: stats.harmless || 0,
              undetected: stats.undetected || 0,
              safe: (stats.malicious || 0) === 0 && (stats.suspicious || 0) === 0,
            };
            
            VIRUSTOTAL_SCAN_CACHE.set('url:' + urlHash, { result, timestamp: Date.now() });
            resolve(result);
          } else if (res.statusCode === 404) {
            // URL not in database, submit for scanning
            submitUrlForScan(urlToScan, urlHash).then(resolve);
          } else {
            resolve({ scanned: false, error: 'API error', statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ scanned: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => resolve({ scanned: false, error: e.message }));
    req.end();
  });
}

// Submit URL to VirusTotal for scanning
async function submitUrlForScan(urlToScan, urlHash) {
  return new Promise((resolve) => {
    const postData = `url=${encodeURIComponent(urlToScan)}`;
    
    const options = {
      hostname: 'www.virustotal.com',
      path: '/api/v3/urls',
      method: 'POST',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            // URL submitted, return pending status
            const result = { scanned: true, pending: true, url: urlToScan };
            VIRUSTOTAL_SCAN_CACHE.set('url:' + urlHash, { result, timestamp: Date.now() });
            resolve(result);
          } else {
            resolve({ scanned: false, error: 'Submit failed' });
          }
        } catch (e) {
          resolve({ scanned: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => resolve({ scanned: false, error: e.message }));
    req.write(postData);
    req.end();
  });
}

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
    const dirs = ensureUserDirs();
    let username = 'Anonymous#' + Math.floor(1000 + Math.random() * 9000);
    
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
    
    // Re-read settings right before execution to catch any last-second disables
    try {
      const freshSettings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
      if (freshSettings.autoExecute !== true) {
        console.log('[Infernix] AutoExec was disabled before execution - aborting');
        return;
      }
    } catch (e) {
      console.log('[Infernix] Could not re-read settings, aborting autoexec for safety');
      return;
    }
    
    // Re-read settings right before execution to catch any last-second disables
    try {
      const freshSettings = JSON.parse(fs.readFileSync(dirs.settingsFile, 'utf-8'));
      if (freshSettings.autoExecute !== true) {
        console.log('[Infernix] AutoExec was disabled before execution - aborting');
        return;
      }
    } catch (e) {
      console.log('[Infernix] Could not re-read settings, aborting autoexec for safety');
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
ipcMain.handle('executor-execute', async (event, { script, clients, scriptName }) => {
  if (!script || typeof script !== 'string') {
    return { ok: false, error: 'Script must be a string' };
  }
  
  try {
    // Xeno uses a local HTTP server on port 3110 for execution
    const clientPids = Array.isArray(clients) ? clients : [];
    
    return new Promise((resolve) => {
      // Prepend clipboard support to scripts
        const clipboardHelper = `-- Infernix Clipboard Support
if not _G.InfernixClipboard then
  _G.InfernixClipboard = true
  local HttpService = game:GetService("HttpService")
  local oldSetClipboard = setclipboard
  getgenv().setclipboard = function(text)
    if oldSetClipboard then pcall(oldSetClipboard, text) end
    pcall(function()
      local data = HttpService:JSONEncode({text = tostring(text)})
      local req = (syn and syn.request) or request or http_request or (http and http.request)
      if req then req({Url = "http://127.0.0.1:3111/clipboard", Method = "POST", Headers = {["Content-Type"] = "application/json"}, Body = data}) end
    end)
  end
  getgenv().toclipboard = setclipboard
end
`;
        const postData = clipboardHelper + "\n" + script;
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
            addToExecutionHistory(scriptName, script, true);
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

  // ==========================================
  // PRESET MANAGEMENT
  // ==========================================
  
  // Get all presets
  ipcMain.handle('get-presets', async () => {
    const dirs = ensureUserDirs();
    if (!dirs) return [];
    
    const presetsDir = path.join(dirs.base, 'presets');
    fs.mkdirSync(presetsDir, { recursive: true });
    
    try {
      const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
      return files.map(file => {
        const filePath = path.join(presetsDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return {
            name: data.name || file.replace('.json', ''),
            description: data.description || '',
            filePath,
            createdAt: data.createdAt || null,
            settings: data.settings || {},
            theme: data.theme || {},
            tabs: data.tabs || []
          };
        } catch (e) {
          return { name: file.replace('.json', ''), filePath, error: true };
        }
      });
    } catch (e) {
      return [];
    }
  });
  
  // Save a preset
  ipcMain.handle('save-preset', async (event, presetData) => {
    const dirs = ensureUserDirs();
    if (!dirs) return { ok: false, error: 'No user dirs' };
    
    const presetsDir = path.join(dirs.base, 'presets');
    fs.mkdirSync(presetsDir, { recursive: true });
    
    const { name, description, settings, theme, tabs } = presetData;
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(presetsDir, safeName + '.json');
    
    try {
      const data = {
        name,
        description: description || '',
        createdAt: new Date().toISOString(),
        settings: settings || {},
        theme: theme || {},
        tabs: tabs || []
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { ok: true, filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  
  // Load a preset
  ipcMain.handle('load-preset', async (event, filePath) => {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return { ok: true, preset: data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  
  // Delete a preset
  ipcMain.handle('delete-preset', async (event, filePath) => {
    try {
      fs.unlinkSync(filePath);
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
const CURRENT_VERSION = '1.2.5';
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

// ==========================================
// EXECUTION HISTORY
// ==========================================

ipcMain.handle('get-execution-history', async () => {
  loadExecutionHistory();
  return executionHistory.slice().reverse(); // Return newest first
});

ipcMain.handle('clear-execution-history', async () => {
  executionHistory = [];
  saveExecutionHistory();
  return { ok: true };
});

ipcMain.handle('delete-history-items', async (event, ids) => {
  if (!Array.isArray(ids)) return { ok: false };
  executionHistory = executionHistory.filter(item => !ids.includes(item.id));
  saveExecutionHistory();
  return { ok: true };
});

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















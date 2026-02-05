import { useState, useEffect } from 'react';
import { 
  FolderOpen, History, Settings2, Wand2, XCircle, Bell, Shield, 
  Download, RefreshCw, AlertTriangle, RotateCcw, CheckCircle, Zap, Palette, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './SettingsView.css';
import AutoExecManager from './AutoExecManager';
import WorkspaceEditor from './WorkspaceEditor';

// Changelog data
const CHANGELOG = [
  {
    version: '1.1.5',
    date: 'February 2026',
    changes: [
      '🔄 Fixed Auto-Update Installer - Now properly launches after app closes',
      '⚡ Uses spawn with detached process for reliable updates',
    ]
  },
  {
    version: '1.1.4',
    date: 'February 2026',
    changes: [
      '🔧 Fixed Premium Script Execution - Large scripts now execute properly',
      '📡 Improved Script Hub Execution - Uses IPC for reliability',
      '📦 Fixed Content-Length headers for script payloads',
    ]
  },
  {
    version: '1.1.3',
    date: 'February 2026',
    changes: [
      '🔄 Fixed Auto-Update - Updates now install correctly',
      '📂 Drag & Drop Scripts - Drop .lua/.txt files onto editor',
      '🔍 Auto-Lint on file drop',
    ]
  },
  {
    version: '1.1.2',
    date: 'February 2026',
    changes: [
      '📂 Drag & Drop Scripts - Drop .lua/.txt files directly onto editor',
      '🔍 Auto-Lint - Automatic syntax checking on file drop',
      '🔧 Fixed Debug Console setting not being respected',
    ]
  },
  {
    version: '1.1.1',
    date: 'February 2026',
    changes: [
      '🔥 Custom Update UI - Fire-themed in-app update modal',
      '📥 In-App Updates - Downloads without opening browser',
      '🔄 Fixed GitHub API Redirect issue for updates',
    ]
  },
  {
    version: '1.0.9',
    date: 'February 2026',
    changes: [
      '🎨 Custom Themes - Dark, Light, Midnight modes',
      '🎨 Accent Color Picker with presets',
      '🌈 RGB Color Shift animation',
      '🔧 Fixed AutoExec to actually work on attach',
      '⚡ Auto-Attach with AutoExec support',
    ]
  },
  {
    version: '1.0.8',
    date: 'February 2026',
    changes: [
      '?? A/ANS - Admin Notification System (alerts when game owner/admin joins)',
      '?? Automatic Update Checker - checks GitHub for new versions',
      '??? ABS - Anti Banwave System - monitors for banwaves',
      '? Emergency shutdown button for quick escape',
      '?? New security settings panel',
    ]
  },
  {
    version: '1.0.7',
    date: 'February 2026',
    changes: [
      '?? AutoExec now actually runs scripts on attach',
      '?? Kill Roblox button in Dashboard and Settings',
      '?? Fixed Workspace AI chat scrolling',
      '?? Fixed chat message bubbles display',
      '?? All settings buttons now functional',
    ]
  },
  {
    version: '1.0.6',
    date: 'February 2026',
    changes: [
      '? AutoExec Manager - Select tabs and add to autoexec',
      '? Workspace Script Editor with AI assistance',
      '?? AI Assistant now helps EDIT scripts',
      '??? Script Tools: Loop, Function, Event, GUI, ESP templates',
    ]
  },
];

function SettingsView({ tabs, onNewTab, onSwitchToExecutor }) {
  const { 
    themeMode, setThemeMode, 
    accentColor, setAccentColor, 
    colorShift, setColorShift,
    accentPresets 
  } = useTheme();
  
  const [settings, setSettings] = useState({
    topmost: false,
    autoAttach: true,
    autoExecute: false,
    closeRoblox: false,
    ansEnabled: true,
    ansAutoShutdown: false,
    absEnabled: true,
    absAutoShutdown: false,
    autoCheckUpdates: true,
    debugConsole: false,
    theme: 'dark',
    discordUsername: '',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showAutoExec, setShowAutoExec] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [killing, setKilling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [banwaveStatus, setBanwaveStatus] = useState(null);
  const [checkingBanwave, setCheckingBanwave] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.1.5');

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await window.electronAPI?.loadSettings();
        if (saved) {
          setSettings(prev => ({ ...prev, ...saved }));
        }
        const version = await window.electronAPI?.getCurrentVersion?.();
        if (version) setCurrentVersion(version);
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadSettings();
    
    // Check for updates on load
    checkForUpdates();
    
    // Check banwave status
    checkBanwaveStatus();
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (!settingsLoaded) return;
    window.electronAPI?.saveSettings(settings);
    
    // Update ABS enabled state
    window.electronAPI?.setABSEnabled?.(settings.absEnabled);
  }, [settings, settingsLoaded]);

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openFolder = async (type) => {
    if (type === 'autoexec') {
      await window.electronAPI?.openAutoexecDir();
    } else if (type === 'workspace') {
      await window.electronAPI?.openWorkspaceDir();
    } else if (type === 'scripts') {
      await window.electronAPI?.openScriptsDir();
    }
  };

  const handleWorkspaceDone = (scriptData) => {
    setShowWorkspace(false);
    if (onNewTab && scriptData) {
      onNewTab(scriptData);
      if (onSwitchToExecutor) {
        onSwitchToExecutor();
      }
    }
  };

  const handleKillRoblox = async () => {
    setKilling(true);
    try {
      await window.electronAPI?.killRoblox?.();
    } catch (e) {
      console.error('Failed to kill Roblox:', e);
    } finally {
      setTimeout(() => setKilling(false), 1000);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const result = await window.electronAPI?.checkUpdates?.();
      setUpdateInfo(result);
    } catch (e) {
      console.error('Failed to check updates:', e);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (updateInfo?.downloadUrl) {
      await window.electronAPI?.downloadUpdate?.(updateInfo.downloadUrl);
    }
  };

  const checkBanwaveStatus = async () => {
    setCheckingBanwave(true);
    try {
      const status = await window.electronAPI?.checkBanwave?.();
      setBanwaveStatus(status);
    } catch (e) {
      console.error('Failed to check banwave:', e);
    } finally {
      setTimeout(() => setCheckingBanwave(false), 500);
    }
  };

  const handleEmergencyShutdown = async () => {
    if (confirm('This will kill Roblox and close Infernix immediately. Continue?')) {
      await window.electronAPI?.absEmergencyShutdown?.();
    }
  };

  const enableANS = async () => {
    try {
      await window.electronAPI?.enableANS?.();
      alert('A/ANS activated! You will be notified when admins join.');
    } catch (e) {
      console.error('Failed to enable ANS:', e);
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Reset all settings to defaults? This will restart the app.')) {
      await window.electronAPI?.resetSettings?.();
      window.electronAPI?.restartApp?.();
    }
  };

  const handleToggleDebugConsole = async () => {
    const newValue = !settings.debugConsole;
    await toggleSetting('debugConsole');
    if (confirm('Debug console setting changed. Restart now to apply?')) {
      window.electronAPI?.restartApp?.();
    }
  };

  const getToggleClass = (isActive) => {
    return 'toggle' + (isActive ? ' active' : '');
  };

  return (
    <div className="settings-view">
      <h2 className="settings-title">Settings</h2>

      {/* Update Banner */}
      {updateInfo?.hasUpdate && (
        <div className="update-banner">
          <div className="update-info">
            <Download size={18} />
            <div>
              <strong>Update Available!</strong>
              <span>v{updateInfo.latestVersion} is now available</span>
            </div>
          </div>
          <button className="update-btn" onClick={handleDownloadUpdate}>
            Download Now
          </button>
        </div>
      )}

      {/* Banwave Alert */}
      {banwaveStatus?.active && (
        <div className="banwave-alert">
          <AlertTriangle size={18} />
          <div>
            <strong>?? BANWAVE DETECTED!</strong>
            <span>{banwaveStatus.message || 'Exercise extreme caution!'}</span>
          </div>
          <button className="emergency-btn" onClick={handleEmergencyShutdown}>
            Emergency Shutdown
          </button>
        </div>
      )}

      <div className="settings-section">
        <h3 className="section-title">General</h3>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Always on Top</span>
            <span className="setting-desc">Keep Infernix above other windows</span>
          </div>
          <button
            className={getToggleClass(settings.topmost)}
            onClick={() => toggleSetting('topmost')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Auto Attach</span>
            <span className="setting-desc">Automatically attach to new Roblox clients</span>
          </div>
          <button
            className={getToggleClass(settings.autoAttach)}
            onClick={() => toggleSetting('autoAttach')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Auto Execute</span>
            <span className="setting-desc">Run autoexec scripts on attach</span>
          </div>
          <button
            className={getToggleClass(settings.autoExecute)}
            onClick={() => toggleSetting('autoExecute')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Close Roblox on Exit</span>
            <span className="setting-desc">Terminate Roblox when closing Infernix</span>
          </div>
          <button
            className={getToggleClass(settings.closeRoblox)}
            onClick={() => toggleSetting('closeRoblox')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Discord Username</span>
            <span className="setting-desc">Your Discord username for activity tracking</span>
          </div>
          <input
            type="text"
            value={settings.discordUsername || ''}
            onChange={(e) => setSettings(prev => ({ ...prev, discordUsername: e.target.value }))}
            placeholder="Enter Discord username"
            className="settings-input"
            style={{ 
              width: '150px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      {/* Theme Section */}
      <div className="settings-section">
        <h3 className="section-title">Appearance</h3>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Theme Mode</span>
            <span className="setting-desc">Choose your preferred theme</span>
          </div>
          <div className="theme-buttons">
            <button
              className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => setThemeMode('dark')}
            >
              <Moon size={14} />
              Dark
            </button>
            <button
              className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => setThemeMode('light')}
            >
              <Sun size={14} />
              Light
            </button>
            <button
              className={`theme-btn ${themeMode === 'midnight' ? 'active' : ''}`}
              onClick={() => setThemeMode('midnight')}
            >
              <Moon size={14} />
              Midnight
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Accent Color</span>
            <span className="setting-desc">Customize the accent color</span>
          </div>
          <div className="color-picker-row">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="color-input"
            />
          </div>
        </div>

        <div className="color-presets">
          {accentPresets.map((preset) => (
            <button
              key={preset.name}
              className={`color-preset ${accentColor === preset.color ? 'active' : ''}`}
              style={{ backgroundColor: preset.color }}
              onClick={() => setAccentColor(preset.color)}
              title={preset.name}
            />
          ))}
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">RGB Color Shift</span>
            <span className="setting-desc">Animate through colors continuously</span>
          </div>
          <button
            className={getToggleClass(colorShift)}
            onClick={() => setColorShift(!colorShift)}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* V1.0.8 Security Section */}
      <div className="settings-section">
        <h3 className="section-title">Security</h3>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">A/ANS - Admin Notifications</span>
            <span className="setting-desc">Alert when game owner/admin joins (Rank 250-255)</span>
          </div>
          <button
            className={getToggleClass(settings.ansEnabled)}
            onClick={() => toggleSetting('ansEnabled')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">A/ANS Auto-Shutdown</span>
            <span className="setting-desc">Auto close when admin/owner joins</span>
          </div>
          <button
            className={getToggleClass(settings.ansAutoShutdown)}
            onClick={() => toggleSetting('ansAutoShutdown')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">ABS - Anti Banwave System</span>
            <span className="setting-desc">Monitor for banwave alerts from GitHub</span>
          </div>
          <button
            className={getToggleClass(settings.absEnabled)}
            onClick={() => toggleSetting('absEnabled')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">ABS Auto-Shutdown</span>
            <span className="setting-desc">Auto close during banwaves</span>
          </div>
          <button
            className={getToggleClass(settings.absAutoShutdown)}
            onClick={() => toggleSetting('absAutoShutdown')}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="folders-row" style={{ marginTop: '12px' }}>
          <button className="folder-btn" onClick={enableANS}>
            <Bell size={14} />
            Activate A/ANS
          </button>
          <button className="folder-btn danger" onClick={handleEmergencyShutdown}>
            <Zap size={14} />
            Emergency Shutdown
          </button>
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <span className="setting-label">Banwave Status</span>
            <span className="setting-desc">
              {banwaveStatus?.active ? '?? ACTIVE - BE CAREFUL!' : '? All Clear'}
            </span>
          </div>
          <button 
            className="folder-btn secondary" 
            onClick={checkBanwaveStatus}
            disabled={checkingBanwave}
            style={{ flex: 'none', minWidth: 'auto', padding: '6px 12px' }}
          >
            <RefreshCw size={12} className={checkingBanwave ? 'spinning' : ''} />
            {checkingBanwave ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Actions</h3>
        <div className="folders-row">
          <button className="folder-btn danger" onClick={handleKillRoblox} disabled={killing}>
            <XCircle size={14} />
            {killing ? 'Killing...' : 'Kill Roblox'}
          </button>
          <button 
            className="folder-btn" 
            onClick={checkForUpdates} 
            disabled={checkingUpdates}
          >
            <RefreshCw size={14} className={checkingUpdates ? 'spinning' : ''} />
            {checkingUpdates ? 'Checking...' : 'Check Updates'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Folders & Tools</h3>
        <div className="folders-row">
          <button className="folder-btn" onClick={() => setShowAutoExec(true)}>
            <Settings2 size={14} />
            Manage AutoExec
          </button>
          <button className="folder-btn" onClick={() => setShowWorkspace(true)}>
            <Wand2 size={14} />
            Open Workspace
          </button>
        </div>
        <div className="folders-row" style={{ marginTop: '8px' }}>
          <button className="folder-btn secondary" onClick={() => openFolder('autoexec')}>
            <FolderOpen size={14} />
            Autoexec
          </button>
          <button className="folder-btn secondary" onClick={() => openFolder('workspace')}>
            <FolderOpen size={14} />
            Workspace
          </button>
          <button className="folder-btn secondary" onClick={() => openFolder('scripts')}>
            <FolderOpen size={14} />
            Saved Scripts
          </button>
        </div>
      </div>

      
      <div className="settings-section">
        <h3 className="section-title">Developer</h3>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Debug Console</span>
            <span className="setting-desc">Open DevTools with the app (requires restart)</span>
          </div>
          <button
            className={getToggleClass(settings.debugConsole)}
            onClick={handleToggleDebugConsole}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="folders-row" style={{ marginTop: '12px' }}>
          <button className="folder-btn danger" onClick={handleResetSettings}>
            <RotateCcw size={14} />
            Reset All Settings
          </button>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="section-title">About</h3>
        <div className="about-info">
          <p><strong>Infernix Executor</strong></p>
          <p>Version {currentVersion}</p>
          <p className="muted">© 2026 Infernix Team</p>
        </div>
      </div>

      {showAutoExec && (
        <AutoExecManager
          tabs={tabs || []}
          onClose={() => setShowAutoExec(false)}
        />
      )}

      {showWorkspace && (
        <WorkspaceEditor
          onDone={handleWorkspaceDone}
          onClose={() => setShowWorkspace(false)}
        />
      )}
    </div>
  );
}

export default SettingsView;







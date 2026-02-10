import { useState, useEffect } from 'react';
import { Zap, Users, FileCode, Clock, Flame, Sparkles, History, XCircle } from 'lucide-react';
import './Dashboard.css';
import { useTheme } from '../contexts/ThemeContext';

// Changelog data
const CHANGELOG = [
  {
    version: '1.2.5',
    date: 'February 2026',
    changes: [
      'VirusTotal Integration - Scan scripts for security threats',
      'Auto-Scan on Drop - Files are automatically scanned when dragged in',
      'Tab Safety Badges - Visual indicators show scan status on each tab',
      'Smart Detection - Distinguishes HackTool (expected) from real threats',
      'AI Security Summary - Get AI-powered analysis of scan results',
    ]
  },
  {
    version: '1.2.4',
    date: 'February 2026',
    changes: [
      'Dynamic Syntax Colors - Editor colors adapt to your accent color choice',
      'Execution History Panel - View and re-run past scripts in Executor tab',
      'History Actions - Execute, Copy, or Open in Tab from history',
      'Accent-based brackets/parentheses coloring',
    ]
  },
  {
    version: '1.2.3',
    date: 'February 2026',
    changes: [
      'Fixed Midnight Theme - Editor background now matches UI',
      'Execution History Modal - Track all script executions',
      'Success/Failed filtering in history',
      'Bulk delete history items',
    ]
  },
  {
    version: '1.1.5',
    date: 'February 2026',
    changes: [
      'Fixed Auto-Update Installer - Properly launches after app closes',
      'Uses detached spawn for reliable installer execution',
    ]
  },
  {
    version: '1.1.4',
    date: 'February 2026',
    changes: [
      'Fixed Premium Script Execution - Large scripts now work properly',
      'Improved ScriptHub Execution - Uses IPC for reliability',
      'Fixed HTTP headers for script payloads',
    ]
  },
  {
    version: '1.1.3',
    date: 'February 2026',
    changes: [
      'Fixed Auto-Update - Updates now install correctly',
      'Improved update process - App closes before installing',
    ]
  },
  {
    version: '1.1.2',
    date: 'February 2026',
    changes: [
      'Drag & Drop Scripts - Drop .lua/.txt files directly onto editor',
      'Auto-Lint - Automatic syntax checking on file drop',
      'Fixed Debug Console setting not being respected',
      'One-click installer for cleaner setup experience',
    ]
  },
  {
    version: '1.1.1',
    date: 'February 2026',
    changes: [
      'Custom Update UI - Fire-themed in-app update modal',
      'In-App Updates - Downloads and installs without browser',
      'Download Progress - Animated progress bar for updates',
      'Fixed GitHub Redirect - Update detection now works properly',
    ]
  },
  {
    version: '1.0.9',
    date: 'February 2026',
    changes: [
      'Custom Themes - Color picker for accent colors',
      'Auto-Update System - Detects new releases from GitHub',
      'ScriptHub Virtualization - Smoother scrolling with 1000s of scripts',
      'Accent color applies to entire UI dynamically',
      'Fade animations for ScriptHub cards',
      'Fixed hardcoded colors throughout app',
    ]
  },
  {
    version: '1.0.8',
    date: 'February 2026',
    changes: [
      'Banwave Status indicator with API integration',
      'Game detection for ScriptHub filtering',
      'Improved Dashboard stats display',
      'Various bug fixes and optimizations',
    ]
  },
  {
    version: '1.0.7',
    date: 'February 2026',
    changes: [
      'AutoExec now actually runs scripts on attach',
      'Kill Roblox button in Dashboard and Settings',
      'Fixed Workspace AI chat scrolling',
      'Fixed chat message bubbles display',
      'All settings buttons now functional',
      'Improved overall stability',
    ]
  },
  {
    version: '1.0.6',
    date: 'February 2026',
    changes: [
      'NEW: AutoExec Manager - Select tabs and add to autoexec',
      'NEW: Workspace Script Editor with AI assistance',
      'AI Assistant now helps EDIT scripts, not rewrite',
      'Script Tools: Loop, Function, Event, GUI, ESP templates',
      'One-click insert code snippets from AI',
      'Enhanced folder management UI',
      'Improved fire theme throughout',
      'Fixed Roblox detection in packaged app',
    ]
  },
  {
    version: '1.0.0',
    date: 'February 2026',
    changes: [
      'Initial release of Infernix Executor',
      'Complete UI overhaul with fire theme',
      'Script saving with custom names and descriptions',
      'Open saved scripts with professional modal UI',
      'Client Manager shows avatar, nickname, and game info',
      'ScriptHub with automatic game detection',
      'AI Assistant for script generation',
      'Dashboard with live stats and quick actions',
      'Silent operation - no executor branding',
      'Persistent tabs - scripts saved between sessions',
      'Settings persistence',
    ]
  }
];

function Dashboard({ clients = [], executionCount = 0, scriptCount = 0, startTime, onViewChange }) {
  const [uptime, setUptime] = useState('0:00');
  const [killing, setKilling] = useState(false);
  const { accentColor } = useTheme();

  // Update uptime every second
  useEffect(() => {
    const updateUptime = () => {
      const elapsed = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      if (hours > 0) {
        setUptime(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      } else {
        setUptime(`${minutes}:${String(seconds).padStart(2, '0')}`);
      }
    };

    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

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

  const stats = [
    { icon: Flame, label: 'Executions', value: String(executionCount), color: accentColor },
    { icon: Users, label: 'Active Clients', value: String(clients.length), color: '#22c55e'},
    { icon: FileCode, label: 'Scripts', value: String(scriptCount), color: '#fbbf24'},
    { icon: Clock, label: 'Uptime', value: uptime, color: '#ef4444'},
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="fire-icon-wrap">
            <Flame size={28} className="fire-icon" />
          </div>
          <div>
            <h2>Welcome to <span className="brand-text">Infernix</span></h2>
            <p>Ignite your gameplay</p>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ color: stat.color, background: `${stat.color}15` }}>
                <Icon size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="quick-actions">
        <h3><Sparkles size={14} /> Quick Actions</h3>
        <div className="actions-row">
          <button className="action-btn fire" onClick={() => onViewChange?.('executor')}>
            <Zap size={16} />
            Open Executor
          </button>
          <button className="action-btn" onClick={() => onViewChange?.('scripthub')}>
            <FileCode size={16} />
            Script Hub
          </button>
          <button className="action-btn" onClick={() => onViewChange?.('clients')}>
            <Users size={16} />
            Client Manager
          </button>
          <button 
            className={`action-btn danger ${killing ? 'killing': ''}`} 
            onClick={handleKillRoblox}
            disabled={killing}
          >
            <XCircle size={16} />
            {killing ? 'Killing...': 'Kill Roblox'}
          </button>
        </div>
      </div>

      <div className="changelog-section">
        <h3><History size={14} /> Changelog</h3>
        {CHANGELOG.map((release, i) => (
          <div key={i} className="changelog-card">
            <div className="changelog-header">
              <span className="version-badge">v{release.version}</span>
              <span className="release-date">{release.date}</span>
            </div>
            <ul className="changelog-list">
              {release.changes.map((change, j) => (
                <li key={j}>{change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;

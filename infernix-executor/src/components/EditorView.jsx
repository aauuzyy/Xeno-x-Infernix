import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { Play, Trash2, Power, Save, FolderOpen, Plus, X, Check, Upload, FileCode, History, Copy, ExternalLink, Clock, ChevronDown, ChevronUp, Shield, ShieldCheck, ShieldAlert, AlertTriangle, Loader } from 'lucide-react';
import SaveScriptModal from './SaveScriptModal';
import OpenScriptModal from './OpenScriptModal';
import ScanModal from './ScanModal';
import './EditorView.css';

// Helper to convert hex to HSL
function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Helper to convert HSL to hex
function hslToHex(h, s, l) {
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate syntax highlighting colors from a base accent color
function generateSyntaxColors(accentHex, isDark = true) {
  const hsl = hexToHSL(accentHex);
  const { h, s } = hsl;
  
  // Generate a palette of colors based on the accent
  // We create variations by shifting hue and adjusting lightness
  const baseLightness = isDark ? 60 : 45;
  const brightLightness = isDark ? 70 : 55;
  const dimLightness = isDark ? 50 : 35;
  
  return {
    // Primary accent (for cursor, active line numbers, brackets)
    accent: accentHex,
    accentDim: hslToHex(h, s, dimLightness),
    accentBright: hslToHex(h, s, brightLightness),
    
    // Keywords - slightly shifted hue for variety
    keyword: hslToHex((h + 10) % 360, Math.min(s + 10, 100), baseLightness),
    keywordControl: hslToHex((h + 10) % 360, Math.min(s + 10, 100), dimLightness),
    
    // Strings - complementary shift
    string: hslToHex((h + 40) % 360, Math.min(s + 5, 100), brightLightness),
    stringEscape: hslToHex((h + 40) % 360, Math.min(s + 5, 100), Math.min(brightLightness + 10, 90)),
    
    // Numbers - opposite shift
    number: hslToHex((h + 180) % 360, Math.max(s - 10, 30), baseLightness),
    numberFloat: hslToHex((h + 180) % 360, Math.max(s - 10, 30), brightLightness),
    
    // Functions - triadic color
    function: hslToHex((h + 120) % 360, Math.min(s, 90), baseLightness),
    
    // Types - analogous color
    type: hslToHex((h + 30) % 360, Math.min(s, 85), baseLightness),
    typeIdentifier: hslToHex((h + 30) % 360, Math.min(s, 85), brightLightness),
    
    // Operators and constants
    operator: hslToHex(h, s, baseLightness),
    constant: hslToHex((h - 20 + 360) % 360, Math.min(s + 5, 100), dimLightness),
    constantLanguage: hslToHex((h - 20 + 360) % 360, Math.min(s + 5, 100), baseLightness),
    
    // Tags and attributes
    tag: hslToHex((h + 10) % 360, Math.min(s + 10, 100), baseLightness),
    attributeName: hslToHex((h + 60) % 360, s, baseLightness),
    attributeValue: hslToHex((h + 40) % 360, Math.min(s + 5, 100), brightLightness),
    
    // Predefined and global
    predefined: hslToHex((h + 120) % 360, Math.min(s, 90), brightLightness),
    global: hslToHex((h + 30) % 360, Math.min(s, 85), baseLightness),
    variablePredefined: hslToHex(h, s, baseLightness),
    
    // Selection and highlights (with alpha)
    selectionBg: accentHex + '44',
    wordHighlightBg: accentHex + '22',
    bracketMatchBg: accentHex + '33',
  };
}

function EditorView({ tabs, activeTab, onTabChange, onNewTab, onCloseTab, onRenameTab, onCodeChange, onUpdateTabScan, onNotify, clients = [] }) {
  const { themeMode, accentColor } = useTheme();
  const monacoRef = useRef(null);
  
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const renameInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  
  // Execution History state
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [executionHistory, setExecutionHistory] = useState([]);
  
  // Scan Modal state
  const [showScanModal, setShowScanModal] = useState(false);

  const activeScript = tabs.find(t => t.id === activeTab);

  // Detection classification arrays for auto-scan
  const EXPECTED_DETECTIONS = ['hacktool', 'hack.tool', 'gamehack', 'game.hack', 'riskware', 'exploit', 'cheat', 'gamemod', 'tool.lua', 'not-a-virus'];
  const REAL_THREATS = ['trojan', 'stealer', 'keylogger', 'backdoor', 'ransomware', 'miner', 'worm', 'rootkit', 'spyware', 'banker', 'rat.', 'infostealer'];
  const SUSPICIOUS_DOMAINS = ['grabify.link', 'iplogger.org', 'blasze.tk', '2no.co', 'iplogger.com', 'iplogger.ru', 'yip.su', 'iplis.org', 'ipgrabber.ru', 'discord.com/api/webhooks'];

  // Auto-scan a script in the background and return status
  const performAutoScan = async (tabId, content) => {
    if (!onUpdateTabScan) return;

    onUpdateTabScan(tabId, 'scanning');

    try {
      // Quick local check for suspicious domains
      let hasSuspiciousDomain = false;
      for (const domain of SUSPICIOUS_DOMAINS) {
        if (content.toLowerCase().includes(domain)) {
          hasSuspiciousDomain = true;
          break;
        }
      }

      // VirusTotal scan
      const vtResult = await window.electronAPI?.virusTotalScan?.(content);

      if (!vtResult || vtResult.error) {
        onUpdateTabScan(tabId, 'unknown', { error: vtResult?.error || 'Scan failed' });
        return;
      }

      const detections = vtResult.detections || [];
      let hasRealThreat = false;
      let hasExpected = false;

      for (const det of detections) {
        const resultLower = det.result.toLowerCase();
        if (REAL_THREATS.some(threat => resultLower.includes(threat))) {
          hasRealThreat = true;
          break;
        }
        if (EXPECTED_DETECTIONS.some(expected => resultLower.includes(expected))) {
          hasExpected = true;
        }
      }

      if (hasRealThreat || hasSuspiciousDomain) {
        onUpdateTabScan(tabId, 'threat', { detections, hasSuspiciousDomain });
      } else if (hasExpected) {
        onUpdateTabScan(tabId, 'expected', { detections });
      } else if (detections.length > 0) {
        onUpdateTabScan(tabId, 'suspicious', { detections });
      } else {
        onUpdateTabScan(tabId, 'safe', { detections: [] });
      }
    } catch (err) {
      console.error('Auto-scan error:', err);
      onUpdateTabScan(tabId, 'unknown', { error: err.message });
    }
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    onCloseTab(tabId);
  };

  const handleCodeChange = (value) => {
    onCodeChange(activeTab, value || '');
  };

  // Execute script directly via HTTP (like Xeno does)
  const executeScript = async (script, targetClients, scriptName) => {
    console.log('Executing script via HTTP to port 3110');
    console.log('Target clients:', targetClients);
    console.log('Script length:', script?.length);
    
    try {
      // Encode script properly for large scripts
      const encoder = new TextEncoder();
      const scriptBytes = encoder.encode(script);
      
      const response = await fetch('http://localhost:3110/o', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': scriptBytes.length.toString(),
          'clients': JSON.stringify(targetClients)  // lowercase 'clients'like Xeno expects
        },
        body: script
      });

      console.log('Execution response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('Execution failed:', text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return { ok: true };
    } catch (error) {
      console.error('Direct execution failed:', error);
      // Fallback to IPC which uses Node.js http module (more reliable for large scripts)
      try {
        const result = await window.electronAPI?.execute(script, targetClients, scriptName);
        return result;
      } catch (ipcError) {
        console.error('IPC execution also failed:', ipcError);
        return { ok: false, error: error.message };
      }
    }
  };

  // Parse client helper - PIDs must be strings like Xeno does
  const parseClient = (client) => {
    if (Array.isArray(client)) {
      return {
        pid: String(client[0] ?? ''),
        username: client[1],
        playerName: client[2],
        status: client[3],
        version: client[4],
        placeId: client[5]
      };
    }
    return {
      ...client,
      pid: String(client.pid ?? '')
    };
  };

  const handleExecute = async () => {
    if (!activeScript?.content) {
      onNotify({
        type: 'error',
        title: 'No Script',
        message: 'Nothing to execute'
      });
      return;
    }
    
    try {
      // Get all clients with status attached (3)
      const attachedClients = clients
        .map(parseClient)
        .filter(c => c.status === 3)
        .map(c => c.pid);
      
      console.log('Attached clients for execution:', attachedClients);
      console.log('All clients:', clients.map(parseClient));
      
      if (attachedClients.length === 0) {
        onNotify({
          type: 'warning',
          title: 'No Clients',
          message: 'No attached Roblox clients found'
        });
        return;
      }
      
      // Execute via direct HTTP (like Xeno)
      console.log('Executing script to:', attachedClients);
      const result = await executeScript(activeScript.content, attachedClients, activeScript.name);
      
      // Refresh history after execution
      refreshHistoryAfterExecution();
      
      if (result?.ok) {
        onNotify({
          type: 'fire',
          title: 'Script Executed',
          message: `Running on ${attachedClients.length} client(s)...`
        });
      } else {
        onNotify({
          type: 'warning',
          title: 'Execution Warning',
          message: result?.error || 'Execution may have failed'
        });
      }
    } catch (e) {
      onNotify({
        type: 'error',
        title: 'Execution Failed',
        message: e.message || 'Unknown error'
      });
    }
  };

  const handleClear = () => {
    onCodeChange(activeTab, '');
  };

  const handleSaveScript = async (name, description) => {
    if (!activeScript?.content) {
      onNotify({
        type: 'warning',
        title: 'Nothing to Save',
        message: 'Script is empty'
      });
      return;
    }
    
    try {
      const result = await window.electronAPI?.saveScript(name, description, activeScript.content);
      if (result?.ok) {
        onNotify({
          type: 'success',
          title: 'Script Saved',
          message: `"${name}" saved successfully`
        });
        // Update the tab name to match
        onRenameTab(activeTab, name);
      } else {
        throw new Error(result?.error || 'Failed to save');
      }
    } catch (e) {
      onNotify({
        type: 'error',
        title: 'Save Failed',
        message: e.message
      });
    }
  };

  const handleOpenScript = (name, content) => {
    // Create a new tab with the loaded script name and content
    onNewTab({ name, content });
    
    onNotify({
      type: 'success',
      title: 'Script Loaded',
      message: `"${name}" opened in new tab`
    });
  };

  const handleKillRoblox = async () => {
    try {
      const result = await window.electronAPI?.killRoblox();
      if (result?.killed) {
        onNotify({
          type: 'success',
          title: 'Roblox Killed',
          message: 'All Roblox processes terminated'
        });
      } else {
        onNotify({
          type: 'warning',
          title: 'Kill Roblox',
          message: 'No Roblox processes found'
        });
      }
    } catch (e) {
      onNotify({
        type: 'error',
        title: 'Kill Failed',
        message: e.message
      });
    }
  };

  const handleDoubleClick = (e, tab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingName(tab.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const handleRenameSubmit = (tabId) => {
    if (editingName.trim()) {
      onRenameTab(tabId, editingName.trim());
    }
    setEditingTabId(null);
  };

  const handleRenameKeyDown = (e, tabId) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };
  // Basic Lua linting - checks for common syntax issues
  const lintLuaCode = (code) => {
    const issues = [];
    const lines = code.split('\n');
    
    let openBlocks = 0;
    let openParens = 0;
    let openBrackets = 0;
    let openBraces = 0;
    
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      
      // Skip comments
      if (trimmed.startsWith('--')) return;
      
      // Count block openers/closers
      const blockOpeners = (trimmed.match(/\b(function|if|for|while|repeat|do)\b/g) || []).length;
      const blockClosers = (trimmed.match(/\bend\b/g) || []).length;
      const untilClosers = (trimmed.match(/\buntil\b/g) || []).length;
      
      openBlocks += blockOpeners - blockClosers - untilClosers;
      
      // Count brackets
      openParens += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      openBrackets += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
      openBraces += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      
      // Check for common issues
      if (trimmed.match(/\bthen\s*$/)) {
        // Valid: if condition then
      }
      if (trimmed.match(/=\s*$/)) {
        issues.push({ line: lineNum, message: 'Incomplete assignment'});
      }
    });
    
    if (openBlocks > 0) {
      issues.push({ line: lines.length, message: `Missing ${openBlocks} 'end'statement(s)` });
    } else if (openBlocks < 0) {
      issues.push({ line: lines.length, message: `Extra 'end'statement(s)` });
    }
    
    if (openParens !== 0) {
      issues.push({ line: lines.length, message: `Unbalanced parentheses` });
    }
    if (openBrackets !== 0) {
      issues.push({ line: lines.length, message: `Unbalanced square brackets` });
    }
    if (openBraces !== 0) {
      issues.push({ line: lines.length, message: `Unbalanced curly braces` });
    }
    
    return issues;
  };

  // Handle file drop
  const handleFileDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => 
      f.name.endsWith('.lua') || f.name.endsWith('.txt') || f.name.endsWith('.luau')
    );
    
    if (validFiles.length === 0) {
      onNotify({
        type: 'warning',
        title: 'Invalid File',
        message: 'Please drop .lua, .luau, or .txt files'
      });
      return;
    }
    
    for (const file of validFiles) {
      try {
        const content = await file.text();
        const fileName = file.name.replace(/\.(lua|luau|txt)$/i, '');
        
        // Lint the code
        const issues = lintLuaCode(content);
        
        // Create new tab with the content and get the new tab ID
        const newTabId = onNewTab({ name: fileName, content });

        // Auto-scan the file for security threats
        if (newTabId && onUpdateTabScan) {
          performAutoScan(newTabId, content);
        }

        if (issues.length > 0) {
          onNotify({
            type: 'warning',
            title: 'Lint Warnings',
            message: `${issues.length} issue(s): ${issues[0].message}`
          });
        } else {
          onNotify({
            type: 'success',
            title: 'File Loaded',
            message: `"${file.name}" - Scanning for threats...`
          });
        }
      } catch (err) {
        onNotify({
          type: 'error',
          title: 'Read Error',
          message: `Failed to read ${file.name}`
        });
      }
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEditorMount = (editor, monaco) => {
    monacoRef.current = monaco;

    // Define themes with dynamic accent colors
    defineThemesWithAccent(monaco, accentColor);

    // Set theme based on current themeMode
    const themeName = themeMode === 'light'? 'infernix-light': themeMode === 'midnight'? 'infernix-midnight': 'infernix-dark';
    monaco.editor.setTheme(themeName);
  };

  // Helper function to define themes with dynamic accent colors
  const defineThemesWithAccent = (monaco, accent) => {
    const darkColors = generateSyntaxColors(accent, true);
    const lightColors = generateSyntaxColors(accent, false);

    // Remove # from hex colors for Monaco token rules
    const strip = (hex) => hex.replace('#', '');

    // Dark theme (default)
    monaco.editor.defineTheme('infernix-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic'},
        { token: 'keyword', foreground: strip(darkColors.keyword), fontStyle: 'bold'},
        { token: 'keyword.control', foreground: strip(darkColors.keywordControl) },
        { token: 'string', foreground: strip(darkColors.string) },
        { token: 'string.escape', foreground: strip(darkColors.stringEscape) },
        { token: 'number', foreground: strip(darkColors.number) },
        { token: 'number.float', foreground: strip(darkColors.numberFloat) },
        { token: 'variable', foreground: 'e5e7eb'},
        { token: 'variable.predefined', foreground: strip(darkColors.variablePredefined) },
        { token: 'function', foreground: strip(darkColors.function) },
        { token: 'type', foreground: strip(darkColors.type) },
        { token: 'type.identifier', foreground: strip(darkColors.typeIdentifier) },
        { token: 'tag', foreground: strip(darkColors.tag) },
        { token: 'attribute.name', foreground: strip(darkColors.attributeName) },
        { token: 'attribute.value', foreground: strip(darkColors.attributeValue) },
        { token: 'delimiter', foreground: strip(darkColors.accentDim) },
        { token: 'delimiter.bracket', foreground: strip(darkColors.accent) },
        { token: 'operator', foreground: strip(darkColors.operator) },
        { token: 'constant', foreground: strip(darkColors.constant) },
        { token: 'constant.language', foreground: strip(darkColors.constantLanguage) },
        { token: 'global', foreground: strip(darkColors.global) },
        { token: 'identifier', foreground: 'e5e7eb'},
        { token: 'predefined', foreground: strip(darkColors.predefined) },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#e5e7eb',
        'editor.lineHighlightBackground': '#1a1a1a',
        'editor.selectionBackground': darkColors.selectionBg,
        'editorCursor.foreground': accent,
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': accent,
        'editor.wordHighlightBackground': darkColors.wordHighlightBg,
        'editorBracketMatch.background': darkColors.bracketMatchBg,
        'editorBracketMatch.border': accent,
      },
    });

    // Light theme
    monaco.editor.defineTheme('infernix-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic'},
        { token: 'keyword', foreground: strip(lightColors.keyword), fontStyle: 'bold'},
        { token: 'keyword.control', foreground: strip(lightColors.keywordControl) },
        { token: 'string', foreground: strip(lightColors.string) },
        { token: 'string.escape', foreground: strip(lightColors.stringEscape) },
        { token: 'number', foreground: strip(lightColors.number) },
        { token: 'number.float', foreground: strip(lightColors.numberFloat) },
        { token: 'variable', foreground: '1f2937'},
        { token: 'variable.predefined', foreground: strip(lightColors.variablePredefined) },
        { token: 'function', foreground: strip(lightColors.function) },
        { token: 'type', foreground: strip(lightColors.type) },
        { token: 'type.identifier', foreground: strip(lightColors.typeIdentifier) },
        { token: 'tag', foreground: strip(lightColors.tag) },
        { token: 'attribute.name', foreground: strip(lightColors.attributeName) },
        { token: 'attribute.value', foreground: strip(lightColors.attributeValue) },
        { token: 'delimiter', foreground: strip(lightColors.accentDim) },
        { token: 'delimiter.bracket', foreground: strip(lightColors.accent) },
        { token: 'operator', foreground: strip(lightColors.operator) },
        { token: 'constant', foreground: strip(lightColors.constant) },
        { token: 'constant.language', foreground: strip(lightColors.constantLanguage) },
        { token: 'global', foreground: strip(lightColors.global) },
        { token: 'identifier', foreground: '1f2937'},
        { token: 'predefined', foreground: strip(lightColors.predefined) },
      ],
      colors: {
        'editor.background': '#fafaf9',
        'editor.foreground': '#1f2937',
        'editor.lineHighlightBackground': '#f5f5f4',
        'editor.selectionBackground': lightColors.selectionBg,
        'editorCursor.foreground': accent,
        'editorLineNumber.foreground': '#9ca3af',
        'editorLineNumber.activeForeground': accent,
        'editor.wordHighlightBackground': lightColors.wordHighlightBg,
        'editorBracketMatch.background': lightColors.bracketMatchBg,
        'editorBracketMatch.border': accent,
      },
    });

    // Midnight theme (deep blue)
    monaco.editor.defineTheme('infernix-midnight', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6e7681', fontStyle: 'italic'},
        { token: 'keyword', foreground: strip(darkColors.keyword), fontStyle: 'bold'},
        { token: 'keyword.control', foreground: strip(darkColors.keywordControl) },
        { token: 'string', foreground: strip(darkColors.string) },
        { token: 'string.escape', foreground: strip(darkColors.stringEscape) },
        { token: 'number', foreground: strip(darkColors.number) },
        { token: 'number.float', foreground: strip(darkColors.numberFloat) },
        { token: 'variable', foreground: 'e2e8f0'},
        { token: 'variable.predefined', foreground: strip(darkColors.variablePredefined) },
        { token: 'function', foreground: strip(darkColors.function) },
        { token: 'type', foreground: strip(darkColors.type) },
        { token: 'type.identifier', foreground: strip(darkColors.typeIdentifier) },
        { token: 'tag', foreground: strip(darkColors.tag) },
        { token: 'attribute.name', foreground: strip(darkColors.attributeName) },
        { token: 'attribute.value', foreground: strip(darkColors.attributeValue) },
        { token: 'delimiter', foreground: strip(darkColors.accentDim) },
        { token: 'delimiter.bracket', foreground: strip(darkColors.accent) },
        { token: 'operator', foreground: strip(darkColors.operator) },
        { token: 'constant', foreground: strip(darkColors.constant) },
        { token: 'constant.language', foreground: strip(darkColors.constantLanguage) },
        { token: 'global', foreground: strip(darkColors.global) },
        { token: 'identifier', foreground: 'e2e8f0'},
        { token: 'predefined', foreground: strip(darkColors.predefined) },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#161b22',
        'editor.selectionBackground': darkColors.selectionBg,
        'editorCursor.foreground': accent,
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': accent,
        'editor.wordHighlightBackground': darkColors.wordHighlightBg,
        'editorBracketMatch.background': darkColors.bracketMatchBg,
        'editorBracketMatch.border': accent,
        'editorLink.activeForeground': accent,
      },
    });
  };

  // Update Monaco theme when themeMode or accentColor changes
  useEffect(() => {
    if (monacoRef.current) {
      // Re-define themes with new accent color
      defineThemesWithAccent(monacoRef.current, accentColor);

      const themeName = themeMode === 'light'? 'infernix-light': themeMode === 'midnight'? 'infernix-midnight': 'infernix-dark';
      monacoRef.current.editor.setTheme(themeName);
    }
  }, [themeMode, accentColor]);

  // Load execution history
  useEffect(() => {
    loadExecutionHistory();
  }, []);

  const loadExecutionHistory = async () => {
    try {
      const data = await window.electronAPI?.getExecutionHistory?.();
      setExecutionHistory(data || []);
    } catch (e) {
      console.error('Failed to load history:', e);
      setExecutionHistory([]);
    }
  };

  // Reload history after execution
  const refreshHistoryAfterExecution = () => {
    setTimeout(() => loadExecutionHistory(), 500);
  };

  const handleHistoryRerun = async (item) => {
    const targetClients = clients.filter(c => c.connected);
    if (targetClients.length === 0) {
      onNotify?.('No clients connected', 'error');
      return;
    }
    await executeScript(item.script, targetClients, item.scriptName);
    refreshHistoryAfterExecution();
  };

  const handleHistoryCopy = (item) => {
    navigator.clipboard.writeText(item.script);
    onNotify?.('Copied to clipboard', 'success');
  };

  const handleHistoryOpenInTab = (item) => {
    // Pass the script content directly to create a new tab with it
    onNewTab?.({ name: item.scriptName || 'History', content: item.script });
  };

  const formatHistoryTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };


  return (
    <div 
      className={`editor-view ${isDragOver ? 'drag-over': ''}`}
      onDrop={handleFileDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-zone">
            <div className="drop-icon">
              <FileCode size={48} />
            </div>
            <h3>Drop Script File</h3>
            <p>Release to load .lua, .luau, or .txt file</p>
            <div className="drop-features">
              <span><Check size={14} /> Auto-lint</span>
              <span><Check size={14} /> New tab</span>
            </div>
          </div>
        </div>
      )}
      {/* Tab Bar */}
      <div className="tab-bar">
        <div className="tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active': ''}`}
              onClick={() => onTabChange(tab.id)}
              onDoubleClick={(e) => handleDoubleClick(e, tab)}
            >
              {/* Safety Badge */}
              {tab.scanStatus && (
                <span className={`tab-safety-badge ${tab.scanStatus}`} title={
                  tab.scanStatus === 'safe' ? 'Verified Safe' :
                  tab.scanStatus === 'expected' ? 'HackTool (Expected for executor scripts)' :
                  tab.scanStatus === 'threat' ? 'Threat Detected!' :
                  tab.scanStatus === 'suspicious' ? 'Suspicious Patterns' :
                  tab.scanStatus === 'scanning' ? 'Scanning...' :
                  'Scan status unknown'
                }>
                  {tab.scanStatus === 'safe' && <ShieldCheck size={12} />}
                  {tab.scanStatus === 'expected' && <ShieldCheck size={12} />}
                  {tab.scanStatus === 'threat' && <ShieldAlert size={12} />}
                  {tab.scanStatus === 'suspicious' && <AlertTriangle size={12} />}
                  {tab.scanStatus === 'scanning' && <Loader size={12} className="spinning" />}
                  {tab.scanStatus === 'unknown' && <Shield size={12} />}
                </span>
              )}
              {editingTabId === tab.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  className="tab-rename-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRenameSubmit(tab.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, tab.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-name">{tab.name}</span>
              )}
              <button
                className="tab-close"
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="tab-new" onClick={onNewTab}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="tool-btn primary" onClick={handleExecute}>
          <Play size={14} />
          <span>Execute</span>
        </button>
        <button className="tool-btn" onClick={handleClear}>
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
        <div className="toolbar-divider" />
        <button className="tool-btn danger" onClick={handleKillRoblox}>
          <Power size={14} />
          <span>Kill Roblox</span>
        </button>
        <div className="toolbar-spacer" />
        
        {/* VirusTotal Security Scan Button */}
        <button className="tool-btn security-scan" onClick={() => setShowScanModal(true)}>
          <Shield size={14} />
          <span>Scan</span>
        </button>
        <button className="tool-btn" onClick={() => setShowSaveModal(true)}>              <Save size={14} />
          <span>Save</span>
        </button>
        <button className="tool-btn" onClick={() => setShowOpenModal(true)}>
          <FolderOpen size={14} />
          <span>Open</span>
        </button>
      </div>

      {/* Editor */}
      <div className="editor-container">
        <MonacoEditor
          height="100%"
          defaultLanguage="lua"
          value={activeScript?.content || ''}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: true, scale: 1, showSlider: 'always', size: 'proportional', maxColumn: 60 },
            fontSize: 13,
            lineHeight: 20,
            fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            fontLigatures: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 12 },
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* Execution History Panel */}
      <div className={`history-panel ${historyExpanded ? 'expanded': 'collapsed'}`}>
        <div className="history-header" onClick={() => setHistoryExpanded(!historyExpanded)}>
          <div className="history-title">
            <History size={14} />
            <span>Execution History</span>
            <span className="history-count">{executionHistory.length}</span>
          </div>
          <button className="history-toggle">
            {historyExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
        
        {historyExpanded && (
          <div className="history-content">
            {executionHistory.length === 0 ? (
              <div className="history-empty">
                <Clock size={20} />
                <span>No execution history yet</span>
              </div>
            ) : (
              <div className="history-list">
                {executionHistory.slice(0, 50).map((item, index) => (
                  <div key={item.id || index} className="history-item">
                    <div className="history-item-info">
                      <span className="history-item-name">{item.scriptName || 'Untitled'}</span>
                      {item.description && (
                        <span className="history-item-desc">{item.description}</span>
                      )}
                      <span className="history-item-time">
                        <Clock size={10} />
                        {formatHistoryTime(item.timestamp)}
                      </span>
                    </div>
                    <div className="history-item-actions">
                      <button 
                        className="history-action-btn execute"
                        onClick={() => handleHistoryRerun(item)}
                        title="Execute"
                      >
                        <Play size={12} />
                      </button>
                      <button 
                        className="history-action-btn copy"
                        onClick={() => handleHistoryCopy(item)}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                      <button 
                        className="history-action-btn open"
                        onClick={() => handleHistoryOpenInTab(item)}
                        title="Open in new tab"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <SaveScriptModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveScript}
        defaultName={activeScript?.name || 'Untitled'}
      />
      
      <OpenScriptModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        onOpen={handleOpenScript}
      />

      <ScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        script={activeScript?.content || ''}
        scriptName={activeScript?.name || 'Untitled'}
        onScanComplete={(status, result) => {
          if (activeTab && onUpdateTabScan) {
            onUpdateTabScan(activeTab, status, result);
          }
        }}
      />
    </div>
  );
}

export default EditorView;









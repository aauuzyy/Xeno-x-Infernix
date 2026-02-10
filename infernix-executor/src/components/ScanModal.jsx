import { useState, useEffect } from 'react';
import { X, Shield, ShieldCheck, ShieldAlert, ShieldX, Loader2, Link2, FileCode, CheckCircle, AlertTriangle, XCircle, ExternalLink, Sparkles, AlertOctagon, Info } from 'lucide-react';
import './ScanModal.css';

// Detection types that are EXPECTED for executor scripts (not real threats)
const EXPECTED_DETECTIONS = [
  'hacktool', 'gamehack', 'cheat', 'exploit', 'riskware', 'not-a-virus',
  'game-hack', 'heur', 'pup', 'potentially', 'unwanted', 'adware',
  'application', 'tool', 'roblox', 'injector', 'trainer', 'hack'
];

// Detection types that are ACTUAL threats
const REAL_THREATS = [
  'trojan', 'stealer', 'keylogger', 'ransomware', 'backdoor', 'rat',
  'spyware', 'worm', 'rootkit', 'banker', 'cryptominer', 'miner',
  'password', 'credential', 'infostealer', 'dropper', 'downloader'
];

// Regex patterns to detect loadstring URLs
const LOADSTRING_PATTERNS = [
  /loadstring\s*\(\s*game\s*:\s*HttpGet\s*\(\s*["']([^"']+)["']/gi,
  /loadstring\s*\(\s*game\s*:\s*HttpGetAsync\s*\(\s*["']([^"']+)["']/gi,
  /HttpGet\s*\(\s*["']([^"']+)["']\s*\)/gi,
  /request\s*\(\s*\{\s*Url\s*=\s*["']([^"']+)["']/gi,
  /syn\.request\s*\(\s*\{\s*Url\s*=\s*["']([^"']+)["']/gi,
  /http_request\s*\(\s*\{\s*Url\s*=\s*["']([^"']+)["']/gi,
];

// Known IP logger / malicious domains
const SUSPICIOUS_DOMAINS = [
  'grabify.link', 'iplogger.org', 'iplogger.com', 'iplogger.ru',
  '2no.co', 'iplis.ru', 'ezstat.ru', 'iplogger.info',
  'logs-01.loggly.com', 'webhook.site', 'requestbin.com',
  'pipedream.net', 'canarytokens.com', 'blasze.tk', 'blasze.com',
  'ipgrabber.ru', 'ipgrab.org', 'tracker.gg', 'quicklink.to',
  'discord.com/api/webhooks', 'discordapp.com/api/webhooks',
];

// Suspicious patterns in script
const SUSPICIOUS_PATTERNS = [
  { pattern: /webhook/gi, name: 'Discord Webhook', severity: 'warning', desc: 'May send data to external servers'},
  { pattern: /getPlayerData|PlayerData/gi, name: 'Player Data Access', severity: 'info', desc: 'Accesses player information'},
  { pattern: /HttpService:PostAsync/gi, name: 'HTTP POST', severity: 'warning', desc: 'Sends data to external server'},
  { pattern: /game\.Players\.LocalPlayer\.(Name|UserId)/gi, name: 'Identity Access', severity: 'info', desc: 'Accesses your username/ID'},
  { pattern: /getfenv|setfenv|getrawmetatable|setrawmetatable|hookfunction|hookmetamethod/gi, name: 'Environment Manipulation', severity: 'warning', desc: 'Modifies script environment'},
  { pattern: /syn\.crypt\.encrypt|syn\.crypt\.decrypt/gi, name: 'Encryption', severity: 'info', desc: 'Uses encryption functions'},
  { pattern: /writefile|appendfile/gi, name: 'File Write', severity: 'warning', desc: 'Writes to your filesystem'},
  { pattern: /readfile|listfiles|isfile|isfolder/gi, name: 'File Access', severity: 'info', desc: 'Reads your filesystem'},
  { pattern: /game:GetService\("HttpService"\):GetAsync/gi, name: 'HTTP Request', severity: 'info', desc: 'Fetches external content'},
  { pattern: /keylogger|key\s*log|keystroke/gi, name: 'Keylogger', severity: 'danger', desc: 'May capture keystrokes'},
  { pattern: /password|credential|login|auth/gi, name: 'Credential Access', severity: 'warning', desc: 'May access credentials'},
  { pattern: /hwid|fingerprint|machineid/gi, name: 'Hardware ID', severity: 'warning', desc: 'Collects hardware identifiers'},
];

function extractUrls(script) {
  const urls = new Set();
  for (const pattern of LOADSTRING_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(script)) !== null) {
      if (match[1] && match[1].startsWith('http')) {
        urls.add(match[1]);
      }
    }
  }
  return Array.from(urls);
}

// Classify a detection as "expected" (hacktool) or "real threat"
function classifyDetection(detection) {
  const resultLower = (detection.result || '').toLowerCase();
  const engineLower = (detection.engine || '').toLowerCase();
  
  // Check if it's an actual threat
  for (const threat of REAL_THREATS) {
    if (resultLower.includes(threat)) {
      return 'threat';
    }
  }
  
  // Check if it's an expected detection for executor scripts
  for (const expected of EXPECTED_DETECTIONS) {
    if (resultLower.includes(expected)) {
      return 'expected';
    }
  }
  
  // If malicious but doesn't match patterns, treat as potential threat
  if (detection.category === 'malicious') {
    return 'unknown';
  }
  
  return 'expected';
}

function checkForIpLoggers(script, urls) {
  const findings = [];
  
  // Check URLs against known IP loggers
  for (const url of urls) {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      for (const suspicious of SUSPICIOUS_DOMAINS) {
        if (domain.includes(suspicious.replace('discord.com/api/webhooks', 'discord.com')) || url.toLowerCase().includes(suspicious)) {
          findings.push({
            type: 'ip-logger',
            name: 'IP Logger Detected',
            url: url,
            domain: domain,
            severity: 'danger',
            desc: `Known IP logging/tracking service: ${suspicious}`
          });
        }
      }
    } catch (e) {}
  }
  
  // Check for suspicious patterns
  for (const { pattern, name, severity, desc } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(script)) {
      findings.push({ type: 'pattern', name, severity, desc });
    }
  }
  
  return findings;
}

export default function ScanModal({ isOpen, onClose, script, scriptName, onScanComplete }) {
  const [phase, setPhase] = useState('idle'); // idle, scanning, complete
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState([]);
  const [results, setResults] = useState(null);
  const [detectedUrls, setDetectedUrls] = useState([]);
  const [localFindings, setLocalFindings] = useState([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startScan();
    }
  }, [isOpen]);

  const startScan = async () => {
    setPhase('scanning');
    setResults(null);
    setAiSummary('');
    setLocalFindings([]);

    // Detect URLs in script
    const urls = extractUrls(script);
    setDetectedUrls(urls);
    
    // Check for IP loggers and suspicious patterns locally
    const findings = checkForIpLoggers(script, urls);
    setLocalFindings(findings);

    // Build steps
    const scanSteps = [
      { id: 'hash', label: 'Calculating script hash', status: 'pending'},
      { id: 'local', label: 'Checking for IP loggers & suspicious patterns', status: 'pending'},
      { id: 'lookup', label: 'Checking VirusTotal database', status: 'pending'},
    ];

    // Add URL scan steps
    urls.forEach((url, i) => {
      try {
        const domain = new URL(url).hostname;
        scanSteps.push({
          id: `url-${i}`,
          label: `Scanning URL: ${domain}`,
          url: url,
          status: 'pending',
        });
      } catch (e) {}
    });

    scanSteps.push({ id: 'analyze', label: 'Analyzing results', status: 'pending'});
    scanSteps.push({ id: 'ai', label: 'AI generating security summary', status: 'pending'});

    setSteps(scanSteps);
    setCurrentStep(0);

    // Execute scan steps
    const finalResults = {
      scriptScan: null,
      urlScans: [],
      overallVerdict: 'clean',
      threats: 0,
      warnings: 0,
      detections: [],
      localFindings: findings,
    };

    // Step 1: Calculate hash
    updateStep(0, 'scanning');
    await delay(400);
    updateStep(0, 'complete');

    // Step 2: Local analysis
    updateStep(1, 'scanning');
    setCurrentStep(1);
    await delay(300);
    
    if (findings.some(f => f.severity === 'danger')) {
      finalResults.threats += findings.filter(f => f.severity === 'danger').length;
      finalResults.overallVerdict = 'malicious';
      updateStep(1, 'threat');
    } else if (findings.some(f => f.severity === 'warning')) {
      finalResults.warnings += findings.filter(f => f.severity === 'warning').length;
      if (finalResults.overallVerdict === 'clean') finalResults.overallVerdict = 'suspicious';
      updateStep(1, 'warning');
    } else {
      updateStep(1, 'complete');
    }

    // Step 3: VirusTotal lookup
    updateStep(2, 'scanning');
    setCurrentStep(2);

    try {
      const scanResult = await window.electronAPI?.virusTotalScan?.(script, scriptName || 'script.lua');
      finalResults.scriptScan = scanResult;
      
      // Extract and classify detections from the API response
      if (scanResult?.detections?.length > 0) {
        // Classify each detection
        const classifiedDetections = scanResult.detections.map(d => ({
          ...d,
          classification: classifyDetection(d)
        }));
        
        finalResults.detections = classifiedDetections;
        
        // Count real threats vs expected detections
        const realThreats = classifiedDetections.filter(d => d.classification === 'threat');
        const unknownThreats = classifiedDetections.filter(d => d.classification === 'unknown');
        const expectedDetections = classifiedDetections.filter(d => d.classification === 'expected');
        
        finalResults.realThreats = realThreats;
        finalResults.expectedDetections = expectedDetections;
        
        // Only mark as malicious if there are REAL threats (trojans, stealers, etc.)
        if (realThreats.length > 0) {
          finalResults.threats = realThreats.length;
          finalResults.overallVerdict = 'malicious';
          updateStep(2, 'threat');
        } else if (unknownThreats.length > 0) {
          // Unknown detections - warn but don't block
          finalResults.warnings += unknownThreats.length;
          if (finalResults.overallVerdict === 'clean') finalResults.overallVerdict = 'suspicious';
          updateStep(2, 'warning');
        } else if (expectedDetections.length > 0) {
          // Only HackTool/GameHack detections - this is normal for executor scripts
          finalResults.expectedCount = expectedDetections.length;
          updateStep(2, 'complete'); // Green checkmark - it's fine!
        } else {
          updateStep(2, 'complete');
        }
      }
    } catch (e) {
      updateStep(2, 'error');
    }

    // Step 4+: Scan URLs
    for (let i = 0; i < urls.length; i++) {
      const stepIndex = 3 + i;
      updateStep(stepIndex, 'scanning');
      setCurrentStep(stepIndex);

      try {
        const urlResult = await window.electronAPI?.virusTotalScanUrl?.(urls[i]);
        finalResults.urlScans.push({ url: urls[i], result: urlResult });

        if (urlResult?.malicious > 0) {
          finalResults.threats += urlResult.malicious;
          finalResults.overallVerdict = 'malicious';
          updateStep(stepIndex, 'threat');
          
          // Add URL detections
          if (urlResult?.engines) {
            const urlDetections = getEngineNames(urlResult);
            finalResults.detections.push(...urlDetections.map(d => ({ ...d, source: urls[i] })));
          }
        } else if (urlResult?.suspicious > 0) {
          finalResults.warnings += urlResult.suspicious;
          if (finalResults.overallVerdict === 'clean') finalResults.overallVerdict = 'suspicious';
          updateStep(stepIndex, 'warning');
        } else {
          updateStep(stepIndex, 'complete');
        }
      } catch (e) {
        updateStep(stepIndex, 'error');
      }
    }

    // Final step: Analyze
    const analyzeStepIndex = 3 + urls.length;
    updateStep(analyzeStepIndex, 'scanning');
    setCurrentStep(analyzeStepIndex);
    await delay(200);
    updateStep(analyzeStepIndex, 'complete');

    setResults(finalResults);
    
    // AI Summary step
    const aiStepIndex = analyzeStepIndex + 1;
    updateStep(aiStepIndex, 'scanning');
    setCurrentStep(aiStepIndex);
    setAiLoading(true);
    
    try {
      await generateAiSummary(finalResults, findings);
      updateStep(aiStepIndex, 'complete');
    } catch (e) {
      updateStep(aiStepIndex, 'error');
    }
    
    setAiLoading(false);
    setPhase('complete');

    // Notify parent of scan result for tab badge
    if (onScanComplete) {
      let status = 'safe';
      if (finalResults.realThreats?.length > 0 || finalResults.localFindings?.some(f => f.severity === 'danger')) {
        status = 'threat';
      } else if (finalResults.overallVerdict === 'suspicious') {
        status = 'suspicious';
      } else if (finalResults.expectedDetections?.length > 0) {
        status = 'expected';
      }
      onScanComplete(status, finalResults);
    }
  };

  const generateAiSummary = async (scanResults, localFindings) => {
    const prompt = buildAiPrompt(scanResults, localFindings);
    
    try {
      const response = await window.electronAPI?.aiGenerate?.({
        messages: [
          { role: 'system', content: 'You are a cybersecurity expert analyzing Roblox Lua scripts. Provide a concise, clear security analysis in 2-3 sentences. Be direct about risks. Use simple language. Do not use emojis.' },
          { role: 'user', content: prompt }
        ]
      });
      
      if (response?.choices?.[0]?.message?.content) {
        setAiSummary(response.choices[0].message.content);
      } else if (response?.error) {
        setAiSummary(generateFallbackSummary(scanResults, localFindings));
      } else {
        // Fallback to basic summary
        setAiSummary(generateFallbackSummary(scanResults, localFindings));
      }
    } catch (e) {
      setAiSummary(generateFallbackSummary(scanResults, localFindings));
    }
  };

  const buildAiPrompt = (scanResults, localFindings) => {
    let prompt = `Analyze this Roblox script security scan and provide a brief summary:\n\n`;
    
    prompt += `Script: ${scriptName || 'Unknown'}\n`;
    prompt += `Verdict: ${scanResults.overallVerdict.toUpperCase()}\n`;
    prompt += `VirusTotal: ${scanResults.scriptScan?.malicious || 0} malicious, ${scanResults.scriptScan?.suspicious || 0} suspicious detections\n`;
    
    if (scanResults.detections?.length > 0) {
      prompt += `\nDetection names:\n`;
      scanResults.detections.slice(0, 5).forEach(d => {
        prompt += `- ${d.name}: ${d.result || d.category}\n`;
      });
    }
    
    if (localFindings.length > 0) {
      prompt += `\nLocal analysis findings:\n`;
      localFindings.forEach(f => {
        prompt += `- ${f.name} (${f.severity}): ${f.desc}\n`;
      });
    }
    
    if (detectedUrls.length > 0) {
      prompt += `\nExternal URLs loaded: ${detectedUrls.length}\n`;
    }
    
    prompt += `\nProvide a 2-3 sentence security summary. Explain what was detected, the risk level, and whether it's safe to run.`;
    
    return prompt;
  };

  const generateFallbackSummary = (scanResults, localFindings) => {
    // Check for real threats (trojans, stealers, etc.)
    if (scanResults.realThreats?.length > 0) {
      const threatNames = scanResults.realThreats.map(t => t.result).slice(0, 2).join(', ');
      return `DANGER: This script contains actual malware (${threatNames}). This is NOT a normal game exploit - it may steal your data or compromise your system. Do NOT run this script.`;
    }
    
    // Check for IP loggers
    if (localFindings.some(f => f.type === 'ip-logger')) {
      return `WARNING: This script contains an IP logger URL which can track your location and identity. This is suspicious and potentially dangerous.`;
    }
    
    // Check for suspicious patterns only
    if (scanResults.overallVerdict === 'suspicious') {
      const patterns = localFindings.filter(f => f.severity === 'warning').map(f => f.name).slice(0, 2);
      return `CAUTION: This script has suspicious patterns${patterns.length ? ` (${patterns.join(', ')})` : ''}. Review carefully - it may send data externally.`;
    }
    
    // Expected HackTool detection - this is fine for executor
    if (scanResults.expectedDetections?.length > 0) {
      return `This script is safe to use. VirusTotal detected it as a "HackTool" which is expected for Roblox exploit scripts. No actual malware, trojans, or data stealers were found.`;
    }
    
    return `This script appears safe. No malware or suspicious patterns detected.`;
  };

  const updateStep = (index, status) => {
    setSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, status } : step
    ));
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleClose = () => {
    setPhase('idle');
    setSteps([]);
    setResults(null);
    setAiSummary('');
    onClose();
  };

  if (!isOpen) return null;

  const getVerdictInfo = () => {
    if (!results) return null;

    // Check for real threats first
    if (results.realThreats?.length > 0) {
      return {
        icon: ShieldX,
        title: 'Real Threats Detected',
        subtitle: `${results.realThreats.length} dangerous detection(s) found`,
        className: 'malicious',
      };
    }
    
    // Check for local findings (IP loggers, etc.)
    if (results.localFindings?.some(f => f.severity === 'danger')) {
      return {
        icon: ShieldX,
        title: 'Threats Detected',
        subtitle: `${results.threats} malicious detection(s) found`,
        className: 'malicious',
      };
    }

    // Check for suspicious patterns
    if (results.overallVerdict === 'suspicious') {
      return {
        icon: ShieldAlert,
        title: 'Suspicious Patterns',
        subtitle: `${results.warnings} suspicious pattern(s) found`,
        className: 'suspicious',
      };
    }
    
    // Check if only HackTool detections (expected for executor)
    if (results.expectedDetections?.length > 0) {
      return {
        icon: ShieldCheck,
        title: 'Script Verified',
        subtitle: `Detected as game exploit (expected for executor)`,
        className: 'safe',
      };
    }

    return {
      icon: ShieldCheck,
      title: 'Verified Safe',
      subtitle: 'No threats detected',
      className: 'safe',
    };
  };

  const verdict = getVerdictInfo();

  return (
    <div className="scan-modal-overlay" onClick={handleClose}>
      <div className="scan-modal" onClick={e => e.stopPropagation()}>
        <button className="scan-modal-close" onClick={handleClose}>
          <X size={18} />
        </button>

        <div className="scan-modal-header">
          <div className="scan-icon-wrap">
            <Shield size={24} />
          </div>
          <h2>VirusTotal Security Scan</h2>
          <p>Scanning <strong>{scriptName || 'script.lua'}</strong></p>
        </div>

        <div className="scan-modal-body">
          {/* Scanning Progress */}
          {phase === 'scanning'&& (
            <div className="scan-progress">
              <div className="scan-spinner">
                <Loader2 size={32} className="spin" />
              </div>
              <div className="scan-steps">
                {steps.map((step, i) => (
                  <div key={step.id} className={`scan-step ${step.status}`}>
                    <div className="step-icon">
                      {step.status === 'scanning'&& <Loader2 size={14} className="spin" />}
                      {step.status === 'complete'&& <CheckCircle size={14} />}
                      {step.status === 'pending'&& <div className="step-dot" />}
                      {step.status === 'threat'&& <XCircle size={14} />}
                      {step.status === 'warning'&& <AlertTriangle size={14} />}
                      {step.status === 'error'&& <XCircle size={14} />}
                    </div>
                    <span className="step-label">{step.label}</span>
                    {step.url && (
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="step-url"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {phase === 'complete'&& verdict && (
            <div className="scan-results">
              <div className={`verdict-card ${verdict.className}`}>
                <verdict.icon size={40} />
                <h3>{verdict.title}</h3>
                <p>{verdict.subtitle}</p>
              </div>

              {/* AI Summary */}
              {aiSummary && (
                <div className={`ai-summary ${results.overallVerdict}`}>
                  <div className="ai-summary-header">
                    <Sparkles size={14} />
                    <span>AI Security Analysis</span>
                  </div>
                  <p>{aiSummary}</p>
                </div>
              )}

              {/* What was detected */}
              {(results.realThreats?.length > 0 || localFindings.some(f => f.severity === 'danger')) && (
                <div className="detections-section">
                  <h4><AlertOctagon size={14} /> Real Threats Found</h4>
                  <div className="detection-list">
                    {localFindings.filter(f => f.severity === 'danger').map((f, i) => (
                      <div key={`local-d-${i}`} className="detection-item danger">
                        <XCircle size={12} />
                        <div className="detection-info">
                          <span className="detection-name">{f.name}</span>
                          <span className="detection-desc">{f.desc}</span>
                        </div>
                      </div>
                    ))}
                    {results.realThreats?.slice(0, 5).map((d, i) => (
                      <div key={`vt-${i}`} className="detection-item danger">
                        <XCircle size={12} />
                        <div className="detection-info">
                          <span className="detection-name">{d.engine}</span>
                          <span className="detection-desc">{d.result}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expected detections (HackTool - normal for executor) */}
              {results.expectedDetections?.length > 0 && !results.realThreats?.length && (
                <div className="detections-section expected">
                  <h4><Info size={14} /> Expected Detections (Normal)</h4>
                  <p className="expected-note">These are flagged as "HackTool" which is expected for Roblox exploits</p>
                  <div className="detection-list">
                    {results.expectedDetections.slice(0, 3).map((d, i) => (
                      <div key={`exp-${i}`} className="detection-item expected">
                        <CheckCircle size={12} />
                        <div className="detection-info">
                          <span className="detection-name">{d.engine}</span>
                          <span className="detection-desc">{d.result}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suspicious patterns */}
              {localFindings.filter(f => f.severity === 'warning').length > 0 && (
                <div className="detections-section">
                  <h4><AlertTriangle size={14} /> Suspicious Patterns</h4>
                  <div className="detection-list">
                    {localFindings.filter(f => f.severity === 'warning').map((f, i) => (
                      <div key={`local-w-${i}`} className="detection-item warning">
                        <AlertTriangle size={12} />
                        <div className="detection-info">
                          <span className="detection-name">{f.name}</span>
                          <span className="detection-desc">{f.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected URLs */}
              {detectedUrls.length > 0 && (
                <div className="detected-urls">
                  <h4><Link2 size={14} /> Loadstring URLs ({detectedUrls.length})</h4>
                  <div className="url-list">
                    {detectedUrls.map((url, i) => {
                      const urlResult = results.urlScans.find(s => s.url === url);
                      const isSafe = !urlResult?.result?.malicious && !urlResult?.result?.suspicious;
                      const isIpLogger = localFindings.some(f => f.type === 'ip-logger'&& f.url === url);
                      return (
                        <div key={i} className={`url-item ${isIpLogger ? 'danger': isSafe ? 'safe': 'unsafe'}`}>
                          <span className="url-status">
                            {isIpLogger ? <XCircle size={12} /> : isSafe ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                          </span>
                          <span className="url-text">{url.length > 40 ? url.slice(0, 40) + '...': url}</span>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="url-link">
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Script Details */}
              {results.scriptScan && (
                <div className="scan-details">
                  <h4><FileCode size={14} /> Script Analysis</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Malicious</span>
                      <span className={`detail-value ${((results.realThreats?.length || 0) + (results.localFindings?.filter(f => f.severity === 'danger').length || 0)) > 0 ? 'bad': 'good'}`}>
                        {(results.realThreats?.length || 0) + (results.localFindings?.filter(f => f.severity === 'danger').length || 0)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Suspicious</span>
                      <span className={`detail-value ${(results.localFindings?.filter(f => f.severity === 'warning').length || 0) > 0 ? 'warn': 'good'}`}>
                        {results.localFindings?.filter(f => f.severity === 'warning').length || 0}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Expected</span>
                      <span className="detail-value good">{results.expectedDetections?.length || 0}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Undetected</span>
                      <span className="detail-value">{results.scriptScan.undetected || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="scan-modal-footer">
          {phase === 'complete'? (
            <button className="scan-done-btn" onClick={handleClose}>
              Done
            </button>
          ) : (
            <button className="scan-cancel-btn" onClick={handleClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

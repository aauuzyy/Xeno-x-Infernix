import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Loader2, Scan } from 'lucide-react';
import './SecurityBadge.css';

export default function SecurityBadge({ script, scriptName, compact = false, onScanComplete }) {
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Check for cached result on mount or script change
  useEffect(() => {
    if (!script) return;
    
    const checkCached = async () => {
      try {
        const cached = await window.electronAPI?.virusTotalCached?.(script);
        if (cached) {
          setScanResult(cached);
          onScanComplete?.(cached);
        }
      } catch (e) {
        console.error('Failed to check cache:', e);
      }
    };
    
    checkCached();
  }, [script]);

  const handleScan = async () => {
    if (!script || scanning) return;
    
    setScanning(true);
    setScanResult(null);
    
    try {
      const result = await window.electronAPI?.virusTotalScan?.(script, scriptName || 'script.lua');
      setScanResult(result);
      onScanComplete?.(result);
      
      // If pending, poll for results
      if (result?.pending && result?.analysisId) {
        pollForResults(result.analysisId);
      }
    } catch (e) {
      setScanResult({ scanned: false, error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const pollForResults = async (analysisId, attempts = 0) => {
    if (attempts > 10) return; // Max 10 attempts (about 30 seconds)
    
    setTimeout(async () => {
      try {
        const result = await window.electronAPI?.virusTotalCheck?.(analysisId);
        if (result?.completed) {
          setScanResult({ ...result, scanned: true, pending: false });
          onScanComplete?.(result);
        } else {
          pollForResults(analysisId, attempts + 1);
        }
      } catch (e) {
        console.error('Poll failed:', e);
      }
    }, 3000);
  };

  const getStatusInfo = () => {
    if (scanning) {
      return {
        icon: Loader2,
        text: 'Scanning...',
        className: 'scanning',
        spin: true,
      };
    }
    
    if (!scanResult) {
      return {
        icon: Shield,
        text: compact ? 'Scan': 'Scan Script',
        className: 'unscan',
        action: handleScan,
      };
    }
    
    if (scanResult.pending) {
      return {
        icon: Loader2,
        text: 'Analyzing...',
        className: 'pending',
        spin: true,
      };
    }
    
    if (scanResult.error) {
      return {
        icon: ShieldAlert,
        text: 'Scan Failed',
        className: 'error',
        action: handleScan,
      };
    }
    
    if (scanResult.verdict === 'malicious') {
      return {
        icon: ShieldX,
        text: `${scanResult.malicious} Threats`,
        className: 'malicious',
      };
    }
    
    if (scanResult.verdict === 'suspicious') {
      return {
        icon: ShieldAlert,
        text: 'Suspicious',
        className: 'suspicious',
      };
    }
    
    return {
      icon: ShieldCheck,
      text: compact ? 'Safe': 'Verified Safe',
      className: 'safe',
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <div className="security-badge-wrapper">
      <button
        className={`security-badge ${status.className} ${compact ? 'compact': ''}`}
        onClick={status.action || (() => setShowDetails(!showDetails))}
        disabled={scanning}
        title={scanResult?.error || (scanResult?.scanned ? 'Click for details': 'Scan with VirusTotal')}
      >
        <Icon size={compact ? 12 : 14} className={status.spin ? 'spin': ''} />
        <span>{status.text}</span>
      </button>

      {/* Details Popup */}
      {showDetails && scanResult?.scanned && !scanResult.pending && (
        <div className="security-details">
          <div className="security-details-header">
            <Scan size={14} />
            <span>VirusTotal Scan Results</span>
          </div>
          <div className="security-details-body">
            <div className="scan-stat">
              <span className="stat-label">Malicious</span>
              <span className={`stat-value ${scanResult.malicious > 0 ? 'bad': 'good'}`}>
                {scanResult.malicious || 0}
              </span>
            </div>
            <div className="scan-stat">
              <span className="stat-label">Suspicious</span>
              <span className={`stat-value ${scanResult.suspicious > 0 ? 'warn': 'good'}`}>
                {scanResult.suspicious || 0}
              </span>
            </div>
            <div className="scan-stat">
              <span className="stat-label">Clean</span>
              <span className="stat-value good">{scanResult.harmless || 0}</span>
            </div>
            <div className="scan-stat">
              <span className="stat-label">Undetected</span>
              <span className="stat-value">{scanResult.undetected || 0}</span>
            </div>
          </div>
          <div className="security-details-footer">
            <span className="hash-label">SHA-256:</span>
            <span className="hash-value">{scanResult.hash?.slice(0, 16)}...</span>
          </div>
          <button className="rescan-btn" onClick={handleScan}>
            <Scan size={12} />
            Rescan
          </button>
        </div>
      )}
    </div>
  );
}

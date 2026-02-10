import React, { useState, useEffect } from 'react';
import './UpdateModal.css';

const UpdateModal = ({ isOpen, onClose, updateInfo, isBlocking }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedSize, setDownloadedSize] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    // Listen for download progress
    const handleProgress = (progress) => {
      setDownloadProgress(progress.percent);
      setDownloadedSize(progress.downloaded);
      setTotalSize(progress.total);
    };

    // Listen for download complete
    const handleComplete = () => {
      setStatus('Installing update... Infernix will restart shortly.');
      setDownloadProgress(100);
    };

    // Listen for errors
    const handleError = (errorMsg) => {
      setError(errorMsg);
      setIsDownloading(false);
    };

    if (window.electronAPI) {
      window.electronAPI.onUpdateProgress(handleProgress);
      window.electronAPI.onUpdateComplete(handleComplete);
      window.electronAPI.onUpdateError(handleError);
    }

    return () => {
      if (window.electronAPI?.removeUpdateListeners) {
        window.electronAPI.removeUpdateListeners();
      }
    };
  }, [isOpen]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ''+ sizes[i];
  };

  const handleUpdateNow = async () => {
    setIsDownloading(true);
    setStatus('Downloading update...');
    setError(null);
    
    try {
      const result = await window.electronAPI.downloadUpdate(updateInfo.downloadUrl);
      if (!result.ok) {
        throw new Error(result.error || 'Download failed');
      }
    } catch (e) {
      setError(e.message);
      setIsDownloading(false);
    }
  };

  const handleLater = () => {
    if (!isBlocking) {
      onClose();
    }
  };

  if (!isOpen || !updateInfo) return null;

  return (
    <div className="update-modal-overlay">
      <div className="update-modal">
        {/* Animated background */}
        <div className="update-bg-animation">
          <div className="fire-particle p1"></div>
          <div className="fire-particle p2"></div>
          <div className="fire-particle p3"></div>
          <div className="fire-particle p4"></div>
          <div className="fire-particle p5"></div>
        </div>

        {/* Header */}
        <div className="update-header">
          <div className="update-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <h2>Update Available</h2>
        </div>

        {/* Version info */}
        <div className="update-version-info">
          <div className="version-badge current">v{updateInfo.currentVersion}</div>
          <div className="version-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
          <div className="version-badge new">v{updateInfo.latestVersion}</div>
        </div>

        {/* Release name */}
        <div className="update-release-name">
          {updateInfo.releaseName || `Infernix v${updateInfo.latestVersion}`}
        </div>

        {/* Changes */}
        {updateInfo.releaseNotes && (
          <div className="update-changes">
            <h4>What's New</h4>
            <div className="changes-content">
              {updateInfo.releaseNotes}
            </div>
          </div>
        )}

        {/* Download progress */}
        {isDownloading && (
          <div className="download-progress-section">
            <div className="progress-status">{status}</div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${downloadProgress}%` }}
              />
              <div className="progress-glow" style={{ left: `${downloadProgress}%` }} />
            </div>
            <div className="progress-details">
              <span>{downloadProgress.toFixed(1)}%</span>
              {totalSize > 0 && (
                <span>{formatBytes(downloadedSize)} / {formatBytes(totalSize)}</span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="update-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Buttons */}
        {!isDownloading && (
          <div className="update-buttons">
            <button className="update-btn primary" onClick={handleUpdateNow}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Update Now
            </button>
            {!isBlocking && (
              <button className="update-btn secondary" onClick={handleLater}>
                Later
              </button>
            )}
          </div>
        )}

        {/* Downloading state */}
        {isDownloading && (
          <div className="update-downloading-message">
            <div className="spinner"></div>
            <span>Please wait while Infernix updates...</span>
          </div>
        )}

        {/* Mandatory notice */}
        <div className="update-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{isBlocking ? 'This update is required to continue using Infernix': 'Updates include important fixes and new features'}</span>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;

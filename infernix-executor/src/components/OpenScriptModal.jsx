import { useState, useEffect } from 'react';
import { X, FolderOpen, FileText, Trash2, Clock, Search, RefreshCw } from 'lucide-react';
import './ScriptModal.css';

function OpenScriptModal({ isOpen, onClose, onOpen }) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScript, setSelectedScript] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadScripts();
    }
  }, [isOpen]);

  const loadScripts = async () => {
    setLoading(true);
    try {
      const saved = await window.electronAPI?.getSavedScripts();
      setScripts(saved || []);
    } catch (e) {
      console.error('Failed to load scripts:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredScripts = scripts.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpen = async (script) => {
    try {
      const result = await window.electronAPI?.loadScript(script.path);
      if (result?.ok) {
        onOpen(script.name, result.content);
        onClose();
      }
    } catch (e) {
      console.error('Failed to open script:', e);
    }
  };

  const handleDelete = async (e, script) => {
    e.stopPropagation();
    if (deleting) return;
    
    setDeleting(script.path);
    try {
      await window.electronAPI?.deleteScript(script.path);
      setScripts(prev => prev.filter(s => s.path !== script.path));
      if (selectedScript?.path === script.path) {
        setSelectedScript(null);
      }
    } catch (e) {
      console.error('Failed to delete script:', e);
    } finally {
      setDeleting(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter'&& selectedScript) {
      handleOpen(selectedScript);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-container open-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FolderOpen size={20} />
            <h2>Open Script</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-toolbar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scripts..."
              autoFocus
            />
          </div>
          <button className="toolbar-btn" onClick={loadScripts} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spinning': ''} />
          </button>
        </div>

        <div className="modal-body scripts-list">
          {loading ? (
            <div className="scripts-loading">
              <RefreshCw size={24} className="spinning" />
              <span>Loading scripts...</span>
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="scripts-empty">
              <FileText size={40} />
              <h3>{searchQuery ? 'No matching scripts': 'No saved scripts'}</h3>
              <p>{searchQuery ? 'Try a different search term': 'Save a script to see it here'}</p>
            </div>
          ) : (
            filteredScripts.map(script => (
              <div 
                key={script.path}
                className={`script-item ${selectedScript?.path === script.path ? 'selected': ''}`}
                onClick={() => setSelectedScript(script)}
                onDoubleClick={() => handleOpen(script)}
              >
                <div className="script-icon">
                  <FileText size={20} />
                </div>
                <div className="script-info">
                  <div className="script-name">{script.name}</div>
                  {script.description && (
                    <div className="script-description">{script.description}</div>
                  )}
                  <div className="script-meta">
                    <span className="script-date">
                      <Clock size={12} />
                      {formatDate(script.savedAt)}
                    </span>
                    <span className="script-size">{formatSize(script.size)}</span>
                  </div>
                </div>
                <button 
                  className="script-delete"
                  onClick={(e) => handleDelete(e, script)}
                  disabled={deleting === script.path}
                  title="Delete script"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="modal-btn secondary" 
            onClick={() => window.electronAPI?.openScriptsDir()}
          >
            Open Folder
          </button>
          <div className="footer-right">
            <button className="modal-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="modal-btn primary" 
              onClick={() => selectedScript && handleOpen(selectedScript)}
              disabled={!selectedScript}
            >
              Open Script
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpenScriptModal;

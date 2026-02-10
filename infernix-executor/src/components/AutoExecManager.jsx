import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, Play, Check, X, FileText, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import './AutoExecManager.css';

function AutoExecManager({ tabs, onClose }) {
  const [selectedTabs, setSelectedTabs] = useState([]);
  const [autoExecScripts, setAutoExecScripts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load existing autoexec scripts
  useEffect(() => {
    loadAutoExecScripts();
  }, []);

  const loadAutoExecScripts = async () => {
    try {
      const scripts = await window.electronAPI?.getAutoExecScripts?.();
      setAutoExecScripts(scripts || []);
    } catch (e) {
      console.error('Failed to load autoexec scripts:', e);
    }
  };

  const toggleTabSelection = (tabId) => {
    setSelectedTabs(prev =>
      prev.includes(tabId)
        ? prev.filter(id => id !== tabId)
        : [...prev, tabId]
    );
  };

  const selectAll = () => {
    setSelectedTabs((tabs || []).map(t => t.id));
  };

  const deselectAll = () => {
    setSelectedTabs([]);
  };

  const addToAutoExec = async () => {
    if (selectedTabs.length === 0) return;

    setLoading(true);
    try {
      for (const tabId of selectedTabs) {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
          await window.electronAPI?.addToAutoExec?.({
            name: tab.name,
            content: tab.content
          });
        }
      }
      await loadAutoExecScripts();
      setSelectedTabs([]);
    } catch (e) {
      console.error('Failed to add to autoexec:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeFromAutoExec = async (scriptName) => {
    try {
      await window.electronAPI?.removeFromAutoExec?.(scriptName);
      await loadAutoExecScripts();
    } catch (e) {
      console.error('Failed to remove from autoexec:', e);
    }
  };

  const openAutoExecFolder = async () => {
    await window.electronAPI?.openAutoexecDir?.();
  };

  return (
    <div className="autoexec-modal-overlay" onClick={onClose}>
      <div className="autoexec-modal" onClick={(e) => e.stopPropagation()}>
        <div className="autoexec-header">
          <div className="header-title">
            <Zap size={20} className="header-icon" />
            <h2>AutoExec Manager</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="autoexec-content">
          {/* Left Panel - Open Tabs */}
          <div className="autoexec-panel">
            <div className="panel-header">
              <div className="panel-title">
                <FileText size={16} />
                <h3>Open Tabs</h3>
              </div>
              <div className="panel-actions">
                <button onClick={selectAll} className="mini-btn">Select All</button>
                <button onClick={deselectAll} className="mini-btn">Clear</button>
              </div>
            </div>

            <div className="tabs-list">
              {(tabs || []).length === 0 ? (
                <div className="empty-state">
                  <FileText size={32} className="empty-icon" />
                  <p>No open tabs</p>
                  <span className="muted">Open scripts in the editor first</span>
                </div>
              ) : (
                (tabs || []).map(tab => (
                  <div
                    key={tab.id}
                    className={`tab-item ${selectedTabs.includes(tab.id) ? 'selected': ''}`}
                    onClick={() => toggleTabSelection(tab.id)}
                  >
                    <div className="tab-checkbox">
                      {selectedTabs.includes(tab.id) && <Check size={12} />}
                    </div>
                    <div className="tab-info">
                      <span className="tab-name">{tab.name}</span>
                      <span className="tab-preview">
                        {(tab.content || '').split('\n')[0].substring(0, 40) || 'Empty script'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              className="add-btn"
              onClick={addToAutoExec}
              disabled={selectedTabs.length === 0 || loading}
            >
              <Plus size={16} />
              {loading ? 'Adding...': `Add to AutoExec ${selectedTabs.length > 0 ? `(${selectedTabs.length})` : ''}`}
            </button>
          </div>

          {/* Right Panel - AutoExec Scripts */}
          <div className="autoexec-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Play size={16} />
                <h3>AutoExec Scripts</h3>
              </div>
              <div className="panel-actions">
                <button onClick={loadAutoExecScripts} className="mini-btn icon-btn" title="Refresh">
                  <RefreshCw size={14} />
                </button>
                <button onClick={openAutoExecFolder} className="mini-btn">
                  <FolderOpen size={14} />
                  Open Folder
                </button>
              </div>
            </div>

            <div className="autoexec-list">
              {autoExecScripts.length === 0 ? (
                <div className="empty-state">
                  <Zap size={32} className="empty-icon" />
                  <p>No AutoExec scripts</p>
                  <span className="muted">Add scripts from open tabs to run them automatically when joining a game</span>
                </div>
              ) : (
                autoExecScripts.map((script, index) => (
                  <div key={index} className="autoexec-item">
                    <div className="script-icon">
                      <FileText size={16} />
                    </div>
                    <div className="script-info">
                      <span className="script-name">{script.name}</span>
                      <span className="script-status">Ready to execute</span>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => removeFromAutoExec(script.name)}
                      title="Remove from AutoExec"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="autoexec-footer">
              <div className="info-badge">
                <Zap size={14} />
                <span>Scripts execute automatically when you join a game</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutoExecManager;
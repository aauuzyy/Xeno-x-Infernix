import { useState, useEffect } from 'react';
import { X, History, Play, Trash2, Clock, FileCode, CheckCircle, XCircle, RotateCcw, Search, Filter, Flame } from 'lucide-react';
import './ExecutionHistory.css';

export default function ExecutionHistory({ isOpen, onClose, onRerun }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'success', 'failed'
  const [selectedItems, setSelectedItems] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI?.getExecutionHistory?.();
      setHistory(data || []);
    } catch (e) {
      console.error('Failed to load history:', e);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      setClosing(false);
      setSelectedItems(new Set());
    }, 200);
  };

  const handleRerun = async (item) => {
    if (onRerun) {
      onRerun(item.script, item.scriptName);
    }
    handleClose();
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all execution history?')) return;
    try {
      await window.electronAPI?.clearExecutionHistory?.();
      setHistory([]);
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;
    
    try {
      const idsToDelete = Array.from(selectedItems);
      await window.electronAPI?.deleteHistoryItems?.(idsToDelete);
      setHistory(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
    } catch (e) {
      console.error('Failed to delete items:', e);
    }
  };

  const toggleSelect = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than a minute
    if (diff < 60000) return 'Just now';
    // Less than an hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Less than a day
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Otherwise show date
    return date.toLocaleDateString() + ''+ date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
  };

  const truncateScript = (script, maxLength = 100) => {
    if (!script) return '';
    const firstLine = script.split('\n')[0];
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.substring(0, maxLength) + '...';
  };

  const filteredHistory = history.filter(item => {
    // Filter by status
    if (filter === 'success'&& !item.success) return false;
    if (filter === 'failed'&& item.success) return false;
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = item.scriptName?.toLowerCase().includes(query);
      const scriptMatch = item.script?.toLowerCase().includes(query);
      if (!nameMatch && !scriptMatch) return false;
    }
    
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className={`history-modal-overlay ${closing ? 'closing': ''}`} onClick={handleClose}>
      <div className={`history-modal ${closing ? 'closing': ''}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-title">
            <div className="history-icon">
              <History size={20} />
            </div>
            <div className="history-title-text">
              <h2>Execution History</h2>
              <span className="history-count">{history.length} executions</span>
            </div>
          </div>
          <button className="history-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="history-toolbar">
          <div className="history-search">
            <Search size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search scripts..."
            />
          </div>
          
          <div className="history-filters">
            <button 
              className={`filter-btn ${filter === 'all'? 'active': ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn success ${filter === 'success'? 'active': ''}`}
              onClick={() => setFilter('success')}
            >
              <CheckCircle size={13} />
              Success
            </button>
            <button 
              className={`filter-btn failed ${filter === 'failed'? 'active': ''}`}
              onClick={() => setFilter('failed')}
            >
              <XCircle size={13} />
              Failed
            </button>
          </div>
        </div>

        {/* Actions Bar */}
        {(selectedItems.size > 0 || history.length > 0) && (
          <div className="history-actions">
            {selectedItems.size > 0 ? (
              <button className="action-btn delete" onClick={handleDeleteSelected}>
                <Trash2 size={14} />
                Delete Selected ({selectedItems.size})
              </button>
            ) : (
              <button className="action-btn clear" onClick={handleClearHistory}>
                <Trash2 size={14} />
                Clear All
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="history-modal-content">
          {loading ? (
            <div className="history-loading">
              <div className="loading-spinner" />
              <span>Loading history...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="history-empty">
              <div className="empty-icon">
                <History size={48} />
              </div>
              <h3>No executions yet</h3>
              <p>Scripts you execute will appear here</p>
            </div>
          ) : (
            <div className="history-list">
              {filteredHistory.map((item, index) => (
                <div 
                  key={item.id || index} 
                  className={`history-item ${selectedItems.has(item.id) ? 'selected': ''} ${item.success ? 'success': 'failed'}`}
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => toggleSelect(item.id)}
                >
                  <div className="item-checkbox">
                    <div className={`checkbox ${selectedItems.has(item.id) ? 'checked': ''}`}>
                      {selectedItems.has(item.id) && <CheckCircle size={12} />}
                    </div>
                  </div>
                  
                  <div className="item-status">
                    {item.success ? (
                      <div className="status-badge success">
                        <CheckCircle size={14} />
                      </div>
                    ) : (
                      <div className="status-badge failed">
                        <XCircle size={14} />
                      </div>
                    )}
                  </div>
                  
                  <div className="item-info">
                    <div className="item-name">
                      <FileCode size={14} />
                      <span>{item.scriptName || 'Untitled Script'}</span>
                    </div>
                    <div className="item-preview">{truncateScript(item.script)}</div>
                    <div className="item-meta">
                      <span className="meta-time">
                        <Clock size={12} />
                        {formatTime(item.timestamp)}
                      </span>
                      {item.client && (
                        <span className="meta-client">
                          <Flame size={12} />
                          {item.client}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    className="item-rerun"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRerun(item);
                    }}
                    title="Re-run this script"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {history.length > 0 && (
          <div className="history-footer">
            <div className="footer-stat">
              <CheckCircle size={14} className="success" />
              <span>{history.filter(h => h.success).length} successful</span>
            </div>
            <div className="footer-stat">
              <XCircle size={14} className="failed" />
              <span>{history.filter(h => !h.success).length} failed</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

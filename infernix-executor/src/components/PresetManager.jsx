import { useState, useEffect } from 'react';
import { X, Save, FolderOpen, Trash2, Package, FileText, Clock, Palette, Settings2, Check } from 'lucide-react';
import './PresetManager.css';

export default function PresetManager({
  isOpen,
  onClose,
  onLoad,
  currentSettings,
  currentTheme,
  currentTabs
}) {
  const [presets, setPresets] = useState([]);
  const [mode, setMode] = useState('load'); // 'load'or 'save'
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saveOptions, setSaveOptions] = useState({
    includeSettings: true,
    includeTheme: true,
    includeTabs: true
  });

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      loadPresets();
    }
  }, [isOpen]);

  const loadPresets = async () => {
    try {
      const list = await window.electronAPI?.getPresets();
      setPresets(list || []);
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      setClosing(false);
    }, 200);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    setLoading(true);

    try {
      const presetData = {
        name: newPresetName.trim(),
        description: newPresetDesc.trim(),
        settings: saveOptions.includeSettings ? currentSettings : null,
        theme: saveOptions.includeTheme ? currentTheme : null,
        tabs: saveOptions.includeTabs ? currentTabs : null
      };

      const result = await window.electronAPI?.savePreset(presetData);
      if (result?.ok) {
        setNewPresetName('');
        setNewPresetDesc('');
        await loadPresets();
        setMode('load');
      }
    } catch (e) {
      console.error('Failed to save preset:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = async (preset) => {
    setLoading(true);
    try {
      const result = await window.electronAPI?.loadPreset(preset.filePath);
      if (result?.ok && result.preset) {
        onLoad(result.preset);
        handleClose();
      }
    } catch (e) {
      console.error('Failed to load preset:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePreset = async (preset, e) => {
    e.stopPropagation();
    if (!confirm(`Delete preset "${preset.name}"?`)) return;

    try {
      await window.electronAPI?.deletePreset(preset.filePath);
      await loadPresets();
    } catch (e) {
      console.error('Failed to delete preset:', e);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ''+ date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
  };

  if (!isOpen) return null;

  return (
    <div className={`preset-modal-overlay ${closing ? 'closing': ''}`} onClick={handleClose}>
      <div className={`preset-modal ${closing ? 'closing': ''}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="preset-modal-header">
          <div className="preset-title">
            <div className="preset-icon">
              <Package size={20} />
            </div>
            <h2>Preset Manager</h2>
          </div>
          <button className="preset-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="preset-tabs">
          <button
            className={`preset-tab ${mode === 'load'? 'active': ''}`}
            onClick={() => setMode('load')}
          >
            <FolderOpen size={15} />
            Load Preset
          </button>
          <button
            className={`preset-tab ${mode === 'save'? 'active': ''}`}
            onClick={() => setMode('save')}
          >
            <Save size={15} />
            Save New
          </button>
        </div>

        {/* Content */}
        <div className="preset-modal-content">
          {mode === 'save'? (
            <div className="save-preset-form">
              <div className="form-group">
                <label>
                  <FileText size={14} />
                  Preset Name
                  <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder="My Awesome Preset"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>
                  <FileText size={14} />
                  Description
                  <span className="optional">(optional)</span>
                </label>
                <textarea
                  value={newPresetDesc}
                  onChange={e => setNewPresetDesc(e.target.value)}
                  placeholder="What this preset is for..."
                  rows={3}
                />
              </div>

              <div className="options-group">
                <label className="options-title">Include in preset:</label>
                
                <label className={`option-item ${saveOptions.includeSettings ? 'checked': ''}`}>
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={saveOptions.includeSettings}
                      onChange={e => setSaveOptions(prev => ({ ...prev, includeSettings: e.target.checked }))}
                    />
                    <div className="custom-checkbox">
                      {saveOptions.includeSettings && <Check size={12} />}
                    </div>
                  </div>
                  <Settings2 size={16} className="option-icon" />
                  <div className="option-text">
                    <span className="option-label">Settings</span>
                    <span className="option-desc">Auto-attach, notifications, etc.</span>
                  </div>
                </label>

                <label className={`option-item ${saveOptions.includeTheme ? 'checked': ''}`}>
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={saveOptions.includeTheme}
                      onChange={e => setSaveOptions(prev => ({ ...prev, includeTheme: e.target.checked }))}
                    />
                    <div className="custom-checkbox">
                      {saveOptions.includeTheme && <Check size={12} />}
                    </div>
                  </div>
                  <Palette size={16} className="option-icon" />
                  <div className="option-text">
                    <span className="option-label">Theme</span>
                    <span className="option-desc">Colors, accent, mode</span>
                  </div>
                </label>

                <label className={`option-item ${saveOptions.includeTabs ? 'checked': ''}`}>
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={saveOptions.includeTabs}
                      onChange={e => setSaveOptions(prev => ({ ...prev, includeTabs: e.target.checked }))}
                    />
                    <div className="custom-checkbox">
                      {saveOptions.includeTabs && <Check size={12} />}
                    </div>
                  </div>
                  <FileText size={16} className="option-icon" />
                  <div className="option-text">
                    <span className="option-label">Open Tabs</span>
                    <span className="option-desc">{currentTabs?.length || 0} current scripts</span>
                  </div>
                </label>
              </div>

              <button
                className="save-btn"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim() || loading}
              >
                <Save size={16} />
                {loading ? 'Saving...': 'Save Preset'}
              </button>
            </div>
          ) : (
            <div className="presets-list">
              {presets.length === 0 ? (
                <div className="presets-empty">
                  <div className="empty-icon">
                    <Package size={48} />
                  </div>
                  <h3>No presets saved</h3>
                  <p>Click "Save New" to create your first preset</p>
                </div>
              ) : (
                presets.map((preset, idx) => (
                  <div
                    key={idx}
                    className="preset-item"
                    onClick={() => handleLoadPreset(preset)}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="preset-item-icon">
                      <Package size={18} />
                    </div>
                    <div className="preset-item-info">
                      <span className="preset-item-name">{preset.name}</span>
                      {preset.description && (
                        <span className="preset-item-desc">{preset.description}</span>
                      )}
                      <div className="preset-item-meta">
                        {preset.settings && (
                          <span className="meta-tag">
                            <Settings2 size={11} /> Settings
                          </span>
                        )}
                        {preset.theme && (
                          <span className="meta-tag">
                            <Palette size={11} /> Theme
                          </span>
                        )}
                        {preset.tabs?.length > 0 && (
                          <span className="meta-tag">
                            <FileText size={11} /> {preset.tabs.length} tabs
                          </span>
                        )}
                        {preset.createdAt && (
                          <span className="meta-tag date">
                            <Clock size={11} /> {formatDate(preset.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="preset-delete-btn"
                      onClick={(e) => handleDeletePreset(preset, e)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

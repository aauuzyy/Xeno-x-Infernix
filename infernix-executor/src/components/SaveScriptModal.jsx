import { useState } from 'react';
import { X, Save, FileText, AlignLeft } from 'lucide-react';
import './ScriptModal.css';

function SaveScriptModal({ isOpen, onClose, onSave, defaultName }) {
  const [name, setName] = useState(defaultName || '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter'&& !e.shiftKey && name.trim()) {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container save-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Save size={20} />
            <h2>Save Script</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>
              <FileText size={14} />
              Script Name <span className="required">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter script name..."
              autoFocus
              maxLength={50}
            />
          </div>

          <div className="form-group">
            <label>
              <AlignLeft size={14} />
              Description <span className="optional">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this script does..."
              rows={3}
              maxLength={200}
            />
            <span className="char-count">{description.length}/200</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="modal-btn primary" 
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Saving...': 'Save Script'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveScriptModal;

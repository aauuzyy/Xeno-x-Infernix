import { Minus, Maximize2, X, Flame } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './TitleBar.css';

function TitleBar() {
  const { accentColor } = useTheme();
  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <div className="logo">
          <Flame size={20} style={{ color: accentColor }} />
          <span className="logo-name">Infernix</span>
        </div>
      </div>

      <div className="titlebar-drag" />

      <div className="titlebar-controls">
        <button className="control-btn" onClick={handleMinimize}><Minus size={14} /></button>
        <button className="control-btn" onClick={handleMaximize}><Maximize2 size={12} /></button>
        <button className="control-btn control-close" onClick={handleClose}><X size={14} /></button>
      </div>
    </header>
  );
}

export default TitleBar;

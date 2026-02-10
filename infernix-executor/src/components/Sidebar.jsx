import { LayoutDashboard, Code, Flame, Users, Settings, ChevronLeft, Zap } from 'lucide-react';
import './Sidebar.css';

function Sidebar({ activeView, onViewChange, collapsed, onToggleCollapse, clientCount }) {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard'},
    { id: 'executor', icon: Code, label: 'Executor'},
    { id: 'scripthub', icon: Flame, label: 'Scripthub'},
    { id: 'assistant', icon: Zap, label: 'Assistant', offline: true },
    { id: 'clients', icon: Users, label: 'Client Manager', badge: clientCount },
    { id: 'settings', icon: Settings, label: 'Settings'},
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed': ''}`}>
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active': ''} ${item.offline ? 'offline': ''}`}
              onClick={() => !item.offline && onViewChange(item.id)}
              disabled={item.offline}
            >
              <Icon size={18} />
              {!collapsed && <span className={`nav-label ${item.offline ? 'strikethrough': ''}`}>{item.label}</span>}
              {!collapsed && item.offline && <span className="offline-badge">Offline</span>}
              {!collapsed && item.badge > 0 && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <button className="collapse-btn" onClick={onToggleCollapse}>
        <ChevronLeft size={16} className={collapsed ? 'rotated': ''} />
      </button>
    </aside>
  );
}

export default Sidebar;
import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X, Flame, Zap } from 'lucide-react';
import './Notification.css';

function Notification({ notifications, onRemove }) {
  return (
    <div className="notification-container">
      {notifications.map(notif => (
        <NotificationItem key={notif.id} notification={notif} onRemove={onRemove} />
      ))}
    </div>
  );
}

function NotificationItem({ notification, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(notification.id), 300);
    }, notification.duration || 4000);

    return () => clearTimeout(timer);
  }, [notification, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(notification.id), 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle size={16} />;
      case 'error': return <AlertCircle size={16} />;
      case 'fire': return <Flame size={16} />;
      case 'ai': return <Zap size={16} />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className={`notification ${notification.type} ${isExiting ? 'exiting': ''}`}>
      <div className="notification-icon">{getIcon()}</div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        {notification.message && (
          <div className="notification-message">{notification.message}</div>
        )}
      </div>
      <button className="notification-close" onClick={handleClose}>
        <X size={14} />
      </button>
    </div>
  );
}

export default Notification;

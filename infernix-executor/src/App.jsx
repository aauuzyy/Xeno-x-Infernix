import { useState, useRef, useCallback, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EditorView from './components/EditorView';
import ScriptHub from './components/ScriptHub';
import ClientManager from './components/ClientManager';
import SettingsView from './components/SettingsView';
import Assistant from './components/Assistant';
import Notification from './components/Notification';
import UpdateModal from './components/UpdateModal';
import './App.css';

function App() {
  const [activeView, setActiveView] = useState('executor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState([]);
  const [executorVersion, setExecutorVersion] = useState('1.0.0');
  const [executionCount, setExecutionCount] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isBlockingUpdate, setIsBlockingUpdate] = useState(false);
  const [startTime] = useState(Date.now());

  // Listen for client updates from main process
  useEffect(() => {
    if (window.electronAPI?.onClientsUpdate) {
      window.electronAPI.onClientsUpdate((newClients) => {
        setClients(newClients || []);
      });
      
      // Get initial version
      window.electronAPI.getVersion?.().then((ver) => {
        setExecutorVersion(ver || '1.0.0');
      });
    }
    
    return () => {
      window.electronAPI?.removeClientsListener?.();
    };
  }, []);

  // Auto-check for updates on startup
  useEffect(() => {
    const checkForUpdates = async () => {
      if (window.electronAPI?.checkUpdates) {
        try {
          const result = await window.electronAPI.checkUpdates();
          if (result.hasUpdate) {
            setUpdateInfo(result);
            setShowUpdateModal(true);
            setIsBlockingUpdate(true); // Block app usage until updated
          }
        } catch (e) {
          console.error('Update check failed:', e);
        }
      }
    };
    
    // Check after a short delay to let the app initialize
    const timer = setTimeout(checkForUpdates, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Lifted tab state for cross-component access
  const [tabs, setTabs] = useState([
    { id: 1, name: 'Script 1', content: '-- Welcome to Infernix\nprint("Hello, World!")'}
  ]);
  const [activeTab, setActiveTab] = useState(1);
  const tabCounter = useRef(2);
  const [tabsLoaded, setTabsLoaded] = useState(false);

  // Load saved tabs on startup
  useEffect(() => {
    const loadSavedTabs = async () => {
      try {
        const savedTabs = await window.electronAPI?.loadTabs();
        if (savedTabs && savedTabs.tabs && savedTabs.tabs.length > 0) {
          setTabs(savedTabs.tabs);
          setActiveTab(savedTabs.activeTab || savedTabs.tabs[0].id);
          tabCounter.current = savedTabs.counter || (Math.max(...savedTabs.tabs.map(t => t.id)) + 1);
        }
      } catch (e) {
        console.error('Failed to load tabs:', e);
      } finally {
        setTabsLoaded(true);
      }
    };
    loadSavedTabs();
  }, []);


  // Save tabs whenever they change (debounced)
  useEffect(() => {
    if (!tabsLoaded) return; // Don't save until initial load is done
    
    const saveTimeout = setTimeout(() => {
      window.electronAPI?.saveTabs({
        tabs,
        activeTab,
        counter: tabCounter.current
      });
    }, 500);
    
    return () => clearTimeout(saveTimeout);
  }, [tabs, activeTab, tabsLoaded]);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const notificationId = useRef(0);

  const addNotification = useCallback((notif) => {
    const id = ++notificationId.current;
    setNotifications(prev => [...prev, { ...notif, id }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Tab operations
  const handleNewTab = (initialData = null) => {
    const newTab = {
      id: tabCounter.current++,
      name: initialData?.name || `Script ${tabCounter.current - 1}`,
      content: initialData?.content || '-- New Script\n'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newTab.id);
    return newTab.id;
  };

  const handleCloseTab = (tabId) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  const handleRenameTab = (tabId, newName) => {
    setTabs(tabs.map(t => 
      t.id === tabId ? { ...t, name: newName } : t
    ));
  };

  const handleCodeChange = (tabId, content) => {
    setTabs(tabs.map(t => 
      t.id === tabId ? { ...t, content } : t
    ));
  };

  // Update tab scan status for safety badges
  const handleUpdateTabScan = (tabId, scanStatus, scanResult = null) => {
    setTabs(tabs.map(t =>
      t.id === tabId ? { ...t, scanStatus, scanResult } : t
    ));
  };

  const handleSwitchToExecutor = (tabId) => {
    setActiveView('executor');
    if (tabId) {
      setActiveTab(tabId);
    }
  };

  const handleLoadScript = (scriptContent) => {
    const newTab = {
      id: tabCounter.current++,
      name: `Script ${tabCounter.current - 1}`,
      content: scriptContent
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newTab.id);
    setActiveView('executor');
    addNotification({
      type: 'success',
      title: 'Script Loaded',
      message: 'Script added to new tab'
    });
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard 
            clients={clients}
            executionCount={executionCount}
            scriptCount={tabs.length}
            startTime={startTime}
            onViewChange={setActiveView}
          />
        );
      case 'executor':
        return (
          <EditorView
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onNewTab={handleNewTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
            onCodeChange={handleCodeChange}
            onUpdateTabScan={handleUpdateTabScan}
            onNotify={addNotification}
            clients={clients}
          />
        );
      case 'scripthub':
        return <ScriptHub onLoadScript={handleLoadScript} clients={clients} />;
      case 'clients':
        return <ClientManager clients={clients} onNotify={addNotification} />;
      case 'settings':
        return (
          <SettingsView 
            tabs={tabs} 
            onNewTab={handleNewTab}
            onSwitchToExecutor={() => setActiveView('executor')}
          />
        );
      case 'assistant':
        return (
          <Assistant 
            tabs={tabs}
            onWriteToTab={handleWriteToTab}
            onSwitchToExecutor={handleSwitchToExecutor}
            onNotify={addNotification}
          />
        );
      default:
        return (
          <EditorView
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onNewTab={handleNewTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
            onCodeChange={handleCodeChange}
            onUpdateTabScan={handleUpdateTabScan}
            onNotify={addNotification}
            clients={clients}
          />
        );
    }
  };

  return (
    <ThemeProvider>
      <div className="app">
        <TitleBar />
        <div className="app-body">
          <Sidebar
            activeView={activeView}
            onViewChange={setActiveView}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            clientCount={clients.length}
          />
          <main className="main-view">
            {renderView()}
          </main>
        </div>
        <Notification notifications={notifications} onRemove={removeNotification} />
        
        {/* Update Modal - blocking when outdated */}
        {showUpdateModal && (
          <UpdateModal
            isOpen={showUpdateModal}
            onClose={() => {
              if (!isBlockingUpdate) {
                setShowUpdateModal(false);
              }
            }}
            updateInfo={updateInfo}
            isBlocking={isBlockingUpdate}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;



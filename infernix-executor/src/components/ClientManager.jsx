import { useState, useEffect, useRef } from 'react';
import { Zap, RefreshCw, Power, User, Gamepad2, Hash, Check, AlertCircle, Loader, CheckSquare, Square, XCircle, Unplug } from 'lucide-react';
import './ClientManager.css';

function ClientManager({ clients, onNotify }) {
  const [gameInfo, setGameInfo] = useState({});
  const [avatars, setAvatars] = useState({});
  const [userIds, setUserIds] = useState({});
  const [selectedPids, setSelectedPids] = useState(new Set());
  const gameInfoCache = useRef(new Map());
  const avatarCache = useRef(new Map());
  const userIdCache = useRef(new Map());

  // Parse client data - handles both array and object formats
  // PIDs must be strings like Xeno does
  const parseClient = (client) => {
    if (Array.isArray(client)) {
      // Array format: [pid, username, playerName, status, version, placeId]
      return {
        pid: String(client[0] ?? ''),
        username: client[1] || 'Unknown',
        playerName: client[2] || '',
        status: client[3] || 0,
        version: client[4] || '',
        placeId: client[5] || null
      };
    }
    // Object format
    return {
      pid: String(client.pid ?? ''),
      username: client.username || 'Unknown',
      playerName: client.playerName || client.displayName || '',
      status: client.status || 0,
      version: client.version || '',
      placeId: client.placeId || client.PlaceId || null
    };
  };

  // Fetch game info using main process proxy (avoids CORS)
  useEffect(() => {
    const fetchGameInfo = async () => {
      for (const client of clients) {
        const parsed = parseClient(client);
        const placeId = parsed.placeId;
        
        if (!placeId || placeId === 0) continue;
        const placeIdStr = String(placeId);
        
        if (gameInfoCache.current.has(placeIdStr)) {
          setGameInfo(prev => ({...prev, [placeId]: gameInfoCache.current.get(placeIdStr)}));
          continue;
        }

        try {
          // Use the main process proxy to avoid CORS
          const info = await window.electronAPI?.robloxGetGameInfo(placeId);
          if (info) {
            gameInfoCache.current.set(placeIdStr, info);
            setGameInfo(prev => ({...prev, [placeId]: info}));
          }
        } catch (e) {
          console.error('Failed to fetch game info:', e);
        }
      }
    };

    if (clients.length > 0) {
      fetchGameInfo();
    }
  }, [clients]);

  // Fetch avatars using main process proxy (avoids CORS)
  useEffect(() => {
    const fetchAvatars = async () => {
      for (const client of clients) {
        const parsed = parseClient(client);
        const username = parsed.username;
        
        if (!username || username === 'Unknown') continue;
        if (avatarCache.current.has(username)) {
          setAvatars(prev => ({...prev, [username]: avatarCache.current.get(username)}));
          continue;
        }

        try {
          // First get user ID
          let userId = userIdCache.current.get(username);
          if (!userId) {
            const userInfo = await window.electronAPI?.robloxGetUserInfo(username);
            if (userInfo?.id) {
              userId = userInfo.id;
              userIdCache.current.set(username, userId);
              setUserIds(prev => ({...prev, [username]: userId}));
            }
          }
          
          if (userId) {
            // Then get avatar
            const avatarUrl = await window.electronAPI?.robloxGetAvatar(userId);
            if (avatarUrl) {
              avatarCache.current.set(username, avatarUrl);
              setAvatars(prev => ({...prev, [username]: avatarUrl}));
            }
          }
        } catch (e) {
          console.error('Failed to fetch avatar:', e);
        }
      }
    };

    if (clients.length > 0) {
      fetchAvatars();
    }
  }, [clients]);

  const handleAttach = async () => {
    try {
      const result = await window.electronAPI?.attach();
      if (result?.ok) {
        onNotify?.({
          type: 'success',
          title: 'Attached',
          message: 'Successfully attached to Roblox'
        });
      } else {
        onNotify?.({
          type: 'error',
          title: 'Attach Failed',
          message: result?.error || 'Could not attach to Roblox'
        });
      }
    } catch (e) {
      onNotify?.({
        type: 'error',
        title: 'Attach Error',
        message: e.message
      });
    }
  };


  const handleUnattach = async () => {
    if (selectedPids.size === 0) {
      onNotify?.({
        type: 'warning',
        title: 'No Selection',
        message: 'Select a client to unattach'
      });
      return;
    }

    try {
      for (const pid of selectedPids) {
        await window.electronAPI?.unattach(pid);
      }
      onNotify?.({
        type: 'success',
        title: 'Unattached',
        message: 'Cleaned up '+ selectedPids.size + 'client(s) - UI destroyed'
      });
      setSelectedPids(new Set());
    } catch (e) {
      onNotify?.({
        type: 'error',
        title: 'Unattach Error',
        message: e.message
      });
    }
  };
  const handleKillAll = async () => {
    try {
      const result = await window.electronAPI?.killRoblox();
      if (result?.killed) {
        onNotify?.({
          type: 'success',
          title: 'Killed',
          message: 'All Roblox processes terminated'
        });
      } else {
        onNotify?.({
          type: 'warning',
          title: 'Kill Roblox',
          message: 'No Roblox processes found'
        });
      }
    } catch (e) {
      onNotify?.({
        type: 'error',
        title: 'Kill Failed',
        message: e.message
      });
    }
  };
  // Check if all clients are selected
  const allSelected = clients.length > 0 && clients.every(c => {
    const parsed = parseClient(c);
    return selectedPids.has(parsed.pid);
  });

  // Selection functions
  const toggleSelect = (pid) => {
    setSelectedPids(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pid)) {
        newSet.delete(pid);
      } else {
        newSet.add(pid);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPids(new Set());
    } else {
      const allPids = clients.map(c => {
        const parsed = parseClient(c);
        return parsed.pid;
      });
      setSelectedPids(new Set(allPids));
    }
  };

  const killSelected = async () => {
    if (selectedPids.size === 0) {
      onNotify?.({
        type: 'warning',
        title: 'No Selection',
        message: 'Select clients to kill first'
      });
      return;
    }

    try {
      for (const pid of selectedPids) {
        await window.electronAPI?.killProcess?.(parseInt(pid));
      }
      onNotify?.({
        type: 'success',
        title: 'Killed',
        message: `Killed ${selectedPids.size} client(s)`
      });
      setSelectedPids(new Set());
    } catch (e) {
      onNotify?.({
        type: 'error',
        title: 'Kill Failed',
        message: e.message
      });
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 3:
        return { label: 'ATTACHED', color: 'attached', icon: Check };
      case 2:
        return { label: 'WAITING', color: 'waiting', icon: Loader };
      case 1:
        return { label: 'ATTACHING', color: 'attaching', icon: Loader };
      default:
        return { label: 'READY', color: 'ready', icon: AlertCircle };
    }
  };

  return (
    <div className="client-manager">
      <div className="cm-header">
        <h2 className="cm-title">Client Manager</h2>
        <div className="cm-actions">
          <button className="cm-btn secondary" onClick={toggleSelectAll} title="Select All">
            {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            Select All
          </button>
          <button className="cm-btn primary" onClick={handleAttach}>
            <Zap size={14} />
            Attach
          </button>
          {selectedPids.size > 0 && (
            <>
              <button className="cm-btn warning" onClick={handleUnattach} title="Unattach - Cleans up all injected UI">
                <Unplug size={14} />
                Unattach ({selectedPids.size})
              </button>
              <button className="cm-btn danger" onClick={killSelected}>
                <XCircle size={14} />
                Kill ({selectedPids.size})
              </button>
            </>
          )}
          <button className="cm-btn danger" onClick={handleKillAll}>
            <Power size={14} />
            Kill All
          </button>
        </div>
      </div>

      <div className="clients-list">
        {clients.length === 0 ? (
          <div className="no-clients">
            <div className="no-clients-icon">
              <User size={40} />
            </div>
            <h3>No Roblox Clients Detected</h3>
            <p>Launch Roblox and join a game, then click Attach to get started</p>
          </div>
        ) : (
          clients.map((client, idx) => {
            const parsed = parseClient(client);
            const statusInfo = getStatusInfo(parsed.status);
            const StatusIcon = statusInfo.icon;
            const game = gameInfo[parsed.placeId];
            const avatar = avatars[parsed.username];
            const isSelected = selectedPids.has(parsed.pid);

            return (
              <div 
                key={parsed.pid || idx} 
                className={`client-card ${isSelected ? 'selected': ''}`}
                onClick={() => toggleSelect(parsed.pid)}
              >
                <div className="client-select">
                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <div className="client-avatar">
                  {avatar ? (
                    <img src={avatar} alt="" />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={24} />
                    </div>
                  )}
                </div>

                <div className="client-info">
                  <div className="client-user">
                    <span className="username">{parsed.username}</span>
                    {parsed.playerName && parsed.playerName !== parsed.username && (
                      <span className="display-name">({parsed.playerName})</span>
                    )}
                  </div>

                  <div className="client-game">
                    {game?.thumbnail ? (
                      <img src={game.thumbnail} alt="" className="game-icon" />
                    ) : (
                      <Gamepad2 size={16} className="game-icon-fallback" />
                    )}
                    <span className="game-name">{game?.name || 'Loading game...'}</span>
                  </div>
                </div>

                <div className="client-pid">
                  <Hash size={12} />
                  <span>PID:</span>
                  <strong>{parsed.pid}</strong>
                </div>

                <div className={`client-status ${statusInfo.color}`}>
                  <StatusIcon size={12} className={statusInfo.color === 'attaching'|| statusInfo.color === 'waiting'? 'spinning': ''} />
                  <span>{statusInfo.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ClientManager;




import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Wand2, Code, FileText, Play, Save, X, Settings,
  Sparkles, Copy, Undo, Redo, Search, Replace,
  MessageSquare, Send, ChevronRight, ChevronLeft, Plus, Trash2,
  Braces, Hash, Box, Zap, Eye, FileCode, BookOpen, PanelLeftClose, PanelRightClose, Flame, User
} from 'lucide-react';
import './WorkspaceEditor.css';

const SCRIPT_TOOLS = [
  { id: 'loop', name: 'Loop', icon: Zap, snippet: `for i = 1, 10 do\n    -- Your code here\n    print(i)\nend` },
  { id: 'function', name: 'Function', icon: Braces, snippet: `local function myFunction(param1, param2)\n    -- Your code here\n    return result\nend` },
  { id: 'event', name: 'Event', icon: Sparkles, snippet: `game.Players.PlayerAdded:Connect(function(player)\n    print(player.Name .. " joined!")\nend)` },
  { id: 'service', name: 'Get Service', icon: Box, snippet: `local Players = game:GetService("Players")\nlocal ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal RunService = game:GetService("RunService")` },
  { id: 'localplayer', name: 'Local Player', icon: Hash, snippet: `local Players = game:GetService("Players")\nlocal LocalPlayer = Players.LocalPlayer\nlocal Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()\nlocal Humanoid = Character:WaitForChild("Humanoid")\nlocal HumanoidRootPart = Character:WaitForChild("HumanoidRootPart")` },
  { id: 'gui', name: 'Create GUI', icon: Eye, snippet: `local ScreenGui = Instance.new("ScreenGui")\nScreenGui.Parent = game.CoreGui\n\nlocal Frame = Instance.new("Frame")\nFrame.Size = UDim2.new(0, 200, 0, 100)\nFrame.Position = UDim2.new(0.5, -100, 0.5, -50)\nFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)\nFrame.Parent = ScreenGui` },
  { id: 'esp', name: 'ESP Template', icon: Eye, snippet: `-- Basic ESP Template\nlocal function createESP(player)\n    local highlight = Instance.new("Highlight")\n    highlight.FillColor = Color3.new(1, 0, 0)\n    highlight.OutlineColor = Color3.new(1, 1, 1)\n    highlight.FillTransparency = 0.5\n    highlight.Parent = player.Character\nend\n\nfor _, player in pairs(game.Players:GetPlayers()) do\n    if player ~= game.Players.LocalPlayer then\n        createESP(player)\n    end\nend` },
  { id: 'teleport', name: 'Teleport', icon: Zap, snippet: `local function teleportTo(position)\n    local player = game.Players.LocalPlayer\n    local character = player.Character\n    if character then\n        character:SetPrimaryPartCFrame(CFrame.new(position))\n    end\nend\n\n-- Usage: teleportTo(Vector3.new(0, 50, 0))` },
];

function WorkspaceEditor({ onDone, onClose }) {
  const [code, setCode] = useState('-- Start creating your script here!\n-- Use the tools on the left to add code snippets\n\n');
  const [scriptName, setScriptName] = useState('New Script');
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m here to help edit your script. Tell me what you want to change or add, and I\'ll help you modify specific parts.'}
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAI, setShowAI] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const editorRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth'});
    }
  }, [aiMessages]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  const insertSnippet = (snippet) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };
      editor.executeEdits('', [{ range, text: snippet + '\n\n'}]);
      editor.focus();
    }
  };

  const handleAISend = async () => {
    if (!aiInput.trim() || aiLoading) return;

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    try {
      const systemPrompt = `You are an expert Roblox Lua script assistant. Help EDIT scripts, not rewrite completely.

CURRENT SCRIPT:
\`\`\`lua
${code}
\`\`\`

INSTRUCTIONS:
1. Provide ONLY the specific code that needs to be added or modified
2. Be concise - don't repeat the entire script
3. Use code blocks with \`\`\`lua for code
4. Explain briefly what the change does`;

      const response = await window.electronAPI?.aiGenerate({
        messages: [
          { role: 'system', content: systemPrompt },
          ...aiMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage }
        ]
      });

      if (response?.choices?.[0]?.message?.content) {
        setAiMessages(prev => [...prev, {
          role: 'assistant',
          content: response.choices[0].message.content
        }]);
      } else {
        setAiMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I could not get a response. Please try again.'
        }]);
      }
    } catch (e) {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.'
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const applyCodeFromAI = (codeBlock) => {
    const match = codeBlock.match(/```(?:lua)?\n?([\s\S]*?)```/);
    if (match) {
      insertSnippet(match[1].trim());
    }
  };

  const handleDone = () => {
    onDone({ name: scriptName, content: code });
  };

  const formatMessage = (content) => {
    if (!content) return null;
    const parts = content.split(/(```(?:lua)?\n?[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const codeContent = part.replace(/```(?:lua)?\n?/, '').replace(/```$/, '');
        return (
          <div key={i} className="ai-code-block">
            <div className="code-block-header">
              <span>Lua</span>
              <button onClick={() => applyCodeFromAI(part)} className="apply-code-btn">
                <Plus size={12} /> Insert
              </button>
            </div>
            <pre>{codeContent}</pre>
          </div>
        );
      }
      return part.trim() ? <p key={i}>{part}</p> : null;
    });
  };

  return (
    <div className="workspace-modal-overlay" onClick={onClose}>
      <div className="workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-header">
          <div className="workspace-title-area">
            <FileCode size={20} />
            <input
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              className="script-name-input"
              placeholder="Script Name"
            />
          </div>
          <div className="workspace-actions">
            <button className="toggle-panel-btn" onClick={() => setShowTools(!showTools)} title={showTools ? 'Hide Tools': 'Show Tools'}>
              <PanelLeftClose size={16} />
            </button>
            <button className="toggle-panel-btn" onClick={() => setShowAI(!showAI)} title={showAI ? 'Hide AI': 'Show AI'}>
              <PanelRightClose size={16} />
            </button>
            <button className="done-btn" onClick={handleDone}>
              <ChevronRight size={16} />
              Done - Open in Executor
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="workspace-body">
          <div className={`tools-panel ${showTools ? '': 'collapsed'}`}>
            {showTools ? (
              <>
                <h3><Code size={14} /> Script Tools</h3>
                <div className="tools-grid">
                  {SCRIPT_TOOLS.map(tool => (
                    <button key={tool.id} className="tool-btn" onClick={() => insertSnippet(tool.snippet)} title={tool.name}>
                      <tool.icon size={16} />
                      <span>{tool.name}</span>
                    </button>
                  ))}
                </div>
                <div className="tools-section">
                  <h4><BookOpen size={12} /> Quick Actions</h4>
                  <button className="action-btn" onClick={() => setCode('')}>
                    <Trash2 size={14} /> Clear All
                  </button>
                  <button className="action-btn" onClick={() => navigator.clipboard.writeText(code)}>
                    <Copy size={14} /> Copy Script
                  </button>
                </div>
              </>
            ) : (
              <button className="expand-panel-btn" onClick={() => setShowTools(true)} title="Show Tools">
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          <div className="editor-area">
            <Editor
              height="100%"
              defaultLanguage="lua"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorMount}
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', Consolas, monospace",
                minimap: { enabled: true },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 4,
              }}
            />
          </div>

          <div className={`ai-panel ${showAI ? '': 'collapsed'}`}>
            {showAI ? (
              <>
                <div className="ai-header">
                  <Sparkles size={14} />
                  <span>AI Script Assistant</span>
                </div>

                <div className="ai-messages-container">
                  <div className="ai-messages">
                    {aiMessages.map((msg, i) => (
                      <div key={i} className={`ai-message ${msg.role}`}>
                        <div className="ai-avatar">
                          {msg.role === 'assistant'? <Flame size={14} /> : <User size={14} />}
                        </div>
                        <div className="message-bubble">
                          {formatMessage(msg.content)}
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="ai-message assistant">
                        <div className="ai-avatar"><Flame size={14} /></div>
                        <div className="message-bubble">
                          <div className="typing-indicator">
                            <span></span><span></span><span></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="ai-input-area">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter'&& handleAISend()}
                    placeholder="Ask to edit your script..."
                    disabled={aiLoading}
                  />
                  <button onClick={handleAISend} disabled={aiLoading || !aiInput.trim()}>
                    <Send size={16} />
                  </button>
                </div>
              </>
            ) : (
              <button className="expand-panel-btn" onClick={() => setShowAI(true)} title="Show AI">
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceEditor;

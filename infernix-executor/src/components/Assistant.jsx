import { useState, useRef } from 'react';
import { Zap, Send, Sparkles, Loader, AlertCircle } from 'lucide-react';
import './Assistant.css';

const SYSTEM_PROMPT = `You are Infernix AI, an expert Roblox Lua script generator. You ONLY output raw Lua code - no explanations, no markdown, no code blocks, just pure Lua code.

Rules:
1. Output ONLY valid Lua code that works with Roblox exploits/executors
2. Never include markdown formatting like \`\`\`lua or \`\`\`
3. Never explain the code - just output the script
4. Always include helpful comments in the code itself
5. Use modern Roblox API practices
6. Make scripts that are safe and work with most executors
7. Start scripts with a comment like "-- [Script Name] by Infernix"
8. End scripts with a print statement confirming the script loaded
9. Use game:GetService() for services
10. Handle errors gracefully with pcall when needed

Common services to use:
- game:GetService("Players")
- game:GetService("UserInputService")
- game:GetService("RunService")
- game:GetService("TweenService")
- game:GetService("ReplicatedStorage")
- workspace.CurrentCamera

Remember: Output RAW LUA CODE ONLY. No other text.`;

function Assistant({ tabs, onWriteToTab, onSwitchToExecutor, onNotify }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('Ready to assist');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const findTargetTab = (input) => {
    const lowerInput = input.toLowerCase();
    
    for (const tab of tabs) {
      const tabNameLower = tab.name.toLowerCase();
      if (lowerInput.includes(tabNameLower)) {
        return tab;
      }
    }
    
    return null;
  };

  const typeCode = async (code, tabId) => {
    const chars = code.split('');
    let currentContent = '';
    
    for (let i = 0; i < chars.length; i++) {
      currentContent += chars[i];
      onWriteToTab(tabId, currentContent);
      
      const char = chars[i];
      let delay = 3;
      
      if (char === '\n') delay = 15;
      else if (char === '') delay = 5;
      else if ('.,;:(){}[]'.includes(char)) delay = 8;
      
      await new Promise(r => setTimeout(r, delay));
    }
  };

  const generateWithAI = async (userPrompt) => {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Create a Roblox Lua script for: ${userPrompt}` }
    ];

    // Use Electron IPC to call the AI API from main process
    const data = await window.electronAPI.aiGenerate(messages);
    
    let code = data.choices?.[0]?.message?.content || '';
    
    // Clean up any markdown formatting if AI included it
    code = code.replace(/^```lua\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/g, '').trim();
    
    return code;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setStatus('Connecting to Infernix AI...');

    try {
      const targetTab = findTargetTab(prompt);
      const writeTabId = targetTab?.id || tabs[tabs.length - 1]?.id;
      const writeTabName = targetTab?.name || tabs[tabs.length - 1]?.name || 'Script';

      // Generate code with AI
      setStatus('AI is thinking...');
      const generatedCode = await generateWithAI(prompt);

      if (!generatedCode) {
        throw new Error('No code generated');
      }

      // Switch to executor view
      setStatus('Switching to '+ writeTabName + '...');
      onSwitchToExecutor(writeTabId);
      await new Promise(r => setTimeout(r, 400));

      // Clear the tab first
      onWriteToTab(writeTabId, '');
      await new Promise(r => setTimeout(r, 100));

      // Type the code with animation
      setStatus('Writing code...');
      await typeCode(generatedCode, writeTabId);

      setStatus('Ready to assist');
      setPrompt('');

      // Show notification
      onNotify({
        type: 'ai',
        title: 'Script Generated',
        message: `AI script written to ${writeTabName}`,
        duration: 5000
      });

    } catch (err) {
      console.error('AI generation error:', err);
      setError(err.message || 'Unknown error');
      setStatus('Generation failed');
      onNotify({
        type: 'error',
        title: 'Generation Failed',
        message: err.message || 'Unknown error',
        duration: 5000
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter'&& !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="assistant">
      <div className="assistant-header">
        <div className="assistant-icon">
          <Zap size={24} />
        </div>
        <div className="assistant-info">
          <h2>Infernix AI</h2>
          <p>Powered by GPT-4 • Describe any script you need</p>
        </div>
      </div>

      <div className="assistant-tips">
        <div className="tip-title">
          <Sparkles size={14} />
          <span>Example Prompts</span>
        </div>
        <div className="tip-grid">
          <span className="tip-tag" onClick={() => setPrompt('fly script with speed control')}>Fly Script</span>
          <span className="tip-tag" onClick={() => setPrompt('ESP that shows player names and distance')}>Player ESP</span>
          <span className="tip-tag" onClick={() => setPrompt('speed hack with adjustable walkspeed')}>Speed Hack</span>
          <span className="tip-tag" onClick={() => setPrompt('noclip toggle script')}>Noclip</span>
          <span className="tip-tag" onClick={() => setPrompt('infinite jump script')}>Inf Jump</span>
          <span className="tip-tag" onClick={() => setPrompt('click teleport to mouse position')}>Click TP</span>
          <span className="tip-tag" onClick={() => setPrompt('aimbot for shooter games')}>Aimbot</span>
          <span className="tip-tag" onClick={() => setPrompt('auto farm script')}>Auto Farm</span>
        </div>
        <p className="tip-hint">
           Click a tag or type anything! Mention a tab name to write there.
        </p>
      </div>

      <div className="assistant-status">
        <div className={`status-indicator ${isGenerating ? 'active': ''} ${error ? 'error': ''}`} />
        <span>{status}</span>
        {isGenerating && <Loader size={14} className="spinning" />}
      </div>

      {error && (
        <div className="assistant-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="assistant-input-area">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Describe your script... (e.g. 'make a fly script with speed control')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />
          <button 
            className="send-btn" 
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? <Loader size={16} className="spinning" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Assistant;

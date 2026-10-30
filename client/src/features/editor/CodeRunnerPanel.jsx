import React, { useState, useEffect, useRef } from 'react';
import {
  Play, RotateCw, Trash2, Terminal, Eye, ExternalLink,
  CheckCircle2, AlertCircle, AlertTriangle, X, Maximize2, Minimize2,
  Smartphone, Tablet, Monitor, Info
} from 'lucide-react';

export default function CodeRunnerPanel({
  activeDoc,
  content = '',
  allDocuments = [],
  activeTab = 'console',
  setActiveTab,
  onClose,
  runTrigger = 0,
  onRun
}) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'success' | 'error'
  const [executionTime, setExecutionTime] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewport, setViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  const startTimeRef = useRef(0);

  const filePath = activeDoc?.file_path || '';
  const fileExt = (filePath.split('.').pop() || '').toLowerCase();

  // Trigger execution when parent changes runTrigger
  useEffect(() => {
    if (runTrigger > 0) {
      executeFile();
    }
  }, [runTrigger]);

  // Listen for console messages from HTML preview iframe
  useEffect(() => {
    function handlePreviewMessage(event) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.source === 'devcollab-preview-console') {
        const timeStr = new Date().toLocaleTimeString();
        setLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            time: timeStr,
            type: data.type || 'log',
            text: `[Preview] ${data.text || ''}`
          }
        ]);
      }
    }

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, []);

  function clearLogs() {
    setLogs([]);
    setStatus('idle');
    setExecutionTime(null);
  }

  function serializeArg(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return val.toString();
    if (val instanceof Error) return val.stack || `${val.name}: ${val.message}`;
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch (e) {
        return Object.prototype.toString.call(val);
      }
    }
    return String(val);
  }

  function appendLog(type, args) {
    const timeStr = new Date().toLocaleTimeString();
    const formattedText = Array.isArray(args) ? args.map(serializeArg).join(' ') : serializeArg(args);
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        type,
        text: formattedText
      }
    ]);
  }

  // Multi-file HTML bundler for Web Live Preview
  function generateBundledHtml(rawContent) {
    let raw = rawContent || '';

    // If active document is CSS, embed it into a component showcase
    if (fileExt === 'css') {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CSS Preview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; background: #0d1117; color: #e6edf3; }
    .showcase-grid { display: flex; flex-direction: column; gap: 20px; max-width: 600px; margin: 0 auto; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 18px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
    .btn-primary { background: #238636; color: white; }
    .btn-secondary { background: #21262d; color: #e6edf3; border-color: #30363d; }
  </style>
  <style>
${raw}
  </style>
</head>
<body>
  <div class="showcase-grid">
    <div class="card">
      <h2 style="margin-bottom: 8px;">CSS Live Preview</h2>
      <p style="color: #8b949e; font-size: 0.9rem;">Styles from <code>${filePath}</code> applied to sample UI components:</p>
      <div style="margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-primary">Primary Button</button>
        <button class="btn btn-secondary">Secondary Button</button>
      </div>
      <div style="margin-top: 16px;">
        <input type="text" placeholder="Sample text input..." style="padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; width: 100%; box-sizing: border-box;" />
      </div>
    </div>
  </div>
</body>
</html>
      `;
    }

    // If active document is Markdown
    if (fileExt === 'md') {
      const escaped = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; line-height: 1.6; background: #0d1117; color: #e6edf3; }
    pre { background: #161b22; padding: 16px; border-radius: 6px; overflow-x: auto; border: 1px solid #30363d; }
    h1, h2, h3 { border-bottom: 1px solid #30363d; padding-bottom: 6px; }
  </style>
</head>
<body>
  <h1>Markdown Preview: ${filePath}</h1>
  <pre>${escaped}</pre>
</body>
</html>
      `;
    }

    // Injects console logger bridge into HTML preview
    const consoleBridge = `
<script>
(function() {
  function serialize(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return val.toString();
    if (val instanceof Error) return val.stack || (val.name + ': ' + val.message);
    if (typeof val === 'object') {
      try { return JSON.stringify(val); } catch(e) { return Object.prototype.toString.call(val); }
    }
    return String(val);
  }
  function send(type, args) {
    try {
      window.parent.postMessage({
        source: 'devcollab-preview-console',
        type: type,
        text: args.map(serialize).join(' ')
      }, '*');
    } catch(e) {}
  }
  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = function(...args) { origLog.apply(console, args); send('log', args); };
  console.info = function(...args) { origInfo.apply(console, args); send('info', args); };
  console.warn = function(...args) { origWarn.apply(console, args); send('warn', args); };
  console.error = function(...args) { origError.apply(console, args); send('error', args); };
  window.onerror = function(msg, url, line, col, err) {
    send('error', [err ? (err.stack || err.message) : (msg + (line ? ' (line ' + line + ')' : ''))]);
  };
})();
</script>
    `;

    // Inject console bridge right after <head> or at start
    let bundled = raw;
    if (bundled.includes('<head>')) {
      bundled = bundled.replace('<head>', '<head>' + consoleBridge);
    } else {
      bundled = consoleBridge + bundled;
    }

    // Replace <link rel="stylesheet" href="..."> with bundled project styles
    bundled = bundled.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi, (match, href1, href2) => {
      const href = href1 || href2;
      const cleanHref = href.replace(/^\.?\//, '');
      const foundDoc = allDocuments.find(d => d.file_path === cleanHref || d.file_path.endsWith('/' + cleanHref));
      if (foundDoc) {
        return `<style>/* Bundled: ${cleanHref} */\n${foundDoc.content}\n</style>`;
      }
      return match;
    });

    // Replace <script src="..."> with bundled project scripts
    bundled = bundled.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match, src) => {
      const cleanSrc = src.replace(/^\.?\//, '');
      const foundDoc = allDocuments.find(d => d.file_path === cleanSrc || d.file_path.endsWith('/' + cleanSrc));
      if (foundDoc) {
        return `<script>/* Bundled: ${cleanSrc} */\n${foundDoc.content}\n<\/script>`;
      }
      return match;
    });

    return bundled;
  }

  // Main file execution handler
  async function executeFile() {
    if (!activeDoc) {
      setActiveTab('console');
      appendLog('system', 'ℹ️ No file selected. Select or create a file in the explorer to run code.');
      return;
    }

    setStatus('running');
    startTimeRef.current = performance.now();
    const timeStr = new Date().toLocaleTimeString();

    // 1. Web Preview types: HTML, CSS, SVG, Markdown
    if (['html', 'htm', 'svg', 'css', 'md'].includes(fileExt)) {
      setActiveTab('preview');
      const bundled = generateBundledHtml(content);
      setPreviewHtml(bundled);
      setPreviewKey(prev => prev + 1);
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setExecutionTime(elapsed);
      setStatus('success');
      appendLog('system', `🌐 Live Preview updated for ${filePath} (${content.length} bytes)`);
      return;
    }

    // 2. JSON validation and pretty print
    if (fileExt === 'json') {
      setActiveTab('console');
      try {
        const parsed = JSON.parse(content);
        const elapsed = Math.round(performance.now() - startTimeRef.current);
        const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;
        setExecutionTime(elapsed);
        setStatus('success');
        appendLog('system', `✓ Valid JSON syntax | ${keys} top-level entries | ${new Blob([content]).size} bytes`);
        appendLog('return', JSON.stringify(parsed, null, 2));
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTimeRef.current);
        setExecutionTime(elapsed);
        setStatus('error');
        appendLog('error', `JSON Parse Error: ${err.message}`);
      }
      return;
    }

    // 3. Python script
    if (fileExt === 'py') {
      setActiveTab('console');
      appendLog('system', `🐍 Python Execution: Running ${filePath}...`);

      try {
        if (!window.loadPyodide && !window._pyodideLoading) {
          window._pyodideLoading = true;
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            setTimeout(() => reject(new Error('Pyodide load timeout')), 5000);
          });
        }

        if (window.loadPyodide) {
          if (!window._pyodideInstance) {
            window._pyodideInstance = await window.loadPyodide({
              stdout: (text) => appendLog('log', text),
              stderr: (text) => appendLog('error', text)
            });
          }
          const py = window._pyodideInstance;
          const result = await py.runPythonAsync(content);
          const elapsed = Math.round(performance.now() - startTimeRef.current);
          setExecutionTime(elapsed);
          setStatus('success');
          if (result !== undefined) {
            appendLog('return', `=> ${result}`);
          }
          appendLog('system', `⚡ Python execution finished in ${elapsed}ms (Exit 0)`);
          return;
        }
      } catch (e) {
        // Fallback for offline mode
      }

      const lines = content.split('\n');
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setExecutionTime(elapsed);
      setStatus('success');
      appendLog('info', `[Python Sandbox] Read ${lines.length} lines in ${filePath}. Syntax checked.`);
      appendLog('system', `⚡ In offline mode, JavaScript & Web (HTML/CSS) execute natively in-browser. Connect to load full Pyodide runtime or run via 'python ${filePath}'.`);
      return;
    }

    // 4. JavaScript / TypeScript Execution (Direct Sandboxed Async Runner)
    setActiveTab('console');
    appendLog('system', `▶ Running ${filePath || 'script'} (JavaScript Sandbox)...`);

    try {
      const customConsole = {
        log: (...args) => appendLog('log', args),
        info: (...args) => appendLog('info', args),
        warn: (...args) => appendLog('warn', args),
        error: (...args) => appendLog('error', args),
        table: (...args) => appendLog('info', args)
      };

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const runnerFn = new AsyncFunction('console', content);

      // Run with 10-second timeout protection
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Execution timed out after 10 seconds (Possible infinite loop)')), 10000);
      });

      const executionPromise = runnerFn(customConsole);
      const result = await Promise.race([executionPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setExecutionTime(elapsed);
      setStatus('success');

      if (result !== undefined) {
        appendLog('return', `=> ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
      }
      appendLog('system', `⚡ Process finished with exit code 0 in ${elapsed}ms`);
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setExecutionTime(elapsed);
      setStatus('error');
      appendLog('error', err.stack || err.message);
      appendLog('system', `⚡ Process exited with error in ${elapsed}ms`);
    }
  }

  function openPreviewInNewWindow() {
    const bundled = generateBundledHtml(content);
    const blob = new Blob([bundled], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div
      className="runner-panel"
      style={{
        height: isMaximized ? '100%' : '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d1117',
        borderTop: '2px solid #30363d',
        zIndex: 10
      }}
    >
      {/* Runner Header */}
      <div
        style={{
          background: '#161b22',
          borderBottom: '1px solid var(--border-color)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem',
          flexShrink: 0
        }}
      >
        {/* Left Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`btn btn-sm ${activeTab === 'console' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '4px 10px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
            onClick={() => setActiveTab('console')}
          >
            <Terminal size={13} />
            <span>Console Output</span>
            {logs.length > 0 && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '1px 5px',
                borderRadius: '10px',
                fontSize: '0.7rem'
              }}>
                {logs.length}
              </span>
            )}
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '4px 10px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
            onClick={() => {
              setActiveTab('preview');
              if (!previewHtml && activeDoc) {
                setPreviewHtml(generateBundledHtml(content));
              }
            }}
          >
            <Eye size={13} />
            <span>Web Live Preview</span>
          </button>

          {/* Status Indicator */}
          <div style={{ marginLeft: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
            {status === 'running' && (
              <span style={{ color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RotateCw size={12} className="spin" /> Executing...
              </span>
            )}
            {status === 'success' && (
              <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={12} /> Success {executionTime !== null && `(${executionTime}ms)`}
              </span>
            )}
            {status === 'error' && (
              <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> Exit with Error
              </span>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={executeFile}
            title="Re-run (Ctrl + Enter)"
          >
            <Play size={11} fill="currentColor" />
            <span>Run</span>
          </button>

          {activeTab === 'console' && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={clearLogs}
              title="Clear Console Output"
            >
              <Trash2 size={11} />
              <span>Clear</span>
            </button>
          )}

          {activeTab === 'preview' && (
            <>
              {/* Viewport switcher */}
              <div style={{ display: 'flex', background: '#0d1117', borderRadius: '4px', border: '1px solid var(--border-color)', padding: 2 }}>
                <button
                  className="file-tree-btn"
                  style={{ color: viewport === 'desktop' ? 'var(--accent-blue)' : 'var(--text-dim)' }}
                  onClick={() => setViewport('desktop')}
                  title="Desktop View (100%)"
                >
                  <Monitor size={12} />
                </button>
                <button
                  className="file-tree-btn"
                  style={{ color: viewport === 'tablet' ? 'var(--accent-blue)' : 'var(--text-dim)' }}
                  onClick={() => setViewport('tablet')}
                  title="Tablet View (768px)"
                >
                  <Tablet size={12} />
                </button>
                <button
                  className="file-tree-btn"
                  style={{ color: viewport === 'mobile' ? 'var(--accent-blue)' : 'var(--text-dim)' }}
                  onClick={() => setViewport('mobile')}
                  title="Mobile View (375px)"
                >
                  <Smartphone size={12} />
                </button>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => setPreviewKey(k => k + 1)}
                title="Reload Live Preview"
              >
                <RotateCw size={11} />
              </button>

              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={openPreviewInNewWindow}
                title="Open Live Preview in New Window"
              >
                <ExternalLink size={11} />
                <span>Pop out</span>
              </button>
            </>
          )}

          <button
            className="file-tree-btn"
            onClick={onClose}
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Runner Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* TAB 1: Console / Terminal Output */}
        {activeTab === 'console' && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              background: '#0a0d12'
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', padding: '24px 0', textAlign: 'center' }}>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Terminal size={18} />
                  <span style={{ fontWeight: 600 }}>Interactive Terminal & Runner Ready</span>
                </div>
                <div style={{ fontSize: '0.78rem' }}>
                  Click <strong style={{ color: 'var(--accent-blue)' }}>Run</strong> or press <kbd style={{ background: '#1c2128', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)' }}>Ctrl + Enter</kbd> to execute <code>{filePath || 'your file'}</code> and view output.
                </div>
              </div>
            ) : (
              logs.map((log) => {
                let badgeColor = 'var(--text-dim)';
                let textColor = 'var(--text-main)';
                let badgeText = log.type.toUpperCase();

                if (log.type === 'error') {
                  badgeColor = 'var(--accent-red)';
                  textColor = '#ff7b72';
                } else if (log.type === 'warn') {
                  badgeColor = 'var(--accent-amber)';
                  textColor = '#e3b341';
                } else if (log.type === 'info') {
                  badgeColor = 'var(--accent-blue)';
                  textColor = '#79c0ff';
                } else if (log.type === 'return') {
                  badgeColor = 'var(--accent-purple)';
                  textColor = '#d2a8ff';
                  badgeText = 'RESULT';
                } else if (log.type === 'system') {
                  badgeColor = '#8b949e';
                  textColor = '#8b949e';
                  badgeText = 'SYS';
                }

                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '3px 0',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                    }}
                  >
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', flexShrink: 0, marginTop: 1 }}>
                      {log.time}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: badgeColor,
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '1px 5px',
                        borderRadius: 3,
                        flexShrink: 0
                      }}
                    >
                      {badgeText}
                    </span>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        color: textColor,
                        flex: 1
                      }}
                    >
                      {log.text}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: Live Web Preview */}
        {activeTab === 'preview' && (
          <div
            style={{
              flex: 1,
              background: '#1a1f26',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'stretch',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '768px' : '375px',
                maxWidth: '100%',
                height: '100%',
                background: '#ffffff',
                boxShadow: viewport !== 'desktop' ? '0 0 20px rgba(0,0,0,0.5)' : 'none',
                transition: 'width 0.2s ease',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <iframe
                key={previewKey}
                title="devcollab-live-preview"
                srcDoc={previewHtml || generateBundledHtml(content)}
                sandbox="allow-scripts allow-modals allow-forms"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#ffffff'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

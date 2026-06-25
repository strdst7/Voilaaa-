/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import ContentContainer from '@/components/ContentContainer';
import {DataContext} from '@/context';
import {Example} from '@/lib/types';
import {
  getYoutubeEmbedUrl,
  getYouTubeVideoTitle,
  validateYoutubeUrl,
} from '@/lib/youtube';
import {useContext, useEffect, useRef, useState, KeyboardEvent, useMemo} from 'react';
import {Check, Download, RotateCcw, X, Search, Sparkles, Zap, Monitor, Layout, Play, Moon, Sun, Activity, Trash2, History, ChevronLeft, ChevronRight, AlertCircle} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Whether to validate the input URL before attempting to generate content
const VALIDATE_INPUT_URL = true;

// Whether to pre-seed with example content
const PRESEED_CONTENT = true;

// Helper function to load a shared state by ID
export default function App() {
  const {defaultExample, examples, setExamples, isLoading} =
    useContext(DataContext);

  const [videoUrl, setVideoUrl] = useState('');

  const [urlValidating, setUrlValidating] = useState(false); // State to track URL validation
  const [validationError, setValidationError] = useState<string | null>(null); // State to track URL validation error
  const [contentLoading, setContentLoading] = useState(false); // State to track content loading
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reference to ContentContainer component for accessing its state
  const contentContainerRef = useRef<{
    getSpec: () => string;
    getCode: () => string;
  } | null>(null);

  // Counter to force ContentContainer re-mount even if the video URL hasn't changed
  const [reloadCounter, setReloadCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedExample, setSelectedExample] = useState<Example | null>(null);
  const [hasPreseeded, setHasPreseeded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [history, setHistory] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('voilaa_history');
        return saved ? JSON.parse(saved) : [];
      } catch (err) {
        console.error('Failed to parse history', err);
        return [];
      }
    }
    return [];
  });
  const [zenMode, setZenMode] = useState(false);
  const [workspaceFullscreen, setWorkspaceFullscreen] = useState(false);
  const [isHome, setIsHome] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [parallaxPos, setParallaxPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isHome) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    
    // Gradient follow
    const gx = (clientX / innerWidth) * 100;
    const gy = (clientY / innerHeight) * 100;
    setMousePos({ x: gx, y: gy });

    // Parallax movement
    const px = (clientX - innerWidth / 2) / 50;
    const py = (clientY - innerHeight / 2) / 50;
    setParallaxPos({ x: px, y: py });
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark'; // Starting with dark for this specific UI
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Effect to pre-seed with a default example or load from query params on startup
  useEffect(() => {
    if (PRESEED_CONTENT && !videoUrl && !isLoading && !hasPreseeded) {
      let loadedFromQuery = false;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlParam = params.get('url') || params.get('video');
        if (urlParam) {
          const trimmed = urlParam.trim();
          if (trimmed) {
            const match = [defaultExample, ...examples].find(ex => ex?.url === trimmed);
            setSelectedExample(match || null);
            setInputValue(trimmed);
            if (inputRef.current) {
              inputRef.current.value = trimmed;
            }
            proceedWithVideo(trimmed);
            loadedFromQuery = true;
          }
        }
      }

      if (!loadedFromQuery && defaultExample?.url) {
        setVideoUrl(defaultExample.url);
        setSelectedExample(defaultExample);
        setInputValue(defaultExample.url);
        if (inputRef.current) {
          inputRef.current.value = defaultExample.url;
        }
      }
      setHasPreseeded(true);
    }
  }, [defaultExample, examples, isLoading, videoUrl, hasPreseeded]);

  // Handle 'Enter' key press in the input field
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !urlValidating && !contentLoading) {
      handleSubmit();
    }
  };

  const handleExampleSelect = (example: Example) => {
    if (inputRef.current) {
      inputRef.current.value = example.url;
    }
    setInputValue(example.url);
    setSelectedExample(example);
    setContentLoading(false);
    proceedWithVideo(example.url);
    
    // Smooth scroll to top of right side on mobile
    if (window.innerWidth <= 768) {
      const contentArea = document.querySelector('.content-area');
      contentArea?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = async () => {
    const inputValue = inputRef.current?.value.trim() || '';

    if (!inputValue) {
      inputRef.current?.focus();
      return;
    }

    // Prevent multiple clicks while validating
    if (urlValidating) return;

    setUrlValidating(true);
    setValidationError(null); // Clear previous validation error
    setVideoUrl(''); // Clear previous video URL immediately
    setContentLoading(false); // Reset content loading state
    
    // Check if the URL matches any of our examples
    const match = [defaultExample, ...examples].find(
      (example) => example?.url === inputValue,
    );

    setSelectedExample(match || null);

    // No need to validate the URL if it's a pre-seeded example
    if (match) {
      setValidationError(null);
      proceedWithVideo(inputValue);
      return;
    }

    if (VALIDATE_INPUT_URL) {
      // Validate video URL
      const validationResult = await validateYoutubeUrl(inputValue);

      if (validationResult.isValid) {
        setValidationError(null);
        proceedWithVideo(inputValue);
      } else {
        setValidationError(validationResult.error || 'Invalid YouTube URL');
        setUrlValidating(false);
      }
    } else {
      // If URL validation is disabled, proceed directly
      setValidationError(null);
      proceedWithVideo(inputValue);
    }
  };

  // Helper function to handle common operations after URL validation and save to history
  const proceedWithVideo = (url: string) => {
    setVideoUrl(url);
    setIsHome(false);
    setValidationError(null);
    // Incrementing the counter changes the 'key' prop on ContentContainer,
    // forcing it to re-mount and re-generate content
    setReloadCounter((c) => c + 1);
    setUrlValidating(false);

    // Save to history optimistically
    const matchingEx = [defaultExample, ...examples].find(ex => ex?.url === url);
    const initialTitle = matchingEx ? matchingEx.title : 'Generating App...';
    const initialId = Date.now().toString();

    setHistory(prev => {
      const filtered = prev.filter(item => item.url !== url);
      const updated = [
        {
          id: initialId,
          url,
          title: initialTitle,
          timestamp: Date.now(),
          status: matchingEx ? 'ready' : 'fetching'
        },
        ...filtered
      ];
      if (typeof window !== 'undefined') {
        localStorage.setItem('voilaa_history', JSON.stringify(updated));
      }
      return updated;
    });

    if (!matchingEx) {
      getYouTubeVideoTitle(url)
        .then(fetchedTitle => {
          setHistory(prev => {
            const updated = prev.map(item => {
              if (item.url === url) {
                return { ...item, title: fetchedTitle, status: 'ready' };
              }
              return item;
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem('voilaa_history', JSON.stringify(updated));
            }
            return updated;
          });
        })
        .catch(() => {
          setHistory(prev => {
            const updated = prev.map(item => {
              if (item.url === url) {
                return { ...item, title: 'Analyzed Video', status: 'ready' };
              }
              return item;
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem('voilaa_history', JSON.stringify(updated));
            }
            return updated;
          });
        });
    }
  };

  const handleReloadFromHistory = (url: string) => {
    if (urlValidating || contentLoading) return;

    // Check if the URL matches any of our examples
    const match = [defaultExample, ...examples].find(
      (example) => example?.url === url,
    );

    setSelectedExample(match || null);
    
    if (inputRef.current) {
      inputRef.current.value = url;
    }
    setInputValue(url);
    proceedWithVideo(url);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent reloading when deleting
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('voilaa_history', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your entire analysis history?')) {
      setHistory([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('voilaa_history');
      }
    }
  };

  const handleDownload = () => {
    const code = contentContainerRef.current?.getCode();
    if (!code) return;

    try {
      const blob = new Blob([code], {type: 'text/html'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-app.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download: ', err);
    }
  };

  const handleClear = () => {
    setVideoUrl('');
    setSelectedExample(null);
    setInputValue('');
    setValidationError(null);
    setIsHome(true);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    
    if (droppedText) {
      // Try to find a URL in the dropped text
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = droppedText.match(urlRegex);
      const url = matches ? matches[0] : droppedText.trim();

      if (url) {
        if (inputRef.current) {
          inputRef.current.value = url;
        }
        setInputValue(url);
        
        // Auto-trigger validation if it looks like a YouTube URL
        const validation = await validateYoutubeUrl(url);
        if (validation.isValid) {
          handleSubmit();
        }
      }
    }
  };

  // Callback function to handle loading state changes from ContentContainer
  const handleContentLoadingStateChange = (isLoading: boolean) => {
    setContentLoading(isLoading);
  };


  const marqueeExamples = useMemo(() => {
    if (examples.length === 0) return [];
    // Repeat examples for seamless scroll
    return [...examples, ...examples, ...examples];
  }, [examples]);

  const marqueeGallery = (
    <div className="marquee-wrapper">
      <div className="marquee-track">
        {marqueeExamples.map((example, index) => (
          <motion.button
            key={`${example.url}-${index}`}
            className="marquee-pill"
            whileHover={{ y: -2, backgroundColor: 'var(--color-accent-soft)' }}
            onClick={() => handleExampleSelect(example)}
          >
            <span className="pill-dot"></span>
            <span className="pill-title">{example.title}</span>
            <span className="pill-action">LOAD_STREAM</span>
          </motion.button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <main 
        className={`main-container ${zenMode ? 'zen-active' : ''} ${isHome ? 'home-view' : 'workspace-view'}`}
        onMouseMove={handleMouseMove}
        style={{
          '--mouse-x': `${mousePos.x}%`,
          '--mouse-y': `${mousePos.y}%`
        } as React.CSSProperties}
      >
        {isHome ? (
          <div className="home-dashboard">
            <motion.header 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                x: parallaxPos.x * 0.8,
                y: parallaxPos.y * 0.8
              }}
              className="home-hero"
            >
              <div className="brand-group">
                <h1 className="hero-headline">
                  <motion.span
                    initial={{ opacity: 0, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 1 }}
                  >Synthesis</motion.span>
                  <span className="cursor-blink">_</span>
                </h1>
                <p className="hero-subtitle">
                  The professional-grade intelligence engine that transforms digital signals into architectural learning frameworks.
                </p>
              </div>

              <div className="discovery-controls">
                <button 
                  className="theme-toggle-btn" 
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              </div>
            </motion.header>

            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`search-hub ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="hub-input-wrapper">
                <div className="hub-input-header">
                  <label>Signal Input</label>
                  <div className="live-badge">
                    <div className="live-dot"></div>
                    STREAM_SOURCE_READY
                  </div>
                </div>
                
                <div className={`hub-search-box ${validationError ? 'has-error' : ''}`}>
                  <div className={`hub-drop-overlay ${isDragging ? 'visible' : ''}`}>
                    <div className="drop-content-mini">
                      <Zap size={24} className="drop-icon-zap" />
                      <span>Release to Analyze Signal</span>
                    </div>
                  </div>
                  <Search size={20} className="hub-search-icon" />
                  <input
                    ref={inputRef}
                    className="hub-input"
                    type="text"
                    value={inputValue}
                    placeholder="Enter professional video URL..."
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setValidationError(null);
                    }}
                  />
                  <button 
                    onClick={handleSubmit}
                    className="hub-submit-btn"
                    disabled={urlValidating || !inputValue.trim()}
                  >
                    {urlValidating ? <RotateCcw size={18} className="spin" /> : <Sparkles size={18} />}
                    <span>INITIATE</span>
                  </button>
                </div>
                {validationError && (
                  <div className="hub-error-message">
                    <AlertCircle size={14} className="error-icon" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
            </motion.section>

            <section className="manifesto-section">
              <div className="manifesto-watermark">VOILAA</div>
              <div className="manifesto-content">
                <div className="neural-status">
                  <div className="heartbeat"></div>
                  <span>NEURAL_SYNTHESIS_ONLINE</span>
                </div>
                <h2 className="mission-statement">
                  Precision Intelligence for the Modern Mind.<br />
                  <span>Transform noise into knowledge, instantly.</span>
                </h2>
              </div>
            </section>


            <div className="marquee-section">
              {marqueeGallery}
            </div>

            <footer className="home-footer">
              <div className="designer-credit">
                <strong>NUR AMIRAH MOHD KAMIL &copy; 2026</strong>
              </div>
              <div className="tech-stack">
                <span>VOILAA_INTELLIGENCE_v4.5</span>
              </div>
            </footer>
          </div>
        ) : (
          <>
            {/* Collapsible History Sidebar */}
            {!zenMode && (
              <div className={`history-sidebar ${historySidebarOpen ? 'expanded' : 'collapsed'}`}>
                {/* Header / Top Toggle */}
                <div className="sidebar-header">
                  {historySidebarOpen ? (
                    <>
                      <div className="sidebar-title-group">
                        <History size={14} className="text-accent" />
                        <span>History</span>
                      </div>
                      <button 
                        onClick={() => setHistorySidebarOpen(false)}
                        className="sidebar-toggle-btn"
                        title="Collapse Sidebar"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setHistorySidebarOpen(true)}
                      className="sidebar-toggle-btn collapsed-state"
                      title="Expand History"
                    >
                      <History size={14} />
                    </button>
                  )}
                </div>

                {/* Main List */}
                {historySidebarOpen && (
                  <div className="sidebar-content-wrapper">
                    {history.length === 0 ? (
                      <div className="sidebar-empty">
                        <History size={20} className="empty-icon text-muted" />
                        <p>No history</p>
                      </div>
                    ) : (
                      <>
                        <div className="sidebar-list">
                          {history.map((item) => (
                            <div 
                              key={item.id} 
                              className={`history-item ${videoUrl === item.url ? 'active' : ''}`}
                              onClick={() => handleReloadFromHistory(item.url)}
                              title={item.title || item.url}
                            >
                              <div className="item-body">
                                <span className={`status-dot-mini ${item.status === 'fetching' ? 'fetching' : ''}`}></span>
                                <span className="item-title">{item.title}</span>
                              </div>
                              <button 
                                className="delete-item-btn"
                                onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                                title="Remove from history"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="sidebar-footer">
                          <button 
                            className="clear-history-link" 
                            onClick={handleClearHistory}
                          >
                            <span>Clear All</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {!zenMode && (
              <div className="left-side">
                <header className="brand-section">
                  <div className="brand-header">
                    <div className="headline-group">
                      <h1 className="headline clickable" onClick={() => setIsHome(true)}>
                        Voilaa!
                        <span className="cursor-blink">_</span>
                      </h1>
                      <button 
                        className="theme-toggle-btn" 
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                      >
                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                      </button>
                      <button 
                        className={`zen-toggle-btn ${workspaceFullscreen ? 'active' : ''}`}
                        onClick={() => setWorkspaceFullscreen(!workspaceFullscreen)}
                        title={workspaceFullscreen ? "Exit Fullscreen" : "Workspace Fullscreen"}
                      >
                        <Monitor size={14} />
                      </button>
                      <button 
                        className={`zen-toggle-btn ${zenMode ? 'active' : ''}`}
                        onClick={() => setZenMode(!zenMode)}
                        title={zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
                      >
                        <Layout size={14} />
                      </button>
                    </div>
                    <div className="status-indicator">
                      <div className="status-dot"></div>
                      <span>SYSTEM ACTIVE</span>
                    </div>
                  </div>
                  <p className="subtitle">
                    Studio-grade learning generation from professional video content.
                  </p>
                  <div className="attribution-row">
                    <div className="attribution-pill">
                      AI CO-PILOT ACTIVE
                    </div>
                    <span className="designer-tag">By Nur Amirah Mohd Kamil</span>
                  </div>
                </header>

                <section 
                  className={`search-section ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className={`drop-overlay ${isDragging ? 'visible' : ''}`}>
                    <div className="drop-content">
                      <Play size={32} className="drop-icon" />
                      <span>Drop YouTube Link Here</span>
                    </div>
                  </div>
                  <div className="input-container">
                    <div className="section-label-group">
                      <label htmlFor="youtube-url" className="input-label">
                        Intelligence Source
                      </label>
                      <span className="label-detail">YouTube H.264/WebM</span>
                    </div>
                    <div className={`search-box ${validationError ? 'has-error' : ''}`}>
                      <div className="search-icon-wrapper">
                        <Play size={14} className="icon-accent" />
                      </div>
                      <input
                        ref={inputRef}
                        id="youtube-url"
                        className="youtube-input"
                        type="text"
                        placeholder="Paste URL to analyze..."
                        value={inputValue}
                        disabled={urlValidating || contentLoading}
                        onKeyDown={handleKeyDown}
                        onFocus={(e) => {
                          e.target.select();
                          setIsInputFocused(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => setIsInputFocused(false), 200);
                        }}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          setValidationError(null);
                        }}
                      />
                      <AnimatePresence>
                        {(isInputFocused || inputValue) && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="clear-input-btn"
                            onClick={handleClear}
                            title="Clear source"
                          >
                            <X size={12} />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                    {validationError && (
                      <div className="workspace-error-message">
                        <AlertCircle size={12} className="error-icon" />
                        <span>{validationError}</span>
                      </div>
                    )}
                  </div>

                  <div className="button-group">
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handleSubmit}
                      className="button-primary submit-button-premium"
                      disabled={urlValidating || contentLoading}
                    >
                      {urlValidating ? (
                        <>
                          <RotateCcw size={18} className="spin" />
                          <span>Validating Signal...</span>
                        </>
                      ) : contentLoading ? (
                        <>
                          <Zap size={18} className="pulse" />
                          <span>Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          <span>Analyze & Build App</span>
                        </>
                      )}
                    </motion.button>
                    
                    <div className="action-row">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDownload}
                        className="button-secondary action-btn-studio"
                        title="Export Code"
                        disabled={!selectedExample && !videoUrl}
                      >
                        <Download size={14} />
                        <span>Export</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleClear}
                        className="button-secondary action-btn-studio"
                        title="Reset Workspace"
                        disabled={!videoUrl && !inputRef.current?.value}
                      >
                        <RotateCcw size={14} />
                        <span>Reset</span>
                      </motion.button>
                    </div>
                  </div>
                </section>

                <section className="monitor-section">
                  <div className="section-label">Source Monitor</div>
                  <div className="video-container-premium">
                    {videoUrl ? (
                      <>
                        <iframe
                          className="video-iframe"
                          src={getYoutubeEmbedUrl(videoUrl)}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen></iframe>
                        {contentLoading && (
                          <div className="synthesis-overlay">
                            <div className="scanning-bar-vertical"></div>
                            <div className="neural-grid-overlay"></div>
                            <div className="processing-status">
                              <RotateCcw size={16} className="spin" />
                              <span>NEURAL_LAYER_ANALYSIS</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="video-placeholder-premium">
                      <motion.div
                        animate={{ 
                          scale: [1, 1.1, 1],
                          opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <Monitor size={32} className="monitor-icon" />
                      </motion.div>
                      <div className="signal-status">
                        <span className="status-indicator-dot"></span>
                        <span>Awaiting Video Signal</span>
                      </div>
                      <div className="scanning-line"></div>
                    </div>
                  )}
                </div>
              </section>

              <section className="diagnostics-section">
                <div className="section-header-compact">
                  <div className="label-with-icon">
                    <Activity size={10} />
                    <span>SIGNAL_DIAGNOSTICS</span>
                  </div>
                  <div className="status-pill-mini">ACTIVE</div>
                </div>
                
                <div className="diagnostics-grid">
                  <div className="diag-item">
                    <div className="diag-label">NEURAL_LOAD</div>
                    <div className="diag-value">64.2%</div>
                    <div className="diag-bar-bg">
                      <motion.div 
                        className="diag-bar-fill"
                        animate={{ width: ['60%', '68%', '62%'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </div>
                  <div className="diag-item">
                    <div className="diag-label">LATENCY_MS</div>
                    <div className="diag-value">12ms</div>
                    <div className="diag-mini-graph">
                      {[...Array(12)].map((_, i) => (
                        <motion.div 
                          key={i}
                          className="graph-bar"
                          animate={{ height: [10, 15, 8, 12][i % 4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="diag-item">
                    <div className="diag-label">ENTROPY_FLUX</div>
                    <div className="diag-value">0.84</div>
                    <div className="diag-meta">OPTIMAL_STATE</div>
                  </div>
                </div>
              </section>
            </div>
          )}

          <div className={`right-side ${zenMode ? 'zen-view' : ''}`}>
            {zenMode && (
              <div className="zen-header">
                <div className="zen-brand clickable" onClick={() => setIsHome(true)}>
                  <span className="brand-dot"></span>
                  <span>Voilaa Dashboard</span>
                </div>
                <div className="zen-controls">
                  <button 
                    className="theme-toggle-btn" 
                    onClick={toggleTheme}
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  </button>
                  <button 
                    className="zen-toggle-btn active"
                    onClick={() => setZenMode(false)}
                    title="Exit Zen Mode"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
            <div className="workspace-area">
              {videoUrl ? (
                <ContentContainer
                  key={reloadCounter}
                  contentBasis={videoUrl}
                  onLoadingStateChange={handleContentLoadingStateChange}
                  preSeededSpec={selectedExample?.spec}
                  preSeededCode={selectedExample?.code}
                  ref={contentContainerRef}
                  isFullscreen={workspaceFullscreen}
                />
              ) : (
                <div className="workspace-placeholder">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="placeholder-content"
                  >
                    <div className="placeholder-visual">
                      <motion.div
                        animate={{ 
                          rotate: 360,
                        }}
                        transition={{ 
                          duration: 20, 
                          repeat: Infinity, 
                          ease: "linear" 
                        }}
                        className="visual-rings"
                      >
                        <div className="ring"></div>
                        <div className="ring"></div>
                        <div className="ring"></div>
                      </motion.div>
                      <Sparkles size={64} className="placeholder-icon" />
                    </div>
                    <div className="placeholder-text-group">
                      <h2>Intelligence Engine Ready</h2>
                      <p>Select an example from the repository or input a video URL to begin the professional synthesis process.</p>
                    </div>
                    <div className="system-ready-badge">
                      <Zap size={12} />
                      <span>All Systems Nominal</span>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </main>

      <style>{`
        .main-container.zen-active {
          max-width: 100vw;
          margin: 0;
          height: 100vh;
          border-radius: 0;
          border: none;
          padding: 0;
        }

        .zen-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          background: var(--color-background-soft);
          border-bottom: 2px solid var(--color-border-soft);
          z-index: 200;
        }

        .zen-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1rem;
          color: var(--color-text);
          letter-spacing: -0.02em;
        }

        .brand-dot {
          width: 8px;
          height: 8px;
          background: var(--color-accent);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--color-accent-glow);
        }

        .zen-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .zen-toggle-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-background-soft);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
        }

        .zen-toggle-btn:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .zen-toggle-btn.active {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .right-side.zen-view {
          width: 100%;
          height: 100vh;
          padding: 0;
          display: flex;
          flex-direction: column;
        }

        .right-side.zen-view .workspace-area {
          flex: 1;
          border-radius: 0;
          border: none;
          background: var(--color-background);
        }

        .right-side.zen-view :global(.content-container) {
          border-radius: 0;
        }

        .main-container.home-view {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-background);
          background-image: 
            radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(var(--color-accent-rgb), 0.15) 0%, transparent 50%),
            radial-gradient(circle at calc(100% - var(--mouse-x)) calc(100% - var(--mouse-y)), rgba(var(--color-accent-rgb), 0.08) 0%, transparent 40%),
            linear-gradient(rgba(var(--color-accent-rgb), 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--color-accent-rgb), 0.05) 1px, transparent 1px);
          background-size: 100% 100%, 100% 100%, 50px 50px, 50px 50px;
          transition: background-image 0.4s cubic-bezier(0.1, 0.7, 1.0, 0.1);
          position: relative;
          overflow: hidden;
        }


        .manifesto-section {
          position: relative;
          padding: 4rem 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          margin-top: -3rem;
          margin-bottom: 0rem;
        }

        @media (max-width: 768px) {
          .manifesto-section {
            padding: 2.5rem 0;
            margin-top: -1.5rem;
          }
          .manifesto-watermark {
            font-size: 6rem !important;
          }
          .mission-statement {
            font-size: 1.5rem !important;
          }
        }

        .manifesto-watermark {
          position: absolute;
          font-size: clamp(8rem, 20vw, 15rem);
          font-weight: 900;
          color: var(--color-text);
          opacity: 0.03;
          letter-spacing: -0.05em;
          z-index: 0;
          pointer-events: none;
          user-select: none;
          font-family: var(--font-display);
          white-space: nowrap;
        }

        .manifesto-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          max-width: 800px;
          padding: 0 2rem;
        }

        .neural-status {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: var(--font-technical);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-accent);
          letter-spacing: 0.2em;
          background: rgba(var(--color-accent-rgb), 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: 2rem;
          border: 1px solid rgba(var(--color-accent-rgb), 0.1);
        }

        .neural-status .heartbeat {
          width: 6px;
          height: 6px;
          background: var(--color-accent);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--color-accent);
          animation: heartbeat-pulse 1.5s ease-in-out infinite;
        }

        @keyframes heartbeat-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }

        .mission-statement {
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 5vw, 2.75rem);
          line-height: 1.1;
          font-weight: 800;
          color: var(--color-text);
          letter-spacing: -0.03em;
        }

        .mission-statement span {
          display: block;
          margin-top: 1rem;
          font-family: var(--font-technical);
          font-size: clamp(0.875rem, 2vw, 1.125rem);
          font-weight: 400;
          color: var(--color-text-muted);
          letter-spacing: 0;
          text-transform: none;
        }


        .marquee-section {
          margin: 0;
          width: 100%;
          overflow: hidden;
          background: rgba(var(--color-accent-rgb), 0.02);
          border-top: 1px solid var(--color-border-soft);
          border-bottom: 1px solid var(--color-border-soft);
        }

        .marquee-wrapper {
          width: 100%;
          overflow: hidden;
          position: relative;
          padding: 0.75rem 0;
        }

        .marquee-track {
          display: flex;
          gap: 1rem;
          width: fit-content;
          animation: marquee-forward 60s linear infinite;
        }

        @keyframes marquee-forward {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-33.33% - 0.33rem)); }
        }

        .marquee-pill {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.4rem 1rem;
          background: var(--color-background-elevated);
          border: 1px solid var(--color-border-soft);
          border-radius: 2rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .pill-dot {
          width: 4px;
          height: 4px;
          background: var(--color-accent);
          border-radius: 50%;
          opacity: 0.6;
        }

        .pill-title {
          font-family: var(--font-technical);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: 0.02em;
        }

        .pill-action {
          font-family: var(--font-technical);
          font-size: 0.55rem;
          font-weight: 800;
          color: var(--color-accent);
          opacity: 0.4;
          letter-spacing: 0.05em;
        }

        .marquee-pill:hover .pill-action {
          opacity: 1;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-technical);
          font-size: 0.5rem;
          color: var(--color-accent);
          background: var(--color-accent-soft);
          padding: 0.25rem 0.6rem;
          border-radius: 2px;
        }

        .live-dot {
          width: 4px;
          height: 4px;
          background: currentColor;
          border-radius: 50%;
          animation: pulse-mini 1s infinite;
        }

        .main-container.home-view::before {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at center, transparent 0%, var(--color-background) 85%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          opacity: 0.2;
          pointer-events: none;
        }

        .main-container.home-view::after {
          content: '';
          position: absolute;
          width: 200%;
          height: 200%;
          top: -50%;
          left: -50%;
          background-image: radial-gradient(circle, rgba(var(--color-accent-rgb), 0.02) 0%, transparent 50%);
          animation: float 20s infinite linear;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes float {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .home-dashboard {
          width: 100%;
          max-width: 1100px;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 2rem;
          overflow-y: auto;
          scrollbar-width: none;
        }

        @media (max-width: 768px) {
          .home-dashboard {
            padding: 1rem;
          }
        }

        .home-dashboard::-webkit-scrollbar { display: none; }

        .home-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          padding-top: 2rem;
        }

        @media (max-width: 768px) {
          .home-hero {
            flex-direction: column;
            gap: 1.5rem;
            padding-top: 1rem;
          }
        }

        .brand-group {
          max-width: 600px;
        }

        .hero-headline {
          font-family: var(--font-display);
          font-size: clamp(4rem, 10vw, 6rem);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.06em;
          color: var(--color-text);
          margin: 0.5rem 0 1.5rem;
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
          position: relative;
        }

        @media (max-width: 768px) {
          .hero-headline {
            font-size: 3.5rem;
            flex-wrap: wrap;
          }
          .hero-subtitle {
            font-size: 1rem !important;
            max-width: 100% !important;
          }
        }

        .hero-headline span:first-child {
          background: linear-gradient(to right, var(--color-text), var(--color-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 30px rgba(var(--color-accent-rgb), 0.1));
        }

        .hero-headline span:last-child {
          color: var(--color-accent);
          background: none;
          -webkit-text-fill-color: var(--color-accent);
          animation: cursor-blink 1s step-end infinite;
        }

        @keyframes cursor-blink {
          50% { opacity: 0; }
        }

        .system-readout {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          font-family: var(--font-technical);
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .mono-code {
          color: var(--color-accent);
          padding: 0.25rem 0.6rem;
          background: var(--color-accent-soft);
          border-radius: 2px;
          border-left: 3px solid var(--color-accent);
        }

        .mono-status {
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          padding: 0.25rem 0.6rem;
          border-radius: 2px;
          opacity: 0.7;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mono-status::before {
          content: '';
          width: 4px;
          height: 4px;
          background: var(--color-accent);
          border-radius: 50%;
          animation: pulse-mini 1s infinite;
        }

        .hero-subtitle {
          font-size: 1.25rem;
          line-height: 1.6;
          color: var(--color-text-muted);
          max-width: 480px;
          margin: 0;
        }

        .search-hub {
          position: relative;
          margin-bottom: 3rem;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-hub:focus-within {
          transform: translateY(-2px);
        }

        .search-hub.dragging {
          transform: translateY(-4px) scale(1.01);
        }

        .hub-input-wrapper {
          position: relative;
          z-index: 5;
        }

        .hub-input-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          padding: 0 1rem;
        }

        .hub-input-header label {
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--color-text-muted);
        }

        .hub-input-header span {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-accent);
          opacity: 0.8;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .hub-input-header span::before {
          content: '';
          width: 6px;
          height: 6px;
          background: currentColor;
          border-radius: 50%;
          animation: pulse-mini 1s infinite;
        }

        .hub-search-box {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          background: rgba(var(--color-background-elevated-rgb), 0.8);
          backdrop-filter: blur(12px);
          padding: 1rem;
          border-radius: 2.5rem;
          border: 1px solid var(--color-border);
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);
          transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
          width: 100%;
          max-width: 800px;
          position: relative;
          overflow: hidden;
        }

        .hub-search-box.has-error {
          border-color: var(--color-error) !important;
          box-shadow: 0 0 0 1px var(--color-error), 0 10px 30px -10px rgba(239, 68, 68, 0.2) !important;
        }

        .search-box.has-error .youtube-input {
          border-color: var(--color-error) !important;
          box-shadow: 0 0 0 1px var(--color-error) !important;
        }

        .hub-error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-error);
          font-size: 0.8125rem;
          font-weight: 500;
          margin-top: 0.75rem;
          padding: 0 1.5rem;
          animation: slide-down-error 0.25s ease-out;
        }

        .workspace-error-message {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--color-error);
          font-size: 0.75rem;
          font-weight: 500;
          margin-top: 0.5rem;
          animation: slide-down-error 0.25s ease-out;
        }

        @keyframes slide-down-error {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .hub-search-box {
            flex-direction: column;
            border-radius: 1rem;
            padding: 0.75rem;
            gap: 1rem;
          }
          .hub-search-icon {
            display: none;
          }
          .hub-input {
            width: 100%;
            font-size: 1rem !important;
            text-align: center;
          }
          .hub-submit-btn {
            width: 100%;
            justify-content: center;
            border-radius: 0.75rem;
          }
        }

        .search-hub:focus-within .hub-search-box {
          border-color: var(--color-accent);
          background: var(--color-background);
          box-shadow: 
            0 0 0 1px var(--color-accent),
            0 20px 40px -12px rgba(var(--color-accent-rgb), 0.25);
          animation: focus-border-pulse 2s infinite ease-in-out;
        }

        @keyframes focus-border-pulse {
          0%, 100% { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent), 0 20px 40px -12px rgba(var(--color-accent-rgb), 0.25); }
          50% { border-color: rgba(var(--color-accent-rgb), 0.5); box-shadow: 0 0 0 1px rgba(var(--color-accent-rgb), 0.5), 0 15px 30px -12px rgba(var(--color-accent-rgb), 0.15); }
        }

        .hub-drop-overlay {
          position: absolute;
          inset: 0;
          background: rgba(var(--color-accent-rgb), 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateY(100%);
        }

        .hub-drop-overlay.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .drop-content-mini {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: white;
          font-family: var(--font-technical);
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .drop-icon-zap {
          filter: drop-shadow(0 0 10px rgba(255,255,255,0.5));
          animation: zap-shake 0.5s infinite;
        }

        @keyframes zap-shake {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          75% { transform: scale(1.1) rotate(5deg); }
        }

        .hub-search-icon {
          color: var(--color-text-muted);
          margin-left: 1rem;
          transition: color 0.3s ease;
        }

        .search-hub:focus-within .hub-search-icon {
          color: var(--color-accent);
        }

        .hub-input {
          flex: 1;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          font-size: 1.125rem !important;
          color: var(--color-text) !important;
          font-family: var(--font-technical);
          padding: 0 !important;
        }

        .hub-input::placeholder {
          color: var(--color-text-muted);
          opacity: 0.5;
        }

        .hub-submit-btn {
          padding: 0.75rem 2rem;
          background: var(--color-accent);
          color: white;
          border: none;
          border-radius: 1.25rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 10px 20px -5px rgba(var(--color-accent-rgb), 0.4);
          white-space: nowrap;
        }

        .hub-submit-btn:hover:not(:disabled) {
          background: #ea580c;
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -5px rgba(var(--color-accent-rgb), 0.5);
        }

        .hub-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .hub-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .home-footer {
          margin-top: 6rem;
          padding: 3rem 0;
          border-top: 1px solid var(--color-border-soft);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .designer-credit {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .designer-credit span {
          font-size: 0.55rem;
          font-weight: 800;
          color: var(--color-text-muted);
          letter-spacing: 0.1em;
        }

        .designer-credit strong {
          font-size: 0.75rem;
          color: var(--color-text);
          letter-spacing: 0.05em;
        }

        .tech-stack {
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--color-text-muted);
          background: var(--color-background-soft);
          padding: 0.4rem 0.8rem;
          border-radius: 4px;
          border: 1px solid var(--color-border);
        }

        .clickable {
          cursor: pointer;
          transition: color 0.2s;
        }

        .clickable:hover {
          color: var(--color-accent);
        }

        .main-container {
          max-width: 1500px;
          margin: 1.5rem auto;
          height: calc(100vh - 3rem);
          padding: 1.5rem;
          display: flex;
          gap: 1.5rem;
          box-sizing: border-box;
          overflow: hidden;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 2.5rem;
          box-shadow: 
            0 20px 50px -12px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.05);
          background-image: 
            radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.03) 0%, transparent 40%),
            radial-gradient(circle at 90% 90%, rgba(251, 191, 36, 0.03) 0%, transparent 40%);

          @media (max-width: 1024px) {
            flex-direction: column;
            padding: 1rem;
            height: auto;
            margin: 0;
            max-width: none;
            border: none;
            border-radius: 0;
            overflow: visible;
            gap: 2rem;
          }

          @media (max-width: 480px) {
            padding: 0.75rem;
            gap: 1.5rem;
          }
        }

        .left-side {
          width: 360px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          overflow-y: auto;
          scrollbar-width: none;
          flex-shrink: 0;
          padding-right: 0.25rem;

          @media (max-width: 1024px) {
            width: 100%;
            height: auto;
            overflow: visible;
            padding-right: 0;
            gap: 2rem;
          }
        }

        .left-side::-webkit-scrollbar { display: none; }

        .brand-section {
          padding: 0.5rem 0;
        }

        .brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .headline-group {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .theme-toggle-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-background-soft);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
        }

        .theme-toggle-btn:hover {
          background: var(--color-background-elevated);
          border-color: var(--color-accent);
          color: var(--color-accent);
          transform: rotate(15deg);
        }

        .headline {
          color: var(--color-text);
          font-family: var(--font-display);
          font-size: 3.25rem;
          font-weight: 800;
          margin: 0;
          line-height: 0.9;
          letter-spacing: -0.06em;
          display: flex;
          align-items: baseline;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--color-text-muted);
          letter-spacing: 0.1em;
          background: var(--color-background-soft);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid var(--color-border);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: var(--color-success);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--color-success);
          animation: pulse-status 2s infinite;
        }

        @keyframes pulse-status {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .cursor-blink {
          color: var(--color-accent);
          animation: blink 1s step-end infinite;
          font-size: 0.7em;
          margin-left: 0.05em;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        .subtitle {
          color: var(--color-text-muted);
          font-size: 0.9375rem;
          margin: 0;
          line-height: 1.6;
          font-weight: 400;
          max-width: 90%;
        }

        .attribution-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1.25rem;
        }

        .attribution-pill {
          padding: 0.2rem 0.6rem;
          background: var(--color-accent-soft);
          color: var(--color-accent);
          border-radius: 4px;
          font-size: 0.55rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: 1px solid rgba(var(--color-accent-rgb), 0.2);
        }

        .designer-tag {
          font-size: 0.7rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .section-label {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--color-text-muted);
          margin-bottom: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, var(--color-border-soft), transparent);
        }

        .search-section {
          background: var(--color-background-soft);
          border: 1px solid var(--color-border);
          padding: 1.5rem;
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-section.dragging {
          border-color: var(--color-accent);
          background: rgba(var(--color-accent-rgb), 0.05);
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(var(--color-accent-rgb), 0.15);
        }

        .drop-overlay {
          position: absolute;
          inset: 0;
          background: rgba(var(--color-accent-rgb), 0.1);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .drop-overlay.visible {
          opacity: 1;
        }

        .drop-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: var(--color-accent);
          font-weight: 700;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .drop-icon {
          animation: bounce-drop 1s infinite alternate;
        }

        @keyframes bounce-drop {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }

        .search-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: var(--color-accent);
          opacity: 0.5;
        }

        .section-label-group {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.5rem;
        }

        .label-detail {
          font-size: 0.55rem;
          color: var(--color-text-muted);
          font-weight: 600;
          opacity: 0.6;
        }

        .input-label {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--color-text);
        }

        .search-box {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon-wrapper {
          position: absolute;
          left: 1rem;
          color: var(--color-accent);
          display: flex;
          align-items: center;
          pointer-events: none;
          z-index: 2;
        }

        .youtube-input {
          width: 100% !important;
          padding-left: 2.75rem !important;
          background-color: var(--color-background-elevated) !important;
          border: 1px solid var(--color-border) !important;
          font-family: var(--font-technical);
          font-size: 0.8125rem !important;
        }

        .youtube-input:focus {
          border-color: var(--color-accent) !important;
          box-shadow: 0 0 0 1px var(--color-accent) !important;
        }

        .clear-input-btn {
          position: absolute;
          right: 0.75rem;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          background: var(--color-background-soft);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-input-btn:hover {
          background: var(--color-error);
          color: white;
          border-color: var(--color-error);
        }

        .button-group {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .submit-button-premium {
          width: 100%;
          padding: 1.125rem !important;
          font-size: 0.9375rem !important;
          background: linear-gradient(135deg, var(--color-accent), #ea580c) !important;
          border-radius: var(--radius-md) !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          box-shadow: 0 8px 24px -6px rgba(var(--color-accent-rgb), 0.4) !important;
        }

        .submit-button-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px -8px rgba(var(--color-accent-rgb), 0.5) !important;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

        .action-row {
          display: flex;
          gap: 0.75rem;
        }

        .action-btn-studio {
          flex: 1;
          padding: 0.625rem !important;
          font-size: 0.7rem !important;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-radius: var(--radius-md) !important;
          background: var(--color-background-soft) !important;
          border: 1px solid var(--color-border) !important;
          color: var(--color-text) !important;
        }

        .monitor-section {
          display: flex;
          flex-direction: column;
        }

        .video-container-premium {
          aspect-ratio: 16/9;
          background-color: #000;
          border-radius: var(--radius-lg);
          border: 2px solid var(--color-border);
          overflow: hidden;
          position: relative;
          box-shadow: var(--shadow-lg), 0 0 20px rgba(0,0,0,0.4);
          z-index: 1;
        }

        .synthesis-overlay {
          position: absolute;
          inset: 0;
          background: rgba(var(--color-accent-rgb), 0.05);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          pointer-events: none;
        }

        .scanning-bar-vertical {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--color-accent);
          box-shadow: 0 0 15px var(--color-accent);
          animation: scan-horizontal 4s infinite ease-in-out;
        }

        @keyframes scan-horizontal {
          0% { left: 0; }
          50% { left: 100%; }
          100% { left: 0; }
        }

        .neural-grid-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(var(--color-accent-rgb), 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--color-accent-rgb), 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
          opacity: 0.3;
        }

        .processing-status {
          background: rgba(0,0,0,0.8);
          padding: 0.5rem 1rem;
          border-radius: 4px;
          border: 1px solid var(--color-accent);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--color-accent);
          font-family: var(--font-technical);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          z-index: 20;
        }

        .diagnostics-section {
          margin-top: 1.5rem;
          background: rgba(var(--color-background-elevated-rgb), 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid var(--color-border-soft);
          border-radius: var(--radius-md);
          padding: 1.25rem;
        }

        .section-header-compact {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .label-with-icon {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-technical);
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--color-text-muted);
          letter-spacing: 0.1rem;
        }

        .status-pill-mini {
          font-family: var(--font-technical);
          font-size: 0.5rem;
          color: var(--color-accent);
          background: var(--color-accent-soft);
          padding: 0.15rem 0.5rem;
          border-radius: 2px;
          font-weight: 800;
        }

        .diagnostics-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        @media (max-width: 768px) {
           .diagnostics-grid {
             display: grid;
             grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
             gap: 1rem;
           }
        }

        @media (max-width: 480px) {
           .diagnostics-grid {
             grid-template-columns: 1fr;
           }
        }

        .diag-item {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .diag-label {
          font-family: var(--font-technical);
          font-size: 0.55rem;
          color: var(--color-text-muted);
          opacity: 0.7;
          letter-spacing: 0.05rem;
        }

        .diag-value {
          font-family: var(--font-technical);
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .diag-bar-bg {
          height: 3px;
          background: var(--color-border-soft);
          border-radius: 1px;
          overflow: hidden;
          margin-top: 2px;
        }

        .diag-bar-fill {
          height: 100%;
          background: var(--color-accent);
          box-shadow: 0 0 8px var(--color-accent);
        }

        .diag-mini-graph {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 24px;
          margin-top: 4px;
        }

        .graph-bar {
          flex: 1;
          background: var(--color-accent);
          opacity: 0.4;
          border-radius: 1px;
        }

        .diag-meta {
          font-family: var(--font-technical);
          font-size: 0.55rem;
          color: var(--color-accent);
          font-weight: 700;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.1rem;
        }

        .video-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }

        .video-placeholder-premium {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          background: radial-gradient(circle at center, #1c1917, #0c0a09);
          color: var(--color-text-muted);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          position: relative;
          overflow: hidden;
        }

        .scanning-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
          opacity: 0.2;
          animation: scan 3s linear infinite;
        }

        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(500px); }
        }

        .signal-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          opacity: 0.6;
        }

        .status-indicator-dot {
          width: 6px;
          height: 6px;
          background: var(--color-accent);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--color-accent);
          animation: pulse-mini 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-mini {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }

        .monitor-icon {
          color: var(--color-accent);
        }

        .right-side {
          flex: 1;
          height: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;

          @media (max-width: 1024px) {
            height: auto;
            gap: 2rem;
          }
        }

        .workspace-area {
          flex: 1;
          background: var(--color-background-soft);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border);
          overflow: hidden;
          box-shadow: var(--shadow-xl), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          position: relative;

          @media (max-width: 768px) {
            border-radius: var(--radius-lg);
            min-height: 500px;
          }
        }

        .workspace-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
          background: radial-gradient(circle at center, rgba(var(--color-accent-rgb), 0.03), transparent);
        }

        .placeholder-content {
          max-width: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .placeholder-visual {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 140px;
          height: 140px;
        }

        .placeholder-icon {
          color: var(--color-accent);
          filter: drop-shadow(0 0 20px var(--color-accent-glow));
          z-index: 2;
        }

        .visual-rings {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ring {
          position: absolute;
          border: 1px solid var(--color-border);
          border-radius: 50%;
          animation: ring-expand 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          opacity: 0;
        }

        .ring:nth-child(1) { width: 100%; height: 100%; animation-delay: 0s; }
        .ring:nth-child(2) { width: 100%; height: 100%; animation-delay: 2s; }
        .ring:nth-child(3) { width: 100%; height: 100%; animation-delay: 4s; }

        @keyframes ring-expand {
          0% { transform: scale(0.6); opacity: 0; border-color: var(--color-accent); }
          20% { opacity: 0.3; }
          100% { transform: scale(1.6); opacity: 0; border-color: var(--color-border); }
        }

        .placeholder-text-group h2 {
          font-family: var(--font-display);
          font-size: 2.75rem;
          margin: 0 0 1rem 0;
          letter-spacing: -0.04em;
          color: var(--color-text);
          font-weight: 800;
          line-height: 1;
        }

        .placeholder-text-group p {
          color: var(--color-text-muted);
          line-height: 1.6;
          margin: 0;
          font-size: 1.125rem;
          font-weight: 400;
        }

        .system-ready-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--color-background-elevated);
          border: 1px solid var(--color-border);
          border-radius: 2rem;
          font-family: var(--font-technical);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-accent);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        /* Collapsible History Sidebar Styles */
        .history-sidebar {
          display: flex;
          flex-direction: column;
          background: var(--color-background-soft);
          border-right: 1px solid var(--color-border);
          height: 100%;
          overflow: hidden;
          transition: width 0.3s ease, border-color 0.3s ease;
          position: relative;
          box-sizing: border-box;
          flex-shrink: 0;
          z-index: 50;

          @media (max-width: 1024px) {
            width: 100% !important;
            height: auto;
            border-right: none;
            border-bottom: 1px solid var(--color-border);
          }
        }

        .history-sidebar.collapsed {
          width: 44px;
        }

        .history-sidebar.expanded {
          width: 260px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid var(--color-border);
          min-height: 52px;
          box-sizing: border-box;

          @media (max-width: 1024px) {
            min-height: auto;
            padding: 0.75rem 1rem;
          }
        }

        .sidebar-title-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.85rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .text-accent {
          color: var(--color-accent);
        }

        .sidebar-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--color-background-elevated);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sidebar-toggle-btn:hover {
          color: var(--color-text);
          border-color: var(--color-accent);
          background: var(--color-accent-soft);
        }

        .sidebar-toggle-btn.collapsed-state {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          margin: 0 auto;
        }

        .sidebar-content-wrapper {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
          padding: 1rem 0;

          @media (max-width: 1024px) {
            max-height: 240px;
            overflow-y: auto;
          }
        }

        .sidebar-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          text-align: center;
          color: var(--color-text-muted);
          gap: 0.75rem;
          flex: 1;
        }

        .sidebar-empty p {
          font-size: 0.75rem;
          margin: 0;
        }

        .empty-icon {
          opacity: 0.4;
        }

        .sidebar-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0 0.75rem;
          overflow-y: auto;
          flex: 1;
          scrollbar-width: thin;
        }

        .history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.75rem;
          background: var(--color-background-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          gap: 0.5rem;
          overflow: hidden;
        }

        .history-item:hover {
          border-color: var(--color-accent);
          background: var(--color-accent-soft);
        }

        .history-item.active {
          border-color: var(--color-accent);
          background: var(--color-accent-soft);
          box-shadow: 0 0 10px var(--color-accent-soft);
        }

        .item-body {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }

        .status-dot-mini {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-success);
          flex-shrink: 0;
        }

        .status-dot-mini.fetching {
          background: var(--color-accent);
          animation: pulse-mini 1.5s infinite ease-in-out;
        }

        @keyframes pulse-mini {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .item-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .delete-item-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .history-item:hover .delete-item-btn {
          opacity: 1;
        }

        .delete-item-btn:hover {
          color: var(--color-error);
          background: rgba(239, 68, 68, 0.1);
        }

        .sidebar-footer {
          padding: 0.75rem 0.75rem 0;
          border-top: 1px solid var(--color-border);
          display: flex;
          justify-content: center;
          margin-top: auto;
        }

        .clear-history-link {
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          font-size: 0.7rem;
          font-family: var(--font-technical);
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.5rem;
          transition: color 0.2s ease;
        }

        .clear-history-link:hover {
          color: var(--color-error);
          text-decoration: underline;
        }

        .desktop-gallery-container {
          @media (max-width: 1024px) { display: none; }
        }

        .mobile-gallery-container {
          display: none;
          @media (max-width: 1024px) { 
            display: block; 
            padding-bottom: 3rem;
          }
        }
      `}</style>

    </>
  );
}

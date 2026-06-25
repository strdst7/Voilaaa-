/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import Editor from '@monaco-editor/react';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import {motion, AnimatePresence} from 'motion/react';

// import 'react-tabs/style/react-tabs.css'

import {GoogleGenAI, Type} from '@google/genai';
import {parseHTML, parseJSON} from '@/lib/parse';
import {
  CODE_REGION_CLOSER,
  CODE_REGION_OPENER,
  SPEC_ADDENDUM,
  SPEC_FROM_VIDEO_PROMPT,
} from '@/lib/prompts';
import {getYouTubeVideoTitle} from '@/lib/youtube';
import {generateText} from '@/lib/textGeneration';
import { QuizQuestion } from '@/lib/types';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Settings, Sliders, Zap, Sparkles, Cpu, ChevronDown, ChevronUp, RefreshCw, FileText, Eye, Code as CodeIcon, X, HelpCircle, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, Award, Share2} from 'lucide-react';

interface ContentContainerProps {
  contentBasis: string;
  preSeededSpec?: string;
  preSeededCode?: string;
  onLoadingStateChange?: (isLoading: boolean) => void;
  isFullscreen?: boolean;
}

type LoadingState = 'loading-spec' | 'loading-code' | 'ready' | 'error';
type ModelType = 'gemini-3-flash-preview' | 'gemini-3.1-pro-preview';

interface GenerationParams {
  specModel: ModelType;
  codeModel: ModelType;
  temperature: number;
  depth: 'concise' | 'balanced' | 'detailed';
}

// Export the ContentContainer component as a forwardRef component
export default forwardRef(function ContentContainer(
  {
    contentBasis,
    preSeededSpec,
    preSeededCode,
    onLoadingStateChange,
    isFullscreen = false,
  }: ContentContainerProps,
  ref,
) {
  const [spec, setSpec] = useState<string>(preSeededSpec || '');
  const [code, setCode] = useState<string>(preSeededCode || '');
  const [iframeKey, setIframeKey] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(
    preSeededSpec && preSeededCode ? 'ready' : 'loading-spec',
  );
  const [error, setError] = useState<string | null>(null);
  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [editedSpec, setEditedSpec] = useState('');
  const [activeTabIndex, setActiveTabIndex] = useState(0); // 0: Render, 1: Code, 2: Spec
  const [showSpecPreview, setShowSpecPreview] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSections, setActiveSections] = useState<string[]>(['models', 'curriculum']);
  
  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  
  const toggleSection = (section: string) => {
    setActiveSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };
  
  const [params, setParams] = useState<GenerationParams>({
    specModel: 'gemini-3-flash-preview',
    codeModel: 'gemini-3.1-pro-preview',
    temperature: 0.75,
    depth: 'balanced'
  });

  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}${window.location.pathname}?url=${encodeURIComponent(contentBasis)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }).catch(err => {
        console.error('Failed to copy share link: ', err);
      });
    }
  };

  // Expose methods to the parent component through ref
  useImperativeHandle(ref, () => ({
    getSpec: () => spec,
    getCode: () => code,
  }));

  // Helper function to generate content spec from video
  const generateSpecFromVideo = async (videoUrl: string, currentParams: GenerationParams): Promise<string> => {
    let title = '';
    try {
      title = await getYouTubeVideoTitle(videoUrl);
    } catch (e) {
      console.warn('Could not fetch video title:', e);
    }

    const depthPrompt = currentParams.depth === 'detailed' 
      ? "Be extremely detailed and comprehensive, covering every nuance." 
      : currentParams.depth === 'concise' 
        ? "Be extremely concise and focused on the absolute essentials." 
        : "";

    const specResponse = await generateText({
      modelName: currentParams.specModel,
      prompt: `${SPEC_FROM_VIDEO_PROMPT}${depthPrompt ? `\n\n${depthPrompt}` : ''}${title ? `\n\nVideo Title: ${title}` : ''}`,
      videoUrl: videoUrl,
      temperature: currentParams.temperature,
    });

    const parsed = parseJSON(specResponse);
    let specValue = parsed.spec || '';
    
    if (!specValue) {
      // If we couldn't parse the expected JSON structure, try to use the raw response as spec
      specValue = specResponse.substring(0, 2000); 
    }

    if (!specValue) {
      throw new Error('Failed to generate learning specification from video.');
    }
    
    specValue += SPEC_ADDENDUM;

    return specValue;
  };

  // Helper function to generate code from content spec
  const generateCodeFromSpec = async (spec: string, currentParams: GenerationParams): Promise<string> => {
    const codeResponse = await generateText({
      modelName: currentParams.codeModel,
      prompt: spec,
      temperature: currentParams.temperature,
    });

    const code = parseHTML(
      codeResponse,
      CODE_REGION_OPENER,
      CODE_REGION_CLOSER,
    );
    return code;
  };

  // Propagate loading state changes as a boolean
  useEffect(() => {
    if (onLoadingStateChange) {
      const isLoading =
        loadingState === 'loading-spec' || loadingState === 'loading-code';
      onLoadingStateChange(isLoading);
    }
  }, [loadingState, onLoadingStateChange]);

  // On mount (or when contentBasis changes), generate a content spec and then use that spec to generate code
  useEffect(() => {
    async function generateContent() {
      // Reset states
      setError(null);
      setActiveTabIndex(0); // Reset to Render tab on new video
      
      // If we have COMPLETE pre-seeded content, use it
      if (preSeededSpec && preSeededCode) {
        setSpec(preSeededSpec);
        setCode(preSeededCode);
        
        setLoadingState('ready');
        return;
      }

      try {
        setLoadingState('loading-spec');
        setSpec('');
        setCode('');

        // Generate a content spec based on video content
        const generatedSpec = await generateSpecFromVideo(contentBasis, params);
        setSpec(generatedSpec);
        
        setLoadingState('loading-code');

        // Generate code using the generated content spec
        const generatedCode = await generateCodeFromSpec(generatedSpec, params);
        setCode(generatedCode);
        setLoadingState('ready');
      } catch (err) {
        console.error(
          'An error occurred while attempting to generate content:',
          err,
        );
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred',
        );
        setLoadingState('error');
      }
    }

    generateContent();
  }, [contentBasis, preSeededSpec, preSeededCode]);

  const handleRegenerate = async () => {
    try {
      setLoadingState('loading-spec');
      setError(null);
      setShowSettings(false);
      setShowQuiz(false); // Reset quiz view on model regeneration
      
      const generatedSpec = await generateSpecFromVideo(contentBasis, params);
      setSpec(generatedSpec);
      setLoadingState('loading-code');
      
      const generatedCode = await generateCodeFromSpec(generatedSpec, params);
      setCode(generatedCode);
      setLoadingState('ready');
    } catch (err) {
      console.error('Manual regeneration failed:', err);
      setError(err instanceof Error ? err.message : 'Regeneration failed');
      setLoadingState('error');
    }
  };

  const generateQuiz = async () => {
    if (!spec) return;
    
    setIsGeneratingQuiz(true);
    setError(null);
    setShowQuiz(true);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setQuizCompleted(false);
    setUserAnswers([]);
    setQuizFeedback(null);
    setIsAnswerCorrect(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Based on the following learning specification, generate an interactive quiz with 5 multiple-choice questions. 
      The questions should test deep understanding of the core concepts.
      
      Specification:
      ${spec}
      
      Your response MUST be a JSON array of objects, where each object follows this structure:
      {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": 0, // Index of the correct option (0-3)
        "explanation": "A brief explanation of why this is correct"
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ['question', 'options', 'correctAnswer', 'explanation']
            }
          }
        }
      });

      const questions = JSON.parse(response.text);
      setQuizQuestions(questions);
      setUserAnswers(new Array(questions.length).fill(null));
    } catch (err) {
      console.error('Quiz generation failed:', err);
      setError('Failed to generate quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (quizFeedback !== null || quizCompleted) return;

    const currentQuestion = quizQuestions[currentQuestionIndex];
    const isCorrect = optionIndex === currentQuestion.correctAnswer;
    
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestionIndex] = optionIndex;
    setUserAnswers(newUserAnswers);
    
    setIsAnswerCorrect(isCorrect);
    setQuizFeedback(currentQuestion.explanation);
    
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuizFeedback(null);
      setIsAnswerCorrect(null);
    } else {
      setQuizCompleted(true);
    }
  };

  const resetQuiz = () => {
    setShowQuiz(false);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setQuizCompleted(false);
    setUserAnswers([]);
    setQuizFeedback(null);
    setIsAnswerCorrect(null);
  };

  // Re-render iframe when code changes
  useEffect(() => {
    if (code) {
      setIframeKey((prev) => prev + 1);
    }
  }, [code]);

  // Show save message when code changes manually (not during initial load)
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => {
        setSaveMessage('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleCodeChange = (value: string | undefined) => {
    setCode(value || '');
    setSaveMessage('HTML updated. Changes will appear in the Render tab.');
  };

  const handleSpecEdit = () => {
    setEditedSpec(spec);
    setIsEditingSpec(true);
  };

  const handleSpecSave = async () => {
    const trimmedEditedSpec = editedSpec.trim();

    // Only regenerate if the spec has actually changed
    if (trimmedEditedSpec === spec) {
      setIsEditingSpec(false); // Close the editor
      setEditedSpec(''); // Reset edited spec state
      return;
    }

    try {
      setLoadingState('loading-code');
      setError(null);
      setSpec(trimmedEditedSpec); // Update spec state with trimmed version
      setIsEditingSpec(false);
      setActiveTabIndex(1); // Switch to code tab

      // Generate code using the edited content spec
      const generatedCode = await generateCodeFromSpec(trimmedEditedSpec, params);
      setCode(generatedCode);
      setLoadingState('ready');
    } catch (err) {
      console.error(
        'An error occurred while attempting to generate code:',
        err,
      );
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred',
      );
      setLoadingState('error');
    }
  };

  const handleSpecCancel = () => {
    setIsEditingSpec(false);
    setEditedSpec('');
  };

  const renderLoadingSpinner = () => (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        gap: '1.5rem',
      }}>
      <div className="loading-spinner"></div>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
        {loadingState === 'loading-spec'
          ? 'Processing YouTube URL...'
          : 'Crafting interactive experience...'}
      </p>
    </div>
  );

  const renderErrorState = () => (
    <div
      style={{
        alignItems: 'center',
        color: 'var(--color-error)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        gap: '1rem',
      }}>
      <div
        style={{
          fontFamily: 'var(--font-technical)',
          fontSize: '2rem',
          opacity: 0.5,
        }}>
        [!]
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
        <h3 style={{fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)'}}>Error</h3>
        <p style={{fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '300px'}}>{error || 'Something went wrong'}</p>
      </div>
      {!contentBasis.startsWith('http://') &&
      !contentBasis.startsWith('https://') ? (
        <p style={{fontSize: '0.75rem', opacity: 0.7}}>
          Note: URL must begin with http:// or https://
        </p>
      ) : null}
    </div>
  );

  // Styles for tab list
  const tabListStyle = {
    backgroundColor: 'transparent',
    display: 'flex',
    listStyle: 'none',
    margin: 0,
    padding: '0 12px',
  };

  // Styles for tabs
  const tabStyle = {
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '4px',
    padding: '8px 12px',
  };

  // Base style for button container in spec tab
  const buttonContainerStyle = {padding: '0 1rem 1rem'};

  const renderQuiz = () => {
    if (isGeneratingQuiz) {
      return (
        <div className="quiz-loading-container">
          <RefreshCw size={24} className="spin icon-blue" />
          <p>Synthesizing assessment modules...</p>
        </div>
      );
    }

    if (quizCompleted) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="quiz-results-container"
        >
          <div className="results-header">
            <Award size={32} className="icon-purple" />
            <h3>Assessment Complete</h3>
            <div className="score-display">
              <span className="score-num">{quizScore}</span>
              <span className="score-total">/ {quizQuestions.length}</span>
            </div>
          </div>
          
          <div className="results-feedback">
            {quizScore === quizQuestions.length ? (
              <p>Exceptional performance. Core concepts fully integrated.</p>
            ) : quizScore > quizQuestions.length / 2 ? (
              <p>Strong baseline. Consider reviewing minor discrepancies.</p>
            ) : (
              <p>Further synthesis required. Review spec content for clarification.</p>
            )}
          </div>

          <div className="results-actions">
            <button onClick={generateQuiz} className="button-primary">
              Retake Assessment
            </button>
            <button onClick={resetQuiz} className="button-secondary">
              Back to Spec
            </button>
          </div>
        </motion.div>
      );
    }

    if (quizQuestions.length === 0) return null;

    const currentQuestion = quizQuestions[currentQuestionIndex];

    return (
      <div className="quiz-active-container">
        <div className="quiz-progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
          ></div>
        </div>

        <div className="question-header">
          <span className="question-counter">MODULE_0{currentQuestionIndex + 1}</span>
          <h3 className="question-text">{currentQuestion.question}</h3>
        </div>

        <div className="options-grid">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = userAnswers[currentQuestionIndex] === idx;
            const isCorrect = idx === currentQuestion.correctAnswer;
            const hasAnswered = quizFeedback !== null;
            
            let variantClass = '';
            if (hasAnswered) {
              if (isCorrect) variantClass = 'correct';
              else if (isSelected) variantClass = 'incorrect';
              else variantClass = 'disabled';
            } else if (isSelected) {
              variantClass = 'selected';
            }

            return (
              <button
                key={idx}
                className={`option-btn ${variantClass}`}
                onClick={() => handleAnswerSelect(idx)}
                disabled={hasAnswered}
              >
                <span className="option-letter">{['A', 'B', 'C', 'D'][idx]}</span>
                <span className="option-label">{option}</span>
                {hasAnswered && isCorrect && <CheckCircle2 size={14} className="status-icon" />}
                {hasAnswered && isSelected && !isCorrect && <AlertCircle size={14} className="status-icon" />}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {quizFeedback && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className={`feedback-box ${isAnswerCorrect ? 'success' : 'error'}`}
            >
              <div className="feedback-header">
                {isAnswerCorrect ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                <span>{isAnswerCorrect ? 'VERIFIED' : 'ANALYSIS_CORRECTION'}</span>
              </div>
              <p>{quizFeedback}</p>
              <button className="next-btn" onClick={nextQuestion}>
                {currentQuestionIndex === quizQuestions.length - 1 ? 'Complete' : 'Next Question'}
                <ArrowRight size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSpecContent = () => {
    if (loadingState === 'error') {
      return spec ? (
        <div className="spec-view-area">
          {showSpecPreview ? (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{spec}</ReactMarkdown>
            </div>
          ) : (
            <div className="spec-raw-text">{spec}</div>
          )}
        </div>
      ) : (
        renderErrorState()
      );
    }

    if (loadingState === 'loading-spec') {
      return renderLoadingSpinner();
    }

    if (isEditingSpec) {
      return (
        <div className="spec-edit-area">
          <div className="spec-editor-container">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={editedSpec}
              onChange={(value) => setEditedSpec(value || '')}
              theme="vs-dark"
              options={{
                minimap: {enabled: false},
                fontSize: 14,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                scrollBeyondLastLine: false,
                padding: {top: 20},
              }}
            />
            <div className="spec-editor-stats">
              <span className="stat-item">
                <FileText size={10} />
                {editedSpec.length} characters
              </span>
              <span className="stat-item">
                <Zap size={10} />
                {editedSpec.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>
          <div className="spec-actions-footer">
            <button onClick={handleSpecSave} className="button-primary">
              Generate Reconstruction
            </button>
            <button onClick={handleSpecCancel} className="button-secondary">
              Discard Changes
            </button>
          </div>
        </div>
      );
    }

    if (showQuiz) {
      return (
        <div className="quiz-view-container">
          <div className="spec-toolbar">
            <button onClick={resetQuiz} className="back-to-spec-btn">
              <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
              Return to Specification
            </button>
          </div>
          <div className="quiz-content-area">
            {renderQuiz()}
          </div>
        </div>
      );
    }

    return (
      <div className="spec-view-area-container">
        <div className="spec-toolbar">
          <div className="toggle-group">
            <button 
              className={`toggle-btn ${showSpecPreview ? 'active' : ''}`}
              onClick={() => setShowSpecPreview(true)}
              title="Markdown Preview"
            >
              <Eye size={14} />
              Preview
            </button>
            <button 
              className={`toggle-btn ${!showSpecPreview ? 'active' : ''}`}
              onClick={() => setShowSpecPreview(false)}
              title="Raw Spec Text"
            >
              <CodeIcon size={14} />
              Raw
            </button>
          </div>
          <button onClick={generateQuiz} className="quiz-entry-btn">
            <HelpCircle size={14} />
            Diagnostic Quiz
          </button>
        </div>
        <div className="spec-view-area">
          {showSpecPreview ? (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{spec}</ReactMarkdown>
            </div>
          ) : (
            <div className="spec-raw-text">{spec}</div>
          )}
        </div>
        <div className="spec-actions-footer">
          <button
            onClick={handleSpecEdit}
            className="button-primary">
            Edit Spec
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`content-container-root ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {!isFullscreen ? (
        <Tabs
          className="tabs-root"
          selectedIndex={activeTabIndex}
          onSelect={(index) => {
            if (isEditingSpec && index !== 2) {
              setIsEditingSpec(false);
              setEditedSpec('');
            }
            setActiveTabIndex(index);
          }}>
          <div className="tab-header-flex">
            <TabList className="tab-list">
              <Tab className="tab" selectedClassName="tab--selected">
                Render
              </Tab>
              <Tab className="tab" selectedClassName="tab--selected">
                Code
              </Tab>
              <Tab className="tab" selectedClassName="tab--selected">
                Spec
              </Tab>
            </TabList>
            
            <div className="tab-actions">
              <button 
                className={`share-toggle ${copiedShare ? 'copied' : ''}`}
                onClick={handleShare}
                title="Copy share link for this learning experience"
              >
                {copiedShare ? <CheckCircle2 size={16} className="text-success" /> : <Share2 size={16} />}
                <span className="share-label">{copiedShare ? 'Copied!' : 'Share'}</span>
              </button>

              <button 
                className={`settings-toggle ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings(!showSettings)}
                title="AI Generation Settings"
              >
                <Sliders size={16} />
                <span className="settings-label">AI Settings</span>
              </button>
            </div>
          </div>
  
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="settings-overlay"
              >
                <div className="settings-header-top">
                  <div className="settings-title-group">
                    <h3>Generation Parameters</h3>
                    <span className="settings-subtitle">Configure AI behavior & output fidelity</span>
                  </div>
                  <button 
                    className="close-settings-btn"
                    onClick={() => setShowSettings(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
  
                <div className="settings-scroll-area">
                  {/* 1. Model Configuration Section */}
                  <div className="settings-section">
                    <button 
                      className={`section-header ${activeSections.includes('models') ? 'active' : ''}`} 
                      onClick={() => toggleSection('models')}
                      title="Choose AI engines for analysis and development"
                    >
                      <div className="header-left">
                        <Cpu size={16} className="icon-blue" />
                        <div className="label-container">
                          <span className="main-label">System Architecture</span>
                          <span className="sub-label">Select LLM engines</span>
                        </div>
                      </div>
                      {activeSections.includes('models') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <AnimatePresence>
                      {activeSections.includes('models') && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="section-content"
                        >
                          <div className="setting-item">
                            <label className="setting-label" title="Model specialized in multimodal comprehension and logical planning">
                               Semantic Analyst
                            </label>
                            <select 
                              value={params.specModel}
                              onChange={(e) => setParams({...params, specModel: e.target.value as ModelType})}
                              className="setting-select"
                            >
                              <option value="gemini-3-flash-preview">Gemini 1.5 Flash (Performance)</option>
                              <option value="gemini-3.1-pro-preview">Gemini 1.5 Pro (Complexity)</option>
                            </select>
                            <p className="item-description">Responsible for high-level comprehension and instructional design specification.</p>
                          </div>
                          <div className="setting-divider"></div>
                          <div className="setting-item">
                            <label className="setting-label" title="Model optimized for high-fidelity code generation and UI implementation">
                               Software Architect
                            </label>
                            <select 
                              value={params.codeModel}
                              onChange={(e) => setParams({...params, codeModel: e.target.value as ModelType})}
                              className="setting-select"
                            >
                              <option value="gemini-3.1-pro-preview">Gemini 1.5 Pro (Precision)</option>
                              <option value="gemini-3-flash-preview">Gemini 1.5 Flash (Velocity)</option>
                            </select>
                            <p className="item-description">Translates specifications into production-grade TypeScript and JSX structures.</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
  
                  {/* 2. Intelligence Depth Section */}
                  <div className="settings-section">
                    <button 
                      className={`section-header ${activeSections.includes('intelligence') ? 'active' : ''}`} 
                      onClick={() => toggleSection('intelligence')}
                      title="Control creative freedom and randomness threshold"
                    >
                      <div className="header-left">
                        <Sparkles size={16} className="icon-purple" />
                        <div className="label-container">
                          <span className="main-label">Intelligence Variance</span>
                          <span className="sub-label">Creative threshold & randomness</span>
                        </div>
                      </div>
                      {activeSections.includes('intelligence') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <AnimatePresence>
                      {activeSections.includes('intelligence') && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="section-content"
                        >
                          <div className="setting-item">
                            <div className="setting-label-row">
                              <label className="setting-label" title="Higher temperature leads to more varied, creative, but potentially less grounded output">Creative Signal (Temp)</label>
                              <span className="setting-badge-value">{params.temperature}</span>
                            </div>
                            <input 
                              type="range" min="0" max="1" step="0.05"
                              value={params.temperature}
                              onChange={(e) => setParams({...params, temperature: parseFloat(e.target.value)})}
                              className="setting-range"
                            />
                            <div className="range-labels">
                              <span>Strict</span>
                              <span>Exploratory</span>
                            </div>
                            <p className="item-description">Determines the balance between logical precision and creative interpretation.</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
  
                  {/* 3. Curriculum Section */}
                  <div className="settings-section">
                    <button 
                      className={`section-header ${activeSections.includes('curriculum') ? 'active' : ''}`} 
                      onClick={() => toggleSection('curriculum')}
                      title="Determine the extent of coverage and technicality"
                    >
                      <div className="header-left">
                        <FileText size={16} className="icon-green" />
                        <div className="label-container">
                          <span className="main-label">Content Architecture</span>
                          <span className="sub-label">Verbosity & complexity level</span>
                        </div>
                      </div>
                      {activeSections.includes('curriculum') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <AnimatePresence>
                      {activeSections.includes('curriculum') && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="section-content"
                        >
                          <div className="setting-item">
                            <label className="setting-label" title="Selecting detailed will significantly increase the volume of generated material">Academic Intensity</label>
                            <div className="radio-grid">
                              {(['concise', 'balanced', 'detailed'] as const).map((d) => (
                                <button 
                                  key={d}
                                  className={`depth-option ${params.depth === d ? 'active' : ''}`}
                                  onClick={() => setParams({...params, depth: d})}
                                  title={`Generate ${d} content`}
                                >
                                  {d.charAt(0).toUpperCase() + d.slice(1)}
                                </button>
                              ))}
                            </div>
                            <p className="item-description">
                              {params.depth === 'concise' && "High-impact focus on primary objectives and core takeaways."}
                              {params.depth === 'balanced' && "Optimized hybrid of theory, practical examples, and verification."}
                              {params.depth === 'detailed' && "Exhaustive exploration of edge cases and advanced technical paradigms."}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <div className="settings-footer">
                  <button 
                    className="regenerate-button-premium" 
                    onClick={handleRegenerate} 
                    disabled={loadingState !== 'ready' && loadingState !== 'error'}
                  >
                    <RefreshCw size={14} className={loadingState !== 'ready' && loadingState !== 'error' ? 'spin' : ''} />
                    <span>Execute Reconstruction</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
  
          <TabPanel className="tab-panel">
            {loadingState === 'error' ? (
              renderErrorState()
            ) : loadingState !== 'ready' ? (
              renderLoadingSpinner()
            ) : (
              <div className="iframe-wrapper">
                <iframe
                  key={iframeKey}
                  srcDoc={code}
                  className="content-iframe"
                  title="rendered-html"
                  sandbox="allow-scripts"
                />
              </div>
            )}
          </TabPanel>
  
          <TabPanel className="tab-panel">
            {loadingState === 'error' ? (
              renderErrorState()
            ) : loadingState !== 'ready' ? (
              renderLoadingSpinner()
            ) : (
              <div className="editor-wrapper">
                <Editor
                  height="100%"
                  defaultLanguage="html"
                  value={code}
                  onChange={handleCodeChange}
                  theme="vs-dark"
                  options={{
                    minimap: {enabled: false},
                    fontSize: 14,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                    padding: {top: 20},
                  }}
                />
                {saveMessage && (
                  <div className="save-toast">
                    {saveMessage}
                  </div>
                )}
              </div>
            )}
          </TabPanel>
  
          <TabPanel className="tab-panel spec-panel">
            {renderSpecContent()}
          </TabPanel>
  
        </Tabs>
      ) : (
        <div className="fullscreen-preview">
          {loadingState === 'ready' ? (
            <iframe
              key={iframeKey}
              srcDoc={code}
              className="content-iframe fullscreen"
              title="fullscreen-rendered-html"
              sandbox="allow-scripts"
            />
          ) : (
            renderLoadingSpinner()
          )}
        </div>
      )}

      <style>{`
        .content-container-root {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .content-container-root.is-fullscreen {
          padding: 0;
          overflow: hidden;
        }

        .fullscreen-preview {
          width: 100%;
          height: 100%;
          background: var(--color-background);
          display: flex;
          flex-direction: column;
        }

        .content-iframe.fullscreen {
          border: none;
          border-radius: 0;
        }

        .tabs-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
        }

        .tab-list {
          display: flex;
          list-style: none;
          padding: 0 0.5rem;
          background-color: var(--color-background-soft);
          flex: 1;
          gap: 0.25rem;
        }

        .tab-header-flex {
          display: flex;
          align-items: center;
          background-color: var(--color-background-soft);
          border-bottom: 2px solid var(--color-border-soft);
          justify-content: space-between;
          height: 48px;
        }

        .tab-actions {
          padding: 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .share-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.875rem;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: rgba(255, 255, 255, 0.03);
          color: var(--color-text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .share-toggle:hover {
          color: var(--color-text);
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--color-text-muted);
        }

        .share-toggle.copied {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .settings-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.875rem;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: rgba(255, 255, 255, 0.03);
          color: var(--color-text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .settings-toggle:hover {
          color: var(--color-text);
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--color-text-muted);
        }

        .settings-toggle.active {
          background: var(--color-accent);
          color: white;
          border-color: var(--color-accent);
          box-shadow: 0 0 15px var(--color-accent-soft);
        }

        .settings-overlay {
          position: absolute;
          top: 3.75rem;
          right: 1rem;
          width: 360px;
          background: var(--color-background-elevated);
          backdrop-filter: blur(24px);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: 
            var(--shadow-2xl),
            0 0 0 1px rgba(var(--color-accent-rgb), 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          z-index: 100;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 85vh;
          animation: slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInDown {
          from { transform: translateY(-20px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }

        .settings-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem;
          border-bottom: 2px solid var(--color-border-soft);
          background: var(--color-background-soft);
        }

        .settings-title-group h3 {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.01em;
        }

        .settings-subtitle {
          font-size: 0.65rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .close-settings-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: var(--color-background-soft);
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-settings-btn:hover {
          background: var(--color-error-soft);
          color: var(--color-error);
          border-color: var(--color-error);
        }

        .settings-scroll-area {
          overflow-y: auto;
          flex: 1;
          scrollbar-width: none;
        }

        .settings-section {
          border-bottom: 1px solid var(--color-border-soft);
        }

        .section-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .section-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .section-header.active {
          background: rgba(var(--color-accent-rgb), 0.03);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
          text-align: left;
        }

        .label-container {
          display: flex;
          flex-direction: column;
        }

        .main-label {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .sub-label {
          font-size: 0.625rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .section-content {
          padding: 0 1.25rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          overflow: hidden;
        }

        .setting-divider {
          height: 1px;
          background: var(--color-border-soft);
          opacity: 0.5;
        }

        .item-description {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          line-height: 1.4;
          margin: 0;
          opacity: 0.8;
        }

        .setting-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .setting-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .setting-badge-value {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--color-accent);
          background: var(--color-accent-soft);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-family: var(--font-technical);
        }

        .setting-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .setting-select {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: var(--color-background-elevated);
          color: var(--color-text);
          font-size: 0.8125rem;
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .setting-select:focus {
          border-color: var(--color-accent);
        }

        .setting-range {
          width: 100%;
          accent-color: var(--color-accent);
          height: 4px;
        }

        .range-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.55rem;
          color: var(--color-text-muted);
          font-weight: 700;
          text-transform: uppercase;
          margin-top: -0.25rem;
        }

        .radio-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.35rem;
          background: var(--color-background-soft);
          padding: 0.35rem;
          border-radius: 10px;
          border: 1px solid var(--color-border);
        }

        .depth-option {
          padding: 0.5rem 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .depth-option.active {
          background: var(--color-accent);
          color: white;
          box-shadow: 0 4px 12px -4px rgba(var(--color-accent-rgb), 0.4);
        }

        .settings-footer {
          padding: 1.25rem;
          background: var(--color-background-soft);
          border-top: 2px solid var(--color-border-soft);
        }

        .regenerate-button-premium {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.875rem;
          background: linear-gradient(135deg, var(--color-accent), #ea580c);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 8px 24px -6px rgba(var(--color-accent-rgb), 0.5);
        }

        .regenerate-button-premium:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px -8px rgba(var(--color-accent-rgb), 0.6);
        }

        .regenerate-button-premium:disabled {
          opacity: 0.5;
          filter: grayscale(1);
          cursor: not-allowed;
        }

        .icon-blue { color: #fbbf24; }
        .icon-purple { color: #a78bfa; }
        .icon-green { color: #34d399; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .settings-overlay {
            width: calc(100vw - 2.5rem);
            right: 1.25rem;
            max-height: 70vh;
          }
        }

        .tab {
          padding: 0 1.25rem;
          height: 100%;
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-muted);
          transition: all 0.2s;
          position: relative;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .tab:hover {
          color: var(--color-text);
        }

        .tab--selected {
          color: var(--color-accent);
        }

        .tab--selected::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 3px;
          background-color: var(--color-accent);
          box-shadow: 0 0 10px var(--color-accent-glow);
          border-radius: 2px;
        }

        .tab-panel {
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          min-height: 0; /* Allow flex shrinking */
          height: 100%;
        }

        .tab-panel.react-tabs__tab-panel--selected {
          display: flex;
        }

        .iframe-wrapper, .editor-wrapper, .spec-view-area-container, .spec-edit-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          position: relative;
          padding: 1rem;
        }

        .iframe-wrapper {
          background: rgba(var(--color-accent-rgb), 0.02);
        }

        .content-iframe {
          width: 100%;
          height: 100%;
          border: 1px solid var(--color-border-soft);
          border-radius: var(--radius-lg);
          flex: 1;
          box-shadow: var(--shadow-inner);
        }

        .save-toast {
          position: absolute;
          bottom: 1.5rem;
          right: 1.5rem;
          background: var(--color-accent);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.75rem;
          box-shadow: 0 4px 12px var(--color-accent-soft);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .spec-panel {
          padding: 0;
          overflow: hidden;
        }

        .loading-spinner {
          animation: spin 0.8s linear infinite;
          border: 2px solid var(--color-border);
          border-radius: 50%;
          border-top-color: var(--color-accent);
          height: 40px;
          width: 40px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spec-view-area-container, .spec-edit-area {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .spec-toolbar {
          padding: 0.5rem 1rem;
          background: var(--color-background-soft);
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: flex-start;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        @media (max-width: 640px) {
          .spec-toolbar {
            justify-content: space-between;
          }
        }

        .toggle-group {
          display: inline-flex;
          background: var(--color-background);
          padding: 0.25rem;
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          color: var(--color-text);
        }

        .toggle-btn.active {
          background: var(--color-background-soft);
          color: var(--color-accent);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .spec-view-area {
          flex: 1;
          overflow: auto;
          scrollbar-width: thin;
        }

        .spec-raw-text {
          white-space: pre-wrap;
          font-family: var(--font-technical);
          line-height: 1.75;
          padding: 1.5rem 2rem;
          font-size: 0.8125rem;
          color: var(--color-text);
        }

        .markdown-body {
          padding: 2rem;
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--color-text);
          max-width: 680px;
          margin: 0 auto;
        }

        @media (max-width: 640px) {
          .markdown-body {
            padding: 1.25rem;
            font-size: 0.8125rem;
          }
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: var(--color-text);
          font-family: var(--font-display);
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .markdown-body h1 { font-size: 2rem; }
        .markdown-body h2 { font-size: 1.5rem; border-bottom: 1px solid var(--color-border-soft); padding-bottom: 0.4em; }
        .markdown-body h3 { font-size: 1.25rem; }

        .markdown-body p { margin-bottom: 1.25rem; }

        .markdown-body ul, .markdown-body ol {
          margin-bottom: 1em;
          padding-left: 2em;
        }

        .markdown-body li { margin-bottom: 0.25em; }

        .markdown-body code {
          background: var(--color-background-soft);
          padding: 0.2em 0.4em;
          border-radius: 4px;
          font-family: var(--font-technical);
          font-size: 0.85em;
        }

        .markdown-body pre {
          background: var(--color-background-soft);
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin-bottom: 1em;
          border: 1px solid var(--color-border-soft);
        }

        .markdown-body pre code {
          padding: 0;
          background: transparent;
          font-size: 0.8rem;
        }

        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.5em;
          font-size: 0.8125rem;
        }

        .markdown-body th, .markdown-body td {
          border: 1px solid var(--color-border-soft);
          padding: 0.75rem;
          text-align: left;
        }

        .markdown-body th {
          background: var(--color-background-soft);
          font-weight: 600;
        }

        .markdown-body tr:nth-child(even) {
          background: rgba(0,0,0,0.02);
        }

        .markdown-body blockquote {
          border-left: 4px solid var(--color-accent-soft);
          padding-left: 1rem;
          color: var(--color-text-muted);
          margin-left: 0;
          margin-bottom: 1em;
        }

        .spec-editor-container {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #1e1e1e;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
        }

        .spec-editor-stats {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 0.5rem 1rem;
          background: #181818;
          border-top: 1px solid #333;
          font-family: var(--font-technical);
          font-size: 0.65rem;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .spec-actions-footer {
          padding: 1rem 0;
          display: flex;
          gap: 0.75rem;
        }

        .quiz-entry-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          background: rgba(var(--color-accent-rgb), 0.1);
          color: var(--color-accent);
          border: 1px solid rgba(var(--color-accent-rgb), 0.2);
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-technical);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .quiz-entry-btn:hover {
          background: var(--color-accent);
          color: white;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(var(--color-accent-rgb), 0.3);
        }

        .back-to-spec-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem;
          background: transparent;
          color: var(--color-text-muted);
          border: none;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-to-spec-btn:hover {
          color: var(--color-text);
        }

        .quiz-view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .quiz-content-area {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem;
          scrollbar-width: thin;
        }

        @media (max-width: 640px) {
          .quiz-content-area {
            padding: 1rem;
          }
        }

        .quiz-loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          margin-top: 4rem;
          font-family: var(--font-technical);
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .quiz-active-container {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
        }

        .quiz-progress-bar {
          width: 100%;
          height: 4px;
          background: var(--color-border-soft);
          border-radius: 2px;
          margin-bottom: 2rem;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--color-accent);
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .question-header {
          margin-bottom: 2rem;
        }

        .question-counter {
          display: block;
          font-family: var(--font-technical);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-accent);
          letter-spacing: 0.2em;
          margin-bottom: 0.5rem;
        }

        .question-text {
          font-family: var(--font-display);
          font-size: 1.5rem;
          line-height: 1.3;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.01em;
        }

        @media (max-width: 640px) {
          .question-text {
            font-size: 1.125rem;
          }
        }

        .options-grid {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .option-btn {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: var(--color-background-elevated);
          border: 1px solid var(--color-border-soft);
          border-radius: 10px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          color: var(--color-text);
          font-family: var(--font-sans);
        }

        @media (max-width: 640px) {
          .option-btn {
            padding: 1rem;
            gap: 0.75rem;
          }
          .option-label {
            font-size: 0.8125rem !important;
          }
        }

        .option-btn:hover:not(:disabled) {
          border-color: var(--color-accent);
          background: rgba(var(--color-accent-rgb), 0.02);
          transform: translateX(4px);
        }

        .option-btn.selected {
          border-color: var(--color-accent);
          background: rgba(var(--color-accent-rgb), 0.05);
        }

        .option-btn.correct {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
          color: #10b981 !important;
        }

        .option-btn.incorrect {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
          color: #ef4444 !important;
        }

        .option-btn.disabled {
          opacity: 0.6;
          cursor: default;
        }

        .option-letter {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-border-soft);
          border-radius: 50%;
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }

        .option-btn.correct .option-letter { background: #10b981; color: white; }
        .option-btn.incorrect .option-letter { background: #ef4444; color: white; }

        .option-label {
          font-size: 0.9375rem;
          font-weight: 500;
          line-height: 1.4;
        }

        .status-icon {
          margin-left: auto;
          flex-shrink: 0;
        }

        .feedback-box {
          padding: 1.5rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .feedback-box.success {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .feedback-box.error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .feedback-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-technical);
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .feedback-box p {
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 0;
          color: var(--color-text);
        }

        .next-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          align-self: flex-end;
          padding: 0.6rem 1.25rem;
          background: var(--color-accent);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .next-btn:hover {
          background: #ea580c;
          transform: translateX(2px);
        }

        .quiz-results-container {
          width: 100%;
          max-width: 480px;
          background: var(--color-background-elevated);
          padding: 3rem 2rem;
          border-radius: 20px;
          border: 1px solid var(--color-border-soft);
          text-align: center;
          box-shadow: 0 20px 50px -12px rgba(0,0,0,0.25);
        }

        .results-header {
          margin-bottom: 2rem;
        }

        .results-header h3 {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 800;
          margin: 1.5rem 0 0.5rem;
          letter-spacing: -0.02em;
          color: var(--color-text);
        }

        .score-display {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.25rem;
        }

        .score-num {
          font-size: 3.5rem;
          font-weight: 900;
          color: var(--color-accent);
          font-family: var(--font-technical);
        }

        .score-total {
          font-size: 1.25rem;
          font-weight: 500;
          color: var(--color-text-muted);
        }

        .results-feedback {
          margin-bottom: 2.5rem;
          font-size: 0.9375rem;
          color: var(--color-text-muted);
          line-height: 1.6;
        }

        .results-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
      `}</style>
    </div>
  );
});

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import './ChatBox.css';

const WELCOME_MESSAGE = {
  id: 'welcome-msg',
  sender: 'ai',
  text: "Hi! I'm HeartMap AI ❤️\nAsk me anything about finding NGOs, donating items, NGO verification, or getting community help.",
  timestamp: new Date()
};

const SUGGESTED_QUESTIONS = [
  'What is HeartMap?',
  'How can I find an NGO?',
  'How are NGOs verified?',
  'I want to donate clothes. What should I do?',
  'How can I report an NGO?'
];

const ChatBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, errorMessage]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputMessage).trim();
    if (!text || isLoading) return;

    setErrorMessage('');
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await api.post('/ai/chat', { message: text });
      const reply = response.data?.reply || 'I am here to assist with HeartMap questions.';

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('HeartMap AI chat error:', error);
      const serverErr = error.response?.data?.error;
      const displayErr = serverErr || 'Unable to connect to HeartMap AI right now. Please try again.';
      setErrorMessage(displayErr);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        ...WELCOME_MESSAGE,
        timestamp: new Date()
      }
    ]);
    setErrorMessage('');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="heartmap-chat-root" aria-label="HeartMap AI Chat Assistant">
      {/* Floating Toggle Button */}
      <motion.button
        type="button"
        className="heartmap-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close HeartMap AI chat' : 'Open HeartMap AI chat'}
      >
        <span className="toggle-heart-icon">❤️</span>
        <span className="toggle-label">HeartMap AI</span>
        <span className="toggle-live-dot" aria-hidden="true" />
      </motion.button>

      {/* Floating Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.section
            className="heartmap-chat-panel"
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            role="region"
            aria-label="HeartMap AI Conversation Window"
          >
            {/* Header */}
            <div className="heartmap-chat-header">
              <div className="header-info-lockup">
                <div className="header-avatar-badge">
                  <span>❤️</span>
                  <span className="avatar-beacon-pulse" />
                </div>
                <div className="header-text-meta">
                  <h3 className="header-title">HeartMap AI</h3>
                  <span className="header-subtitle">Verified Giving &amp; Support Guide</span>
                </div>
              </div>

              <div className="header-actions">
                <button
                  type="button"
                  className="header-tool-btn"
                  onClick={handleClearChat}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                >
                  ↺
                </button>
                <button
                  type="button"
                  className="header-tool-btn header-close-btn"
                  onClick={() => setIsOpen(false)}
                  title="Close chat"
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className="heartmap-chat-messages" role="log" aria-live="polite">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-bubble-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="message-avatar-ai" aria-hidden="true">
                      ♥
                    </div>
                  )}

                  <div className={`chat-bubble ${msg.sender === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                    <div className="chat-bubble-content">
                      {msg.text.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < msg.text.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="chat-bubble-timestamp">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              ))}

              {/* Typing / Loading Indicator */}
              {isLoading && (
                <div className="chat-bubble-row ai-row">
                  <div className="message-avatar-ai" aria-hidden="true">
                    ♥
                  </div>
                  <div className="chat-bubble ai-bubble typing-bubble">
                    <span className="typing-text">HeartMap AI is thinking</span>
                    <span className="typing-dots">
                      <span className="dot dot-1" />
                      <span className="dot dot-2" />
                      <span className="dot dot-3" />
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message Toast in Chat */}
              {errorMessage && (
                <div className="chat-error-toast" role="alert">
                  <span className="error-icon">⚠️</span>
                  <div className="error-text">
                    <p>{errorMessage}</p>
                    <button
                      type="button"
                      className="error-retry-btn"
                      onClick={() => setErrorMessage('')}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips (when only welcome message is shown) */}
            {messages.length === 1 && (
              <div className="chat-suggestion-chips" aria-label="Common questions">
                <span className="chips-label">Popular topics:</span>
                <div className="chips-scroll">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="suggestion-chip-btn"
                      onClick={() => handleSendMessage(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form Footer */}
            <form
              className="heartmap-chat-footer"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <div className="chat-input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  className="chat-text-input"
                  placeholder="Ask about NGOs, donating items, help..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={1000}
                  disabled={isLoading}
                  aria-label="Message to HeartMap AI"
                />

                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={isLoading || !inputMessage.trim()}
                  aria-label="Send message"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
              <div className="chat-footer-note">
                <span>🔒 HeartMap AI never fabricates non-profit credentials or processes payments.</span>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatBox;

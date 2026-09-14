// TgBotDesignerImproved.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

// Improved Telegram Bot Designer with fixed UX, better dark theme, action buttons under messages, and enhanced logic
export default function TgBotDesigner() {
  const [project, setProject] = useState({
    id: generateId(),
    name: "Мой Telegram Бот",
    description: "",
    version: "1.0.0",
    startMessageId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [messages, setMessages] = useState([
    {
      id: generateId(),
      role: "bot",
      text: "👋 Добро пожаловать! Нажмите + между сообщениями чтобы добавить шаг диалога.",
      buttons: [], // Inline buttons
      replyKeyboard: [], // Reply keyboard
      media: null,
      command: "/start",
      delay: 0,
      conditions: [], // For future conditional logic
      isStart: true
    },
  ]);

  const [selectedId, setSelectedId] = useState(messages[0]?.id || null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [mode, setMode] = useState("bot");
  const [theme, setTheme] = useState("light");
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  const [exportModal, setExportModal] = useState({ 
    open: false, 
    content: "", 
    title: "",
    type: "json" 
  });
  
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHistory, setPreviewHistory] = useState([]);
  const [currentPreviewMsgId, setCurrentPreviewMsgId] = useState(null);
  const [activeReplyKeyboard, setActiveReplyKeyboard] = useState([]); // Active reply keyboard in preview
  const [typing, setTyping] = useState(false);
  const [activeTab, setActiveTab] = useState("design");
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  // Undo/Redo history
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Auto-scroll to bottom when messages or preview history change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, previewHistory]);

  // Initialize start message
  useEffect(() => {
    if (messages.length > 0 && !project.startMessageId) {
      const startMsg = messages.find(m => m.isStart) || messages[0];
      setProject(prev => ({ 
        ...prev, 
        startMessageId: startMsg.id,
        updatedAt: new Date().toISOString()
      }));
      setSelectedId(startMsg.id);
    }
  }, [messages, project.startMessageId]);

  // Добавь этот useEffect после существующих
  useEffect(() => {
    document.body.className = `theme-${theme}`;
    return () => {
      document.body.className = '';
    };
  }, [theme]);

  function generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  // Message management with undo/redo support
  const updateMessagesWithHistory = useCallback((updater) => {
    setHistory(prev => [...prev, { messages: [...messages] }].slice(-20)); // Limit history to 20 steps
    setRedoStack([]);
    setMessages(updater);
  }, [messages]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setRedoStack(prev => [...prev, { messages: [...messages] }]);
    setMessages(lastState.messages);
    setHistory(prev => prev.slice(0, -1));
  }, [history, messages]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, { messages: [...messages] }]);
    setMessages(nextState.messages);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, messages]);

  const addMessage = useCallback((options = {}) => {
    const {
      afterId = null,
      beforeId = null,
      role = "bot",
      text = role === "bot" ? "Новое сообщение бота" : "Сообщение пользователя"
    } = options;

    const newMsg = {
      id: generateId(),
      role,
      text,
      buttons: [],
      replyKeyboard: [],
      media: null,
      command: null,
      delay: role === "bot" ? 1 : 0,
      conditions: []
    };

    updateMessagesWithHistory(prev => {
      let newMessages = [...prev];
      
      if (afterId) {
        const idx = newMessages.findIndex(m => m.id === afterId);
        if (idx !== -1) newMessages.splice(idx + 1, 0, newMsg);
        else newMessages.push(newMsg);
      } else if (beforeId) {
        const idx = newMessages.findIndex(m => m.id === beforeId);
        if (idx !== -1) newMessages.splice(idx, 0, newMsg);
        else newMessages.unshift(newMsg);
      } else {
        newMessages.push(newMsg);
      }
      
      return newMessages;
    });

    return newMsg.id;
  }, [updateMessagesWithHistory]);

  const duplicateMessage = useCallback((messageId) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const duplicated = {
      ...message,
      id: generateId(),
      text: `${message.text} (копия)`,
      buttons: message.buttons.map(btn => ({ ...btn, id: generateId() })),
      replyKeyboard: message.replyKeyboard.map(btn => ({ ...btn, id: generateId() }))
    };

    const idx = messages.findIndex(m => m.id === messageId);
    updateMessagesWithHistory(prev => {
      const newMessages = [...prev];
      newMessages.splice(idx + 1, 0, duplicated);
      return newMessages;
    });
    
    return duplicated.id;
  }, [messages, updateMessagesWithHistory]);

  const removeMessage = useCallback((id) => {
    if (messages.length <= 1) {
      alert("Нельзя удалить последнее сообщение");
      return;
    }

    updateMessagesWithHistory(prev => {
      const newMessages = prev.filter(m => m.id !== id);
      
      return newMessages.map(msg => ({
        ...msg,
        buttons: msg.buttons.map(btn => btn.goto === id ? { ...btn, goto: null } : btn),
        replyKeyboard: msg.replyKeyboard.map(btn => btn.goto === id ? { ...btn, goto: null } : btn)
      }));
    });

    if (selectedId === id) {
      const newSelected = messages.find(m => m.id !== id)?.id || null;
      setSelectedId(newSelected);
    }

    if (project.startMessageId === id) {
      const newStartMsg = messages.find(m => m.id !== id && m.role === 'bot');
      setProject(prev => ({ 
        ...prev, 
        startMessageId: newStartMsg?.id || null 
      }));
    }
  }, [messages, selectedId, project.startMessageId, updateMessagesWithHistory]);

  const setStartMessage = useCallback((messageId) => {
    setProject(prev => ({ ...prev, startMessageId: messageId }));
    setMessages(prev => prev.map(msg => ({
      ...msg,
      isStart: msg.id === messageId
    })));
  }, []);

  // Editor logic
  const openEditor = useCallback((id) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    
    setSelectedId(id);
    setEditDraft({
      ...msg,
      buttons: msg.buttons ? [...msg.buttons] : [],
      replyKeyboard: msg.replyKeyboard ? [...msg.replyKeyboard] : [],
      media: msg.media ? { ...msg.media } : null
    });
    setEditing(true);
    setActiveTab("properties");
  }, [messages]);

  const saveEdit = useCallback(() => {
    if (!editDraft) return;

    updateMessagesWithHistory(prev => prev.map(m => 
      m.id === selectedId ? { ...editDraft } : m
    ));
    setEditing(false);
    setEditDraft(null);
  }, [editDraft, selectedId, updateMessagesWithHistory]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditDraft(null);
    setActiveTab("design");
  }, []);

  // Button management
  const addButton = useCallback((type, text = "Новая кнопка") => {
    if (!editDraft) return;

    const key = type === "inline" ? "buttons" : "replyKeyboard";
    setEditDraft(prev => ({
      ...prev,
      [key]: [...prev[key], { 
        id: generateId(), 
        text, 
        goto: null
      }]
    }));
  }, [editDraft]);

  const updateButton = useCallback((type, index, updates) => {
    if (!editDraft) return;

    const key = type === "inline" ? "buttons" : "replyKeyboard";
    setEditDraft(prev => {
      const newButtons = [...prev[key]];
      newButtons[index] = { ...newButtons[index], ...updates };
      return { ...prev, [key]: newButtons };
    });
  }, [editDraft]);

  const removeButton = useCallback((type, index) => {
    if (!editDraft) return;

    const key = type === "inline" ? "buttons" : "replyKeyboard";
    setEditDraft(prev => {
      const newButtons = [...prev[key]];
      newButtons.splice(index, 1);
      return { ...prev, [key]: newButtons };
    });
  }, [editDraft]);

  // Input handling
  const handleInputSubmit = useCallback((e) => {
    e.preventDefault();
    const text = inputRef.current?.value.trim();
    if (!text) return;

    const newId = addMessage({ role: mode, text });
    
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }

    if (mode === "bot") {
      setTimeout(() => openEditor(newId), 100);
    }
  }, [mode, addMessage, openEditor]);

  // Enhanced Preview Mode with Telegram-like behavior
  const startPreview = useCallback(() => {
    const startMsg = messages.find(m => m.id === project.startMessageId) || messages.find(m => m.role === 'bot') || messages[0];
    setPreviewMode(true);
    setPreviewHistory(startMsg ? [startMsg] : []);
    setCurrentPreviewMsgId(startMsg?.id || null);
    setActiveReplyKeyboard(startMsg?.replyKeyboard || []);
    setActiveTab("preview");
  }, [messages, project.startMessageId]);

  const handlePreviewInput = useCallback((e) => {
    e.preventDefault();
    const text = inputRef.current?.value.trim();
    if (!text || !currentPreviewMsgId) return;

    setPreviewHistory(prev => [...prev, { 
      id: generateId(), 
      role: "user", 
      text,
      timestamp: new Date().toISOString()
    }]);
    setTyping(true);

    setTimeout(() => {
      const currentMsg = messages.find(m => m.id === currentPreviewMsgId);
      let nextMsg = null;

      // Check for command match
      const commandMatch = messages.find(m => m.command === text && m.role === 'bot');
      if (commandMatch) {
        nextMsg = commandMatch;
      } else if (currentMsg) {
        const allButtons = [
          ...(currentMsg.buttons || []),
          ...(currentMsg.replyKeyboard || [])
        ];
        const buttonMatch = allButtons.find(btn => 
          btn.text.toLowerCase() === text.toLowerCase() && btn.goto
        );

        if (buttonMatch?.goto) {
          nextMsg = messages.find(m => m.id === buttonMatch.goto);
        }
      }

      if (!nextMsg) {
        const currentIndex = messages.findIndex(m => m.id === currentPreviewMsgId);
        nextMsg = messages.slice(currentIndex + 1).find(m => m.role === 'bot');
      }

      if (nextMsg) {
        setPreviewHistory(prev => [...prev, { ...nextMsg, timestamp: new Date().toISOString() }]);
        setCurrentPreviewMsgId(nextMsg.id);
        setActiveReplyKeyboard(nextMsg.replyKeyboard || []);
      }

      setTyping(false);
    }, 1000 + Math.random() * 500);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [currentPreviewMsgId, messages]);

  const handlePreviewReplyClick = useCallback((btn) => {
    if (inputRef.current) {
      inputRef.current.value = btn.text;
      handlePreviewInput({ preventDefault: () => {} });
    }
  }, [handlePreviewInput]);

  const exitPreview = useCallback(() => {
    setPreviewMode(false);
    setPreviewHistory([]);
    setActiveReplyKeyboard([]);
    setTyping(false);
    setActiveTab("design");
  }, []);

  // Export functions with improved aiogram code
  const exportProject = useCallback((type) => {
    const exportData = {
      ...project,
      messages: messages.map(({ isStart, ...msg }) => msg),
      exportDate: new Date().toISOString(),
      version: "1.0"
    };

    if (type === 'json') {
      const content = JSON.stringify(exportData, null, 2);
      setExportModal({ 
        open: true, 
        title: "Экспорт проекта (JSON)", 
        content,
        type: "json" 
      });
    } else {
      let content = `# Telegram Bot generated from TgBotDesigner
import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters.command import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton

bot = Bot(token='YOUR_TOKEN_HERE')
dp = Dispatcher()

# Message handlers
`;

      const startMsg = exportData.messages.find(m => m.id === exportData.startMessageId);
      if (startMsg) {
        let replyMarkup = '';
        if (startMsg.buttons.length > 0) {
          replyMarkup = `    inline_kb = InlineKeyboardMarkup(inline_keyboard=[
${startMsg.buttons.map(btn => `        [InlineKeyboardButton(text="${btn.text}", callback_data="${btn.id}")]`).join(',\n')}
    ])
    await message.answer("${startMsg.text.replace(/"/g, '\\"')}", reply_markup=inline_kb)`
        } else if (startMsg.replyKeyboard.length > 0) {
          replyMarkup = `    reply_kb = ReplyKeyboardMarkup(keyboard=[
${startMsg.replyKeyboard.map(btn => `        [KeyboardButton(text="${btn.text}")]`).join(',\n')}
    ], resize_keyboard=True)
    await message.answer("${startMsg.text.replace(/"/g, '\\"')}", reply_markup=reply_kb)`
        } else {
          replyMarkup = `    await message.answer("${startMsg.text.replace(/"/g, '\\"')}")`
        }
        content += `@dp.message(Command("start"))
async def start_handler(message: types.Message):
${replyMarkup}
`;
      }

      exportData.messages.forEach(msg => {
        if (msg.role === 'bot' && msg.command && msg.command !== '/start') {
          let replyMarkup = '';
          if (msg.buttons.length > 0) {
            replyMarkup = `, reply_markup=InlineKeyboardMarkup(inline_keyboard=[
${msg.buttons.map(btn => `        [InlineKeyboardButton(text="${btn.text}", callback_data="${btn.id}")]`).join(',\n')}
    ])`;
          } else if (msg.replyKeyboard.length > 0) {
            replyMarkup = `, reply_markup=ReplyKeyboardMarkup(keyboard=[
${msg.replyKeyboard.map(btn => `        [KeyboardButton(text="${btn.text}")]`).join(',\n')}
    ], resize_keyboard=True)`;
          }
          content += `@dp.message(Command("${msg.command.slice(1)}"))
async def cmd_${msg.command.slice(1)}_handler(message: types.Message):
    await message.answer("${msg.text.replace(/"/g, '\\"')}"${replyMarkup})
`;
        }
      });

      // Add callback handlers for inline buttons
      if (exportData.messages.some(m => m.buttons.length > 0)) {
        content += `
# Callback handlers for inline buttons
@dp.callback_query()
async def button_callback(callback: types.CallbackQuery):
    callback_data = callback.data
    messages = {
${exportData.messages
  .filter(m => m.buttons.some(b => b.goto))
  .map(m => m.buttons
    .filter(b => b.goto)
    .map(b => `        "${b.id}": "${m.text.replace(/"/g, '\\"')}"`)
  ).flat().join(',\n')}
    }
    if callback_data in messages:
        await callback.message.answer(messages[callback_data])
    await callback.answer()
`;
      }

      content += `
async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
`;

      setExportModal({ 
        open: true, 
        title: "Экспорт в Python (aiogram)", 
        content,
        type: "python" 
      });
    }
  }, [project, messages]);

  const saveProject = useCallback(() => {
    const data = {
      ...project,
      messages: messages.map(({ isStart, ...msg }) => msg),
      savedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [project, messages]);

  const loadProject = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setProject(prev => ({ ...prev, ...data }));
        setMessages(data.messages || []);
        setSelectedId(data.messages[0]?.id || null);
        setHistory([]); // Reset history on load
        setRedoStack([]);
      } catch (error) {
        alert('Ошибка загрузки файла: неверный формат');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  // Memoized filtered messages
  const filteredMessages = useMemo(() => 
    messages.filter(msg => 
      msg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.command?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.buttons.some(btn => btn.text.toLowerCase().includes(searchTerm.toLowerCase())) ||
      msg.replyKeyboard.some(btn => btn.text.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [messages, searchTerm]
  );

  const themeClasses = theme === "dark" 
    ? "bg-gray-900 text-gray-300" 
    : "bg-slate-50 text-gray-900";
    
  const sidebarBg = theme === "dark" 
    ? "bg-gray-800 border-gray-700" 
    : "bg-white border-slate-200";

  const chatBg = theme === "dark" 
    ? "bg-gradient-to-b from-gray-800 to-gray-900" 
    : "bg-gradient-to-b from-slate-50 to-slate-100";

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${themeClasses} theme-${theme}`}>
      {!previewMode && (
  <div className={`w-80 h-screen flex flex-col border-r transition-colors duration-200 fixed left-0 top-0 bottom-0 overflow-y-auto ${sidebarBg}`}>
    
    <SidebarHeader 
      project={project}
      onProjectUpdate={(updates) => applyChange(state => ({ ...state, project: { ...state.project, ...updates } }))}
      theme={theme}
    />
    
    <NavigationTabs 
      activeTab={activeTab}
      onTabChange={setActiveTab}
      theme={theme}
    />

    <div className="flex-1 min-h-0 overflow-auto">
      {activeTab === "design" && (
        <DesignTab
          messages={filteredMessages}
          selectedId={selectedId}
          onSelect={openEditor}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          theme={theme}
        />
      )}

      {activeTab === "properties" && editDraft && (
        <PropertiesTab
          draft={editDraft}
          onDraftChange={setEditDraft}
          messages={messages}
          theme={theme}
          onSave={saveEdit}
          onCancel={cancelEdit}
          onAddButton={addButton}
          onUpdateButton={updateButton}
          onRemoveButton={removeButton}
        />
      )}

      {activeTab === "flow" && (
        <FlowTab
          messages={messages}
          selectedId={selectedId}
          startMessageId={project.startMessageId}
          onSelect={openEditor}
          onSetStart={setStartMessage}
          theme={theme}
        />
      )}
    </div>

    <SidebarFooter
      onSave={saveProject}
      onLoad={loadProject}
      onUndo={undo}
      onRedo={redo}
      canUndo={history.length > 0}
      canRedo={redoStack.length > 0}
      theme={theme}
    />
  </div>
)}

      <div className="flex-1 flex flex-col min-w-0 ml-80">
        <Header
          previewMode={previewMode}
          mode={mode}
          theme={theme}
          onThemeChange={setTheme}
          onPreview={startPreview}
          onExitPreview={exitPreview}
          onExport={exportProject}
        />

        <div className="flex-1 flex overflow-hidden">
          <div className={`flex-1 flex flex-col transition-colors duration-200 ${chatBg}`}>
            <div className="flex-1 overflow-auto">
              <div className="min-h-full flex flex-col justify-end">
                <div className="p-4 space-y-3 max-w-4xl mx-auto w-full">
                  {(previewMode ? previewHistory : messages).map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isPreview={previewMode}
                      theme={theme}
                      isSelected={selectedId === message.id}
                      isStartMessage={project.startMessageId === message.id}
                      showActions={!previewMode}
                      isHovered={hoveredMessageId === message.id}
                      onHoverChange={setHoveredMessageId}
                      onEdit={openEditor}
                      onAddAfter={(id) => addMessage({ afterId: id, role: 'bot' })}
                      onAddBefore={(id) => addMessage({ beforeId: id, role: 'bot' })}
                      onDuplicate={duplicateMessage}
                      onDelete={removeMessage}
                      onSetStart={setStartMessage}
                      onButtonClick={previewMode ? (goto) => {
                        setTyping(true);
                        setTimeout(() => {
                          const targetMsg = messages.find(m => m.id === goto);
                          if (targetMsg) {
                            setPreviewHistory(prev => [...prev, targetMsg]);
                            setCurrentPreviewMsgId(targetMsg.id);
                            setActiveReplyKeyboard(targetMsg.replyKeyboard || []);
                          }
                          setTyping(false);
                        }, 600);
                      } : undefined}
                    />
                  ))}
                  
                  {previewMode && typing && <TypingIndicator theme={theme} />}
                  
                  {!previewMode && messages.length === 0 && (
                    <EmptyState theme={theme} />
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            <InputArea
              ref={inputRef}
              previewMode={previewMode}
              mode={mode}
              theme={theme}
              activeReplyKeyboard={activeReplyKeyboard}
              onReplyClick={handlePreviewReplyClick}
              onModeChange={setMode}
              onSubmit={previewMode ? handlePreviewInput : handleInputSubmit}
            />
          </div>
        </div>
      </div>

      {exportModal.open && (
        <ExportModal
          modal={exportModal}
          onClose={() => setExportModal(prev => ({ ...prev, open: false }))}
          theme={theme}
        />
      )}
    </div>
  );
}

// Message Bubble: Action buttons under message
function MessageBubble({
  message,
  isPreview,
  theme,
  isSelected,
  isStartMessage,
  showActions,
  isHovered,
  onHoverChange,
  onEdit,
  onAddAfter,
  onAddBefore,
  onDuplicate,
  onDelete,
  onSetStart,
  onButtonClick
}) {
  const isBot = message.role === "bot";
  const hasActions = showActions && isBot;
  
  const bubbleClasses = `
    max-w-[85%] transition-all duration-200
    ${isSelected ? 'ring-2 ring-blue-500 ring-opacity-50 rounded-xl' : ''}
    ${isStartMessage ? 'ring-2 ring-green-500 ring-opacity-50 rounded-xl' : ''}
  `;

  const actionButtons = hasActions && (
    <div className={`flex justify-center gap-2 mt-2 transition-opacity duration-200 ${
      isHovered ? 'opacity-100' : 'opacity-0'
    }`}>
      <ActionButton
        icon="↑"
        title="Добавить перед"
        onClick={() => onAddBefore(message.id)}
        color="green"
      />
      <ActionButton
        icon="✎"
        title="Редактировать"
        onClick={() => onEdit(message.id)}
        color="blue"
      />
      <ActionButton
        icon="⎘"
        title="Дублировать"
        onClick={() => onDuplicate(message.id)}
        color="orange"
      />
      <ActionButton
        icon="↓"
        title="Добавить после"
        onClick={() => onAddAfter(message.id)}
        color="green"
      />
      <ActionButton
        icon="⭐"
        title="Сделать стартовым"
        onClick={() => onSetStart(message.id)}
        color="yellow"
        isActive={isStartMessage}
      />
      <ActionButton
        icon="×"
        title="Удалить"
        onClick={() => onDelete(message.id)}
        color="red"
      />
    </div>
  );

  return (
    <div 
      className={`flex flex-col ${isBot ? "items-start" : "items-end"} telegram-message`}
      onMouseEnter={() => onHoverChange(message.id)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <div className={`flex items-start gap-3 w-full ${isBot ? "justify-start" : "justify-end"}`}>
        {isBot && <BotAvatar />}
        
        <div className={bubbleClasses}>
          <MessageContent
            message={message}
            isBot={isBot}
            isPreview={isPreview}
            theme={theme}
            onButtonClick={onButtonClick}
          />
        </div>
        
        {!isBot && <UserAvatar />}
      </div>
      
      {actionButtons}
    </div>
  );
}

// Action Button Component
function ActionButton({ icon, title, onClick, color, isActive = false }) {
  const colorClasses = {
    green: 'bg-green-500 hover:bg-green-600 text-white',
    blue: 'bg-blue-500 hover:bg-blue-600 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    red: 'bg-red-500 hover:bg-red-600 text-white'
  };

  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        w-8 h-8 rounded-full shadow-lg flex items-center justify-center
        text-sm font-medium transition-all duration-200
        hover:scale-110 active:scale-95
        ${colorClasses[color]}
        ${isActive ? 'ring-2 ring-white ring-opacity-50' : ''}
      `}
    >
      {icon}
    </button>
  );
}

// MessageContent Component
function MessageContent({ message, isBot, isPreview, theme, onButtonClick }) {
  const bubbleBg = isBot 
    ? theme === "dark" ? "var(--tg-bot-bubble-dark)" : "var(--tg-bot-bubble-light)"
    : theme === "dark" ? "var(--tg-user-bubble-dark)" : "var(--tg-user-bubble-light)";
  
  const textColor = theme === "dark" 
    ? "var(--tg-text-dark)"
    : "var(--tg-text-light)";

  return (
    <div className={`px-4 py-3 rounded-2xl shadow-sm ${bubbleBg} ${textColor} ${
      isBot ? 'bot-bubble' : 'user-bubble'
    }`}>
      {message.command && (
        <div className={`text-xs mb-2 ${
          theme === "dark" ? "text-blue-400" : "text-blue-600"
        }`}>
          Команда: {message.command}
        </div>
      )}

      {message.media && <MediaPreview media={message.media} theme={theme} />}

      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {message.text}
      </div>

      {isBot && message.buttons.length > 0 && (
        <InlineButtons 
          buttons={message.buttons}
          isPreview={isPreview}
          theme={theme}
          onButtonClick={onButtonClick}
        />
      )}

      {isBot && message.replyKeyboard.length > 0 && !isPreview && (
        <ReplyKeyboard 
          buttons={message.replyKeyboard}
          isPreview={isPreview}
          theme={theme}
          onButtonClick={onButtonClick}
        />
      )}

      <MessageFooter 
        message={message}
        theme={theme}
        isBot={isBot}
      />
    </div>
  );
}

// Media Preview Component
function MediaPreview({ media, theme }) {
  if (!media) return null;

  switch (media.type) {
    case 'image':
      return (
        <img 
          src={media.url}
          alt="Media"
          className="w-full rounded-lg mb-3 max-h-64 object-cover border border-gray-200 dark:border-gray-600"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      );
    case 'document':
      return (
        <div className={`p-3 rounded-lg border mb-3 ${
          theme === "dark" ? "bg-gray-600 border-gray-500" : "bg-slate-50 border-slate-300"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded flex items-center justify-center ${
              theme === "dark" ? "bg-gray-500" : "bg-blue-100"
            }`}>
              <span className={theme === "dark" ? "text-gray-300" : "text-blue-600"}>📎</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${
                theme === "dark" ? "text-gray-300" : "text-gray-800"
              }`}>
                Документ
              </div>
              <div className={`text-xs truncate ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}>
                {media.url}
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// Inline Buttons Component
function InlineButtons({ buttons, isPreview, theme, onButtonClick }) {
  return (
    <div className="mt-3 space-y-2">
      {buttons.map((btn) => (
        <button
          key={btn.id}
          onClick={() => isPreview && onButtonClick && onButtonClick(btn.goto)}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-all border ${
            isPreview 
              ? `cursor-pointer ${
                  theme === "dark" 
                    ? "bg-gray-600 hover:bg-gray-500 border-gray-500 text-blue-400" 
                    : "bg-white border-slate-300 hover:bg-slate-50 text-blue-600"
                }`
              : `cursor-default ${
                  theme === "dark" 
                    ? "bg-gray-600 border-gray-500 text-blue-400" 
                    : "bg-white border-slate-300 text-blue-600"
                }`
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{btn.text}</span>
            {btn.goto && !isPreview && (
              <span className="text-xs opacity-60">→</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// Reply Keyboard Component
function ReplyKeyboard({ buttons, isPreview, theme, onButtonClick }) {
  return (
    <div className={`mt-3 p-3 rounded border ${
      theme === "dark" 
        ? "border-gray-600 bg-gray-600/30" 
        : "border-slate-300 bg-slate-50"
    }`}>
      <div className={`text-xs mb-2 ${
        theme === "dark" ? "text-gray-400" : "text-gray-600"
      }`}>
        Reply Keyboard:
      </div>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => isPreview && onButtonClick && onButtonClick(btn.goto)}
            className={`px-3 py-2 rounded text-sm border ${
              isPreview
                ? `cursor-pointer ${
                    theme === "dark"
                      ? "bg-gray-500 hover:bg-gray-400 border-gray-400"
                      : "bg-slate-200 hover:bg-slate-300 border-slate-400"
                  }`
                : `cursor-default ${
                    theme === "dark"
                      ? "bg-gray-500 border-gray-400"
                      : "bg-slate-200 border-slate-400"
                  }`
            } ${theme === "dark" ? "text-gray-300" : "text-gray-800"}`}
          >
            {btn.text}
          </button>
        ))}
      </div>
    </div>
  );
}

// Message Footer Component
function MessageFooter({ message, theme, isBot }) {
  const time = new Date().toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`text-xs mt-2 flex items-center gap-2 ${
      theme === "dark" ? "text-gray-400" : "text-gray-500"
    }`}>
      <span>{time}</span>
      {message.delay > 0 && isBot && (
        <span className="opacity-70">⏱️ {message.delay}с</span>
      )}
    </div>
  );
}

// Avatar Components
function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 shadow-sm flex items-center justify-center text-white text-xs font-bold">
      B
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex-shrink-0 shadow-sm flex items-center justify-center text-white text-xs font-bold">
      U
    </div>
  );
}

// Sidebar Header Component
function SidebarHeader({ project, onProjectUpdate, theme }) {
  return (
    <div className={`p-4 border-b ${
      theme === "dark" ? "border-gray-700" : "border-slate-200"
    }`}>
      <input
        value={project.name}
        onChange={(e) => onProjectUpdate(prev => ({ ...prev, name: e.target.value }))}
        className={`w-full text-lg font-bold bg-transparent border-none focus:outline-none ${
          theme === "dark" ? "text-gray-300" : "text-gray-900"
        }`}
        placeholder="Название бота"
      />
      <textarea
        value={project.description}
        onChange={(e) => onProjectUpdate(prev => ({ ...prev, description: e.target.value }))}
        className={`w-full mt-2 text-sm bg-transparent border-none focus:outline-none resize-none ${
          theme === "dark" ? "text-gray-400 placeholder-gray-500" : "text-gray-600 placeholder-gray-400"
        }`}
        placeholder="Описание бота..."
        rows={2}
      />
    </div>
  );
}

// Navigation Tabs Component
function NavigationTabs({ activeTab, onTabChange, theme }) {
  const tabs = [
    { id: "design", label: "Дизайн", icon: "💬" },
    { id: "properties", label: "Свойства", icon: "⚙️" },
    { id: "flow", label: "Поток", icon: "🔀" }
  ];

  return (
    <div className={`border-b ${
      theme === "dark" ? "border-gray-700" : "border-slate-200"
    }`}>
      <div className="flex">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? theme === "dark"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-blue-600 border-b-2 border-blue-600"
                : theme === "dark"
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <span>{tab.icon}</span>
              <span className="hidden sm:block">{tab.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Design Tab Component
function DesignTab({ messages, selectedId, onSelect, searchTerm, onSearchChange, theme }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <div className={`flex-1 py-2 px-3 rounded text-sm text-center ${
          theme === "dark" ? "bg-gray-700 text-gray-300" : "bg-slate-200 text-gray-700"
        }`}>
          🤖 Bot Messages
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className={`text-sm font-medium ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}>
            Сообщения ({messages.length})
          </div>
        </div>
        
        <input
          type="text"
          placeholder="Поиск сообщений..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded text-sm ${
            theme === "dark" 
              ? "bg-gray-700 border-gray-600 text-gray-300 placeholder-gray-400" 
              : "bg-white border-slate-300 text-gray-900 placeholder-gray-500"
          }`}
        />

        <div className="space-y-2 max-h-96 overflow-auto">
          {messages.map((msg, index) => (
            <MessageListItem
              key={msg.id}
              message={msg}
              index={index}
              isSelected={selectedId === msg.id}
              onSelect={onSelect}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Message List Item Component
function MessageListItem({ message, index, isSelected, onSelect, theme }) {
  return (
    <div
      onClick={() => onSelect(message.id)}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? theme === "dark"
            ? "border-blue-500 bg-blue-900/20"
            : "border-blue-500 bg-blue-50"
          : theme === "dark"
            ? "border-gray-600 hover:border-gray-500"
            : "border-slate-200 hover:border-slate-400"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${
              message.role === 'bot' 
                ? theme === "dark" ? "bg-green-400" : "bg-green-500"
                : theme === "dark" ? "bg-blue-400" : "bg-blue-500"
            }`}></span>
            <span className={`text-xs font-medium ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}>
              {message.role === 'bot' ? 'Bot' : 'User'}
            </span>
            {message.command && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                theme === "dark" 
                  ? "bg-blue-900/50 text-blue-300" 
                  : "bg-blue-100 text-blue-700"
              }`}>
                {message.command}
              </span>
            )}
          </div>
          <div className={`text-sm truncate ${
            theme === "dark" ? "text-gray-300" : "text-gray-800"
          }`}>
            {message.text}
          </div>
          {(message.buttons.length > 0 || message.replyKeyboard.length > 0) && (
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-xs ${
                theme === "dark" ? "text-gray-500" : "text-gray-600"
              }`}>
                Кнопки:
              </span>
              <div className="flex gap-1 flex-wrap">
                {[...message.buttons, ...message.replyKeyboard].slice(0, 2).map(btn => (
                  <span key={btn.id} className={`text-xs px-1.5 py-0.5 rounded ${
                    theme === "dark" 
                      ? "bg-gray-600 text-gray-300" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {btn.text}
                  </span>
                ))}
                {message.buttons.length + message.replyKeyboard.length > 2 && (
                  <span className={`text-xs ${
                    theme === "dark" ? "text-gray-500" : "text-gray-600"
                  }`}>
                    +{message.buttons.length + message.replyKeyboard.length - 2}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={`text-xs ${
          theme === "dark" ? "text-gray-500" : "text-gray-600"
        }`}>
          #{index + 1}
        </div>
      </div>
    </div>
  );
}

// Properties Tab Component
function PropertiesTab({ 
  draft, 
  onDraftChange, 
  messages, 
  theme, 
  onSave, 
  onCancel,
  onAddButton,
  onUpdateButton,
  onRemoveButton
}) {
  if (!draft) return null;

  return (
    <div className="p-4 space-y-6 h-full overflow-auto">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          theme === "dark" ? "text-gray-300" : "text-gray-700"
        }`}>
          Текст сообщения
        </label>
        <textarea
          value={draft.text}
          onChange={(e) => onDraftChange({ ...draft, text: e.target.value })}
          className={`w-full h-32 border rounded-lg p-3 text-sm transition-colors ${
            theme === "dark" 
              ? "bg-gray-700 border-gray-600 text-gray-300 placeholder-gray-400" 
              : "bg-white border-slate-300 text-gray-900 placeholder-gray-500"
          }`}
          placeholder="Введите текст сообщения..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}>
            Команда
          </label>
          <input
            value={draft.command || ""}
            onChange={(e) => onDraftChange({ ...draft, command: e.target.value })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-gray-700 border-gray-600 text-gray-300 placeholder-gray-400" 
                : "bg-white border-slate-300 text-gray-900 placeholder-gray-500"
            }`}
            placeholder="/start"
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}>
            Задержка (сек)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={draft.delay}
            onChange={(e) => onDraftChange({ ...draft, delay: Math.max(0, parseInt(e.target.value) || 0) })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-gray-700 border-gray-600 text-gray-300" 
                : "bg-white border-slate-300 text-gray-900"
            }`}
          />
        </div>
      </div>

      <MediaTypeSelector draft={draft} onDraftChange={onDraftChange} theme={theme} />

      <ButtonSection
        type="inline"
        title="Inline кнопки"
        buttons={draft.buttons}
        messages={messages}
        theme={theme}
        onAddButton={() => onAddButton("inline")}
        onUpdateButton={onUpdateButton}
        onRemoveButton={onRemoveButton}
      />

      <ButtonSection
        type="reply"
        title="Reply клавиатура"
        buttons={draft.replyKeyboard}
        messages={messages}
        theme={theme}
        onAddButton={() => onAddButton("reply")}
        onUpdateButton={onUpdateButton}
        onRemoveButton={onRemoveButton}
      />

      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-gray-700">
        <button 
          onClick={onSave}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Сохранить
        </button>
        <button 
          onClick={onCancel}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            theme === "dark"
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-200 hover:bg-gray-300 text-gray-700"
          }`}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// Media Type Selector Component
function MediaTypeSelector({ draft, onDraftChange, theme }) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${
        theme === "dark" ? "text-gray-300" : "text-gray-700"
      }`}>
        Тип сообщения
      </label>
      <select 
        value={draft.media?.type || 'text'}
        onChange={(e) => {
          const type = e.target.value;
          onDraftChange({
            ...draft, 
            media: type === 'text' ? null : { type, url: '' }
          });
        }}
        className={`w-full px-3 py-2 border rounded text-sm ${
          theme === "dark" 
            ? "bg-gray-700 border-gray-600 text-gray-300" 
            : "bg-white border-slate-300 text-gray-900"
        }`}
      >
        <option value="text">📝 Текст</option>
        <option value="image">🖼️ Изображение</option>
        <option value="document">📎 Документ</option>
      </select>

      {(draft.media?.type === 'image' || draft.media?.type === 'document') && (
        <div className="mt-2">
          <label className={`block text-sm font-medium mb-2 ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}>
            URL медиа
          </label>
          <input
            value={draft.media?.url || ""}
            onChange={(e) => onDraftChange({ 
              ...draft, 
              media: { ...draft.media, url: e.target.value } 
            })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-gray-700 border-gray-600 text-gray-300 placeholder-gray-400" 
                : "bg-white border-slate-300 text-gray-900 placeholder-gray-500"
            }`}
            placeholder="https://example.com/image.jpg"
          />
        </div>
      )}
    </div>
  );
}

// Button Section Component
function ButtonSection({ type, title, buttons, messages, theme, onAddButton, onUpdateButton, onRemoveButton }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className={`text-sm font-medium ${
          theme === "dark" ? "text-gray-300" : "text-gray-700"
        }`}>
          {title}
        </label>
        <button 
          onClick={onAddButton}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            theme === "dark"
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          + Добавить кнопку
        </button>
      </div>
      
      <div className="space-y-2">
        {buttons.map((btn, idx) => (
          <ButtonEditor
            key={btn.id}
            type={type}
            button={btn}
            index={idx}
            messages={messages}
            theme={theme}
            onUpdate={onUpdateButton}
            onRemove={onRemoveButton}
          />
        ))}
        
        {buttons.length === 0 && (
          <div className={`text-center py-4 rounded-lg border-2 border-dashed ${
            theme === "dark" 
              ? "border-gray-600 text-gray-500" 
              : "border-slate-300 text-gray-600"
          }`}>
            <div className="text-sm">Нет кнопок</div>
            <div className="text-xs mt-1">Нажмите "Добавить кнопку" чтобы создать</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Button Editor Component
function ButtonEditor({ type, button, index, messages, theme, onUpdate, onRemove }) {
  return (
    <div className={`p-3 rounded-lg border ${
      theme === "dark" 
        ? "bg-gray-700/50 border-gray-600" 
        : "bg-slate-50 border-slate-300"
    }`}>
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-2">
          <input
            value={button.text}
            onChange={(e) => onUpdate(type, index, { text: e.target.value })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-gray-600 border-gray-500 text-gray-300 placeholder-gray-400" 
                : "bg-white border-slate-300 text-gray-900 placeholder-gray-500"
            }`}
            placeholder="Текст кнопки"
          />
          
          <select
            value={button.goto || ""}
            onChange={(e) => onUpdate(type, index, { goto: e.target.value || null })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-gray-600 border-gray-500 text-gray-300" 
                : "bg-white border-slate-300 text-gray-900"
            }`}
          >
            <option value="">-- Выберите целевое сообщение --</option>
            {messages.filter(m => m.role === 'bot').map((m) => (
              <option key={m.id} value={m.id}>
                {m.text.slice(0, 40)}...
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => onRemove(type, index)}
          className={`px-3 py-2 rounded text-sm transition-colors ${
            theme === "dark"
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Flow Tab Component
function FlowTab({ messages, selectedId, startMessageId, onSelect, onSetStart, theme }) {
  return (
    <div className="p-4">
      <div className={`text-sm font-medium mb-4 ${
        theme === "dark" ? "text-gray-300" : "text-gray-700"
      }`}>
        Визуализация потока диалога
      </div>
      
      <div className="space-y-3">
        {messages.map((msg, index) => (
          <FlowMessageItem
            key={msg.id}
            message={msg}
            index={index}
            isSelected={selectedId === msg.id}
            isStart={startMessageId === msg.id}
            onSelect={onSelect}
            onSetStart={onSetStart}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}

// Flow Message Item Component
function FlowMessageItem({ message, index, isSelected, isStart, onSelect, onSetStart, theme }) {
  return (
    <div
      onClick={() => onSelect(message.id)}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? theme === "dark"
            ? "border-blue-500 bg-blue-900/20"
            : "border-blue-500 bg-blue-50"
          : theme === "dark"
            ? "border-gray-600 hover:border-gray-500"
            : "border-slate-200 hover:border-slate-400"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
          message.role === 'bot' 
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
            : 'bg-gradient-to-br from-green-500 to-emerald-600'
        }`}>
          {message.role === 'bot' ? 'B' : 'U'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-800"
            }`}>
              {message.role === 'bot' ? 'Бот' : 'Пользователь'}
            </span>
            {isStart && (
              <span className={`text-xs px-2 py-1 rounded ${
                theme === "dark" 
                  ? "bg-green-900/50 text-green-300" 
                  : "bg-green-100 text-green-700"
              }`}>
                Старт
              </span>
            )}
            {message.command && (
              <span className={`text-xs px-2 py-1 rounded ${
                theme === "dark" 
                  ? "bg-blue-900/50 text-blue-300" 
                  : "bg-blue-100 text-blue-700"
              }`}>
                {message.command}
              </span>
            )}
          </div>
          
          <div className={`text-sm ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}>
            {message.text}
          </div>
          
          {(message.buttons.length > 0 || message.replyKeyboard.length > 0) && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs ${
                theme === "dark" ? "text-gray-500" : "text-gray-600"
              }`}>
                Кнопки:
              </span>
              <div className="flex gap-1 flex-wrap">
                {[...message.buttons, ...message.replyKeyboard].slice(0, 3).map(btn => (
                  <span key={btn.id} className={`text-xs px-1.5 py-0.5 rounded ${
                    theme === "dark" 
                      ? "bg-gray-600 text-gray-300" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {btn.text}
                  </span>
                ))}
                {message.buttons.length + message.replyKeyboard.length > 3 && (
                  <span className={`text-xs ${
                    theme === "dark" ? "text-gray-500" : "text-gray-600"
                  }`}>
                    +{message.buttons.length + message.replyKeyboard.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className={`text-xs ${
            theme === "dark" ? "text-gray-500" : "text-gray-600"
          }`}>
            #{index + 1}
          </div>
          {!isStart && message.role === 'bot' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetStart(message.id);
              }}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                theme === "dark"
                  ? "bg-gray-600 hover:bg-gray-500 text-gray-300"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              Старт
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sidebar Footer Component
function SidebarFooter({ onSave, onLoad, onUndo, onRedo, canUndo, canRedo, theme }) {
  return (
    <div className={`p-4 border-t ${theme === "dark" ? "border-gray-700" : "border-slate-200"}`}>
      <div className="space-y-2">
        <button
          onClick={onSave}
          className={`w-full py-2 px-4 rounded text-sm transition-colors ${
            theme === "dark"
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          💾 Сохранить проект
        </button>
        <label className={`block w-full py-2 px-4 rounded text-sm text-center cursor-pointer transition-colors ${
          theme === "dark"
            ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
            : "bg-slate-200 hover:bg-slate-300 text-slate-700"
        }`}>
          📂 Загрузить проект
          <input
            type="file"
            accept=".json"
            onChange={onLoad}
            className="hidden"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-1 py-2 rounded text-sm transition-colors ${
              canUndo
                ? theme === "dark" 
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300" 
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                : theme === "dark"
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            ↩️ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex-1 py-2 rounded text-sm transition-colors ${
              canRedo
                ? theme === "dark" 
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300" 
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                : theme === "dark"
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            ↪️ Redo
          </button>
        </div>
      </div>
    </div>
  );
}

// Header Component
function Header({ previewMode, mode, theme, onThemeChange, onPreview, onExitPreview, onExport }) {
  return (
    <div className={`border-b px-6 py-4 flex items-center justify-between ${
      theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-slate-200"
    }`}>
      <div className="flex items-center gap-4">
        <h1 className={`text-xl font-semibold ${
          theme === "dark" ? "text-gray-300" : "text-gray-900"
        }`}>
          {previewMode ? "Предпросмотр бота" : "Конструктор Telegram ботов"}
        </h1>
        
        {!previewMode && (
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded text-xs ${
              mode === 'user' 
                ? theme === "dark"
                  ? "bg-blue-900 text-blue-200"
                  : "bg-blue-100 text-blue-800"
                : theme === "dark"
                  ? "bg-green-900 text-green-200"
                  : "bg-green-100 text-green-800"
            }`}>
              {mode === 'user' ? 'Режим пользователя' : 'Режим бота'}
            </div>
            <button 
              onClick={() => onThemeChange(theme === "light" ? "dark" : "light")}
              className={`p-2 rounded transition-colors ${
                theme === "dark" 
                  ? "hover:bg-gray-700 text-gray-300" 
                  : "hover:bg-slate-200 text-gray-600"
              }`}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!previewMode ? (
          <>
            <button 
              onClick={onPreview}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
            >
              👁️ Предпросмотр
            </button>
            <button 
              onClick={() => onExport('json')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              📤 JSON
            </button>
            <button 
              onClick={() => onExport('python')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition-colors"
            >
              🐍 Python
            </button>
          </>
        ) : (
          <button 
            onClick={onExitPreview}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
          >
            ✕ Выйти
          </button>
        )}
      </div>
    </div>
  );
}

// Input Area Component
const InputArea = React.forwardRef(({ previewMode, mode, theme, activeReplyKeyboard, onReplyClick, onModeChange, onSubmit }, ref) => {
  return (
    <div className={`border-t px-6 py-4 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-slate-200"}`}>
      {previewMode && activeReplyKeyboard.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {activeReplyKeyboard.map(btn => (
            <button
              key={btn.id}
              onClick={() => onReplyClick(btn)}
              className={`px-3 py-2 rounded text-sm border cursor-pointer ${
                theme === "dark"
                  ? "bg-gray-500 hover:bg-gray-400 border-gray-400 text-gray-300"
                  : "bg-slate-200 hover:bg-slate-300 border-slate-400 text-gray-800"
              }`}
            >
              {btn.text}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <input
            ref={ref}
            placeholder={
              previewMode 
                ? "Введите сообщение..." 
                : mode === "user" 
                  ? "Сообщение пользователя..." 
                  : "Сообщение бота..."
            }
            className={`w-full px-4 py-3 border rounded-2xl transition-colors ${
              theme === "dark" 
                ? "bg-gray-700 border-gray-600 text-gray-300 placeholder-gray-400" 
                : "bg-white border-slate-300 text-gray-900 placeholder-gray-500"
            }`}
          />
        </div>
        <button 
          type="submit"
          className={`px-6 py-3 rounded-2xl font-medium transition-colors ${
            theme === "dark"
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {previewMode ? "Отправить" : "Добавить"}
        </button>
      </form>
      
      {!previewMode && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
            {mode === 'user' ? 'Добавляется сообщение пользователя' : 'Добавляется сообщение бота'}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => onModeChange('user')}
              className={`px-3 py-1 rounded transition-colors ${
                mode === 'user' 
                  ? theme === "dark"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-600 text-white"
                  : theme === "dark"
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              👤 User
            </button>
            <button 
              onClick={() => onModeChange('bot')}
              className={`px-3 py-1 rounded transition-colors ${
                mode === 'bot' 
                  ? theme === "dark"
                    ? "bg-green-600 text-white"
                    : "bg-green-600 text-white"
                  : theme === "dark"
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              🤖 Bot
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// Typing Indicator Component
function TypingIndicator({ theme }) {
  return (
    <div className="flex justify-start items-end gap-3">
      <BotAvatar />
      <div className={`px-4 py-3 rounded-2xl ${
        theme === "dark" ? "bg-gray-700" : "bg-white border border-slate-200"
      } bot-bubble`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className={`w-2 h-2 rounded-full typing-dot ${
              theme === "dark" ? "bg-gray-400" : "bg-gray-500"
            }`}></div>
            <div className={`w-2 h-2 rounded-full typing-dot ${
              theme === "dark" ? "bg-gray-400" : "bg-gray-500"
            }`} style={{animationDelay: '0.2s'}}></div>
            <div className={`w-2 h-2 rounded-full typing-dot ${
              theme === "dark" ? "bg-gray-400" : "bg-gray-500"
            }`} style={{animationDelay: '0.4s'}}></div>
          </div>
          <span className={`text-xs ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}>
            печатает...
          </span>
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ theme }) {
  return (
    <div className={`text-center py-12 rounded-lg ${
      theme === "dark" ? "text-gray-400" : "text-gray-500"
    }`}>
      <div className="text-6xl mb-4">🤖</div>
      <div className="text-lg mb-2">Начните создание бота</div>
      <div className="text-sm">Добавьте первое сообщение используя поле ввода ниже</div>
    </div>
  );
}

// Export Modal Component
function ExportModal({ modal, onClose, theme }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(modal.content);
  };

  const handleDownload = () => {
    const extension = modal.type === 'python' ? 'py' : 'json';
    const blob = new Blob([modal.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot_export.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
        theme === "dark" ? "bg-gray-800" : "bg-white"
      }`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
          <div className={`font-semibold text-lg ${
            theme === "dark" ? "text-gray-300" : "text-gray-900"
          }`}>
            {modal.title}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              Копировать
            </button>
            <button 
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
            >
              Скачать
            </button>
            <button 
              onClick={onClose}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                theme === "dark"
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              Закрыть
            </button>
          </div>
        </div>
        
        <textarea
          readOnly
          value={modal.content}
          className={`w-full h-96 font-mono text-sm p-6 border-none focus:outline-none resize-none rounded-b-xl ${
            theme === "dark" 
              ? "bg-gray-900 text-green-400 scroll-dark" 
              : "bg-gray-50 text-gray-800 scroll-light"
          }`}
        />
      </div>
    </div>
  );
}

// CSS Styles
const styles = `
:root {
  --tg-bot-bubble-light: #ffffff;
  --tg-bot-bubble-dark: #1c1c1e;
  --tg-user-bubble-light: #d7f0ff;
  --tg-user-bubble-dark: #2a2a2e;
  --tg-text-light: #000000;
  --tg-text-dark: #ffffff;
  --tg-border-light: #d9d9d9;
  --tg-border-dark: #333333;
  --tg-button-light: #f0f0f0;
  --tg-button-dark: #3a3a3c;
}

/* Force scrollbar styles for Webkit browsers */
/* Increase specificity by targeting body and using :root */
:root .theme-light ::-webkit-scrollbar {
  width: 12px !important;
}
:root .theme-light ::-webkit-scrollbar-track {
  background: #f1f5f9 !important;
  border-radius: 6px !important;
}
:root .theme-light ::-webkit-scrollbar-thumb {
  background: #cbd5e1 !important;
  border-radius: 6px !important;
  border: 3px solid #f1f5f9 !important;
}
:root .theme-light ::-webkit-scrollbar-thumb:hover {
  background: #94a3b8 !important;
}

:root .theme-dark ::-webkit-scrollbar {
  width: 12px !important;
}
:root .theme-dark ::-webkit-scrollbar-track {
  background: #1f2937 !important;
  border-radius: 6px !important;
}
:root .theme-dark ::-webkit-scrollbar-thumb {
  background: #4b5563 !important;
  border-radius: 6px !important;
  border: 3px solid #1f2937 !important;
}
:root .theme-dark ::-webkit-scrollbar-thumb:hover {
  background: #6b7280 !important;
}

/* Alternative: Apply scrollbar styles directly to elements that might have overflow */
/* Target the main content area and sidebar specifically */
body.theme-light .overflow-y-auto::-webkit-scrollbar,
body.theme-light .overflow-auto::-webkit-scrollbar {
  width: 12px !important;
}
body.theme-light .overflow-y-auto::-webkit-scrollbar-track,
body.theme-light .overflow-auto::-webkit-scrollbar-track {
  background: #f1f5f9 !important;
  border-radius: 6px !important;
}
body.theme-light .overflow-y-auto::-webkit-scrollbar-thumb,
body.theme-light .overflow-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1 !important;
  border-radius: 6px !important;
  border: 3px solid #f1f5f9 !important;
}
body.theme-light .overflow-y-auto::-webkit-scrollbar-thumb:hover,
body.theme-light .overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8 !important;
}

body.theme-dark .overflow-y-auto::-webkit-scrollbar,
body.theme-dark .overflow-auto::-webkit-scrollbar {
  width: 12px !important;
}
body.theme-dark .overflow-y-auto::-webkit-scrollbar-track,
body.theme-dark .overflow-auto::-webkit-scrollbar-track {
  background: #1f2937 !important;
  border-radius: 6px !important;
}
body.theme-dark .overflow-y-auto::-webkit-scrollbar-thumb,
body.theme-dark .overflow-auto::-webkit-scrollbar-thumb {
  background: #4b5563 !important;
  border-radius: 6px !important;
  border: 3px solid #1f2937 !important;
}
body.theme-dark .overflow-y-auto::-webkit-scrollbar-thumb:hover,
body.theme-dark .overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #6b7280 !important;
}

/* Firefox scrollbar */
.theme-light {
  scrollbar-width: thin !important;
  scrollbar-color: #cbd5e1 #f1f5f9 !important;
}
.theme-dark {
  scrollbar-width: thin !important;
  scrollbar-color: #4b5563 #1f2937 !important;
}

.telegram-message {
  position: relative;
  margin-bottom: 1.5rem;
  animation: messageAppear 0.3s ease-out;
}

.bot-bubble {
  border-radius: 18px 18px 18px 6px;
  position: relative;
}
.bot-bubble:after {
  content: '';
  position: absolute;
  bottom: 0;
  left: -4px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-bottom-left-radius: 10px;
  transform: rotate(135deg);
  box-shadow: -2px 1px 2px rgba(0,0,0,0.05);
}

.user-bubble {
  border-radius: 18px 18px 6px 18px;
  position: relative;
}
.user-bubble:after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -4px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-bottom-right-radius: 10px;
  transform: rotate(-135deg);
  box-shadow: 1px 2px 2px rgba(0,0,0,0.05);
}

.typing-dot {
  animation: typing 1s infinite;
}

@keyframes typing {
  0%, 100% { transform: translateY(0); opacity: 0.6; }
  50% { transform: translateY(-3px); opacity: 1; }
}

@keyframes messageAppear {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  box-shadow: 0 0 0 2px #3390ec;
  transition: box-shadow 0.2s;
}

.message-actions {
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.telegram-message:hover .message-actions {
  opacity: 1;
}

.message-actions button {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, background-color 0.2s;
}

.message-actions button:hover {
  transform: scale(1.1);
}

.message-actions button:active {
  transform: scale(0.95);
}

.reply-keyboard-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  animation: slideUp 0.3s ease-out;
}

.reply-keyboard-preview button {
  transition: background-color 0.2s, transform 0.1s;
}

.reply-keyboard-preview button:hover {
  transform: scale(1.05);
}

.reply-keyboard-preview button:active {
  transform: scale(0.95);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Smooth scrolling for the entire app */
html {
  scroll-behavior: smooth;
}

/* Custom scrollbar for export modal with higher specificity */
.export-modal-content.theme-light::-webkit-scrollbar {
  width: 12px !important;
}

.export-modal-content.theme-light::-webkit-scrollbar-track {
  background: #f8fafc !important;
  border-radius: 6px !important;
}

.export-modal-content.theme-light::-webkit-scrollbar-thumb {
  background: #e2e8f0 !important;
  border-radius: 6px !important;
  border: 3px solid #f8fafc !important;
}

.export-modal-content.theme-light::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1 !important;
}

.export-modal-content.theme-dark::-webkit-scrollbar {
  width: 12px !important;
}

.export-modal-content.theme-dark::-webkit-scrollbar-track {
  background: #111827 !important;
  border-radius: 6px !important;
}

.export-modal-content.theme-dark::-webkit-scrollbar-thumb {
  background: #374151 !important;
  border-radius: 6px !important;
  border: 3px solid #111827 !important;
}

.export-modal-content.theme-dark::-webkit-scrollbar-thumb:hover {
  background: #4b5563 !important;
}

/* Theme-specific overrides */
.theme-dark {
  background-color: var(--tg-bot-bubble-dark);
  color: var(--tg-text-dark);
}

.theme-dark .bg-white {
  background-color: var(--tg-bot-bubble-dark) !important;
}

.theme-dark .text-gray-900 {
  color: var(--tg-text-dark) !important;
}

.theme-dark .border-slate-200 {
  border-color: var(--tg-border-dark) !important;
}

.theme-dark .bg-slate-50 {
  background-color: #1f2937 !important;
}

.theme-dark .bg-slate-200 {
  background-color: var(--tg-button-dark) !important;
}

.theme-dark .bot-bubble {
  background-color: var(--tg-bot-bubble-dark) !important;
  color: var(--tg-text-dark) !important;
}

.theme-dark .user-bubble {
  background-color: var(--tg-user-bubble-dark) !important;
  color: var(--tg-text-dark) !important;
}

.theme-dark .bg-blue-500 {
  background-color: #2563eb !important;
}

.theme-dark .bg-green-500 {
  background-color: #16a34a !important;
}

.theme-dark .bg-orange-500 {
  background-color: #f97316 !important;
}

.theme-dark .bg-red-500 {
  background-color: #ef4444 !important;
}

.theme-dark .bg-blue-600 {
  background-color: #1d4ed8 !important;
}

.theme-dark .bg-green-600 {
  background-color: #15803d !important;
}

.theme-dark .bg-orange-600 {
  background-color: #ea580c !important;
}

.theme-dark .bg-red-600 {
  background-color: #dc2626 !important;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .telegram-message {
    margin-bottom: 1rem;
  }

  .message-actions {
    opacity: 1; /* Always visible on mobile for better UX */
  }

  .bot-bubble,
  .user-bubble {
    max-width: 95%;
  }
}
`;

//export default styles;
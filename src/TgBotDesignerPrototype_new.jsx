// TgBotDesignerImproved.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FixedSizeList } from 'react-window';

// Improved Telegram Bot Designer with fixed UX, better dark theme, action buttons, and enhanced logic
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
      conditions: [],
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
  const modalRef = useRef(null);
  
  const [exportModal, setExportModal] = useState({ 
    open: false, 
    content: "", 
    title: "",
    type: "json" 
  });
  
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHistory, setPreviewHistory] = useState([]);
  const [currentPreviewMsgId, setCurrentPreviewMsgId] = useState(null);
  const [activeReplyKeyboard, setActiveReplyKeyboard] = useState([]);
  const [typing, setTyping] = useState(false);
  const [activeTab, setActiveTab] = useState("design");
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  // Undo/Redo history (stores full state)
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, previewHistory]);

  // Initialize start message
  useEffect(() => {
    if (messages.length > 0 && !project.startMessageId) {
      const startMsg = messages.find(m => m.isStart) || messages[0];
      applyChange((state) => ({
        ...state,
        project: { 
          ...state.project, 
          startMessageId: startMsg.id,
          updatedAt: new Date().toISOString()
        }
      }));
      setSelectedId(startMsg.id);
    }
  }, [messages, project.startMessageId]);

  // Modal focus trap for accessibility
  useEffect(() => {
    if (exportModal.open && modalRef.current) {
      modalRef.current.focus();
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setExportModal(prev => ({ ...prev, open: false }));
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [exportModal.open]);

  function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  // Centralized mutator for state changes
  const applyChange = useCallback((updater) => {
    const currentState = {
        messages: structuredClone(messages),
        project: structuredClone(project),
        selectedId
    };
    
    setHistory(prev => [...prev, currentState].slice(-20));
    setRedoStack([]);

    const newState = updater(currentState);

    // Простое применение изменений
    setMessages(newState.messages);
    setProject(newState.project);
    if (newState.selectedId !== undefined) {
        setSelectedId(newState.selectedId);
    }
    }, [messages, project, selectedId]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    const currentState = {
      messages: structuredClone(messages),
      project: structuredClone(project),
      selectedId
    };
    setRedoStack(prev => [...prev, currentState]);
    setMessages(lastState.messages);
    setProject(lastState.project);
    setSelectedId(lastState.selectedId);
    setHistory(prev => prev.slice(0, -1));
  }, [history, messages, project, selectedId]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const currentState = {
      messages: structuredClone(messages),
      project: structuredClone(project),
      selectedId
    };
    setHistory(prev => [...prev, currentState]);
    setMessages(nextState.messages);
    setProject(nextState.project);
    setSelectedId(nextState.selectedId);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, messages, project, selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key === 'y') {
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
    conditions: [],
    timestamp: new Date().toISOString() // Добавляем timestamp
  };

  let newId = null;
  
  applyChange((state) => {
    let newMessages = [...state.messages];
    let insertionIndex = newMessages.length;
    
    if (afterId) {
      const idx = newMessages.findIndex(m => m.id === afterId);
      if (idx !== -1) insertionIndex = idx + 1;
    } else if (beforeId) {
      const idx = newMessages.findIndex(m => m.id === beforeId);
      if (idx !== -1) insertionIndex = idx;
    }
    
    newMessages.splice(insertionIndex, 0, newMsg);
    newId = newMsg.id;
    
    return { ...state, messages: newMessages };
  });

  return newId;
}, [applyChange]);

  const duplicateMessage = useCallback((messageId) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const duplicated = structuredClone(message);
    duplicated.id = generateId();
    duplicated.text = `${message.text} (копия)`;
    duplicated.buttons.forEach(btn => { btn.id = generateId(); });
    duplicated.replyKeyboard.forEach(btn => { btn.id = generateId(); });

    applyChange((state) => {
      const idx = state.messages.findIndex(m => m.id === messageId);
      const newMessages = [...state.messages];
      newMessages.splice(idx + 1, 0, duplicated);
      return { ...state, messages: newMessages };
    });
    
    return duplicated.id;
  }, [messages, applyChange]);

  const removeMessage = useCallback((id) => {
    if (messages.length <= 1) {
      alert("Нельзя удалить последнее сообщение");
      return;
    }

    applyChange((state) => {
      let newMessages = state.messages.filter(m => m.id !== id);
      
      newMessages = newMessages.map(msg => ({
        ...msg,
        buttons: msg.buttons.map(btn => btn.goto === id ? { ...btn, goto: null } : btn),
        replyKeyboard: msg.replyKeyboard.map(btn => btn.goto === id ? { ...btn, goto: null } : btn)
      }));

      let newSelectedId = state.selectedId;
      if (state.selectedId === id) {
        newSelectedId = newMessages[0]?.id || null;
      }

      let newProject = state.project;
      if (state.project.startMessageId === id) {
        const newStartMsg = newMessages.find(m => m.role === 'bot');
        newProject = { ...newProject, startMessageId: newStartMsg?.id || null };
      }

      return { ...state, messages: newMessages, project: newProject, selectedId: newSelectedId };
    });
  }, [messages, applyChange]);

  const setStartMessage = useCallback((messageId) => {
    applyChange((state) => ({
      ...state,
      project: { ...state.project, startMessageId: messageId },
      messages: state.messages.map(msg => ({
        ...msg,
        isStart: msg.id === messageId
      }))
    }));
  }, [applyChange]);

  const openEditor = useCallback((id) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    
    setSelectedId(id);
    setEditDraft(structuredClone(msg));
    setEditing(true);
    setActiveTab("properties");
  }, [messages]);

  const saveEdit = useCallback(() => {
    if (!editDraft) return;

    applyChange((state) => ({
      ...state,
      messages: state.messages.map(m => 
        m.id === selectedId ? { ...editDraft } : m
      )
    }));
    setEditing(false);
    setEditDraft(null);
  }, [editDraft, selectedId, applyChange]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditDraft(null);
    setActiveTab("design");
  }, []);

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

  const startPreview = useCallback(() => {
    const startMsg = messages.find(m => m.id === project.startMessageId) || messages.find(m => m.role === 'bot') || messages[0];
    setPreviewMode(true);
    setPreviewHistory(startMsg ? [structuredClone(startMsg)] : []);
    setCurrentPreviewMsgId(startMsg?.id || null);
    setActiveReplyKeyboard(startMsg?.replyKeyboard || []);
    setActiveTab("preview");
  }, [messages, project.startMessageId]);

  const handlePreviewInput = useCallback((e) => {
  e.preventDefault();
  const text = inputRef.current?.value.trim();
  if (!text || !currentPreviewMsgId) return;

  // Добавляем сообщение пользователя
  const userMessage = {
    id: generateId(),
    role: "user",
    text,
    timestamp: new Date().toISOString()
  };
  
  setPreviewHistory(prev => [...prev, userMessage]);
  setTyping(true);

  // Имитация задержки ответа бота
  setTimeout(() => {
    const currentMsg = messages.find(m => m.id === currentPreviewMsgId);
    let nextMsg = null;

    // Поиск по команде
    if (text.startsWith('/')) {
      nextMsg = messages.find(m => m.command === text && m.role === 'bot');
    }

    // Поиск по кнопкам
    if (!nextMsg && currentMsg) {
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

    // Поиск следующего сообщения бота по порядку
    if (!nextMsg) {
      const currentIndex = messages.findIndex(m => m.id === currentPreviewMsgId);
      nextMsg = messages.slice(currentIndex + 1).find(m => m.role === 'bot');
    }

    // Fallback - первое сообщение бота
    if (!nextMsg) {
      nextMsg = messages.find(m => m.role === 'bot');
    }

    if (nextMsg) {
      const botMessage = {
        ...structuredClone(nextMsg),
        timestamp: new Date().toISOString()
      };
      setPreviewHistory(prev => [...prev, botMessage]);
      setCurrentPreviewMsgId(nextMsg.id);
      setActiveReplyKeyboard(nextMsg.replyKeyboard || []);
    } else {
      // Сообщение об ошибке, если ответ не найден
      const errorMessage = {
        id: generateId(),
        role: "bot",
        text: "Извините, я не понимаю ваш запрос.",
        timestamp: new Date().toISOString()
      };
      setPreviewHistory(prev => [...prev, errorMessage]);
    }

    setTyping(false);
  }, TYPING_ANIMATION_DELAY);

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

  const validateProject = useCallback(() => {
  const issues = [];
  const reachable = new Set();
  const visited = new Set();

  // Начинаем со стартового сообщения
  if (project.startMessageId) {
    const stack = [project.startMessageId];
    
    while (stack.length > 0) {
      const currentId = stack.pop();
      
      if (visited.has(currentId)) {
        issues.push(`Обнаружен цикл в сообщении: ${currentId}`);
        continue;
      }
      
      visited.add(currentId);
      reachable.add(currentId);
      
      const currentMsg = messages.find(m => m.id === currentId);
      if (currentMsg) {
        // Добавляем все переходы из кнопок
        const allButtons = [...currentMsg.buttons, ...currentMsg.replyKeyboard];
        allButtons.forEach(btn => {
          if (btn.goto && !visited.has(btn.goto)) {
            stack.push(btn.goto);
          }
        });
      }
    }
  }

  // Проверяем недостижимые сообщения
  messages.forEach(msg => {
    if (msg.role === 'bot' && !reachable.has(msg.id) && msg.id !== project.startMessageId) {
      issues.push(`Недостижимое сообщение: "${msg.text.slice(0, 30)}..."`);
    }
  });

  // Проверяем битые ссылки в кнопках
  messages.forEach(msg => {
    const allButtons = [...msg.buttons, ...msg.replyKeyboard];
    allButtons.forEach(btn => {
      if (btn.goto && !messages.some(m => m.id === btn.goto)) {
        issues.push(`Битая ссылка в кнопке "${btn.text}": сообщение ${btn.goto} не найдено`);
      }
    });
  });

  // Проверяем пустые сообщения
  messages.forEach(msg => {
    if (!msg.text?.trim() && !msg.media) {
      issues.push(`Пустое сообщение: ${msg.id}`);
    }
  });

  return issues;
}, [messages, project.startMessageId]);

  const exportProject = useCallback((type) => {
    const issues = validateProject();
    if (issues.length > 0) {
      if (!confirm(`Project issues:\n${issues.join('\n')}\n\nExport anyway?`)) return;
    }

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
      let content = `# Telegram Bot generated from TgBotDesigner\n` +
                    `# Note: This is a basic template. Add FSM for state, error handling, and production features manually.\n` +
                    `import asyncio\n` +
                    `from aiogram import Bot, Dispatcher, types\n` +
                    `from aiogram.filters.command import Command\n` +
                    `from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton\n\n` +
                    `bot = Bot(token='YOUR_TOKEN_HERE')\n` +
                    `dp = Dispatcher()\n\n` +
                    `# Message handlers\n`;

      const startMsg = exportData.messages.find(m => m.id === exportData.startMessageId);
      if (startMsg) {
        let replyMarkup = '';
        if (startMsg.buttons.length > 0) {
          replyMarkup = `    inline_kb = InlineKeyboardMarkup(inline_keyboard=[\n` +
                        `${startMsg.buttons.map(btn => `        [InlineKeyboardButton(text="${btn.text.replace(/"/g, '\\"')}", callback_data="${btn.id}")]`).join(',\n')}\n` +
                        `    ])\n` +
                        `    await message.answer("${startMsg.text.replace(/"/g, '\\"')}", reply_markup=inline_kb)`;
        } else if (startMsg.replyKeyboard.length > 0) {
          replyMarkup = `    reply_kb = ReplyKeyboardMarkup(keyboard=[\n` +
                        `${startMsg.replyKeyboard.map(btn => `        [KeyboardButton(text="${btn.text.replace(/"/g, '\\"')}")]`).join(',\n')}\n` +
                        `    ], resize_keyboard=True)\n` +
                        `    await message.answer("${startMsg.text.replace(/"/g, '\\"')}", reply_markup=reply_kb)`;
        } else {
          replyMarkup = `    await message.answer("${startMsg.text.replace(/"/g, '\\"')}")`;
        }
        content += `@dp.message(Command("start"))\n` +
                   `async def start_handler(message: types.Message):\n` +
                   `${replyMarkup}\n\n`;
      }

      exportData.messages.forEach(msg => {
        if (msg.role === 'bot' && msg.command && msg.command !== '/start') {
          let replyMarkup = '';
          if (msg.buttons.length > 0) {
            replyMarkup = `, reply_markup=InlineKeyboardMarkup(inline_keyboard=[\n` +
                          `${msg.buttons.map(btn => `        [InlineKeyboardButton(text="${btn.text.replace(/"/g, '\\"')}", callback_data="${btn.id}")]`).join(',\n')}\n` +
                          `    ])`;
          } else if (msg.replyKeyboard.length > 0) {
            replyMarkup = `, reply_markup=ReplyKeyboardMarkup(keyboard=[\n` +
                          `${msg.replyKeyboard.map(btn => `        [KeyboardButton(text="${btn.text.replace(/"/g, '\\"')}")]`).join(',\n')}\n` +
                          `    ], resize_keyboard=True)`;
          }
          content += `@dp.message(Command("${msg.command.slice(1)}"))\n` +
                     `async def cmd_${msg.command.slice(1)}_handler(message: types.Message):\n` +
                     `    await message.answer("${msg.text.replace(/"/g, '\\"')}"${replyMarkup})\n\n`;
        }
      });

      if (exportData.messages.some(m => m.buttons.length > 0)) {
        content += `# Callback handlers for inline buttons\n` +
                   `@dp.callback_query()\n` +
                   `async def button_callback(callback: types.CallbackQuery):\n` +
                   `    callback_data = callback.data\n` +
                   `    messages = {\n` +
                   `${exportData.messages
                     .filter(m => m.buttons.some(b => b.goto))
                     .map(m => m.buttons
                       .filter(b => b.goto)
                       .map(b => {
                         const targetMsg = exportData.messages.find(msg => msg.id === b.goto);
                         return `        "${b.id}": "${targetMsg?.text.replace(/"/g, '\\"') || ''}"`;
                       })
                     ).flat().join(',\n')}\n` +
                   `    }\n` +
                   `    if callback_data in messages:\n` +
                   `        await callback.message.answer(messages[callback_data])\n` +
                   `    await callback.answer()\n\n`;
      }

      content += `async def main():\n` +
                 `    await dp.start_polling(bot)\n\n` +
                 `if __name__ == "__main__":\n` +
                 `    asyncio.run(main())\n`;

      setExportModal({ 
        open: true, 
        title: "Экспорт в Python (aiogram)", 
        content,
        type: "python" 
      });
    }
  }, [project, messages, validateProject]);

  const saveProject = useCallback(() => {
    const issues = validateProject();
    if (issues.length > 0) {
      if (!confirm(`Project issues:\n${issues.join('\n')}\n\nSave anyway?`)) return;
    }

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
  }, [project, messages, validateProject]);

  const loadProject = useCallback((event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Проверка размера файла (макс 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Файл слишком большой. Максимальный размер: 5MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Валидация структуры данных
      if (!data.messages || !Array.isArray(data.messages)) {
        throw new Error('Неверный формат файла: отсутствуют сообщения');
      }

      if (!data.project || typeof data.project !== 'object') {
        throw new Error('Неверный формат файла: отсутствует информация о проекте');
      }

      // Восстанавливаем timestamp для сообщений
      const restoredMessages = data.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString()
      }));

      applyChange(() => ({
        messages: restoredMessages,
        project: { 
          ...project, 
          ...data.project,
          updatedAt: new Date().toISOString()
        },
        selectedId: restoredMessages[0]?.id || null
      }));
      
      setHistory([]);
      setRedoStack([]);
      
    } catch (error) {
      console.error('Ошибка загрузки проекта:', error);
      alert(`Ошибка загрузки файла: ${error.message}`);
    }
  };

  reader.onerror = () => {
    alert('Ошибка чтения файла');
  };

  reader.readAsText(file);
  event.target.value = '';
}, [project, applyChange]);

  const filteredMessages = useMemo(() => 
    messages.filter(msg => 
      msg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.command?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.buttons.some(btn => btn.text.toLowerCase().includes(searchTerm.toLowerCase())) ||
      msg.replyKeyboard.some(btn => btn.text.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [messages, searchTerm]
  );

  const themeClasses = theme === "dark" 
    ? "bg-gray-900 text-gray-100" 
    : "bg-slate-50 text-gray-900";
    
  const sidebarBg = theme === "dark" 
    ? "bg-gray-800 border-gray-700" 
    : "bg-white border-slate-200";

  const chatBg = theme === "dark" 
    ? "bg-gradient-to-b from-gray-800 to-gray-900" 
    : "bg-gradient-to-b from-slate-50 to-slate-100";

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${themeClasses}`}>
      {!previewMode && (
        <div className={`w-80 flex flex-col border-r transition-colors duration-200 ${sidebarBg}`} style={{ height: '100vh' }}>
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

          <div className="flex-1 overflow-auto">
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

      <div className="flex-1 flex flex-col min-w-0">
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
                  {(previewMode ? previewHistory : messages).map((message, index, arr) => (
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
                            setPreviewHistory(prev => [...prev, structuredClone(targetMsg)]);
                            setCurrentPreviewMsgId(targetMsg.id);
                            setActiveReplyKeyboard(targetMsg.replyKeyboard || []);
                          }
                          setTyping(false);
                        }, 600);
                      } : undefined}
                      showAvatar={index === 0 || arr[index - 1].role !== message.role}
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
          modalRef={modalRef}
        />
      )}
    </div>
  );
}

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
  onButtonClick,
  showAvatar
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
    } message-actions`}>
      <ActionButton
        icon="↑"
        title="Добавить перед"
        onClick={() => onAddBefore(message.id)}
        color="green"
        ariaLabel="Добавить сообщение перед текущим"
      />
      <ActionButton
        icon="✎"
        title="Редактировать"
        onClick={() => onEdit(message.id)}
        color="blue"
        ariaLabel="Редактировать сообщение"
      />
      <ActionButton
        icon="⎘"
        title="Дублировать"
        onClick={() => onDuplicate(message.id)}
        color="orange"
        ariaLabel="Дублировать сообщение"
      />
      <ActionButton
        icon="↓"
        title="Добавить после"
        onClick={() => onAddAfter(message.id)}
        color="green"
        ariaLabel="Добавить сообщение после текущего"
      />
      <ActionButton
        icon="⭐"
        title="Сделать стартовым"
        onClick={() => onSetStart(message.id)}
        color="yellow"
        isActive={isStartMessage}
        ariaLabel="Установить как стартовое сообщение"
      />
      <ActionButton
        icon="×"
        title="Удалить"
        onClick={() => onDelete(message.id)}
        color="red"
        ariaLabel="Удалить сообщение"
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
        {isBot && showAvatar && <BotAvatar />}
        {!isBot && showAvatar && <UserAvatar />}
        {!showAvatar && <div className="w-8 h-8 flex-shrink-0" />}
        
        <div className={bubbleClasses}>
          <MessageContent
            message={message}
            isBot={isBot}
            isPreview={isPreview}
            theme={theme}
            onButtonClick={onButtonClick}
          />
        </div>
      </div>
      
      {actionButtons}
    </div>
  );
}

function ActionButton({ icon, title, onClick, color, isActive = false, ariaLabel }) {
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
      aria-label={ariaLabel}
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

function MessageContent({ message, isBot, isPreview, theme, onButtonClick }) {
  const bubbleBg = isBot 
    ? theme === "dark" ? "bg-tg-bot-bubble-dark" : "bg-tg-bot-bubble-light"
    : theme === "dark" ? "bg-tg-user-bubble-dark" : "bg-tg-user-bubble-light";
  
  const textColor = theme === "dark" 
    ? "text-tg-text-dark"
    : "text-tg-text-light";

  return (
    <div className={`px-4 py-3 rounded-2xl shadow-sm ${bubbleBg} ${textColor} ${
      isBot ? 'bot-bubble' : 'user-bubble'
    }`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.3' }}>
      {message.command && (
        <div className={`text-xs mb-2 ${
          theme === "dark" ? "text-blue-400" : "text-blue-600"
        }`}>
          Команда: {message.command}
        </div>
      )}

      {message.media && <MediaPreview media={message.media} theme={theme} />}

      <div className="whitespace-pre-wrap text-sm">
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

function MediaPreview({ media, theme }) {
  if (!media) return null;

  switch (media.type) {
    case 'image':
      return (
        <img 
          src={media.url}
          alt="Media content"
          className="w-full rounded-lg mb-3 max-h-64 object-cover border border-tg-border-light dark:border-tg-border-dark"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      );
    case 'document':
      return (
        <div className={`p-3 rounded-lg border mb-3 ${
          theme === "dark" ? "bg-gray-600 border-tg-border-dark" : "bg-slate-50 border-tg-border-light"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded flex items-center justify-center ${
              theme === "dark" ? "bg-gray-500" : "bg-blue-100"
            }`}>
              <span className={theme === "dark" ? "text-tg-text-dark" : "text-blue-600"}>📎</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${
                theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
                    ? "bg-tg-button-dark hover:bg-gray-500 border-tg-border-dark text-blue-400" 
                    : "bg-tg-button-light border-tg-border-light hover:bg-slate-50 text-blue-600"
                }`
              : `cursor-default ${
                  theme === "dark" 
                    ? "bg-tg-button-dark border-tg-border-dark text-blue-400" 
                    : "bg-tg-button-light border-tg-border-light text-blue-600"
                }`
          }`}
          aria-label={`Кнопка ${btn.text}`}
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

function ReplyKeyboard({ buttons, isPreview, theme, onButtonClick }) {
  return (
    <div className={`mt-3 p-3 rounded border ${
      theme === "dark" 
        ? "border-tg-border-dark bg-tg-button-dark/30" 
        : "border-tg-border-light bg-tg-button-light"
    } reply-keyboard-preview`}>
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
                      ? "bg-tg-button-dark hover:bg-gray-400 border-tg-border-dark"
                      : "bg-tg-button-light hover:bg-slate-300 border-tg-border-light"
                  }`
                : `cursor-default ${
                    theme === "dark"
                      ? "bg-tg-button-dark border-tg-border-dark"
                      : "bg-tg-button-light border-tg-border-light"
                  }`
            } ${theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"}`}
            aria-label={`Reply кнопка ${btn.text}`}
          >
            {btn.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageFooter({ message, theme, isBot }) {
  const time = new Date(message.timestamp || new Date()).toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`text-xs mt-2 flex items-center justify-end gap-2 ${
      theme === "dark" ? "text-gray-400" : "text-gray-500"
    }`}>
      <span>{time}</span>
      {message.delay > 0 && isBot && (
        <span className="opacity-70">⏱️ {message.delay}с</span>
      )}
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 shadow-sm flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">
      B
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex-shrink-0 shadow-sm flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">
      U
    </div>
  );
}

function SidebarHeader({ project, onProjectUpdate, theme }) {
  return (
    <div className={`p-4 border-b ${
      theme === "dark" ? "border-tg-border-dark" : "border-tg-border-light"
    }`} style={{ flexShrink: 0 }}>
      <input
        value={project.name}
        onChange={(e) => onProjectUpdate({ name: e.target.value })}
        className={`w-full text-lg font-bold bg-transparent border-none focus:outline-none ${
          theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
        }`}
        placeholder="Название бота"
        aria-label="Название проекта бота"
      />
      <textarea
        value={project.description}
        onChange={(e) => onProjectUpdate({ description: e.target.value })}
        className={`w-full mt-2 text-sm bg-transparent border-none focus:outline-none resize-none ${
          theme === "dark" ? "text-gray-400 placeholder-gray-500" : "text-gray-600 placeholder-gray-400"
        }`}
        placeholder="Описание бота..."
        rows={2}
        aria-label="Описание проекта бота"
      />
    </div>
  );
}

function NavigationTabs({ activeTab, onTabChange, theme }) {
  const tabs = [
    { id: "design", label: "Дизайн", icon: "💬" },
    { id: "properties", label: "Свойства", icon: "⚙️" },
    { id: "flow", label: "Поток", icon: "🔀" }
  ];

  return (
    <div className={`border-b ${
      theme === "dark" ? "border-tg-border-dark" : "border-tg-border-light"
    }`} style={{ flexShrink: 0 }}>
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
            aria-label={`Переключиться на вкладку ${tab.label}`}
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

function DesignTab({ messages, selectedId, onSelect, searchTerm, onSearchChange, theme }) {
  const Row = ({ index, style }) => {
    const msg = messages[index];
    return (
      <div style={style}>
        <MessageListItem
          message={msg}
          index={index}
          isSelected={selectedId === msg.id}
          onSelect={onSelect}
          theme={theme}
        />
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <div className={`flex-1 py-2 px-3 rounded text-sm text-center ${
          theme === "dark" ? "bg-tg-button-dark text-tg-text-dark" : "bg-tg-button-light text-tg-text-light"
        }`}>
          🤖 Bot Messages
        </div>
      </div>

      <div className="space-y-3">
        <div className={`text-sm font-medium ${
          theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
        }`}>
          Сообщения ({messages.length})
        </div>
        
        <input
          type="text"
          placeholder="Поиск сообщений..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full px-3 py-2 border rounded text-sm ${
            theme === "dark" 
              ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark placeholder-gray-400" 
              : "bg-tg-button-light border-tg-border-light text-tg-text-light placeholder-gray-500"
          }`}
          aria-label="Поиск сообщений"
        />

        <div className="max-h-96">
          <FixedSizeList
            height={300}
            itemCount={messages.length}
            itemSize={85}
            width="100%"
          >
            {Row}
          </FixedSizeList>
        </div>
      </div>
    </div>
  );
}

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
            ? "border-tg-border-dark hover:border-gray-500"
            : "border-tg-border-light hover:border-slate-400"
      }`}
      aria-label={`Выбрать сообщение ${message.text.slice(0, 20)}...`}
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
            theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
                      ? "bg-tg-button-dark text-tg-text-dark" 
                      : "bg-tg-button-light text-tg-text-light"
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
    <div className="p-4 space-y-6">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
        }`}>
          Текст сообщения
        </label>
        <textarea
          value={draft.text}
          onChange={(e) => onDraftChange({ ...draft, text: e.target.value })}
          className={`w-full h-32 border rounded-lg p-3 text-sm transition-colors ${
            theme === "dark" 
              ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark placeholder-gray-400" 
              : "bg-tg-button-light border-tg-border-light text-tg-text-light placeholder-gray-500"
          }`}
          placeholder="Введите текст сообщения..."
          aria-label="Текст сообщения"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
          }`}>
            Команда
          </label>
          <input
            value={draft.command || ""}
            onChange={(e) => onDraftChange({ ...draft, command: e.target.value })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark placeholder-gray-400" 
                : "bg-tg-button-light border-tg-border-light text-tg-text-light placeholder-gray-500"
            }`}
            placeholder="/start"
            aria-label="Команда бота"
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
                ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark" 
                : "bg-tg-button-light border-tg-border-light text-tg-text-light"
            }`}
            aria-label="Задержка отправки сообщения"
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

      <div className="flex gap-3 pt-4 border-t border-tg-border-light dark:border-tg-border-dark">
        <button 
          onClick={onSave}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          aria-label="Сохранить изменения"
        >
          Сохранить
        </button>
        <button 
          onClick={onCancel}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            theme === "dark"
              ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark"
              : "bg-tg-button-light hover:bg-gray-300 text-tg-text-light"
          }`}
          aria-label="Отменить изменения"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function MediaTypeSelector({ draft, onDraftChange, theme }) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${
        theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
            ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark" 
            : "bg-tg-button-light border-tg-border-light text-tg-text-light"
        }`}
        aria-label="Выбор типа сообщения"
      >
        <option value="text">📝 Текст</option>
        <option value="image">🖼️ Изображение</option>
        <option value="document">📎 Документ</option>
      </select>

      {(draft.media?.type === 'image' || draft.media?.type === 'document') && (
        <div className="mt-2">
          <label className={`block text-sm font-medium mb-2 ${
            theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
                ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark placeholder-gray-400" 
                : "bg-tg-button-light border-tg-border-light text-tg-text-light placeholder-gray-500"
            }`}
            placeholder="https://example.com/image.jpg"
            aria-label="URL медиа файла"
          />
        </div>
      )}
    </div>
  );
}

function ButtonSection({ type, title, buttons, messages, theme, onAddButton, onUpdateButton, onRemoveButton }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className={`text-sm font-medium ${
          theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
          aria-label={`Добавить ${type === "inline" ? "inline" : "reply"} кнопку`}
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
              ? "border-tg-border-dark text-gray-500" 
              : "border-tg-border-light text-gray-600"
          }`}>
            <div className="text-sm">Нет кнопок</div>
            <div className="text-xs mt-1">Нажмите "Добавить кнопку" чтобы создать</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ButtonEditor({ type, button, index, messages, theme, onUpdate, onRemove }) {
  return (
    <div className={`p-3 rounded-lg border ${
      theme === "dark" 
        ? "bg-tg-button-dark/50 border-tg-border-dark" 
        : "bg-tg-button-light border-tg-border-light"
    }`}>
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-2">
          <input
            value={button.text}
            onChange={(e) => onUpdate(type, index, { text: e.target.value })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark placeholder-gray-400" 
                : "bg-tg-button-light border-tg-border-light text-tg-text-light placeholder-gray-500"
            }`}
            placeholder="Текст кнопки"
            aria-label={`Текст кнопки ${index + 1}`}
          />
          
          <select
            value={button.goto || ""}
            onChange={(e) => onUpdate(type, index, { goto: e.target.value || null })}
            className={`w-full px-3 py-2 border rounded text-sm ${
              theme === "dark" 
                ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark" 
                : "bg-tg-button-light border-tg-border-light text-tg-text-light"
            }`}
            aria-label={`Выбор целевого сообщения для кнопки ${index + 1}`}
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
          aria-label={`Удалить кнопку ${index + 1}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function FlowTab({ messages, selectedId, startMessageId, onSelect, onSetStart, theme }) {
  const Row = ({ index, style }) => {
    const msg = messages[index];
    return (
      <div style={style}>
        <FlowMessageItem
          message={msg}
          index={index}
          isSelected={selectedId === msg.id}
          isStart={startMessageId === msg.id}
          onSelect={onSelect}
          onSetStart={onSetStart}
          theme={theme}
        />
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className={`text-sm font-medium mb-4 ${
        theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
      }`}>
        Визуализация потока диалога
      </div>
      
      <div className="space-y-3">
        <FixedSizeList
          height={300}
          itemCount={messages.length}
          itemSize={85}
          width="100%"
        >
          {Row}
        </FixedSizeList>
      </div>
    </div>
  );
}

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
            ? "border-tg-border-dark hover:border-gray-500"
            : "border-tg-border-light hover:border-slate-400"
      }`}
      aria-label={`Выбрать сообщение ${message.text.slice(0, 20)}... в потоке`}
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
              theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
                      ? "bg-tg-button-dark text-tg-text-dark" 
                      : "bg-tg-button-light text-tg-text-light"
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
                  ? "bg-tg-button-dark hover:bg-gray-500 text-tg-text-dark"
                  : "bg-tg-button-light hover:bg-slate-300 text-tg-text-light"
              }`}
              aria-label="Установить как стартовое сообщение"
            >
              Старт
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarFooter({ onSave, onLoad, onUndo, onRedo, canUndo, canRedo, theme }) {
  return (
    <div className={`p-4 border-t ${theme === "dark" ? "border-tg-border-dark" : "border-tg-border-light"}`} style={{ flexShrink: 0 }}>
      <div className="space-y-2">
        <button
          onClick={onSave}
          className={`w-full py-2 px-4 rounded text-sm transition-colors ${
            theme === "dark"
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          aria-label="Сохранить проект"
        >
          💾 Сохранить проект
        </button>
        <label className={`block w-full py-2 px-4 rounded text-sm text-center cursor-pointer transition-colors ${
          theme === "dark"
            ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark"
            : "bg-tg-button-light hover:bg-slate-300 text-tg-text-light"
        }`}>
          📂 Загрузить проект
          <input
            type="file"
            accept=".json"
            onChange={onLoad}
            className="hidden"
            aria-label="Загрузить файл проекта"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-1 py-2 rounded text-sm transition-colors ${
              canUndo
                ? theme === "dark" ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark" : "bg-tg-button-light hover:bg-slate-300 text-tg-text-light"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Отменить действие (Ctrl+Z)"
          >
            ↩️ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex-1 py-2 rounded text-sm transition-colors ${
              canRedo
                ? theme === "dark" ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark" : "bg-tg-button-light hover:bg-slate-300 text-tg-text-light"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Повторить действие (Ctrl+Y или Ctrl+Shift+Z)"
          >
            ↪️ Redo
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ previewMode, mode, theme, onThemeChange, onPreview, onExitPreview, onExport }) {
  return (
    <div className={`border-b px-6 py-4 flex items-center justify-between ${
      theme === "dark" ? "bg-gray-800 border-tg-border-dark" : "bg-white border-tg-border-light"
    }`} style={{ flexShrink: 0 }}>
      <div className="flex items-center gap-4">
        <h1 className={`text-xl font-semibold ${
          theme === "dark" ? "text-tg-text-dark" : "text-tg-text-light"
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
                  ? "hover:bg-gray-700 text-tg-text-dark" 
                  : "hover:bg-slate-200 text-gray-600"
              }`}
              aria-label={`Переключить на ${theme === "light" ? "темную" : "светлую"} тему`}
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
              aria-label="Запустить предпросмотр"
            >
              👁️ Предпросмотр
            </button>
            <button 
              onClick={() => onExport('json')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
              aria-label="Экспортировать в JSON"
            >
              📤 JSON
            </button>
            <button 
              onClick={() => onExport('python')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition-colors"
              aria-label="Экспортировать в Python (aiogram)"
            >
              🐍 Python
            </button>
          </>
        ) : (
          <button 
            onClick={onExitPreview}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
            aria-label="Выйти из предпросмотра"
          >
            ✕ Выйти
          </button>
        )}
      </div>
    </div>
  );
}

const InputArea = React.forwardRef(({ previewMode, mode, theme, activeReplyKeyboard, onReplyClick, onModeChange, onSubmit }, ref) => {
  return (
    <div className={`border-t px-6 py-4 ${theme === "dark" ? "bg-gray-800 border-tg-border-dark" : "bg-white border-tg-border-light"}`} style={{ flexShrink: 0 }}>
      {previewMode && activeReplyKeyboard.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 reply-keyboard-preview">
          {activeReplyKeyboard.map(btn => (
            <button
              key={btn.id}
              onClick={() => onReplyClick(btn)}
              className={`px-3 py-2 rounded text-sm border cursor-pointer ${
                theme === "dark"
                  ? "bg-tg-button-dark hover:bg-gray-400 border-tg-border-dark text-tg-text-dark"
                  : "bg-tg-button-light hover:bg-slate-300 border-tg-border-light text-tg-text-light"
              }`}
              aria-label={`Reply кнопка ${btn.text}`}
            >
              {btn.text}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <textarea
            ref={ref}
            placeholder={previewMode ? "Введите сообщение..." : "Введите сообщение бота или пользователя..."}
            className={`w-full px-4 py-3 border rounded-lg text-sm resize-none transition-colors ${
              theme === "dark"
                ? "bg-tg-button-dark border-tg-border-dark text-tg-text-dark placeholder-gray-400"
                : "bg-tg-button-light border-tg-border-light text-tg-text-light placeholder-gray-500"
            }`}
            rows={3}
            aria-label={previewMode ? "Ввод сообщения для предпросмотра" : "Ввод сообщения для дизайна"}
          />
        </div>
        {!previewMode && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onModeChange(mode === "bot" ? "user" : "bot")}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                theme === "dark"
                  ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark"
                  : "bg-tg-button-light hover:bg-slate-300 text-tg-text-light"
              }`}
              aria-label={`Переключить на режим ${mode === "bot" ? "пользователя" : "бота"}`}
            >
              {mode === "bot" ? "👤" : "🤖"}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
              aria-label="Отправить сообщение"
            >
              ➤
            </button>
          </div>
        )}
        {previewMode && (
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            aria-label="Отправить сообщение в предпросмотре"
          >
            ➤
          </button>
        )}
      </form>
    </div>
  );
});

function TypingIndicator({ theme }) {
  return (
    <div className={`flex items-center gap-2 p-3 max-w-sm rounded-2xl shadow-sm bot-bubble ${
      theme === "dark" ? "bg-tg-bot-bubble-dark text-gray-400" : "bg-tg-bot-bubble-light text-gray-600"
    }`}>
      <div className="flex gap-1">
        <span className="inline-block w-2 h-2 bg-current rounded-full animate-typing" style={{ animationDelay: '0s' }}></span>
        <span className="inline-block w-2 h-2 bg-current rounded-full animate-typing" style={{ animationDelay: '0.2s' }}></span>
        <span className="inline-block w-2 h-2 bg-current rounded-full animate-typing" style={{ animationDelay: '0.4s' }}></span>
      </div>
      <span className="text-sm">Печатает...</span>
    </div>
  );
}

function EmptyState({ theme }) {
  return (
    <div className={`text-center py-8 max-w-md mx-auto ${
      theme === "dark" ? "text-gray-400" : "text-gray-600"
    }`}>
      <div className="text-2xl mb-2">📭</div>
      <div className="text-sm font-medium">Диалог пуст</div>
      <div className="text-sm mt-1">
        Добавьте первое сообщение внизу, выбрав режим бота или пользователя
      </div>
    </div>
  );
}

// Хук для отслеживания изменений размера окна
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// Хук для дебаунса
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

function ExportModal({ modal, onClose, theme, modalRef }) {
  const download = () => {
    const blob = new Blob([modal.content], { type: modal.type === 'json' ? 'application/json' : 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modal.title.replace(/\s+/g, '_')}.${modal.type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(modal.content);
    alert('Скопировано в буфер обмена');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto ${
          theme === "dark" ? "bg-gray-800 text-tg-text-dark" : "bg-white text-tg-text-light"
        } modal-content`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{modal.title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Закрыть модальное окно"
          >
            ✕
          </button>
        </div>

        <pre className={`p-4 rounded-lg border text-sm overflow-auto ${
          theme === "dark" ? "bg-tg-button-dark border-tg-border-dark text-gray-300" : "bg-tg-button-light border-tg-border-light text-gray-700"
        }`} style={{ maxHeight: '50vh' }}>
          {modal.content}
        </pre>

        <div className="flex gap-3 mt-4">
          <button
            onClick={download}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
            aria-label="Скачать файл"
          >
            Скачать
          </button>
          <button
            onClick={copyToClipboard}
            className={`flex-1 py-2 rounded font-medium transition-colors ${
              theme === "dark"
                ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark"
                : "bg-tg-button-light hover:bg-gray-300 text-tg-text-light"
            }`}
            aria-label="Скопировать в буфер обмена"
          >
            Копировать
          </button>
          <button
            onClick={onClose}
            className={`flex-1 py-2 rounded font-medium transition-colors ${
              theme === "dark"
                ? "bg-tg-button-dark hover:bg-gray-600 text-tg-text-dark"
                : "bg-tg-button-light hover:bg-gray-300 text-tg-text-light"
            }`}
            aria-label="Закрыть"
          >
            Закрыть
          </button>
        </div>
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

@keyframes typing {
  0%, 100% { transform: translateY(0); opacity: 0.6; }
  50% { transform: translateY(-3px); opacity: 1; }
}

@keyframes messageAppear {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.telegram-message {
  animation: messageAppear 0.3s ease-out;
}

input:focus,
textarea:focus,
select:focus {
  box-shadow: 0 0 0 2px #3390ec;
  transition: box-shadow 0.2s;
}

.modal-content {
  outline: none;
}

.message-actions {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.reply-keyboard-preview {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
`;

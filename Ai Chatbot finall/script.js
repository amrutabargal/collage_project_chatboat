// ============================================
// JEENI AI - Premium Multimodal Assistant
// With Chat History & Sidebar Toggle
// ============================================

const chatsContainer = document.querySelector("#chats-container");
const promptForm = document.querySelector("#prompt-form");
const promptInput = document.querySelector("#prompt-input");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector("#file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");
const sidebar = document.querySelector("#sidebar");
const sidebarOverlay = document.querySelector("#sidebar-overlay");

const API_URL = '/api/chat';

let typingInterval, controller;
let currentChatId = null;
let allChats = {}; // Store all chat sessions
const chatHistory = [];
const userData = { message: "", file: {} };

// ============================================
// SIDEBAR TOGGLE
// ============================================

document.querySelector("#sidebar-open")?.addEventListener("click", () => {
  sidebar?.classList.add("open");
  sidebarOverlay?.classList.add("active");
});

document.querySelector("#sidebar-close")?.addEventListener("click", closeSidebar);
sidebarOverlay?.addEventListener("click", closeSidebar);

function closeSidebar() {
  sidebar?.classList.remove("open");
  sidebarOverlay?.classList.remove("active");
}

// ============================================
// CHAT HISTORY MANAGEMENT
// ============================================

function generateChatId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getChatTitle(messages) {
  if (messages.length === 0) return "New Chat";
  const firstMsg = messages[0]?.parts?.[0]?.text || "";
  return firstMsg.substring(0, 40) + (firstMsg.length > 40 ? "..." : "") || "New Chat";
}

function saveAllChats() {
  if (currentChatId && chatHistory.length > 0) {
    allChats[currentChatId] = {
      id: currentChatId,
      title: getChatTitle(chatHistory),
      messages: [...chatHistory],
      timestamp: Date.now()
    };
  }
  localStorage.setItem("allChats", JSON.stringify(allChats));
  localStorage.setItem("currentChatId", currentChatId || "");
  renderChatHistory();
}

function loadAllChats() {
  try {
    const saved = localStorage.getItem("allChats");
    if (saved) {
      allChats = JSON.parse(saved);
    }
    currentChatId = localStorage.getItem("currentChatId") || null;
    
    if (currentChatId && allChats[currentChatId]) {
      chatHistory.length = 0;
      chatHistory.push(...allChats[currentChatId].messages);
      renderMessages();
    }
    
    renderChatHistory();
  } catch (e) {
    console.error("Error loading chats:", e);
  }
}

function renderChatHistory() {
  const list = document.querySelector("#chat-history-list");
  if (!list) return;

  const sortedChats = Object.values(allChats)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (sortedChats.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <span class="material-symbols-rounded">chat_bubble</span>
        <p>No chat history yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = sortedChats.map(chat => `
    <button class="history-item ${chat.id === currentChatId ? 'active' : ''}" data-id="${chat.id}">
      <span class="material-symbols-rounded">chat</span>
      <span class="history-text">${chat.title}</span>
      <span class="material-symbols-rounded history-delete" data-delete="${chat.id}">delete</span>
    </button>
  `).join('');

  // Add click handlers
  list.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("history-delete")) {
        e.stopPropagation();
        deleteChat(e.target.dataset.delete);
      } else {
        loadChat(item.dataset.id);
      }
    });
  });
}

function loadChat(chatId) {
  if (!allChats[chatId]) return;
  
  // Save current chat first
  saveAllChats();
  
  currentChatId = chatId;
  chatHistory.length = 0;
  chatHistory.push(...allChats[chatId].messages);
  
  renderMessages();
  document.body.classList.add("chats-active");
  renderChatHistory();
  closeSidebar();
  
  localStorage.setItem("currentChatId", currentChatId);
}

function deleteChat(chatId) {
  if (!confirm("Delete this chat?")) return;
  
  delete allChats[chatId];
  
  if (chatId === currentChatId) {
    currentChatId = null;
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("chats-active");
  }
  
  saveAllChats();
}

function renderMessages() {
  if (!chatsContainer) return;
  chatsContainer.innerHTML = "";
  
  chatHistory.forEach(msg => {
    if (msg.role === "user") {
      const userText = msg.parts[0].text || "";
      const userMsgHTML = `
        <div class="user-content">
          <p class="message-text">${userText}</p>
          <div class="user-actions">
            <button class="msg-action-btn edit-btn" title="Edit">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="msg-action-btn copy-btn" title="Copy">
              <span class="material-symbols-rounded">content_copy</span>
            </button>
          </div>
        </div>`;
      const div = createMsgElement(userMsgHTML, "user-message");
      
      // Add edit functionality
      const editBtn = div.querySelector('.edit-btn');
      editBtn?.addEventListener('click', () => {
        if (promptInput) {
          promptInput.value = userText;
          promptInput.focus();
        }
      });
      
      // Add copy for user message
      const copyBtn = div.querySelector('.copy-btn');
      copyBtn?.addEventListener('click', () => {
        copyToClipboard(userText, copyBtn);
      });
      
      chatsContainer.appendChild(div);
    } else {
      const formattedText = formatResponse(msg.parts[0].text || "");
      const botMsgHTML = `
        <div class="message-text">
          <img src="logo.png" alt="JEENI" class="avatar" onerror="this.style.background='linear-gradient(135deg,#8b5cf6,#06b6d4)'">
          <div class="bot-content">
            <p class="bot-text">${formattedText}</p>
            <div class="message-actions">
              <button class="copy-btn" title="Copy response">
                <span class="material-symbols-rounded">content_copy</span>
              </button>
            </div>
          </div>
        </div>`;
      const div = createMsgElement(botMsgHTML, "bot-message");
      
      // Add copy functionality
      const copyBtn = div.querySelector('.copy-btn');
      copyBtn?.addEventListener('click', () => {
        const textEl = div.querySelector('.bot-text');
        copyToClipboard(textEl.innerText, copyBtn);
      });
      
      chatsContainer.appendChild(div);
    }
  });
  
  scrollToBottom();
}

// New Chat
document.querySelector("#new-chat-btn")?.addEventListener("click", () => {
  // Save current chat
  saveAllChats();
  
  // Start new chat
  currentChatId = generateChatId();
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("chats-active");
  
  renderChatHistory();
  closeSidebar();
});

// ============================================
// CORE CHAT FUNCTIONS
// ============================================

const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const scrollToBottom = () => {
  chatsContainer?.scrollTo({ top: chatsContainer.scrollHeight, behavior: "smooth" });
};

// Format AI response with proper styling and sections
const formatResponse = (text) => {
  let formatted = text
    // Section Headers with emojis
    .replace(/📌\s*(.+)/g, '<div class="response-section"><h4 class="response-heading"><span class="heading-icon">📌</span> $1</h4></div>')
    .replace(/🔍\s*(.+)/g, '<div class="response-section source-section"><p class="response-source"><span class="heading-icon">🔍</span> $1</p></div>')
    // Highlight points in boxes
    .replace(/✅\s*(.+)/g, '<div class="response-card success"><span class="card-icon">✅</span><span class="card-text">$1</span></div>')
    .replace(/💡\s*(.+)/g, '<div class="response-card tip"><span class="card-icon">💡</span><span class="card-text">$1</span></div>')
    .replace(/📊\s*(.+)/g, '<div class="response-card stat"><span class="card-icon">📊</span><span class="card-text">$1</span></div>')
    .replace(/⚠️\s*(.+)/g, '<div class="response-card warning"><span class="card-icon">⚠️</span><span class="card-text">$1</span></div>')
    .replace(/🎯\s*(.+)/g, '<div class="response-card target"><span class="card-icon">🎯</span><span class="card-text">$1</span></div>')
    .replace(/📝\s*(.+)/g, '<div class="response-card note"><span class="card-icon">📝</span><span class="card-text">$1</span></div>')
    // Numbered lists
    .replace(/^(\d+)\.\s+(.+)$/gm, '<div class="response-list-item"><span class="list-number">$1</span><span class="list-text">$2</span></div>')
    // Bullet points
    .replace(/^[-•]\s+(.+)$/gm, '<div class="response-bullet"><span class="bullet">•</span><span>$1</span></div>')
    // Bold text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Line breaks to paragraphs
    .replace(/\n\n+/g, '</p><p class="response-para">')
    .replace(/\n/g, '<br>');
  
  // Wrap in paragraph if not already
  if (!formatted.startsWith('<')) {
    formatted = '<p class="response-para">' + formatted + '</p>';
  }
  
  return formatted;
};

// Copy text to clipboard
const copyToClipboard = async (text, button) => {
  try {
    await navigator.clipboard.writeText(text);
    const icon = button.querySelector('span');
    const originalIcon = icon.textContent;
    icon.textContent = 'check';
    button.classList.add('copied');
    setTimeout(() => {
      icon.textContent = originalIcon;
      button.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.innerHTML = "";
  const words = text.split(" ");
  let wordIndex = 0;
  let currentText = "";
  
  // Faster typing - 3 words at a time for real-time feel
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      // Add 3 words at a time for faster display
      for (let i = 0; i < 3 && wordIndex < words.length; i++) {
        currentText += (wordIndex === 0 && i === 0 ? "" : " ") + words[wordIndex++];
      }
      textElement.innerHTML = formatResponse(currentText);
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      // Final formatting
      textElement.innerHTML = formatResponse(text);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
      saveAllChats();
    }
  }, 15); // Faster interval
};

const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".bot-text");
  controller = new AbortController();

  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])
    ]
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    const responseText = data.candidates[0].content.parts[0].text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim();
    typingEffect(responseText, textElement, botMsgDiv);
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  } catch (error) {
    textElement.style.color = "#f43f5e";
    textElement.textContent = error.name === "AbortError" 
      ? "Response stopped." 
      : error.message;
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
  } finally {
    userData.file = {};
  }
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput?.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  // Create new chat if none exists
  if (!currentChatId) {
    currentChatId = generateChatId();
  }

  promptInput.value = "";
  userData.message = userMessage;
  document.body.classList.add("bot-responding", "chats-active");
  fileUploadWrapper?.classList.remove("active", "img-attached", "file-attached");

  const userMsgHTML = `
    ${userData.file.data ? (userData.file.isImage
      ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
      : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
    <div class="user-content">
      <p class="message-text"></p>
      <div class="user-actions">
        <button class="msg-action-btn edit-btn" title="Edit">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="msg-action-btn copy-btn" title="Copy">
          <span class="material-symbols-rounded">content_copy</span>
        </button>
      </div>
    </div>
  `;

  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  
  // Add edit functionality
  const editBtn = userMsgDiv.querySelector('.edit-btn');
  editBtn?.addEventListener('click', () => {
    if (promptInput) {
      promptInput.value = userMessage;
      promptInput.focus();
    }
  });
  
  // Add copy functionality
  const copyBtn = userMsgDiv.querySelector('.copy-btn');
  copyBtn?.addEventListener('click', () => {
    copyToClipboard(userMessage, copyBtn);
  });
  
  chatsContainer?.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `
      <div class="message-text">
        <img src="logo.png" alt="JEENI" class="avatar" onerror="this.style.background='linear-gradient(135deg,#8b5cf6,#06b6d4)'">
        <div class="bot-content">
          <p class="bot-text">Thinking...</p>
          <div class="message-actions">
            <button class="copy-btn" title="Copy response">
              <span class="material-symbols-rounded">content_copy</span>
            </button>
          </div>
        </div>
      </div>`;

    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    
    // Add copy functionality
    const copyBtn = botMsgDiv.querySelector('.copy-btn');
    copyBtn?.addEventListener('click', () => {
      const textEl = botMsgDiv.querySelector('.bot-text');
      copyToClipboard(textEl.innerText, copyBtn);
    });
    
    chatsContainer?.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 500);
};

// ============================================
// FILE HANDLING
// ============================================

fileInput?.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    const preview = fileUploadWrapper?.querySelector(".file-preview");
    if (preview) preview.src = e.target.result;
    fileUploadWrapper?.classList.add("active", isImage ? "img-attached" : "file-attached");
    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
  };
});

document.querySelector("#cancel-file-btn")?.addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper?.classList.remove("active", "img-attached", "file-attached");
});

document.querySelector("#stop-response-btn")?.addEventListener("click", () => {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  chatsContainer?.querySelector(".bot-message.loading")?.classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

document.querySelector("#delete-chats-btn")?.addEventListener("click", () => {
  if (Object.keys(allChats).length === 0 && chatHistory.length === 0) return;
  if (confirm("Delete ALL chat history?")) {
    allChats = {};
    currentChatId = null;
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
    localStorage.removeItem("allChats");
    localStorage.removeItem("currentChatId");
    renderChatHistory();
  }
});

// ============================================
// VOICE RECOGNITION
// ============================================

const voiceBtn = document.querySelector("#voice-input-btn");
const voiceIndicator = document.querySelector("#voice-indicator");
let recognition;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    voiceIndicator?.classList.add("active");
    voiceBtn?.classList.add("recording");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (promptInput) promptInput.value = transcript;
  };

  recognition.onend = () => {
    voiceIndicator?.classList.remove("active");
    voiceBtn?.classList.remove("recording");
  };

  recognition.onerror = () => {
    voiceIndicator?.classList.remove("active");
    voiceBtn?.classList.remove("recording");
  };

  voiceBtn?.addEventListener("click", () => {
    voiceBtn.classList.contains("recording") ? recognition.stop() : recognition.start();
  });
}

// ============================================
// CHAT SEARCH
// ============================================

const searchChatBtn = document.querySelector("#search-chat-btn");
const chatSearchContainer = document.querySelector("#chat-search-container");
const chatSearchInput = document.querySelector("#chat-search-input");
const chatSearchClose = document.querySelector("#chat-search-close");
const searchResultsCount = document.querySelector("#search-results-count");

searchChatBtn?.addEventListener("click", () => {
  chatSearchContainer?.classList.toggle("active");
  if (chatSearchContainer?.classList.contains("active")) {
    chatSearchInput?.focus();
  }
});

chatSearchClose?.addEventListener("click", () => {
  chatSearchContainer?.classList.remove("active");
  clearSearchHighlights();
  if (chatSearchInput) chatSearchInput.value = "";
  if (searchResultsCount) searchResultsCount.textContent = "";
});

chatSearchInput?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  clearSearchHighlights();
  
  if (query.length < 2) {
    if (searchResultsCount) searchResultsCount.textContent = "";
    return;
  }

  let count = 0;
  document.querySelectorAll(".chats-container .message-text, .chats-container .bot-text").forEach(el => {
    const text = el.textContent.toLowerCase();
    if (text.includes(query)) {
      const regex = new RegExp(`(${query})`, "gi");
      el.innerHTML = el.textContent.replace(regex, '<mark class="search-highlight">$1</mark>');
      count++;
    }
  });

  if (searchResultsCount) searchResultsCount.textContent = count > 0 ? `${count} found` : "No results";
});

function clearSearchHighlights() {
  document.querySelectorAll(".search-highlight").forEach(el => {
    el.outerHTML = el.textContent;
  });
}

// ============================================
// CHAT EXPORT
// ============================================

const exportChatBtn = document.querySelector("#export-chat-btn");
const exportModal = document.querySelector("#export-modal");

exportChatBtn?.addEventListener("click", () => {
  exportModal?.classList.add("active");
  closeSidebar();
});

exportModal?.querySelector(".close-btn")?.addEventListener("click", () => {
  exportModal?.classList.remove("active");
});

document.querySelector("#export-txt-btn")?.addEventListener("click", () => {
  let text = "JEENI AI - Conversation Export\n";
  text += "=".repeat(50) + "\n\n";
  
  chatHistory.forEach(msg => {
    const role = msg.role === "user" ? "You" : "JEENI";
    const content = msg.parts[0].text || "[File]";
    text += `${role}:\n${content}\n\n`;
  });

  downloadFile(text, "jeeni-chat.txt", "text/plain");
  exportModal?.classList.remove("active");
});

document.querySelector("#export-json-btn")?.addEventListener("click", () => {
  const data = {
    app: "JEENI AI",
    exportDate: new Date().toISOString(),
    messages: chatHistory
  };
  downloadFile(JSON.stringify(data, null, 2), "jeeni-chat.json", "application/json");
  exportModal?.classList.remove("active");
});

document.querySelector("#export-pdf-btn")?.addEventListener("click", () => {
  const element = document.createElement("div");
  element.style.fontFamily = "Arial, sans-serif";
  element.style.padding = "40px";
  element.innerHTML = `
    <h1 style="color:#8b5cf6;margin-bottom:8px;">JEENI AI</h1>
    <p style="color:#666;margin-bottom:24px;">Exported: ${new Date().toLocaleString()}</p>
    <hr style="border:none;border-top:2px solid #eee;margin-bottom:24px;">
  `;
  
  chatHistory.forEach(msg => {
    const role = msg.role === "user" ? "You" : "JEENI";
    const content = msg.parts[0].text || "[File]";
    element.innerHTML += `
      <div style="margin-bottom:20px;">
        <strong style="color:${role === 'You' ? '#8b5cf6' : '#06b6d4'};">${role}</strong>
        <p style="margin-top:8px;line-height:1.6;">${content}</p>
      </div>
    `;
  });

  html2pdf().set({
    margin: 15,
    filename: 'jeeni-chat.pdf',
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4' }
  }).from(element).save();
  
  exportModal?.classList.remove("active");
});

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// SUMMARIZE
// ============================================

document.querySelector("#summarize-btn")?.addEventListener("click", () => {
  if (chatHistory.length < 2) {
    alert("Need more conversation to summarize!");
    return;
  }
  if (promptInput) promptInput.value = "Please summarize our conversation in bullet points.";
  promptForm?.dispatchEvent(new Event("submit"));
});

// ============================================
// THEME
// ============================================

themeToggle?.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-theme");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  
  const icon = themeToggle.querySelector("span:first-child");
  const text = themeToggle.querySelector("span:last-child");
  if (icon) icon.textContent = isLight ? "light_mode" : "dark_mode";
  if (text) text.textContent = isLight ? "Light Mode" : "Dark Mode";
});

// Load theme
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-theme");
  const icon = themeToggle?.querySelector("span:first-child");
  const text = themeToggle?.querySelector("span:last-child");
  if (icon) icon.textContent = "light_mode";
  if (text) text.textContent = "Light Mode";
}

// ============================================
// SUGGESTIONS
// ============================================

document.querySelectorAll(".suggestion-card").forEach(card => {
  card.addEventListener("click", () => {
    if (promptInput) promptInput.value = card.querySelector("p")?.textContent || "";
    promptForm?.dispatchEvent(new Event("submit"));
  });
});

// ============================================
// PASTE IMAGE
// ============================================

promptInput?.addEventListener("paste", (event) => {
  const items = event.clipboardData?.items || [];
  for (let item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const base64String = e.target.result.split(",")[1];
        const preview = fileUploadWrapper?.querySelector(".file-preview");
        if (preview) preview.src = e.target.result;
        fileUploadWrapper?.classList.add("active", "img-attached");
        userData.file = {
          fileName: "pasted-image.png",
          data: base64String,
          mime_type: file.type,
          isImage: true
        };
      };
    }
  }
});

// ============================================
// FORM & FILE BUTTONS
// ============================================

promptForm?.addEventListener("submit", handleFormSubmit);
document.querySelector("#add-file-btn")?.addEventListener("click", () => fileInput?.click());

// ============================================
// RESUME BUILDER
// ============================================

const resumeModal = document.querySelector("#resume-builder-modal");

document.querySelector("#resume-builder-btn")?.addEventListener("click", () => {
  resumeModal?.classList.add("active");
  closeSidebar();
});

resumeModal?.querySelector(".close-btn")?.addEventListener("click", () => {
  resumeModal?.classList.remove("active");
});

document.querySelector("#template-tab-btn")?.addEventListener("click", () => {
  document.querySelector("#template-tab")?.classList.toggle("active");
});

function syncTemplate(value) {
  const selector = document.getElementById("template-selector");
  if (selector) selector.value = value;
  
  document.querySelectorAll(".template-option").forEach(opt => {
    opt.classList.toggle("selected", opt.querySelector("input")?.value === value);
  });
}

document.querySelectorAll(".template-option input").forEach(radio => {
  radio.addEventListener("change", () => syncTemplate(radio.value));
});

function generateResume() {
  const name = document.getElementById("name")?.value || "";
  const email = document.getElementById("email")?.value || "";
  const phone = document.getElementById("phone")?.value || "";
  const linkedin = document.getElementById("linkedin")?.value || "";
  const summary = document.getElementById("summary")?.value || "";
  const education = document.getElementById("education")?.value || "";
  const experience = document.getElementById("experience")?.value || "";
  const skills = document.getElementById("skills")?.value || "";
  const template = document.getElementById("template-selector")?.value || "template1";

  const br = txt => txt.replace(/\n/g, "<br>");
  const contact = `${email}${phone ? ` • ${phone}` : ""}${linkedin ? ` • <a href="${linkedin}" style="color:inherit;">${linkedin}</a>` : ""}`;

  let html = "";

  switch (template) {
    // Template 2: Bold Dark
    case "template2":
      html = `
        <div style="font-family:Arial,sans-serif;">
          <header style="background:#1a1a1a;color:#fff;padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:2rem;">${name}</h1>
            <p style="margin:8px 0 0;opacity:0.8;font-size:0.9rem;">${contact}</p>
          </header>
          <div style="padding:32px;">
            <section style="margin-bottom:24px;"><h2 style="color:#1a1a1a;border-bottom:2px solid #1a1a1a;padding-bottom:8px;">Summary</h2><p>${br(summary)}</p></section>
            <section style="margin-bottom:24px;"><h2 style="color:#1a1a1a;border-bottom:2px solid #1a1a1a;padding-bottom:8px;">Experience</h2><p>${br(experience)}</p></section>
            <section style="margin-bottom:24px;"><h2 style="color:#1a1a1a;border-bottom:2px solid #1a1a1a;padding-bottom:8px;">Education</h2><p>${br(education)}</p></section>
            <section><h2 style="color:#1a1a1a;border-bottom:2px solid #1a1a1a;padding-bottom:8px;">Skills</h2><p>${br(skills)}</p></section>
          </div>
        </div>`;
      break;

    // Template 3: Minimalist
    case "template3":
      html = `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto;">
          <header style="margin-bottom:40px;">
            <h1 style="margin:0;font-size:2.5rem;font-weight:300;color:#333;letter-spacing:-1px;">${name}</h1>
            <p style="margin:8px 0 0;color:#888;font-size:0.85rem;letter-spacing:1px;">${contact}</p>
          </header>
          <section style="margin-bottom:32px;">
            <p style="font-size:1.05rem;line-height:1.8;color:#555;">${br(summary)}</p>
          </section>
          <section style="margin-bottom:32px;">
            <h2 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:3px;color:#999;margin-bottom:16px;font-weight:400;">Experience</h2>
            <p style="line-height:1.8;color:#444;">${br(experience)}</p>
          </section>
          <section style="margin-bottom:32px;">
            <h2 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:3px;color:#999;margin-bottom:16px;font-weight:400;">Education</h2>
            <p style="line-height:1.8;color:#444;">${br(education)}</p>
          </section>
          <section>
            <h2 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:3px;color:#999;margin-bottom:16px;font-weight:400;">Skills</h2>
            <p style="line-height:1.8;color:#444;">${br(skills)}</p>
          </section>
        </div>`;
      break;

    // Template 4: Modern Blue
    case "template4":
      html = `
        <div style="font-family:Arial,sans-serif;">
          <header style="background:linear-gradient(135deg,#3498db,#2980b9);color:#fff;padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:2rem;">${name}</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:0.9rem;">${contact}</p>
          </header>
          <div style="padding:32px;">
            <section style="margin-bottom:24px;"><h2 style="color:#3498db;font-size:1.2rem;">PROFESSIONAL SUMMARY</h2><p style="margin-top:8px;">${br(summary)}</p></section>
            <section style="margin-bottom:24px;"><h2 style="color:#3498db;font-size:1.2rem;">EXPERIENCE</h2><p style="margin-top:8px;">${br(experience)}</p></section>
            <section style="margin-bottom:24px;"><h2 style="color:#3498db;font-size:1.2rem;">EDUCATION</h2><p style="margin-top:8px;">${br(education)}</p></section>
            <section><h2 style="color:#3498db;font-size:1.2rem;">SKILLS</h2><p style="margin-top:8px;">${br(skills)}</p></section>
          </div>
        </div>`;
      break;

    // Template 5: Executive
    case "template5":
      html = `
        <div style="font-family:Georgia,serif;">
          <header style="background:#2c3e50;color:#fff;padding:40px;">
            <h1 style="margin:0;font-size:2.2rem;font-weight:normal;">${name}</h1>
            <p style="margin:12px 0 0;color:#bdc3c7;font-size:0.9rem;">${contact}</p>
          </header>
          <div style="padding:40px;background:#ecf0f1;">
            <section style="margin-bottom:32px;background:#fff;padding:24px;border-left:4px solid #2c3e50;">
              <h2 style="margin:0 0 12px;color:#2c3e50;font-size:1.1rem;text-transform:uppercase;">Executive Summary</h2>
              <p style="margin:0;line-height:1.7;color:#555;">${br(summary)}</p>
            </section>
            <section style="margin-bottom:32px;background:#fff;padding:24px;border-left:4px solid #2c3e50;">
              <h2 style="margin:0 0 12px;color:#2c3e50;font-size:1.1rem;text-transform:uppercase;">Professional Experience</h2>
              <p style="margin:0;line-height:1.7;color:#555;">${br(experience)}</p>
            </section>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
              <section style="background:#fff;padding:24px;border-left:4px solid #2c3e50;">
                <h2 style="margin:0 0 12px;color:#2c3e50;font-size:1.1rem;text-transform:uppercase;">Education</h2>
                <p style="margin:0;line-height:1.7;color:#555;">${br(education)}</p>
              </section>
              <section style="background:#fff;padding:24px;border-left:4px solid #2c3e50;">
                <h2 style="margin:0 0 12px;color:#2c3e50;font-size:1.1rem;text-transform:uppercase;">Core Competencies</h2>
                <p style="margin:0;line-height:1.7;color:#555;">${br(skills)}</p>
              </section>
            </div>
          </div>
        </div>`;
      break;

    // Template 6: Creative
    case "template6":
      html = `
        <div style="font-family:'Segoe UI',sans-serif;">
          <header style="background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;padding:40px;text-align:center;">
            <h1 style="margin:0;font-size:2.5rem;font-weight:300;">${name}</h1>
            <p style="margin:12px 0 0;font-size:0.95rem;opacity:0.9;">${contact}</p>
          </header>
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:32px;padding:32px;">
            <aside>
              <section style="margin-bottom:24px;"><h3 style="color:#8b5cf6;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">Skills</h3><p style="margin-top:8px;font-size:0.9rem;">${br(skills)}</p></section>
              <section><h3 style="color:#8b5cf6;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">Education</h3><p style="margin-top:8px;font-size:0.9rem;">${br(education)}</p></section>
            </aside>
            <main>
              <section style="margin-bottom:24px;"><h3 style="color:#8b5cf6;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">About</h3><p style="margin-top:8px;">${br(summary)}</p></section>
              <section><h3 style="color:#8b5cf6;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">Experience</h3><p style="margin-top:8px;">${br(experience)}</p></section>
            </main>
          </div>
        </div>`;
      break;

    // Template 7: Tech Pro
    case "template7":
      html = `
        <div style="font-family:'Consolas','Monaco',monospace;display:grid;grid-template-columns:280px 1fr;">
          <aside style="background:#0f172a;color:#e2e8f0;padding:32px;">
            <h1 style="margin:0 0 8px;font-size:1.5rem;color:#38bdf8;">${name}</h1>
            <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:32px;">${contact}</p>
            <section style="margin-bottom:28px;">
              <h3 style="color:#38bdf8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">// Skills</h3>
              <p style="font-size:0.85rem;line-height:1.8;color:#cbd5e1;">${br(skills)}</p>
            </section>
            <section>
              <h3 style="color:#38bdf8;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">// Education</h3>
              <p style="font-size:0.85rem;line-height:1.8;color:#cbd5e1;">${br(education)}</p>
            </section>
          </aside>
          <main style="padding:32px;">
            <section style="margin-bottom:28px;">
              <h2 style="color:#0f172a;font-size:0.85rem;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #38bdf8;padding-bottom:8px;margin-bottom:16px;">About Me</h2>
              <p style="line-height:1.8;color:#334155;">${br(summary)}</p>
            </section>
            <section>
              <h2 style="color:#0f172a;font-size:0.85rem;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #38bdf8;padding-bottom:8px;margin-bottom:16px;">Experience</h2>
              <p style="line-height:1.8;color:#334155;">${br(experience)}</p>
            </section>
          </main>
        </div>`;
      break;

    // Template 8: Elegant
    case "template8":
      html = `
        <div style="font-family:'Palatino Linotype','Book Antiqua',Palatino,serif;background:#f8f4f0;padding:48px;">
          <header style="text-align:center;border-bottom:1px solid #c9a959;padding-bottom:32px;margin-bottom:32px;">
            <h1 style="margin:0;font-size:2.2rem;color:#2d2d2d;font-weight:normal;letter-spacing:4px;">${name.toUpperCase()}</h1>
            <p style="margin:16px 0 0;color:#666;font-size:0.9rem;letter-spacing:1px;">${contact}</p>
          </header>
          <section style="margin-bottom:28px;">
            <h2 style="color:#c9a959;font-size:0.85rem;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">Profile</h2>
            <p style="line-height:1.9;color:#444;font-style:italic;">${br(summary)}</p>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="color:#c9a959;font-size:0.85rem;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">Professional Experience</h2>
            <p style="line-height:1.9;color:#444;">${br(experience)}</p>
          </section>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">
            <section>
              <h2 style="color:#c9a959;font-size:0.85rem;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">Education</h2>
              <p style="line-height:1.9;color:#444;">${br(education)}</p>
            </section>
            <section>
              <h2 style="color:#c9a959;font-size:0.85rem;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">Expertise</h2>
              <p style="line-height:1.9;color:#444;">${br(skills)}</p>
            </section>
          </div>
        </div>`;
      break;

    // Template 9: Corporate
    case "template9":
      html = `
        <div style="font-family:'Trebuchet MS',Arial,sans-serif;">
          <header style="background:#1e3a5f;color:#fff;padding:36px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h1 style="margin:0;font-size:1.8rem;">${name}</h1>
              <p style="margin:8px 0 0;opacity:0.85;font-size:0.85rem;">${document.getElementById("jobTitle")?.value || "Professional"}</p>
            </div>
            <div style="text-align:right;font-size:0.85rem;opacity:0.9;">
              <p style="margin:0;">${email}</p>
              <p style="margin:4px 0 0;">${phone}</p>
            </div>
          </header>
          <div style="padding:32px;">
            <section style="margin-bottom:28px;padding:20px;background:#f0f4f8;border-radius:8px;">
              <h2 style="color:#1e3a5f;font-size:1rem;margin:0 0 12px;">PROFESSIONAL SUMMARY</h2>
              <p style="margin:0;line-height:1.7;color:#444;">${br(summary)}</p>
            </section>
            <section style="margin-bottom:28px;">
              <h2 style="color:#1e3a5f;font-size:1rem;border-left:4px solid #1e3a5f;padding-left:12px;margin-bottom:16px;">WORK EXPERIENCE</h2>
              <p style="line-height:1.7;color:#444;">${br(experience)}</p>
            </section>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;">
              <section>
                <h2 style="color:#1e3a5f;font-size:1rem;border-left:4px solid #1e3a5f;padding-left:12px;margin-bottom:16px;">EDUCATION</h2>
                <p style="line-height:1.7;color:#444;">${br(education)}</p>
              </section>
              <section>
                <h2 style="color:#1e3a5f;font-size:1rem;border-left:4px solid #1e3a5f;padding-left:12px;margin-bottom:16px;">KEY SKILLS</h2>
                <p style="line-height:1.7;color:#444;">${br(skills)}</p>
              </section>
            </div>
          </div>
        </div>`;
      break;

    // Template 10: Startup / Modern
    case "template10":
      html = `
        <div style="font-family:'Poppins',sans-serif;">
          <header style="background:linear-gradient(135deg,#ff6b6b 0%,#feca57 50%,#48dbfb 100%);color:#fff;padding:48px;text-align:center;">
            <h1 style="margin:0;font-size:2.5rem;font-weight:700;text-shadow:2px 2px 4px rgba(0,0,0,0.2);">${name}</h1>
            <p style="margin:12px 0 0;font-size:0.95rem;opacity:0.95;">${contact}</p>
          </header>
          <div style="padding:40px;">
            <section style="margin-bottom:32px;text-align:center;">
              <p style="font-size:1.1rem;line-height:1.8;color:#555;max-width:600px;margin:0 auto;">${br(summary)}</p>
            </section>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:24px;">
              <section style="background:#fff5f5;padding:24px;border-radius:16px;">
                <h2 style="color:#ff6b6b;font-size:0.9rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">💼 Experience</h2>
                <p style="line-height:1.8;color:#444;">${br(experience)}</p>
              </section>
              <section style="background:#fff9e6;padding:24px;border-radius:16px;">
                <h2 style="color:#f39c12;font-size:0.9rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">🎓 Education</h2>
                <p style="line-height:1.8;color:#444;">${br(education)}</p>
              </section>
            </div>
            <section style="margin-top:24px;background:#e8f8ff;padding:24px;border-radius:16px;text-align:center;">
              <h2 style="color:#48dbfb;font-size:0.9rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">⚡ Skills & Tools</h2>
              <p style="line-height:1.8;color:#444;">${br(skills)}</p>
            </section>
          </div>
        </div>`;
      break;

    // Template 1: Clean ATS (Default)
    default:
      html = `
        <div style="font-family:Arial,sans-serif;padding:8px;">
          <header style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px;">
            <h1 style="margin:0;font-size:1.8rem;color:#333;">${name}</h1>
            <p style="margin:8px 0 0;color:#666;font-size:0.9rem;">${contact}</p>
          </header>
          <section style="margin-bottom:20px;"><h2 style="color:#333;font-size:1rem;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;">Professional Summary</h2><p style="margin-top:8px;">${br(summary)}</p></section>
          <section style="margin-bottom:20px;"><h2 style="color:#333;font-size:1rem;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;">Experience</h2><p style="margin-top:8px;">${br(experience)}</p></section>
          <section style="margin-bottom:20px;"><h2 style="color:#333;font-size:1rem;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;">Education</h2><p style="margin-top:8px;">${br(education)}</p></section>
          <section><h2 style="color:#333;font-size:1rem;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;">Skills</h2><p style="margin-top:8px;">${br(skills)}</p></section>
        </div>`;
  }

  const output = document.getElementById("resume-output");
  if (output) output.innerHTML = html;
  
  const certifications = document.getElementById("certifications")?.value.trim();
  const projects = document.getElementById("projects")?.value.trim();
  
  if (certifications && output) {
    output.innerHTML += `<section style="margin-top:20px;padding:0 8px;"><h2 style="color:#333;font-size:1rem;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;">Certifications</h2><p style="margin-top:8px;">${br(certifications)}</p></section>`;
  }
  if (projects && output) {
    output.innerHTML += `<section style="margin-top:20px;padding:0 8px;"><h2 style="color:#333;font-size:1rem;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px;">Projects</h2><p style="margin-top:8px;">${br(projects)}</p></section>`;
  }
}

function printResume() {
  const content = document.getElementById("resume-output")?.innerHTML;
  if (!content || content.includes("empty-state")) return alert("Generate resume first!");
  
  const win = window.open("", "", "width=800,height=600");
  win.document.write(`<!DOCTYPE html><html><head><title>Resume</title></head><body style="margin:0;">${content}</body></html>`);
  win.document.close();
  win.print();
}

// ============================================
// ATS SCORE
// ============================================

async function checkATSScore() {
  const jobTitle = document.getElementById("jobTitle")?.value || "";
  const summary = document.getElementById("summary")?.value || "";
  const skills = document.getElementById("skills")?.value || "";
  const experience = document.getElementById("experience")?.value || "";

  if (!summary && !skills) {
    alert("Fill Summary and Skills first!");
    return;
  }

  const display = document.getElementById("ats-score-display");
  if (display) display.innerHTML = '<div style="padding:16px;background:rgba(139,92,246,0.1);border-radius:8px;text-align:center;"><p>🔍 Analyzing ATS compatibility...</p></div>';

  try {
    const response = await fetch('/api/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: `Analyze this resume for ATS compatibility${jobTitle ? ` for "${jobTitle}"` : ""}:

Summary: ${summary}
Skills: ${skills}
Experience: ${experience}

Give: 1) ATS Score /100, 2) Keywords found, 3) Missing keywords, 4) 3 improvements. Be concise.`
          }]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error");

    const result = data.candidates[0].content.parts[0].text;
    if (display) display.innerHTML = `<div style="padding:16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;"><h4 style="margin:0 0 12px;color:#10b981;">📊 ATS Analysis</h4><pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:0.9rem;line-height:1.6;">${result}</pre></div>`;
  } catch (err) {
    if (display) display.innerHTML = `<div style="padding:16px;background:rgba(244,63,94,0.1);border-radius:8px;color:#f43f5e;">❌ ${err.message}</div>`;
  }
}

// ============================================
// AI GENERATORS
// ============================================

async function generateSkills() {
  const jobTitle = document.getElementById("jobTitle")?.value.trim();
  const box = document.getElementById("skills");
  if (!jobTitle) return alert("Enter job title first!");
  if (!box) return;

  box.value = "⏳ Generating...";

  try {
    const response = await fetch('/api/generate-skills', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error");
    box.value = data.text || "No skills found.";
  } catch (err) {
    box.value = "⚠️ Error";
    alert(err.message);
  }
}

async function generateSummary() {
  const jobTitle = document.getElementById("jobTitle")?.value.trim();
  const box = document.getElementById("summary");
  if (!jobTitle) return alert("Enter job title first!");
  if (!box) return;

  box.value = "⏳ Generating...";

  try {
    const response = await fetch('/api/generate-summary', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error");
    box.value = data.text || "No summary.";
  } catch (err) {
    box.value = "⚠️ Error";
    alert(err.message);
  }
}

// ============================================
// COVER LETTER
// ============================================

const coverLetterModal = document.querySelector("#cover-letter-modal");

document.querySelector("#cover-letter-btn")?.addEventListener("click", () => {
  coverLetterModal?.classList.add("active");
  closeSidebar();
});

coverLetterModal?.querySelector(".close-btn")?.addEventListener("click", () => {
  coverLetterModal?.classList.remove("active");
});

async function generateCoverLetter() {
  const name = document.getElementById("cl-name")?.value || "";
  const email = document.getElementById("cl-email")?.value || "";
  const phone = document.getElementById("cl-phone")?.value || "";
  const company = document.getElementById("cl-company")?.value || "";
  const position = document.getElementById("cl-position")?.value || "";
  const hiringManager = document.getElementById("cl-hiring-manager")?.value || "Hiring Manager";
  const jobDescription = document.getElementById("cl-job-description")?.value || "";
  const skills = document.getElementById("cl-skills")?.value || "";

  if (!name || !company || !position || !jobDescription) {
    alert("Fill required fields!");
    return;
  }

  const output = document.getElementById("cover-letter-output");
  if (output) output.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#666;"><p>✨ Creating your cover letter...</p></div>';

  try {
    const response = await fetch('/api/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: `Write a professional cover letter:

Name: ${name}, Email: ${email}, Phone: ${phone}
Company: ${company}, Position: ${position}
Hiring Manager: ${hiringManager}

Job Description: ${jobDescription}

My Skills: ${skills}

Write a compelling cover letter with proper formatting. Be professional and tailored to the job.`
          }]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error");

    const letter = data.candidates[0].content.parts[0].text;
    if (output) output.innerHTML = `<div style="white-space:pre-wrap;line-height:1.8;font-family:Georgia,serif;">${letter}</div>`;
  } catch (err) {
    if (output) output.innerHTML = `<div style="color:#f43f5e;text-align:center;padding:40px;">❌ ${err.message}</div>`;
  }
}

function printCoverLetter() {
  const content = document.getElementById("cover-letter-output")?.innerHTML;
  if (!content || content.includes("empty-state")) return alert("Generate cover letter first!");
  
  const win = window.open("", "", "width=800,height=600");
  win.document.write(`<!DOCTYPE html><html><head><title>Cover Letter</title></head><body style="font-family:Georgia,serif;margin:40px;line-height:1.8;">${content}</body></html>`);
  win.document.close();
  win.print();
}

// ============================================
// MODAL CLOSE ON BACKDROP
// ============================================

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });
});

// ============================================
// INIT
// ============================================

loadAllChats();

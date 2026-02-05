const container = document.querySelector(".container");   
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// API Configuration - Replace with your own API key if quota exceeded
let API_KEY = "AIzaSyC54y8EEr2BGbAh2NTeMzl7f1qcn60EUk4";
let API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Function to update API key (can be called from console: updateAPIKey("your-new-key"))
window.updateAPIKey = function(newKey) {
  API_KEY = newKey;
  API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  console.log("API Key updated successfully!");
};

let typingInterval, controller;
const chatHistory = [];
const userData = { message: "", file: {} };

const createMsgEelement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const scrollToBottom = () => { 
  chatsContainer.scrollTo({ top: chatsContainer.scrollHeight, behavior: "smooth" });
};

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
      // Auto-save after typing effect completes
      setTimeout(() => autoSaveChat(), 500);
    }
  }, 40);
};

const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();

  // Prepare message parts
  const parts = [{ text: userData.message }];
  
  // Add file data if present
  if (userData.file.data) {
    // For PDFs, include text content in the message
    if (userData.file.pdfText) {
      parts[0].text += `\n\n[PDF Content: ${userData.file.fileName}]\n${userData.file.pdfText}`;
    } else if (userData.file.textContent) {
      // For text files, include content in message
      parts[0].text += `\n\n[File Content: ${userData.file.fileName}]\n${userData.file.textContent}`;
    } else if (userData.file.isImage || userData.file.mime_type?.startsWith("image/")) {
      // For images, add as inline data
      parts.push({ inline_data: (({ fileName, isImage, pdfText, textContent, ...rest }) => rest)(userData.file) });
    } else if (userData.file.mime_type?.startsWith("video/")) {
      // For videos, add as inline data (Gemini supports video)
      parts.push({ inline_data: (({ fileName, isImage, pdfText, textContent, ...rest }) => rest)(userData.file) });
    }
  }

  chatHistory.push({
    role: "user",
    parts: parts
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Check for quota exceeded error
      const errorMessage = data.error?.message || "Unknown error occurred";
      if (errorMessage.includes("quota") || errorMessage.includes("Quota exceeded") || errorMessage.includes("rate limit")) {
        throw new Error("API Quota Exceeded: Please check your Google Gemini API key quota. You may need to upgrade your plan or wait for quota reset. For more info: https://ai.google.dev/gemini-api/docs/rate-limits");
      }
      throw new Error(errorMessage);
    }

    const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
    typingEffect(responseText, textElement, botMsgDiv);
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  } catch (error) {
    textElement.style.color = "#d62939";
    let errorMessage = "";
    
    if (error.name === "AbortError") {
      errorMessage = "Response generation stopped.";
    } else if (error.message.includes("quota") || error.message.includes("Quota exceeded")) {
      // Store quota error in localStorage
      localStorage.setItem("api_quota_error", "true");
      // Show API key button
      const apiKeyBtn = document.getElementById("api-key-btn");
      if (apiKeyBtn) {
        apiKeyBtn.style.display = "block";
        apiKeyBtn.title = "Update API Key (Quota Exceeded - Click to update)";
      }
      errorMessage = `⚠️ API Quota Exceeded\n\nYour Google Gemini API free tier quota has been reached.\n\nSolutions:\n1. Click the 🔑 key button to update API key\n2. Wait for quota reset (usually 24 hours)\n3. Upgrade to paid plan\n4. Check usage: https://ai.dev/rate-limit\n\nQuick Fix: Get new key from https://ai.google.dev/ and click 🔑 button above.`;
    } else if (error.message.includes("rate limit")) {
      errorMessage = `⏱️ Rate Limit Reached\n\nToo many requests. Please wait a moment and try again.\n\nCheck your usage: https://ai.dev/rate-limit`;
    } else {
      errorMessage = `❌ Error: ${error.message}\n\nPlease try again or check your API key configuration.`;
    }
    
    textElement.textContent = errorMessage;
    textElement.style.whiteSpace = "pre-line";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    
    // Show additional help for quota errors
    if (error.message.includes("quota") || error.message.includes("Quota exceeded")) {
      setTimeout(() => {
        const helpDiv = document.createElement("div");
        helpDiv.style.cssText = "margin-top: 10px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; font-size: 0.9rem;";
        helpDiv.innerHTML = `
          <strong>💡 Help:</strong><br>
          • Free tier has limited requests per day<br>
          • Quota resets every 24 hours<br>
          • Consider upgrading for more requests<br>
          • Alternative: Use a different API key
        `;
        botMsgDiv.appendChild(helpDiv);
        scrollToBottom();
      }, 500);
    }
  } finally {
    userData.file = {};
  }
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  promptInput.value = "";
  userData.message = userMessage;
  document.body.classList.add("bot-responding", "chats-active");
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
  
  // Clear file previews after sending
  const filePreview = fileUploadWrapper.querySelector(".file-preview");
  const videoPreview = fileUploadWrapper.querySelector(".video-preview");
  const pdfPreview = document.getElementById("pdf-preview");
  
  if (filePreview) {
    filePreview.src = "#";
    filePreview.style.display = "none";
  }
  if (videoPreview) {
    videoPreview.src = "";
    videoPreview.style.display = "none";
  }
  if (pdfPreview) {
    pdfPreview.style.display = "none";
    pdfPreview.textContent = "";
  }

  let filePreviewHTML = "";
  if (userData.file.data) {
    if (userData.file.isImage) {
      filePreviewHTML = `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`;
    } else if (userData.file.mime_type?.startsWith("video/")) {
      filePreviewHTML = `<video src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" controls style="max-width: 300px;"></video>`;
    } else {
      filePreviewHTML = `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`;
    }
  }
  
  const userMsgHTML = `
    ${filePreviewHTML}
    <p class="message-text"></p>
  `;

  const userMsgDiv = createMsgEelement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();
  setTimeout(() => autoSaveChat(), 500);

  setTimeout(() => {
    const botMsgHTML = `
      <div class="message-text">
        <img src="logo.png" alt="AI Avatar" class="avatar">
        <p class="message-text">Just a sec...</p>
      </div>`;

    const botMsgDiv = createMsgEelement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isPDF = file.type === "application/pdf";
  const isText = file.type === "text/plain" || file.type === "text/csv" || file.name.endsWith(".txt") || file.name.endsWith(".csv");
  
  const filePreview = fileUploadWrapper.querySelector(".file-preview");
  const videoPreview = fileUploadWrapper.querySelector(".video-preview");
  const pdfPreview = document.getElementById("pdf-preview");
  
  // Hide all previews first
  filePreview.style.display = "none";
  videoPreview.style.display = "none";
  if (pdfPreview) pdfPreview.style.display = "none";
  
  const reader = new FileReader();
  
  if (isPDF) {
    // Handle PDF files
    reader.readAsDataURL(file);
    reader.onload = async (e) => {
      fileInput.value = "";
      const base64String = e.target.result.split(",")[1];
      
      // Extract text from PDF using PDF.js
      try {
        const pdf = await pdfjsLib.getDocument({ data: atob(base64String) }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(" ") + "\n";
        }
        
        if (pdfPreview) {
          pdfPreview.textContent = fullText.substring(0, 500) + (fullText.length > 500 ? "..." : "");
          pdfPreview.style.display = "block";
        }
        
        userData.file = { 
          fileName: file.name, 
          data: base64String, 
          mime_type: file.type, 
          isImage: false,
          pdfText: fullText
        };
        fileUploadWrapper.classList.add("active", "file-attached");
      } catch (error) {
        console.error("PDF parsing error:", error);
        alert("PDF file could not be read. Please try another file.");
      }
    };
  } else if (isVideo) {
    // Handle video files
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      fileInput.value = "";
      const base64String = e.target.result.split(",")[1];
      videoPreview.src = e.target.result;
      videoPreview.style.display = "block";
      fileUploadWrapper.classList.add("active", "file-attached");
      userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage: false };
    };
  } else if (isText) {
    // Handle text files
    reader.readAsText(file);
    reader.onload = (e) => {
      fileInput.value = "";
      const textContent = e.target.result;
      if (pdfPreview) {
        pdfPreview.textContent = textContent.substring(0, 500) + (textContent.length > 500 ? "..." : "");
        pdfPreview.style.display = "block";
      }
      userData.file = { 
        fileName: file.name, 
        data: btoa(textContent), 
        mime_type: file.type, 
        isImage: false,
        textContent: textContent
      };
      fileUploadWrapper.classList.add("active", "file-attached");
    };
  } else if (isImage) {
    // Handle image files
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      fileInput.value = "";
      const base64String = e.target.result.split(",")[1];
      filePreview.src = e.target.result;
      filePreview.style.display = "block";
      fileUploadWrapper.classList.add("active", "img-attached");
      userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage: true };
    };
  } else {
    // Handle other file types
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      fileInput.value = "";
      const base64String = e.target.result.split(",")[1];
      fileUploadWrapper.classList.add("active", "file-attached");
      userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage: false };
    };
  }
});

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
  const filePreview = fileUploadWrapper.querySelector(".file-preview");
  const videoPreview = fileUploadWrapper.querySelector(".video-preview");
  const pdfPreview = document.getElementById("pdf-preview");
  
  if (filePreview) {
    filePreview.src = "#";
    filePreview.style.display = "none";
  }
  if (videoPreview) {
    videoPreview.src = "";
    videoPreview.style.display = "none";
  }
  if (pdfPreview) {
    pdfPreview.style.display = "none";
    pdfPreview.textContent = "";
  }
});

document.querySelector("#stop-response-btn").addEventListener("click", () => {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

// Delete chats handler - will be overridden below with auto-save cleanup

document.querySelectorAll(".suggestions-item").forEach(item => {
  item.addEventListener("click", () => {
    const imagePrompt = item.dataset.imagePrompt;
    if (imagePrompt) {
      generateImageFromPrompt(imagePrompt);
    } else {
      promptInput.value = item.querySelector(".text").textContent;
      promptForm.dispatchEvent(new Event("submit"));
    }
  });
});

themeToggle.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

promptInput.addEventListener("paste", (event) => {
  const items = event.clipboardData?.items || [];
  for (let item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const base64String = e.target.result.split(",")[1];
        const mimeType = file.type;
        const preview = fileUploadWrapper.querySelector(".file-preview");
        preview.src = e.target.result;
        preview.style.display = "block";
        fileUploadWrapper.classList.add("active", "img-attached");
        userData.file = {
          fileName: "pasted-image.png",
          data: base64String,
          mime_type: mimeType,
          isImage: true
        };
      };
    } else if (item.type.startsWith("video/")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const base64String = e.target.result.split(",")[1];
        const mimeType = file.type;
        const videoPreview = fileUploadWrapper.querySelector(".video-preview");
        videoPreview.src = e.target.result;
        videoPreview.style.display = "block";
        fileUploadWrapper.classList.add("active", "file-attached");
        userData.file = {
          fileName: "pasted-video.mp4",
          data: base64String,
          mime_type: mimeType,
          isImage: false
        };
      };
    }
  }
});

async function generateImageFromPrompt(prompt) {
  const botMsgDiv = createMsgEelement(`<p class="message-text">Generating image...</p>`, "bot-message", "loading");
  chatsContainer.appendChild(botMsgDiv);
  scrollToBottom();
  try {
    const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2", {
      method: "POST",
      headers: {
        Authorization: "Bearer YOUR_HUGGINGFACE_API_KEY",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: prompt })
    });
    const blob = await response.blob();
    const imageURL = URL.createObjectURL(blob);
    botMsgDiv.classList.remove("loading");
    botMsgDiv.innerHTML = `<img src="${imageURL}" alt="Generated Image" style="max-width: 300px; border-radius: 8px;" />`;
    scrollToBottom();
  } catch (err) {
    botMsgDiv.classList.remove("loading");
    botMsgDiv.innerHTML = `<p class="message-text" style="color: red;">Image generation failed: ${err.message}</p>`;
  }
}

// ✅ Resume Builder Logic - Updated with proper API integration


/* ---------- Modal open / close ---------- */
document.getElementById("resume-builder-btn").addEventListener("click", () => {
  document.getElementById("resume-builder-modal").style.display = "block";
});
document.querySelector("#resume-builder-modal .close-btn").addEventListener("click", () => {
  document.getElementById("resume-builder-modal").style.display = "none";
});

/* ---------- Template‑tab toggle ---------- */
document.getElementById("template-tab-btn").addEventListener("click", () => {
  const tab = document.getElementById("template-tab");
  tab.style.display = tab.style.display === "none" ? "block" : "none";
});

/* ---------- Card <‑‑> hidden <select> sync ---------- */
function syncTemplate(value) {
  document.getElementById("template-selector").value = value;          // radio → select
  document.querySelectorAll(".template-card").forEach(card => {        // highlight
    card.style.border = card.querySelector("input").value === value
      ? "2px solid #007bff"
      : "2px solid #ccc";
  });
}
document.querySelectorAll(".template-card input[type='radio']")
  .forEach(radio => radio.addEventListener("change", () => syncTemplate(radio.value)));

/* also allow programmatic change (if you ever set #template-selector) */
document.getElementById("template-selector").addEventListener("change", e => {
  const v = e.target.value;
  document.querySelector(`.template-card input[value='${v}']`).checked = true;
  syncTemplate(v);
});

/* ---------- Generate resume ---------- */
function generateResume() {
  const name        = document.getElementById("name").value;
  const email       = document.getElementById("email").value;
  const phone       = document.getElementById("phone").value;
  const linkedin    = document.getElementById("linkedin").value;
  const summary     = document.getElementById("summary").value;
  const education   = document.getElementById("education").value;
  const experience  = document.getElementById("experience").value;
  const skills      = document.getElementById("skills").value;
  const template    = document.getElementById("template-selector").value || "template1";

  /* helper to break lines */
  const br = txt => txt.replace(/\n/g, "<br>");

  /* ---------- common blocks ---------- */
  const headBlock = `
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    ${linkedin ? `<p><strong>LinkedIn:</strong> <a href="${linkedin}" target="_blank">${linkedin}</a></p>` : ""}
  `;
  const bodyBlocks = `
    <h3>Summary</h3><p>${br(summary)}</p>
    <h3>Education</h3><p>${br(education)}</p>
    <h3>Experience</h3><p>${br(experience)}</p>
    <h3>Skills</h3><p>${br(skills)}</p>
  `;

  let resumeHTML = "";

  /* ---------- Template variations ---------- */
  switch (template) {
    case "template2":          /* Bold header (dark) */
      resumeHTML = `
        <div style="font-family: Arial, sans-serif; max-width:800px; margin:auto;">
          <header style="background:#1a1a1a;color:#fff;padding:20px;">
            <h2 style="margin:0;">${name}</h2>
            <p>${email} | ${phone} ${linkedin ? `| ${linkedin}` : ""}</p>
          </header>
          <main style="padding:20px;">${bodyBlocks}</main>
        </div>
      `;
      break;

    case "template3":          /* Two column */
      resumeHTML = `
        <div style="display:flex;font-family:Arial,sans-serif;max-width:800px;margin:auto;">
          <aside style="width:30%;padding:20px;background:#f4f4f4;">
            <h2>${name}</h2>${headBlock}
            <h3>Skills</h3><p>${br(skills)}</p>
          </aside>
          <main style="width:70%;padding:20px;">${bodyBlocks}</main>
        </div>
      `;
      break;L
  
    case "template4":          /* Modern Blue */
      resumeHTML = `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:auto;border:2px solid #3498db;">
          <header style="background:#3498db;color:#fff;padding:15px;">
            <h2 style="margin:0;">${name}</h2>
          </header>
          <section style="padding:20px;">${headBlock}</section>
          <section style="padding:20px;">${bodyBlocks}</section>
        </div>
      `;v  
      break;

    case "template5":          /* Minimalist */
      resumeHTML = `
        <div style="font-family:Georgia,serif;max-width:700px;margin:auto;padding:20px;">
          <h2 style="border-bottom:1px solid #000;padding-bottom:5px;">${name}</h2>
          ${headBlock}
          ${bodyBlocks}
        </div>
      `;
      break;

    case "template6":          /* Creative layout */
      resumeHTML = `
        <div style="font-family:'Trebuchet MS',sans-serif;max-width:800px;margin:auto;">
          <header style="text-align:center;padding:30px 0;background:linear-gradient(135deg,#00c6ff,#0072ff);color:#fff;">
            <h1 style="margin:0;">${name}</h1>
            <p>${email} | ${phone}${linkedin ? ` | ${linkedin}` : ""}</p>
          </header>
          <div style="display:grid;grid-template-columns:35% 65%;gap:20px;padding:25px;">
            <div>
              <h3>Skills</h3><p>${br(skills)}</p>
            </div>
            <div>${bodyBlocks}</div>
          </div>
        </div>
      `;
      break;

    default:                   /* Template 1 – Clean ATS */
      resumeHTML = `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:20px;">
          <h2 style="color:#2c3e50;padding-bottom:10px;">${name}</h2>
          ${headBlock}
          ${bodyBlocks}
        </div>
      `;
  }

  document.getElementById("resume-output").innerHTML = resumeHTML;
  extendResumeSections();   // add certifications & projects
}

/* ---------- Append certifications & projects ---------- */
// function extendResumeSections() {
//   const resumeContainer = document.getElementById("resume-output");
//   const certifications = document.getElementById("certifications").value.trim();
//   const projects       = document.getElementById("projects").value.trim();

//   let extra = "";
//   if (certifications) {
//     extra += `<h3>Certifications</h3><ul>${certifications.split("\n").map(c=>`<li>${c}</li>`).join("")}</ul>`;
//   }
//   if (projects) {
//     extra += `<h3>Projects</h3><ul>${projects.split("\n").map(p=>`<li>${p}</li>`).join("")}</ul>`;
//   }
//   resumeContainer.innerHTML += extra;
// }

function extendResumeSections() {
  const resumeContainer = document.getElementById("resume-output");
  const certifications = document.getElementById("certifications").value.trim();
  const projects = document.getElementById("projects").value.trim();

  let extra = "";

  // Handle Certifications
  if (certifications) {
    extra += `<h3>Certifications</h3><ul>${certifications
      .split("\n")
      .map(c => `<li>${c}</li>`)
      .join("")}</ul>`;
  }

  // Handle Multiple Projects
  if (projects) {
    extra += `<h3>Projects</h3><div>`;
    const projectBlocks = projects.split(/\n\s*\n/); // Split on double newline

    projectBlocks.forEach(p => {
      const lines = p.trim().split("\n").map(line => line.trim());
      if (lines.length >= 1) {
        const title = lines[0];
        const tech = lines[1] ? `<em>${lines[1]}</em>` : "";
        const description = lines.slice(2).join(" ");
        extra += `
          <div style="margin-bottom: 12px;">
            <strong>${title}</strong><br/>
            ${tech ? `${tech}<br/>` : ""}
            <span>${description}</span>
          </div>`;
      }
    });

    extra += `</div>`;
  }

  // Add to resume container
  resumeContainer.innerHTML += extra;
} 


/* ---------- Print / save ---------- */
function printResume() {
  const content = document.getElementById("resume-output").innerHTML;
  const win = window.open("","","width=800,height=600");
  win.document.write(`<html><head><title>Resume</title><style>body{font-family:Arial;margin:20px;}</style></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

/* ---------- AI (Cohere) helpers – unchanged ---------- */
// async function generateSkills() {
//   const jobTitle = document.getElementById("jobTitle").value.trim();
//   if (!jobTitle) return alert("Please enter your job title.");
//   const apiKey = "zJzS8yqGTcJaVLWFayinVyLkp11t1uLOAIF2x0L5";
//   const message = `List top 5 professional skills (technical and soft) for a ${jobTitle}. Format:\\n- Skill 1\\n- Skill 2`;
//   const response = await fetch("https://api.cohere.ai/v1/chat", {
//     method:"POST",
//     headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
//     body:JSON.stringify({ model:"command-r", message, chat_history:[], temperature:0.7 })
//   });
//   const data = await response.json();
//   if (data?.text) {
//     document.getElementById("skills").value = data.text.trim();
//     alert("Skills generated!");
//   } else alert("Error generating skills.");
// }
async function generateSkills() {
  const jobTitle = document.getElementById("jobTitle").value.trim();
  if (!jobTitle) return alert("Please enter your job title.");

  const apiKey = "zJzS8yqGTcJaVLWFayinVyLkp11t1uLOAIF2x0L5";

  const message = `Act as a professional resume writer. Based on the job title "${jobTitle}", list the top 5 relevant skills (a mix of technical and soft skills) in a clean resume section format like this:

SKILLS
- Skill 1
- Skill 2
- Skill 3
- Skill 4
- Skill 5

Only return the SKILLS section without any extra explanation.`;

  const response = await fetch("https://api.cohere.ai/v1/chat", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "command-r",
      message,
      chat_history: [],
      temperature: 0.5
    })
  });

  const data = await response.json();

  if (data?.text) {
    document.getElementById("skills").value = data.text.trim();
    alert("Skills generated in resume format!");
  } else {
    alert("Error generating skills. Please try again.");
  }
}

async function generateSummary() {
  const jobTitle = document.getElementById("jobTitle").value.trim();
  if (!jobTitle) return alert("Please enter your job title.");
  const apiKey = "zJzS8yqGTcJaVLWFayinVyLkp11t1uLOAIF2x0L5";
  const message = `Write a professional 2-sentence summary for a ${jobTitle}.`;
  const response = await fetch("https://api.cohere.ai/v1/chat", {
    method:"POST",
    headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
    body:JSON.stringify({ model:"command-r", message, chat_history:[], temperature:0.7 })
  });
  const data = await response.json();
  if (data?.text) {
    document.getElementById("summary").value = data.text.trim();
    alert("Summary generated!");
  } else alert("Error generating summary.");
}


/* ---------- Download Resume as Word ---------- */
function downloadWordResume() {
  const content = document.getElementById("resume-output").innerHTML;
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Resume</title></head><body>`;
  const footer = `</body></html>`;
  const sourceHTML = header + content + footer;

  const blob = new Blob(['\ufeff', sourceHTML], {
    type: 'application/msword'
  });

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = "My_Resume.doc";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

/* ---------- ATS Optimization Check ---------- */
function checkATS() {
  const jobTitle = document.getElementById("jobTitle").value.toLowerCase();
  const summary = document.getElementById("summary").value.trim();
  const skills = document.getElementById("skills").value.toLowerCase();
  const experience = document.getElementById("experience").value.trim();
  const education = document.getElementById("education").value.trim();

  let issues = [];

  if (summary.length < 100) {
    issues.push("⚠️ Your summary is quite short. Consider elaborating it to at least 2–3 lines.");
  }

  if (!skills.includes(jobTitle.split(" ")[0])) {
    issues.push("⚠️ Your skills don't seem to include key job title keywords.");
  }

  if (!experience.toLowerCase().includes(jobTitle.split(" ")[0])) {
    issues.push("⚠️ Your experience section is missing role-related terms.");
  }

  if (!education) {
    issues.push("⚠️ Add your educational background. ATS often checks for degrees.");
  }

  const feedbackBox = document.createElement("div");
  feedbackBox.style.border = "1px solid #aaa";
  feedbackBox.style.padding = "15px";
  feedbackBox.style.background = "#fdfce7";
  feedbackBox.style.marginTop = "20px";
  feedbackBox.style.borderRadius = "8px";

  feedbackBox.innerHTML = issues.length === 0
    ? "<strong>✅ Your resume is ATS-friendly!</strong>"
    : `<strong>ATS Suggestions:</strong><ul>${issues.map(i => `<li>${i}</li>`).join("")}</ul>`;

  const prevBox = document.getElementById("resume-preview");
  const existing = document.getElementById("ats-feedback-box");
  if (existing) existing.remove();
  feedbackBox.id = "ats-feedback-box";
  prevBox.appendChild(feedbackBox);
}

/* ========== NEW FEATURES: READ/WRITE & MORE ========== */

// Store full chat messages for export/search
let fullChatMessages = [];

// Helper to get all messages
const getAllMessages = () => {
  return Array.from(chatsContainer.querySelectorAll(".message")).map(msg => {
    const isUser = msg.classList.contains("user-message");
    const textElement = msg.querySelector(".message-text");
    return {
      role: isUser ? "user" : "bot",
      text: textElement ? (textElement.textContent || textElement.innerText) : "",
      timestamp: new Date().toISOString(),
      element: msg
    };
  }).filter(m => m.text && !m.text.includes("Just a sec..."));
};

// Auto-save chat to localStorage
const autoSaveChat = () => {
  try {
    const messages = Array.from(chatsContainer.querySelectorAll(".message")).map(msg => {
      const isUser = msg.classList.contains("user-message");
      const textElement = msg.querySelector(".message-text");
      return {
        role: isUser ? "user" : "bot",
        text: textElement ? (textElement.textContent || textElement.innerText) : "",
        timestamp: new Date().toISOString()
      };
    }).filter(m => m.text && !m.text.includes("Just a sec..."));
    
    const chatData = {
      messages: messages,
      chatHistory: chatHistory,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("chatbot_autosave", JSON.stringify(chatData));
  } catch (error) {
    console.error("Auto-save failed:", error);
  }
};

// Auto-save is called directly in handleFormSubmit and generateResponse

// Save Chat to File
document.getElementById("save-chat-btn")?.addEventListener("click", () => {
  const messages = getAllMessages();
  if (messages.length === 0) {
    alert("No chat to save!");
    return;
  }
  
  const chatData = {
    messages: messages.map(m => ({ role: m.role, text: m.text, timestamp: m.timestamp })),
    chatHistory: chatHistory,
    timestamp: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat_history_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Also save to localStorage
  localStorage.setItem("chatbot_autosave", JSON.stringify(chatData));
  alert("Chat saved successfully!");
});

// Load Chat from File
document.getElementById("load-chat-btn")?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const chatData = JSON.parse(event.target.result);
        
        // Clear current chat
        chatsContainer.innerHTML = "";
        chatHistory.length = 0;
        fullChatMessages = [];
        
        // Restore chat history
        if (chatData.chatHistory) {
          chatHistory.push(...chatData.chatHistory);
        }
        
        // Restore messages
        if (chatData.messages) {
          chatData.messages.forEach(msg => {
            const msgHTML = msg.role === "user" 
              ? `<img src="logo.png" alt="" class="avatar"><p class="message-text">${msg.text}</p>`
              : `<div class="message-text"><img src="logo.png" alt="AI Avatar" class="avatar"><p class="message-text">${msg.text}</p></div>`;
            
            const msgDiv = createMsgEelement(msgHTML, "message", msg.role === "user" ? "user-message" : "bot-message");
            chatsContainer.appendChild(msgDiv);
          });
        }
        
        document.body.classList.add("chats-active");
        scrollToBottom();
        alert("Chat loaded successfully!");
      } catch (error) {
        alert("Error loading chat file: " + error.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

// Export Chat as Text/PDF
document.getElementById("export-chat-btn")?.addEventListener("click", () => {
  const messages = getAllMessages();
  if (messages.length === 0) {
    alert("No chat to export!");
    return;
  }
  
  const format = confirm("Press OK for PDF, Cancel for Text file");
  
  let content = "Chat History Export\n";
  content += "=".repeat(50) + "\n\n";
  
  messages.forEach(msg => {
    const role = msg.role === "user" ? "You" : "AI Assistant";
    const time = new Date(msg.timestamp).toLocaleString();
    content += `[${role}] (${time})\n`;
    content += msg.text + "\n\n";
    content += "-".repeat(50) + "\n\n";
  });
  
  if (format) {
    // Export as PDF (using browser print)
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write(`
      <html>
        <head>
          <title>Chat Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <pre>${content.replace(/\n/g, "<br>")}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  } else {
    // Export as Text
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_export_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
});

// Search in Chat
let searchResults = [];
document.getElementById("search-chat-btn")?.addEventListener("click", () => {
  const searchBar = document.getElementById("search-bar");
  searchBar.style.display = searchBar.style.display === "none" ? "block" : "none";
  if (searchBar.style.display === "block") {
    document.getElementById("search-input").focus();
  }
});

document.getElementById("close-search-btn")?.addEventListener("click", () => {
  document.getElementById("search-bar").style.display = "none";
  // Remove highlights
  fullChatMessages.forEach(msg => {
    if (msg.element) {
      const textEl = msg.element.querySelector(".message-text");
      if (textEl) {
        textEl.innerHTML = textEl.textContent;
      }
    }
  });
});

document.getElementById("search-input")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  const messages = getAllMessages();
  
  if (!query) {
    // Remove highlights
    messages.forEach(msg => {
      if (msg.element) {
        const textEl = msg.element.querySelector(".message-text");
        if (textEl) {
          textEl.innerHTML = textEl.textContent;
        }
      }
    });
    return;
  }
  
  let firstMatch = true;
  // Highlight search results
  messages.forEach(msg => {
    if (msg.element) {
      const textEl = msg.element.querySelector(".message-text");
      if (textEl) {
        const text = textEl.textContent;
        if (text.toLowerCase().includes(query)) {
          const highlighted = text.replace(
            new RegExp(`(${query})`, "gi"),
            '<mark style="background: yellow; color: black;">$1</mark>'
          );
          textEl.innerHTML = highlighted;
          
          // Scroll to first match
          if (firstMatch) {
            msg.element.scrollIntoView({ behavior: "smooth", block: "center" });
            firstMatch = false;
          }
        }
      }
    }
  });
});

// Voice Input
let recognition = null;
let isListening = false;

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    promptInput.value = transcript;
    document.getElementById("voice-input-btn").classList.remove("recording");
    isListening = false;
  };
  
  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    document.getElementById("voice-input-btn").classList.remove("recording");
    isListening = false;
    alert("Voice input error: " + event.error);
  };
  
  recognition.onend = () => {
    document.getElementById("voice-input-btn").classList.remove("recording");
    isListening = false;
  };
}

document.getElementById("voice-input-btn")?.addEventListener("click", () => {
  if (!recognition) {
    alert("Voice input is not supported in your browser.");
    return;
  }
  
  if (isListening) {
    recognition.stop();
    isListening = false;
    document.getElementById("voice-input-btn").classList.remove("recording");
  } else {
    recognition.start();
    isListening = true;
    document.getElementById("voice-input-btn").classList.add("recording");
  }
});

// Copy Message Functionality
chatsContainer.addEventListener("click", (e) => {
  if (e.target.closest(".message")) {
    const message = e.target.closest(".message");
    const textElement = message.querySelector(".message-text");
    if (textElement && e.detail === 2) { // Double click to copy
      const text = textElement.textContent || textElement.innerText;
      navigator.clipboard.writeText(text).then(() => {
        // Show copy feedback
        const feedback = document.createElement("div");
        feedback.textContent = "Copied!";
        feedback.style.cssText = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1d7efd; color: white; padding: 10px 20px; border-radius: 8px; z-index: 10000;";
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 2000);
      });
    }
  }
});

// Load auto-saved chat on page load
window.addEventListener("load", () => {
  try {
    const saved = localStorage.getItem("chatbot_autosave");
    if (saved) {
      const chatData = JSON.parse(saved);
      if (chatData.messages && chatData.messages.length > 0) {
        if (confirm("Found saved chat. Do you want to restore it?")) {
          // Restore chat
          chatsContainer.innerHTML = "";
          chatHistory.length = 0;
          fullChatMessages = [];
          
          if (chatData.chatHistory) {
            chatHistory.push(...chatData.chatHistory);
          }
          
          chatData.messages.forEach(msg => {
            const msgHTML = msg.role === "user" 
              ? `<img src="logo.png" alt="" class="avatar"><p class="message-text">${msg.text}</p>`
              : `<div class="message-text"><img src="logo.png" alt="AI Avatar" class="avatar"><p class="message-text">${msg.text}</p></div>`;
            
            const msgDiv = createMsgEelement(msgHTML, "message", msg.role === "user" ? "user-message" : "bot-message");
            chatsContainer.appendChild(msgDiv);
          });
          
          document.body.classList.add("chats-active");
          scrollToBottom();
        }
      }
    }
  } catch (error) {
    console.error("Error loading auto-saved chat:", error);
  }
});

// Update delete chats button
const deleteChatsBtn = document.querySelector("#delete-chats-btn");
if (deleteChatsBtn) {
  // Remove old handler
  const newDeleteBtn = deleteChatsBtn.cloneNode(true);
  deleteChatsBtn.parentNode.replaceChild(newDeleteBtn, deleteChatsBtn);
  
  newDeleteBtn.addEventListener("click", () => {
    fullChatMessages = [];
    localStorage.removeItem("chatbot_autosave");
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
  });
}

// API Key Update Functionality
const apiKeyBtn = document.getElementById("api-key-btn");
if (apiKeyBtn) {
  apiKeyBtn.addEventListener("click", () => {
    const newKey = prompt("Enter your new Google Gemini API Key:\n\nGet your key from: https://ai.google.dev/\n\nCurrent key will be replaced.", API_KEY);
    if (newKey && newKey.trim() !== "" && newKey !== API_KEY) {
      if (window.updateAPIKey) {
        window.updateAPIKey(newKey.trim());
        alert("✅ API Key updated successfully!\n\nYou can now use the chatbot with your new API key.");
        location.reload(); // Reload to apply changes
      }
    }
  });
}

// Initialize all features
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ AI Chatbot - All Features Ready!");
  console.log("📝 Features: Save, Load, Export, Voice, Search, Auto-Save, Copy");
  console.log("💡 To update API key: Click the key icon button or use: updateAPIKey('your-key') in console");
  
  // Show API key button if previous quota error was detected
  const lastError = localStorage.getItem("api_quota_error");
  if (lastError === "true") {
    const apiKeyBtn = document.getElementById("api-key-btn");
    if (apiKeyBtn) {
      apiKeyBtn.style.display = "block";
    }
  }
});

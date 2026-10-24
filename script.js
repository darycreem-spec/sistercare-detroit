
const status = document.querySelector("#status");
const detail = document.querySelector("#detail");
const chat = document.querySelector("#chat");
const form = document.querySelector("#form");
const question = document.querySelector("#question");
const send = document.querySelector("#send");

let busy = false;
let worker = null;
let activeBubble = null;
let activeRequestId = 0;

function addMessage(text, who = "assistant") {
  const el = document.createElement("div");
  el.className = `msg ${who}`;

  if (who === "assistant") {
    const p = document.createElement("p");
    p.textContent = text;
    el.append(p);
  } else {
    el.textContent = text;
  }

  chat.append(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function showReply(bubble, text, includeReminder = true) {
  bubble.replaceChildren();

  const p = document.createElement("p");
  p.textContent = text;
  bubble.append(p);

  if (includeReminder) {
    const reminder = document.createElement("p");
    reminder.textContent =
      "Reminder: AI can make mistakes. This is not a diagnosis or a replacement for a healthcare professional.";
    bubble.append(reminder);
  }

  chat.scrollTop = chat.scrollHeight;
}

function finishRequest() {
  busy = false;
  activeBubble = null;
  send.disabled = false;
  send.textContent = "Ask navigator";
}

function showFallback(bubble) {
  showReply(
    bubble,
    "I could not complete the AI response right now. For a new or concerning breast change, please contact a healthcare professional promptly. You can use this call script: “I’ve noticed a new change in my breast and would like to schedule an evaluation. What is the soonest available appointment, and do you offer help if I’m uninsured or concerned about cost?”"
  );
}

try {
  worker = new Worker(
    new URL("./ai-worker.js", import.meta.url),
    { type: "module" }
  );

  worker.onmessage = (event) => {
    const data = event.data;

    if (data.id !== activeRequestId || !activeBubble) return;

    if (data.type === "progress") {
      const progress = data.progress;
      if (progress?.status === "progress" &&
          typeof progress.progress === "number") {
        detail.textContent =
          `Downloading AI model: ${Math.round(progress.progress)}%. Please wait.`;
      }
      return;
    }

    if (data.type === "status") {
      detail.textContent = data.text;
      return;
    }

    if (data.type === "answer") {
      showReply(
        activeBubble,
        data.answer ||
          "For a new or concerning breast change, please contact a healthcare professional promptly."
      );
      status.textContent = "AI ready";
      status.classList.add("ready");
      finishRequest();
      return;
    }

    if (data.type === "error") {
      showFallback(activeBubble);
      status.textContent = "AI temporarily unavailable";
      detail.textContent =
        "The rest of SisterCare Detroit remains available.";
      finishRequest();
    }
  };

  worker.onerror = () => {
    if (activeBubble) showFallback(activeBubble);
    status.textContent = "AI temporarily unavailable";
    detail.textContent =
      "Please use the health resources and call script below.";
    finishRequest();
  };
} catch (error) {
  status.textContent = "AI temporarily unavailable";
  detail.textContent =
    "Please use the health resources and call script below.";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = question.value.trim();
  if (!text || busy) return;

  busy = true;
  send.disabled = true;
  send.textContent = "Preparing…";

  addMessage(text, "user");
  question.value = "";

  activeBubble = addMessage("Preparing a supportive response…");
  activeRequestId++;

  const costHelpPattern =
    /\b(cost|afford|uninsured|underinsured|insurance|financial assistance|pay for|can't pay|cannot pay|no insurance|low cost|free mammogram|free screening)\b/i;

  if (costHelpPattern.test(text)) {
    showReply(
      activeBubble,
      "You may have options for help with the cost of breast care. In Michigan, the Breast and Cervical Cancer Control Navigation Program (BC3NP) helps eligible women access breast screening and follow-up care. Call 844-446-8727 or visit https://www.michigan.gov/mdhhs/keep-mi-healthy/chronicdiseases/cancer/bc3np to ask about eligibility and enrollment. In Wayne, Oakland, and Macomb counties, you can also call the Tri-County program at 888-242-2702 or visit https://bcccp.org/. Eligibility and covered services vary. When you call, explain that you have noticed a breast change and are concerned about cost. Ask what evaluation is available and whether financial assistance applies. Please don't delay seeking professional evaluation for a new or concerning breast change."
    );
    finishRequest();
    return;
  }

  if (!worker) {
    showFallback(activeBubble);
    finishRequest();
    return;
  }

  status.textContent = "AI working";
  detail.textContent =
    "The AI is preparing a response. Please keep this page open.";

  worker.postMessage({
    id: activeRequestId,
    text
  });
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    question.value = button.dataset.prompt;
    question.focus();
  });
});

document.querySelector("#clear").addEventListener("click", () => {
  chat.replaceChildren();
  addMessage(
    "Conversation cleared. I can help you prepare for a conversation with a healthcare professional. If you noticed a new lump or breast change, please arrange a professional evaluation promptly. What would be helpful to prepare for today?"
  );
});

document.querySelector("#copy").addEventListener("click", async () => {
  const text = document.querySelector("#script").innerText;
  const out = document.querySelector("#copystatus");

  try {
    await navigator.clipboard.writeText(text);
    out.textContent = "Call script copied.";
  } catch {
    out.textContent =
      "Copy was blocked by your browser. Select and copy the quote above.";
  }
});

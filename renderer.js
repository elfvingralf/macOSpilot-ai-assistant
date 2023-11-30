const { ipcRenderer } = require("electron");

let mediaRecorder; // Define mediaRecorder in a broader scope
let audioChunks = []; // Define audioChunks in a broader scope

function displayWindows(windows) {
  const windowListElement = document.getElementById("windowList");
  windowListElement.innerHTML = ""; // Clear existing list

  windows.forEach((window) => {
    if (window.name === "Window Selection") {
      return;
    }
    const windowElement = document.createElement("div");
    windowElement.innerText = window.name;
    windowElement.onclick = () => selectWindow(window.name);
    windowListElement.appendChild(windowElement);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const windows = await ipcRenderer.invoke("get-windows");
  displayWindows(windows);

  const refreshButton = document.getElementById("refreshButton");
  refreshButton.addEventListener("click", async () => {
    const updatedWindows = await ipcRenderer.invoke("get-windows");
    displayWindows(updatedWindows);
  });
});

ipcRenderer.on("screenshot-analysis", (event, analysis) => {
  // Get the analysis container
  const analysisContainer = document.getElementById("analysis");

  // Check if there is an existing placeholder or message
  if (analysisContainer.firstChild) {
    // Replace the content of the first child (which should be the placeholder/message) with the analysis
    // analysisContainer.firstChild.textContent = analysis;
    updateWindowMessage(analysis);
  } else {
    // If the placeholder/message is somehow missing, create a new div for the analysis
    // const analysisMessage = document.createElement("div");
    // analysisMessage.textContent = analysis;
    // analysisMessage.style.borderBottom = "1px solid #ddd"; // Add styling if needed
    // analysisMessage.style.padding = "10px"; // Add styling if needed
    // analysisMessage.style.marginTop = "10px"; // Add styling if needed

    // Append the new analysis message to the analysis container
    updateWindowMessage(analysis);
  }
});

ipcRenderer.on("start-recording", async () => {
  try {
    updateWindowMessage("Recording in progress...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream); // Use the broader scoped mediaRecorder
    audioChunks = []; // Reset audioChunks for a new recording

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Convert ArrayBuffer to Buffer
      const buffer = Buffer.from(arrayBuffer);

      // Send the buffer to the main process
      ipcRenderer.send("audio-buffer", buffer);
    });

    mediaRecorder.start();
  } catch (error) {
    console.error("Error accessing the microphone", error);
  }
});

ipcRenderer.on("stop-recording", () => {
  // Stop the media recorder
  updateWindowMessage("Processing...");
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
});

function selectWindow(windowName) {
  console.log(windowName);
  ipcRenderer.send("select-window", windowName);

  const analysisContainer = document.getElementById("analysis");

  // Create a new section for this window
  const windowSection = document.createElement("div");
  windowSection.className = "window-section";

  const title = document.createElement("h3");
  title.textContent = `Window: ${windowName}`;
  windowSection.appendChild(title);

  const message = document.createElement("div");
  message.className = "window-message";
  windowSection.appendChild(message);

  // Prepend the new section to the analysis container
  if (analysisContainer.firstChild) {
    analysisContainer.insertBefore(windowSection, analysisContainer.firstChild);
  } else {
    analysisContainer.appendChild(windowSection);
  }
}

function updateAnalysisPlaceholder(message) {
  const analysisContainer = document.getElementById("analysis");
  if (analysisContainer.firstChild) {
    analysisContainer.firstChild.textContent = message;
  } else {
    const placeholder = document.createElement("div");
    placeholder.textContent = message;
    analysisContainer.appendChild(placeholder);
  }
}

function updateWindowMessage(message) {
  ``;
  const latestWindowSection = document.querySelector(".window-section");
  if (latestWindowSection) {
    const messageDiv = latestWindowSection.querySelector(".window-message");
    if (messageDiv) {
      messageDiv.textContent = message;
    }
  }
}

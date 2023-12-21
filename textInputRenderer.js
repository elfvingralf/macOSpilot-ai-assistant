const { ipcRenderer } = require("electron");

const textInput = document.getElementById("textInput");
const closeBtn = document.getElementById("closeBtn");

textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault(); // Prevent default Enter behavior (new line)
    const text = textInput.value.trim();

    ipcRenderer.send("text-input-submitted", text);
    textInput.value = "";
  }
});

closeBtn.addEventListener("click", () => {
  ipcRenderer.send("close-text-input-window");
});

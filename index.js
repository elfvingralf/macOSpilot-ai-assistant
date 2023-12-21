const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut,
  systemPreferences,
} = require("electron");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const OpenAI = require("openai");
const { Blob } = require("buffer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const FormData = require("form-data");
const { exec } = require("child_process");
const activeWin = require("active-win");
const Store = require("electron-store");

const store = new Store();
ffmpeg.setFfmpegPath(ffmpegStatic);

// // //  SET CONFIGS AND PLACEHOLDER VARIABLES // // //

let openAiApiKey = store.get("userApiKey", "");
let openai = new OpenAI({
  apiKey: openAiApiKey,
});

const keyboardShortcut = "CommandOrControl+Shift+'"; // This is the keyboard shortcut that triggers the app

const notificationWindowWidth = 300; // Width of notification window
const notificationWindowHeight = 100; // Height of notification window
const notificationOpacity = 0.8; // Opacity of notification window
const mainWindowWidth = 600; // Width of main window
const mainWindowHeight = 400; // Height of main window
const textInputWindowWidth = 300; // Width of main window
const textInputWindowHeight = 100; // Height of main window

let isRecording = false;
let mainWindow;
let notificationWindow;
let textInputWindow;

let conversationHistory = [
  {
    role: "system",
    content:
      "You are helping users with questions about their OSX applications based on screenshots, always answer in at most one sentence.",
  },
];

// Set to true if you intend to package the app, otherwise false.
const useElectronPackager = false;
let tempFilesDir;
// This decides what directory/storage strategy to use (local project or application folder)
if (useElectronPackager) {
  tempFilesDir = path.join(app.getPath("userData"), "macOSpilot-temp-files");
} else {
  tempFilesDir = path.join(__dirname, "macOSpilot-temp-files");
}

if (!fs.existsSync(tempFilesDir)) {
  fs.mkdirSync(tempFilesDir, { recursive: true });
}

const micRecordingFilePath = path.join(tempFilesDir, "macOSpilotMicAudio.raw");
const mp3FilePath = path.join(tempFilesDir, "macOSpilotAudioInput.mp3");
const screenshotFilePath = path.join(tempFilesDir, "macOSpilotScreenshot.png");
const audioFilePath = path.join(tempFilesDir, "macOSpilotTtsResponse.mp3");

// // // // // // // // // // // // // // // // // // // // //

// Create main Electron window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: mainWindowWidth,
    height: mainWindowHeight,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile("index.html");
}

// Create "always on top" Electron notification window
function createNotificationWindow() {
  notificationWindow = new BrowserWindow({
    width: notificationWindowWidth,
    height: notificationWindowHeight,
    frame: false,
    transparent: true, // Enable transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    alwaysOnTop: true,
    skipTaskbar: true,
    x: 100,
    y: 100,
  });
  notificationWindow.setOpacity(notificationOpacity);
  notificationWindow.loadFile("notifications.html");
}

function createTextInputWindow() {
  textInputWindow = new BrowserWindow({
    width: textInputWindowWidth,
    height: textInputWindowHeight,
    frame: false,
    transparent: true, // Enable transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    alwaysOnTop: true,
    skipTaskbar: true,
    x: 100,
    y: 100,
  });
  textInputWindow.loadFile("textInput.html");
}

// Function to reposition notification and text input windows to the active application
async function repositionWindow(selectedApplicationWindow, copilotWindow) {
  const { x, y, width, height } = selectedApplicationWindow.bounds;
  let newX, newY;

  // Position at the top right corner for notificationWindow
  if (copilotWindow === "notificationWindow") {
    newX = x + width - notificationWindowWidth;
    newY = y;

    // Adjust to keep it on-screen
    newX = Math.round(Math.max(newX, 0)) - 15;
    newY = Math.round(Math.max(newY, 0)) + 15;
    notificationWindow.setPosition(newX, newY);
  }
  // Center the textInputWindow
  else if (copilotWindow === "textInputWindow") {
    newX = x + width / 2 - textInputWindowWidth / 2;
    newY = y + height / 2 - textInputWindowHeight / 2;
    // Adjust to keep it on-screen
    newX = Math.round(Math.max(newX, 0));
    newY = Math.round(Math.max(newY, 0));
    textInputWindow.setPosition(newX, newY);
  }
}

// Manage API key storage/access
ipcMain.on("submit-api-key", (event, apiKey) => {
  store.set("userApiKey", apiKey); // Directly saving the API key using electron-store
});

// Function to mask the API key except for the last 4 characters
function maskApiKey(apiKey) {
  if (apiKey.length <= 4) {
    return apiKey; // If the key is too short, just return it
  }
  return "*".repeat(apiKey.length - 4) + apiKey.slice(-4);
}

// Handle request for API key
ipcMain.on("request-api-key", (event) => {
  const apiKey = store.get("userApiKey", ""); // Get the API key
  const maskedApiKey = maskApiKey(apiKey); // Get the masked version
  event.reply("send-api-key", maskedApiKey); // Send the masked key
});

// fetch the key to send to backend logic
ipcMain.handle("get-api-key", (event) => {
  return store.get("userApiKey", "");
});

// Listen for question input method changes (audio vs keyboard)
ipcMain.on("set-input-method", (event, method) => {
  store.set("inputMethod", method);
  inputMethod = method; // Update the global variable
});

// Listen for request for current question input method changes (audio vs keyboard)
ipcMain.on("request-input-method", (event) => {
  const method = store.get("inputMethod", "voice"); // Default to 'voice' if not set
  event.reply("send-input-method", method);
});

// Close and nullify the text input window if closed by the user
ipcMain.on("close-text-input-window", () => {
  if (textInputWindow) {
    textInputWindow.close();
    textInputWindow = null;
  }
});

// Store the current input method (default to voice if not set)
let inputMethod = store.get("inputMethod", "voice");

// When a user submits a question by text, close the input text window and process the question
ipcMain.on("text-input-submitted", (event, questionText) => {
  if (textInputWindow) {
    textInputWindow.close();
    textInputWindow = null; // Set to null after closing
  }
  // Adding user's question to windows to give sense of progress
  if (!notificationWindow) {
    createNotificationWindow();
  }

  updateNotificationWindowText(questionText);
  mainWindow.webContents.send("push-question-to-windows", questionText);

  // Submit question and screenshot to Vision API
  processInputs(screenshotFilePath, questionText);
});

// Recorded audio gets passed to this function when the microphone recording has stopped
ipcMain.on("audio-buffer", (event, buffer) => {
  openAiApiKey = store.get("userApiKey", "");
  openai = new OpenAI({
    apiKey: openAiApiKey,
  });

  // Save buffer to the temporary file
  fs.writeFile(micRecordingFilePath, buffer, (err) => {
    if (err) {
      console.error("Failed to save temporary audio file:", err);
      return;
    }

    // Convert the temporary file to MP3 and send to Vision API
    try {
      ffmpeg(micRecordingFilePath)
        .setFfmpegPath(ffmpegStatic)
        .audioBitrate(32)
        .toFormat("mp3")
        .on("error", (err) => {
          console.error("Error converting to MP3:", err);
        })
        .on("end", async () => {
          fs.unlink(micRecordingFilePath, (err) => {
            if (err) console.error("Failed to delete temporary file:", err);
          });
          // Send user audio recording to OpenAI Whisper API for transcription
          const transcribedText = await transcribeUserRecording(mp3FilePath);
          // Call OpenAI Vision API with transcribed text
          if (transcribedText) {
            processInputs(screenshotFilePath, transcribedText);
          }
          // Show error message if the transcrition failled.
          else {
            // Future improvement: refactor this to use general call instead of "push-vision-response-to-windows",
            mainWindow.webContents.send(
              "push-vision-response-to-windows",
              "There was an error transcribing your recording"
            );

            updateNotificationWindowText(
              "There was an error transcribing your recording"
            );
          }
        })
        .save(mp3FilePath);
    } catch (error) {
      console.log(error);
    }
  });
});

// Function to push new text to the notification window
function updateNotificationWindowText(textToDisplay) {
  // If the window has been closed by the user, create a new one
  if (!notificationWindow) {
    createNotificationWindow();
  }
  notificationWindow.webContents.send(
    "update-notificationWindow-text",
    textToDisplay
  );
}

// Function to send user inputs to OpenAI Vision API and display/play response
async function processInputs(screenshotFilePath, questionInput) {
  let visionApiResponse = await callVisionAPI(
    screenshotFilePath,
    questionInput
  );

  // If the Vision API response failed it will be null, set error message
  visionApiResponse =
    visionApiResponse ?? "There was an error calling the OpenAI Vision API";

  // Update both windows with the response text (refactor this)
  mainWindow.webContents.send(
    "push-vision-response-to-windows",
    visionApiResponse
  );
  updateNotificationWindowText(visionApiResponse);

  // Call function to generate and playback audio of the Vision API response
  await playVisionApiResponse(visionApiResponse);
}

// Capture a screenshot of the selected window, and save it to disk
async function captureWindow(windowName) {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  // Not been able to use window IDs successfully, so have to rely on names
  const selectedSource = sources.find((source) => source.name === windowName);

  if (!selectedSource) {
    console.error("Window not found:", windowName);
    return "Window not found";
  }

  // Capture and save the thumbnail of the window
  const screenshot = selectedSource.thumbnail.toPNG();
  fs.writeFile(screenshotFilePath, screenshot, async (err) => {
    if (err) {
      throw err;
    }
  });
  return "Window found";
}

// Function to send audio file of user recording and return a transcription
async function transcribeUserRecording(mp3FilePath) {
  try {
    const form = new FormData();

    form.append("file", fs.createReadStream(mp3FilePath));
    form.append("model", "whisper-1");
    form.append("response_format", "text");
    // form.append("prompt", "add", "words", "it", "usually", "gets", "wrong"); // Append correction words if needed
    response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${openAiApiKey}`,
        },
      }
    );

    // Adding user's question to windows to give sense of progress
    updateNotificationWindowText(response.data);
    mainWindow.webContents.send("push-question-to-windows", response.data);

    return response.data;
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return false;
  }
}

// Function to call the Vision API with the screenshot and transcription of the user question
async function callVisionAPI(inputScreenshot, audioInput) {
  const base64Image = fs.readFileSync(inputScreenshot).toString("base64");
  const dataUrl = `data:image/png;base64,${base64Image}`;
  const userMessage = {
    role: "user",
    content: [
      { type: "text", text: audioInput },
      {
        type: "image_url",
        image_url: {
          url: dataUrl,
        },
        // OPTION TO RESIZE
        //   {
        //     image: base64Image,
        //     resize: 1024, // Can be changed, smaller = less quality
        //   },
      },
    ],
  };

  conversationHistory.push(userMessage);

  try {
    const response = await openai.chat.completions.create({
      max_tokens: 850,
      model: "gpt-4-vision-preview",
      messages: conversationHistory,
    });

    const responseContent = response.choices[0].message.content;

    conversationHistory.push({
      role: "assistant",
      content: responseContent,
    });

    return responseContent;
  } catch (error) {
    console.log(error);
    // return null to show error message to user
    return null;
  }
}

// Function that takes text input, calls TTS API, and plays back the response audio
async function playVisionApiResponse(inputText) {
  const url = "https://api.openai.com/v1/audio/speech";
  const voice = "echo"; // you can change voice if you want
  const model = "tts-1";
  const headers = {
    Authorization: `Bearer ${openAiApiKey}`, // API key for authentication
  };

  const data = {
    model: model,
    input: inputText,
    voice: voice,
    response_format: "mp3",
  };

  try {
    const response = await axios.post(url, data, {
      headers: headers,
      responseType: "stream",
    });

    // Save the response stream to a file
    const writer = fs.createWriteStream(audioFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    }).then(() => {
      // Play the audio file using a system command
      let playCommand;
      switch (process.platform) {
        case "darwin": // macOS
          playCommand = `afplay "${audioFilePath}"`;
          break;
        case "win32": // Windows
          playCommand = `start "${audioFilePath}"`;
          break;
        case "linux": // Linux (requires aplay or mpg123 or similar to be installed)
          playCommand = `aplay "${audioFilePath}"`; // or mpg123, etc.
          break;
        default:
          console.error("Unsupported platform for audio playback");
          return;
      }

      exec(playCommand, (error) => {
        if (error) {
          console.error("Failed to play audio:", error);
        } else {
        }
      });
    });
  } catch (error) {
    if (error.response) {
      console.error(
        `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error(`Error in streamedAudio: ${error.message}`);
    }
  }
}

// Run when Electron app is ready
app.whenReady().then(() => {
  createMainWindow();
  createNotificationWindow();

  // Request microphone access
  systemPreferences
    .askForMediaAccess("microphone")
    .then((accessGranted) => {
      if (accessGranted) {
        console.log("Microphone access granted");
      } else {
        console.log("Microphone access denied");
      }
    })
    .catch((err) => {
      console.error("Error requesting microphone access:", err);
    });

  // This call initializes MediaRecorder with an 1ms audio recording, to get around an issue seen on some machines where the first user-triggered recording doesn't work.
  mainWindow.webContents.send("init-mediaRecorder");

  // If defined keyboard shortcut is triggered then run
  globalShortcut.register(keyboardShortcut, async () => {
    // If the microphone recording isn't already running
    if (!isRecording) {
      let activeWindow;
      try {
        activeWindow = await activeWin();
        captureWindowStatus = await captureWindow(activeWindow.title);
        if (!notificationWindow) {
          createNotificationWindow();
        }
        repositionWindow(activeWindow, "notificationWindow");
        // If captureWindow() can't find the selected window, show an error and exit the process
        if (captureWindowStatus != "Window found") {
          const responseMessage = "Unable to capture this window, try another.";
          mainWindow.webContents.send(
            "add-window-name-to-app",
            responseMessage
          );
          updateNotificationWindowText(responseMessage);
          return;
        }

        // If window is found, continue as expected
        const responseMessage = `${activeWindow.owner.name}: ${activeWindow.title}`;
        mainWindow.webContents.send("add-window-name-to-app", responseMessage);
        updateNotificationWindowText(responseMessage);
      } catch (error) {
        console.error("Error capturing the active window:", error);
      }
      // only start recording if the user is using voice input
      if (inputMethod == "voice") {
        mainWindow.webContents.send("start-recording");
        notificationWindow.webContents.send("start-recording");
        isRecording = true;
      }
      // If voice isn't used as input, trigger the text-based input
      else {
        if (!textInputWindow) {
          createTextInputWindow();
        }
        repositionWindow(activeWindow, "textInputWindow");
      }
    } else {
      // If we're already recording, the keyboard shortcut means we should stop
      mainWindow.webContents.send("stop-recording");
      notificationWindow.webContents.send("stop-recording");
      isRecording = false;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister all shortcuts when the application is about to quit
  globalShortcut.unregisterAll();
});

// Close and nullify the notification window if it's closed by the user
ipcMain.on("close-notification-window", () => {
  if (notificationWindow) {
    notificationWindow.close();
    notificationWindow = null;
  }
});

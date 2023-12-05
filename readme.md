# macOSpilot: your personal macOS AI assistant

macOSpilot answers your questions about anything, in any application. No need to reach for another window. Simply use a keyboard shortcut to trigger the assistant, speak your question, and it will give the answer in context and in audio within seconds. Behind the scenes macOSpilot takes a screenshot of your active window when triggerd, and sends it to OpenAI GPT Vision along with a transcript of your question. It's answer will be displayed in text, and converted into audio using OpenAI TTS (text to speech).

- **Works with any application in macOS:** macOSpilot is application agnostic, and simply takes a screenshot of the currently active window when you trigger the assistant.
- **Trigger with keyboard shortcut, speak your question:** No need to juggle windows, just press the keyboard shortcut and speak your question.
- **Answers in-context and in audio:** The answer to your question is provided in an small window overlayed on top of your active window, and in audio (using text-to-speech).

## How it works

1. macOSpilot runs NodeJS/Electron. Simply install the NodeJS project and dependencies (see below) and make the necessary configurations in `index.js`. Then chose to run `yarn start` from the terminal, or package it with Electron with the instructions below, add your OpenAI API key and let the application run in the background.
2. When you need to use macOSpilot, press the keyboard shortcut you've configured. macOSpilot will take a screenshot of your currently active macOS application window and activate the microphone.
3. Speak your question into your microphone and then press the same keyboard shortcut to end the microphone recording.
4. macOSpilot will send your question to OpenAI's Whisper API, and the transcription will be sent to OpenAI's Vision API along with the screenshot.
5. The Vision API response will be displayed in a small notification window on top of your active macOS application window, and read outloud once it's been processed by OpenAI's TTS (text to speech) API.
6. A simple history of answers to your questions in the current session is available in another window that you can hide/minimize.

The most recent screenshot, audio recording, and TTS response will be stored on your machine in part for debugging purposes. The same filename is used every time so they will be overwritten, but are not automatically deleted when you close or delete the application.

## Getting Started

Download or clone the repo to your local machine. Make sure you have NodeJS installed. run `yarn install`

### Install

```bash

git  clone  https://github.com/elfvingralf/macOSpilot-ai-assistant.git

```

Navigate to the folder and run `yarn install` or `npm install` in your folder. This should install all dependencies.

Run `yarn start` or `npm start`. Because the application needs access to read your screen, microphone, read/write files etc, you will need to go through the steps of granting it access and possibly restarting your terminal.

### Configurations

Make sure to add your OpenAI API key by clicking the settings icon in the top right-hand corner of the main window. (it's not stored encrypted!)

If you want to change the default values here's a few things that might be worth changing, all in `index.js`:

- **Keyboard shortcut:** The default keyboard shortcut `keyboardShortcut` is set to "CommandOrControl+Shift+'" (because it seemed like it was rarely used by other applications)

- **OpenAI Vision prompt:** The OpenAI Vision API system prompt in `conversationHistory`, currently just set to "You are helping users with questions about their macOS applications based on screenshots, always answer in at most one sentence."

- **VisionAPI image size:** Image resize params to save some money, I left an example of how in `callVisionAPI()` (I found that I had much poorer results when using it)

- **Application window sizes and settings:** The size of the main window: `mainWindowWidth` and `mainWindowHeight`. The size of the notification window, which always remains on top: `notificationWidth` and `notificationHeight`.

- **More notification window settings:** The level of opacity of the notification window: `notificationOpacity`. Where the notification window moves to on activation, relative to the active window: inside `positionNotificationAtTopRight()` (terrible naming, I know)

### Turn it into an .app with Electron

If you want to create an .app executable instead of running this from your terminal, follow these steps:

```bash
npm  install  electron-packager  --save-dev
```

Add these to your package.json:

```
"scripts": {
"package-win": "electron-packager . --overwrite --asar=true --platform=win32 --arch=x64 --icon=assets/icons/win/icon.ico --prune=true --out=release-builds",
"package-mac": "electron-packager . --overwrite --platform=darwin --arch=x64 --icon=assets/icons/mac/icon.icns --prune=true --out=release-builds",
"package-linux": "electron-packager . --overwrite --platform=linux --arch=x64 --icon=assets/icons/png/1024x1024.png --prune=true --out=release-builds"
}
```

Run one of these depending on which platform you're on. Note I have only tested this on Mac (Apple silicon and Intel):

```bash
npm  run  package-mac
npm  run  package-win
npm  run  package-linux
```

Go to `/release-builds/` and chose the folder of your platform. In there is an executable, `.app` if you're on Mac. Double-click it to open the app, note that it may take a few seconds the first time so be patient.

Once the app is opened, trigger your keyboard shortcut. You'll be asked to grant Privacy & Security permissions. You may need to repeat this another one or two times for all permissions to work properly.

**NOTE:** I've had consistent issues getting macOS to trigger the Privacy & Security Microphone dialog window for the .app, which means that I can't ask my question. If it works for you, or if you have a work-around to this issue, I'd love to know.

## Improvements:

Some improvements I'd like to make, in no particular order:

- Enable optional conversation state inbetween questions, and history inbetween sessions.
- Use buffers instead of writing/reading screenshot and audio files to disk
- Make assistant audio configurable in UI (e.g. speed, make playback optional)
- Make always-on-top window configurable in UI (e.g. toggle sticky position, enable/disable)
- Make screenshot settings configurable in UI (e.g. select area, entire screen)

## About / contact

I'm a self-taught and really like scrapping together fun projects. I write functional code that probably isn't beautiful nor efficient, and share it with the hope that someone else might find it useful.

You can find me as [@ralfelfving](https://twitter.com/ralfelfving) on Twitter/X. If you liked this project, consider checking my tutorials on my YouTube channel [@ralfelfving](https://www.youtube.com/@ralfelfving).

# cOSXpilot: your personal OSX AI assistant

cOSXpilot uses AI to answer your questions about anything in any application, without you having to reach for another window. Simply use a keyboard shortcut to trigger a screenshot of the active window in OSX, speak your question, and get the answer from GPT Vision in context and in audio within seconds.

- **Works with any application in OSX:** cOSXpilot is application agnostic, and simply takes a screenshot of the currently active window.
- **Trigger with keyboard shortcut, speak your question:** No need to juggle windows, just trigger the recording function with a keyboard shortcut and speak your question.
- **Answers in-context and in audio:** The answer to your question is provided in an small window overlayed on top of your active window, and in audio (using text-to-speech).

## How it works

1. cOSXpilot runs NodeJS/Electron. Simply install the NodeJS project and dependencies (see below), run `yarn start`, make the necessary configurations, and let the application run in the background.
2. When you need to use cOSXpilot, press the keyboard shortcut you've configured. cOSXpilot will take a screenshot of your currently active OSX application window and activate the microphone.
3. Speak your question into your microphone and then press the same keyboard shortcut to end the microphone recording.
4. cOSXpilot will send your question to OpenAI's Whisper API. The transcription will be sent to OpenAI's Vision API along with the screenshot.
5. The Vision API response will be displayed in a small notification window on top of your active OSX application window, and read outloud once it's been processed by OpenAI's TTS (text to speech) API.
6. A simply history of answers to your questions in the current session is available in another window that you can hide/minimize.
7. See instructions below if you want to turn it into a `.app` to run it without the terminal.

The most recent screenshot, audio recording, and TTS response will be stored on your machine for debugging purposes. The same filename is used every time so they will be overwritten, but are not automatically deleted when you close the application.

## Getting Started

Download or clone the repo to your local machine. Make sure you have NodeJS installed. run `yarn install`

### Install

```bash

git  clone  https://github.com/elfvingralf/cosxpilot-ai-assistant.git

```

Navigate to the folder and run `yarn install` or `npm install` in your folder. This should install all dependencies.

Create a `.env` file in the root directory of this project, add your OpenAI API key, and save.

```???

#.env file

OPENAI_API_KEY="your openai API key"

```

Run `yarn start` or `npm start`. Because the application needs access to read your screen, microphone, read/write files etc, you will need to go through the steps of granting it access and possibly restarting your terminal.

### Configurations

If you want to change the default values here's a few things that might be worth changing, all in `index.js`:

- **Keyboard shortcut:** The default keyboard shortcut `keyboardShortcut` is set to "CommandOrControl+Shift+'" (because it seemed like it was rarely used by other applications)

- **OpenAI Vision prompt:** The OpenAI Vision API system prompt in `conversationHistory`, currently just set to "You are helping users with questions about their OSX applications based on screenshots, always answer in at most one sentence."

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

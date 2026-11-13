# A Little World for Poonam ♡

A romantic, responsive, seven-screen presentation made with HTML, CSS, and vanilla JavaScript. Each section is its own full-screen page; navigation is always manual.

## Run it in VS Code

1. Open the `POONAM` folder in Visual Studio Code.
2. Install the **Live Server** extension by Ritwick Dey if it is not already installed.
3. Open `index.html`, then select **Go Live** in the VS Code status bar (or right-click the file and choose **Open with Live Server**).
4. The site opens in your browser. Internet access is needed for Google Fonts and the sample Unsplash photos.

You can also open `index.html` directly in a modern browser, but Live Server provides the most consistent local-development experience.

## Navigation and controls

- A personal apology message appears on every fresh visit; the welcome page stays behind it until **It's Okay** is selected.
- Choose a page from the top menu, or use the **Back** and **Next** controls at the bottom.
- On a keyboard, use the arrow keys to change pages when focus is not on a control. The mouse wheel never changes pages.
- On smaller screens, open the menu with the button beside the title.
- Click a memory photo to enlarge it, open the envelope to read the letter, answer the quiz, choose a mood, and tap the smile and surprise buttons.
- Background music and sound effects are optional, generated in the browser, and only start after you press their controls.
- Motion effects are minimized when your device has reduced motion enabled.

## Personalize it

- Add personal photographs to `assets/images/`, then replace the three image URLs and their matching captions in `index.html` and `js/script.js` with your own photos and words.
- Edit the letter directly in `index.html`.
- Edit the `quizQuestions`, `compliments`, and `moodMessages` data in `js/script.js`.
- Adjust colors, typography, and layouts in `css/style.css`.
- `assets/music/` and `assets/icons/` are available for optional local media; the included music and decorative icons are generated without extra files or libraries.

The site does not use a backend or send form data anywhere. The font and sample image assets are loaded from their respective external providers.

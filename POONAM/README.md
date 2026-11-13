# A Little World for Poonam ♡

A romantic, responsive eight-page presentation made with HTML, CSS, and vanilla JavaScript. The original seven pages and animations remain, and the site opens directly on its welcome page. The eighth page adds private, two-person audio/video calls using WebRTC and a Node.js/Socket.IO signaling server.

## Run the website and calling server

1. Install Node.js 18 or newer.
2. In a terminal, open the `backend` folder and run `npm install`.
3. Run `npm start` from that folder.
4. Open `http://localhost:3000`.

The Express server serves the existing website and Socket.IO signaling endpoint together. Opening the HTML file directly or using Live Server alone still shows the website, but private calling requires the Node.js server.

## Private calls

- Create a room and share its 32-character ID, or enter an ID to join.
- Rooms are held in memory, allow at most two participants, and expire after two hours. They are removed when both participants leave.
- Unanswered calls ring for up to 45 seconds.
- Select audio or video before starting. The browser asks for media permissions when a call starts or is answered.
- Calls use WebRTC peer-to-peer media. The signaling server relays room and connection setup messages only; it does not record or persist calls.
- Camera and microphone access requires HTTPS in production (localhost is permitted for development). Serve the site and signaling server behind an HTTPS reverse proxy before sharing it publicly.
- The default STUN server assists NAT discovery. Some networks require a TURN relay. Set `TURN_URLS` (comma-separated), `TURN_USERNAME`, and `TURN_CREDENTIAL` in the server environment to enable TURN. TURN credentials are sent to browsers; use short-lived credentials from your TURN provider for production.

## Test and validate

Run `npm test` and `npm run check` from `backend` to verify room limits, room-ID validation, signaling membership, and disconnect notifications.

Automated signaling tests do not verify camera/microphone access, media quality, or cross-network connectivity. Those require two real devices, HTTPS, and a configured TURN service where direct connections are blocked; they have not been claimed as tested here.

## Navigation and personalizing

- Choose a page from the top menu, or use the Back and Next controls. On a keyboard, use the arrow keys when focus is not on a control.
- On smaller screens, open the menu with the button beside the title.
- Click a memory photo to enlarge it, open the envelope to read the letter, answer the quiz, choose a mood, and tap the smile and surprise buttons.
- Background music and sound effects are optional, generated in the browser, and only start after you press their controls.
- Add personal photographs to `assets/images/`, then update the image markup and captions. Edit the letter in `index.html`, quiz and compliment data in `js/script.js`, and colors, typography, and layouts in `css/style.css`.
- Motion effects are minimized when your device has reduced motion enabled.

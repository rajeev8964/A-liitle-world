(() => {
  "use strict";

  const pages = Array.from(document.querySelectorAll(".page"));
  const pageButtons = Array.from(document.querySelectorAll(".page-menu [data-page]"));
  const currentPageNumber = document.getElementById("currentPageNumber");
  const previousPage = document.getElementById("previousPage");
  const nextPage = document.getElementById("nextPage");
  const menuToggle = document.getElementById("menuToggle");
  const pageMenu = document.getElementById("pageMenu");
  const effectsToggle = document.getElementById("effectsToggle");
  const sorryModal = document.getElementById("sorryModal");
  const sorryHeart = document.getElementById("sorryHeart");
  const sorryBurst = document.getElementById("sorryBurst");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let currentPage = 0;
  let isTransitioning = false;
  let effectsEnabled = true;
  let audioContext;
  let musicTimer;
  let lastCompliment = -1;

  const celebrateSorry = () => {
    sorryHeart.classList.remove("is-beating");
    window.requestAnimationFrame(() => sorryHeart.classList.add("is-beating"));
    if (reducedMotion.matches) return;
    for (let index = 0; index < 12; index += 1) {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * index) / 12;
      const distance = 55 + Math.random() * 75;
      particle.textContent = index % 3 === 0 ? "✦" : "♥";
      particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--rotate", `${Math.random() * 50 - 25}deg`);
      particle.style.setProperty("--size", `${12 + Math.random() * 9}px`);
      sorryBurst.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1200);
    }
  };
  sorryModal.addEventListener("cancel", (event) => event.preventDefault());
  document.getElementById("sorryAgain").addEventListener("click", celebrateSorry);
  document.getElementById("sorryAccept").addEventListener("click", (event) => {
    const acceptButton = event.currentTarget;
    const againButton = document.getElementById("sorryAgain");
    document.getElementById("sorryThanks").hidden = false;
    acceptButton.disabled = true;
    againButton.disabled = true;
    celebrateSorry();
    window.setTimeout(() => {
      sorryModal.classList.add("is-closing");
      window.setTimeout(() => {
        sorryModal.close();
        sorryModal.classList.remove("is-closing");
        document.querySelector(".page-home [data-go='1']").focus();
      }, reducedMotion.matches ? 10 : 380);
    }, 2000);
  });
  sorryModal.showModal();
  document.getElementById("sorryAccept").focus();

  const playEffect = (frequency = 660, duration = 0.12) => {
    if (!effectsEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ||= new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.02);
    } catch (error) {
      console.warn("Sound effects could not be played.", error);
    }
  };

  const updateNavigation = () => {
    currentPageNumber.textContent = String(currentPage + 1).padStart(2, "0");
    previousPage.disabled = currentPage === 0;
    nextPage.disabled = currentPage === pages.length - 1;
    document.getElementById("backToTop").classList.toggle("is-visible", currentPage > 0);
    pageButtons.forEach((button) => {
      const selected = Number(button.dataset.page) === currentPage;
      button.classList.toggle("is-current", selected);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  };

  const goToPage = (pageIndex) => {
    const targetIndex = Number(pageIndex);
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= pages.length || targetIndex === currentPage || isTransitioning) return;
    const previous = pages[currentPage];
    const next = pages[targetIndex];
    isTransitioning = true;
    previous.classList.add("is-leaving");
    next.classList.add("active");
    next.setAttribute("aria-hidden", "false");
    previous.setAttribute("aria-hidden", "true");
    currentPage = targetIndex;
    updateNavigation();
    closeMenu();
    playEffect(520, 0.1);
    window.setTimeout(() => {
      previous.classList.remove("active", "is-leaving");
      isTransitioning = false;
    }, reducedMotion.matches ? 10 : 520);
  };

  function closeMenu() {
    pageMenu.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open page menu");
  }

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => goToPage(button.dataset.go));
  });
  pageButtons.forEach((button) => button.addEventListener("click", () => goToPage(button.dataset.page)));
  previousPage.addEventListener("click", () => goToPage(currentPage - 1));
  nextPage.addEventListener("click", () => goToPage(currentPage + 1));
  document.getElementById("brandHome").addEventListener("click", (event) => {
    event.preventDefault();
    goToPage(0);
  });
  document.getElementById("backToTop").addEventListener("click", () => goToPage(0));
  menuToggle.addEventListener("click", () => {
    const isOpen = pageMenu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close page menu" : "Open page menu");
  });

  window.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isInteracting = target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true']"));
    if (event.key === "Escape") {
      closeMenu();
      closeLightbox();
      closeLetter();
      return;
    }
    if (isInteracting || isTransitioning || document.getElementById("lightbox").classList.contains("is-open")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      goToPage(currentPage + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      goToPage(currentPage - 1);
    }
  });
  document.getElementById("stage").addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.getElementById("effectsToggle").addEventListener("click", () => {
    effectsEnabled = !effectsEnabled;
    effectsToggle.classList.toggle("is-on", effectsEnabled);
    effectsToggle.setAttribute("aria-label", effectsEnabled ? "Mute sound effects" : "Enable sound effects");
    effectsToggle.title = effectsEnabled ? "Sound effects on" : "Sound effects muted";
    if (effectsEnabled) playEffect(760);
  });

  const musicToggle = document.getElementById("musicToggle");
  const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
  let melodyIndex = 0;
  const playNote = () => {
    if (!audioContext || audioContext.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = melody[melodyIndex % melody.length];
    melodyIndex += 1;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.022, audioContext.currentTime + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.7);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1.75);
  };
  musicToggle.addEventListener("click", async () => {
    try {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
        musicToggle.classList.remove("is-playing");
        musicToggle.setAttribute("aria-label", "Play background music");
        musicToggle.title = "Play gentle music";
        return;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");
      audioContext ||= new AudioContextClass();
      await audioContext.resume();
      playNote();
      musicTimer = window.setInterval(playNote, 1450);
      musicToggle.classList.add("is-playing");
      musicToggle.setAttribute("aria-label", "Pause background music");
      musicToggle.title = "Pause gentle music";
    } catch (error) {
      console.error("Background music could not be started.", error);
      musicToggle.setAttribute("aria-label", "Music unavailable");
      musicToggle.title = "Music could not be started in this browser";
    }
  });

  const heartField = document.getElementById("heartField");
  const createFloatingHeart = () => {
    if (reducedMotion.matches || document.hidden) return;
    const heart = document.createElement("span");
    heart.className = "floating-heart";
    heart.textContent = Math.random() > 0.5 ? "♡" : "♥";
    heart.style.left = `${Math.random() * 96}%`;
    heart.style.fontSize = `${10 + Math.random() * 14}px`;
    heart.style.setProperty("--duration", `${7 + Math.random() * 5}s`);
    heartField.appendChild(heart);
    window.setTimeout(() => heart.remove(), 12500);
  };
  window.setInterval(createFloatingHeart, 1250);

  const memoryItems = [
    { caption: "golden hour kind of day ♡", alt: "Golden light over a quiet field" },
    { caption: "little joys, big smiles ✦", alt: "A peaceful mountain lake" },
    { caption: "somewhere beautiful ♡", alt: "Dreamy pink evening sky" }
  ];
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const openLightbox = (index) => {
    const image = document.querySelectorAll(".polaroid img")[index];
    const memory = memoryItems[index];
    if (!image || !memory) return;
    lightboxImage.src = image.src;
    lightboxImage.alt = memory.alt;
    lightboxCaption.textContent = memory.caption;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.getElementById("lightboxClose").focus();
    playEffect(740);
  };
  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
  }
  document.querySelectorAll(".polaroid").forEach((photo) => photo.addEventListener("click", () => openLightbox(Number(photo.dataset.photo))));
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.querySelectorAll(".constellation-star").forEach((star) => {
    star.addEventListener("click", () => {
      star.classList.toggle("is-wished");
      playEffect(880, 0.2);
    });
  });

  const envelope = document.getElementById("envelope");
  const letterPaper = document.getElementById("letterPaper");
  envelope.addEventListener("click", () => {
    const isOpen = envelope.classList.toggle("is-open");
    envelope.setAttribute("aria-expanded", String(isOpen));
    letterPaper.classList.toggle("is-open", isOpen);
    letterPaper.setAttribute("aria-hidden", String(!isOpen));
    envelope.setAttribute("aria-label", isOpen ? "Close your letter" : "Open your letter");
    playEffect(isOpen ? 580 : 440);
  });
  function closeLetter() {
    if (!envelope.classList.contains("is-open")) return;
    envelope.classList.remove("is-open");
    envelope.setAttribute("aria-expanded", "false");
    envelope.setAttribute("aria-label", "Open your letter");
    letterPaper.classList.remove("is-open");
    letterPaper.setAttribute("aria-hidden", "true");
  }
  document.getElementById("letterClose").addEventListener("click", closeLetter);
  document.getElementById("letterSurprise").addEventListener("click", (event) => {
    const secret = document.getElementById("letterSecret");
    secret.hidden = !secret.hidden;
    event.currentTarget.textContent = secret.hidden ? "P.S. there's one more thing ✦" : "A little note to keep ♡";
    playEffect(730);
  });

  const quizQuestions = [
    { question: "What's the nicest kind of day?", options: ["A slow, cozy one", "A little adventure", "A day full of laughs", "All of the above"], answer: 3, right: "Exactly! A little bit of everything sounds lovely. ✨", wrong: "A good guess! But there are so many ways to make a day lovely. ♡" },
    { question: "What does this little website want you to remember?", options: ["You're appreciated", "You should smile more", "You owe someone a coffee", "Nothing at all"], answer: 0, right: "You got it. You're appreciated, exactly as you are. 💗", wrong: "Not quite—the most important thing is that you're appreciated. 💗" },
    { question: "Pick the perfect little treat for a happy moment.", options: ["A favorite song", "Something sweet", "A pretty sunset", "Any of these"], answer: 3, right: "Yes! The little things are the best things. 🌸", wrong: "All lovely choices—but why choose just one? 🌸" },
    { question: "If you could visit anywhere for a day, what would you pick?", options: ["A quiet garden", "A dreamy seaside", "Somewhere new", "Somewhere that feels like home"], answer: 2, right: "A little adventure! There's always somewhere beautiful to discover. 🦋", wrong: "That's a sweet choice. A new place can hold a lovely surprise. 🦋" },
    { question: "One last question: who deserves a little extra happiness?", options: ["Poonam", "Also Poonam", "Definitely Poonam", "All answers are correct"], answer: 3, right: "Correct! This whole little world is proof. 💝", wrong: "Trick question—every answer should be Poonam! 💝" }
  ];
  let quizIndex = 0;
  let quizScore = 0;
  const quizQuestionArea = document.getElementById("quizQuestionArea");
  const quizFeedback = document.getElementById("quizFeedback");
  const quizNext = document.getElementById("quizNext");
  const renderQuestion = () => {
    const question = quizQuestions[quizIndex];
    document.getElementById("quizCount").textContent = `QUESTION ${String(quizIndex + 1).padStart(2, "0")} / ${String(quizQuestions.length).padStart(2, "0")}`;
    document.getElementById("quizScore").textContent = String(quizScore);
    document.getElementById("quizProgress").style.width = `${((quizIndex + 1) / quizQuestions.length) * 100}%`;
    quizFeedback.textContent = "";
    quizNext.hidden = true;
    quizQuestionArea.innerHTML = `<h3 class="quiz-question">${question.question}</h3><div class="quiz-options" role="group" aria-label="Answer choices">${question.options.map((option, index) => `<button class="quiz-option" type="button" data-answer="${index}">${option}</button>`).join("")}</div>`;
    quizQuestionArea.querySelectorAll(".quiz-option").forEach((button) => {
      button.addEventListener("click", () => chooseAnswer(Number(button.dataset.answer)));
    });
  };
  const celebrateQuiz = () => {
    const confetti = document.getElementById("quizConfetti");
    for (let index = 0; index < 18; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.textContent = index % 2 ? "✦" : "♡";
      piece.style.setProperty("--x", `${Math.random() * 440 - 220}px`);
      piece.style.setProperty("--y", `${Math.random() * -240 - 30}px`);
      confetti.appendChild(piece);
      window.setTimeout(() => piece.remove(), 1400);
    }
  };
  const chooseAnswer = (answerIndex) => {
    const question = quizQuestions[quizIndex];
    const options = Array.from(quizQuestionArea.querySelectorAll(".quiz-option"));
    options.forEach((button) => {
      button.disabled = true;
      if (Number(button.dataset.answer) === question.answer) button.classList.add("is-correct");
      else if (Number(button.dataset.answer) === answerIndex) button.classList.add("is-wrong");
    });
    const isCorrect = answerIndex === question.answer;
    if (isCorrect) quizScore += 1;
    document.getElementById("quizScore").textContent = String(quizScore);
    quizFeedback.textContent = isCorrect ? question.right : question.wrong;
    quizNext.hidden = false;
    quizNext.innerHTML = quizIndex === quizQuestions.length - 1 ? "See your result <span>♡</span>" : "Next question <span>→</span>";
    playEffect(isCorrect ? 790 : 310, 0.18);
  };
  const showQuizResult = () => {
    const message = quizScore >= 4 ? "A perfect little heart!" : quizScore >= 2 ? "You did wonderfully!" : "The best part was playing!";
    quizQuestionArea.innerHTML = `<div class="quiz-result"><div class="result-emoji">${quizScore >= 4 ? "🌟" : quizScore >= 2 ? "🌷" : "💗"}</div><h3>${message}</h3><p>You got ${quizScore} out of ${quizQuestions.length}. No matter the score, you're still the star of this little world.</p><button class="text-button" id="quizRestart" type="button">Play again <span>↻</span></button></div>`;
    quizFeedback.textContent = "Surprise: you're already pretty wonderful.";
    quizNext.hidden = true;
    document.getElementById("quizRestart").addEventListener("click", () => {
      quizIndex = 0;
      quizScore = 0;
      renderQuestion();
    });
    celebrateQuiz();
  };
  quizNext.addEventListener("click", () => {
    if (quizIndex === quizQuestions.length - 1) {
      showQuizResult();
    } else {
      quizIndex += 1;
      renderQuestion();
    }
  });
  renderQuestion();

  const compliments = [
    "You make the world a little brighter.",
    "Your smile is genuinely special.",
    "Never forget how amazing you are.",
    "You deserve all the happiness in the world.",
    "Being yourself is already a lovely thing.",
    "Someone's day is better because you're in it.",
    "You bring your own kind of magic."
  ];
  document.getElementById("smileButton").addEventListener("click", () => {
    let nextIndex = Math.floor(Math.random() * compliments.length);
    if (compliments.length > 1 && nextIndex === lastCompliment) nextIndex = (nextIndex + 1) % compliments.length;
    lastCompliment = nextIndex;
    const compliment = document.getElementById("compliment");
    compliment.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300 });
    compliment.textContent = compliments[nextIndex];
    playEffect(690);
  });
  const moodMessages = {
    sunny: "Keep glowing, little sunshine. ☀️",
    good: "That lovely energy looks good on you. ♡",
    okay: "Steady is a beautiful place to be. 🌿",
    cloudy: "Cloudy skies pass. Be gentle with yourself. 🌧️",
    tired: "Rest is productive, too. Take your time. 🌙"
  };
  document.querySelectorAll("[data-mood]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-mood]").forEach((moodButton) => moodButton.classList.remove("is-selected"));
      button.classList.add("is-selected");
      document.getElementById("moodResponse").textContent = moodMessages[button.dataset.mood];
      playEffect(630, 0.1);
    });
  });

  document.getElementById("surpriseButton").addEventListener("click", (event) => {
    const surprise = document.getElementById("hiddenSurprise");
    const isHidden = surprise.hidden;
    surprise.hidden = !isHidden;
    event.currentTarget.innerHTML = isHidden ? "Keep this little note <span>♡</span>" : "Click for a surprise <span>💝</span>";
    if (isHidden) {
      for (let index = 0; index < 13; index += 1) {
        const heart = document.createElement("span");
        heart.className = "floating-heart";
        heart.textContent = "♥";
        heart.style.left = `${35 + Math.random() * 30}%`;
        heart.style.bottom = "15%";
        heart.style.fontSize = `${13 + Math.random() * 15}px`;
        heart.style.setProperty("--duration", `${2 + Math.random() * 2}s`);
        heartField.appendChild(heart);
        window.setTimeout(() => heart.remove(), 4500);
      }
      playEffect(880, 0.2);
    }
  });

  updateNavigation();
  pages.forEach((page, index) => page.setAttribute("aria-hidden", String(index !== 0)));
  window.addEventListener("load", () => {
    window.setTimeout(() => document.getElementById("loader").classList.add("is-done"), reducedMotion.matches ? 0 : 650);
  });
  if (document.readyState === "complete") {
    window.setTimeout(() => document.getElementById("loader").classList.add("is-done"), reducedMotion.matches ? 0 : 650);
  }
})();

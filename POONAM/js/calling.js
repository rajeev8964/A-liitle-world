(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const statusText = $("#callStatusMessage");
  const connectionStatus = $("#callConnectionStatus");
  const createRoomButton = $("#createRoom");
  const joinRoomButton = $("#joinRoom");
  const startCallButton = $("#startCall");
  const roomIdInput = $("#roomIdInput");
  const shareRoom = $("#shareRoom");
  const roomBadge = $("#roomBadge");
  const incomingCall = $("#incomingCall");
  const controls = $("#callControls");
  const localVideo = $("#localVideo");
  const remoteVideo = $("#remoteVideo");
  const remoteAudio = $("#remoteAudio");
  const remotePlaceholder = $("#remotePlaceholder");
  const remotePresence = $("#remotePresence");
  const localPresence = $("#localPresence");
  const remoteProfilePresence = $("#remoteProfilePresence");
  const roomIdDisplay = $("#roomIdDisplay");
  const callVideoStage = $("#callVideoStage");

  let socket;
  let roomId = null;
  let peerPresent = false;
  let callMode = "audio";
  let localStream = null;
  let peerConnection = null;
  let remoteCandidates = [];
  let callStartedAt = 0;
  let callTimer = null;
  let facingMode = "user";
  let isInCall = false;
  let callPending = false;
  let iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  const setStatus = (message) => {
    statusText.textContent = message;
  };

  const setConnectionStatus = (message) => {
    connectionStatus.textContent = message;
    connectionStatus.parentElement.classList.toggle("is-connected", message.startsWith("Connected"));
  };

  const emit = (event, payload) => new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error("The signaling server is disconnected. Please try again."));
      return;
    }
    const callback = (error, response) => {
      if (error) {
        reject(new Error("The signaling server did not respond. Please try again."));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(messageForCode(response && response.code)));
        return;
      }
      resolve(response);
    };
    if (payload === undefined) socket.timeout(8000).emit(event, callback);
    else socket.timeout(8000).emit(event, payload, callback);
  });

  const messageForCode = (code) => ({
    ROOM_NOT_FOUND: "That room ID is invalid or has expired.",
    ROOM_FULL: "This private room already has two people.",
    ALREADY_IN_ROOM: "Leave your current room before joining another.",
    PEER_NOT_PRESENT: "Wait for the other person to join before calling.",
    INVALID_MODE: "Choose audio or video before starting the call.",
    CALL_IN_PROGRESS: "A call is already in progress in this room.",
    NO_INCOMING_CALL: "There is no incoming call to answer.",
    NO_ACTIVE_CALL: "There is no call to end.",
    INVALID_CALLER: "The call could not be established. Please try again.",
    CALL_NOT_ACTIVE: "The call is no longer active."
  }[code] || "Something went wrong. Please try again.");

  const setRoomState = (id, hasPeer) => {
    roomId = id;
    peerPresent = hasPeer;
    createRoomButton.hidden = Boolean(id);
    joinRoomButton.hidden = Boolean(id);
    roomIdInput.hidden = Boolean(id);
    shareRoom.hidden = !id;
    roomBadge.hidden = !id;
    roomIdDisplay.textContent = id || "";
    $("#roomBadgeId").textContent = id || "";
    $("#leaveRoom").hidden = !id;
    startCallButton.disabled = !id || !hasPeer || isInCall || callPending;
    $("#remoteProfile").classList.toggle("is-online", hasPeer);
    $("#remotePresenceDot").classList.toggle("is-online", hasPeer);
    remoteProfilePresence.textContent = hasPeer ? "Online" : "Offline";
    remotePresence.textContent = hasPeer
      ? "Here with you"
      : id ? "Waiting for someone to join" : "Create or join a private room";
    $("#remoteName").textContent = hasPeer ? "Your person is here" : "Your person";
    setConnectionStatus(hasPeer ? "Room connected" : id ? "Waiting for them" : "Not connected");
  };

  const updateModeButton = () => {
    const videoMode = callMode === "video";
    const modeButton = $("#toggleCallMode");
    modeButton.querySelector("small").textContent = videoMode ? "Audio" : "Video";
    modeButton.setAttribute("aria-label", videoMode ? "Switch to audio call" : "Switch to video call");
    modeButton.title = videoMode ? "Switch to audio call" : "Switch to video call";
    const modePicker = $("#chooseCallMode");
    modePicker.textContent = videoMode ? "Use audio" : "Use video";
    modePicker.setAttribute("aria-label", videoMode ? "Switch to audio call" : "Switch to video call");
    startCallButton.innerHTML = `${videoMode ? "Start video call" : "Start audio call"} <span>♡</span>`;
  };

  const setCallActive = (active) => {
    isInCall = active;
    controls.hidden = !active;
    createRoomButton.disabled = active;
    joinRoomButton.disabled = active;
    startCallButton.disabled = active || callPending || !roomId || !peerPresent;
    $("#toggleCallMode").disabled = active;
    $("#chooseCallMode").hidden = active;
    $("#chooseCallMode").disabled = active || callPending;
    if (active) {
      callStartedAt = Date.now();
      updateCallTimer();
      callTimer = window.setInterval(updateCallTimer, 1000);
    } else if (callTimer) {
      window.clearInterval(callTimer);
      callTimer = null;
      setConnectionStatus(peerPresent ? "Room connected" : "Not connected");
    }
  };

  const updateCallTimer = () => {
    if (!callStartedAt) return;
    const seconds = Math.floor((Date.now() - callStartedAt) / 1000);
    const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    setConnectionStatus(`Connected · ${elapsed}`);
  };

  const requestMedia = async (mode) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Audio and video calls require a modern browser on HTTPS (or localhost).");
    }
    if (!window.isSecureContext) {
      throw new Error("For your privacy, camera and microphone access requires HTTPS.");
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video" ? { facingMode: { ideal: facingMode } } : false
      });
    } catch (error) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        throw new Error("Camera or microphone permission was denied. Allow access in your browser and try again.");
      }
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        throw new Error("A required microphone or camera could not be found on this device.");
      }
      if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        throw new Error("Your microphone or camera is busy in another app.");
      }
      throw new Error(`Could not access your microphone or camera: ${error.message}`);
    }
  };

  const showLocalMedia = () => {
    const hasVideo = Boolean(localStream && localStream.getVideoTracks().length);
    localVideo.srcObject = hasVideo ? localStream : null;
    localVideo.hidden = !hasVideo;
    $("#localVideoLabel").hidden = !hasVideo;
    $("#toggleCamera").hidden = !hasVideo;
    $("#switchCamera").hidden = !hasVideo;
    $("#callVideoStage").classList.toggle("has-video", hasVideo || Boolean(remoteVideo.srcObject));
    localPresence.textContent = "Online";
    $("#localProfile").classList.add("is-online");
    updateMicrophoneUI();
  };

  const updateMicrophoneUI = () => {
    const microphone = localStream && localStream.getAudioTracks()[0];
    const muted = !microphone || !microphone.enabled;
    const button = $("#toggleMicrophone");
    button.classList.toggle("is-muted", muted);
    button.setAttribute("aria-pressed", String(muted));
    button.setAttribute("aria-label", muted ? "Unmute microphone" : "Mute microphone");
    button.title = muted ? "Unmute microphone" : "Mute microphone";
    button.querySelector("small").textContent = muted ? "Unmute" : "Mute";
    $("#localMicStatus").setAttribute("aria-label", muted ? "Microphone muted" : "Microphone on");
    $("#localMicStatus").classList.toggle("is-muted", muted);
  };

  const stopMedia = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peerConnection = null;
    }
    remoteCandidates = [];
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    remoteAudio.srcObject = null;
    remoteVideo.hidden = true;
    $("#remoteVideoLabel").hidden = true;
    $("#callVideoStage").classList.remove("has-video");
    $("#remoteMicStatus").classList.remove("is-muted");
    $("#remoteMicStatus").setAttribute("aria-label", "Microphone status");
    localPresence.textContent = "Offline";
    $("#localProfile").classList.remove("is-online");
  };

  const endLocalCall = (message) => {
    callPending = false;
    stopMedia();
    setCallActive(false);
    incomingCall.hidden = true;
    $("#toggleMicrophone").classList.remove("is-muted");
    $("#toggleCamera").classList.remove("is-camera-off");
    $("#toggleCamera").querySelector("small").textContent = "Camera";
    $("#toggleCallMode").disabled = false;
    $("#chooseCallMode").hidden = false;
    $("#chooseCallMode").disabled = false;
    remotePlaceholder.hidden = false;
    remoteVideo.hidden = true;
    setStatus(message);
  };

  const flushRemoteCandidates = async () => {
    if (!peerConnection || !peerConnection.remoteDescription) return;
    const candidates = remoteCandidates;
    remoteCandidates = [];
    for (const candidate of candidates) await peerConnection.addIceCandidate(candidate);
  };

  const createPeerConnection = () => {
    if (peerConnection) return peerConnection;
    peerConnection = new RTCPeerConnection({ iceServers });
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("webrtc:ice-candidate", candidate.toJSON());
    };
    peerConnection.ontrack = ({ streams }) => {
      if (!streams.length) return;
      const stream = streams[0];
      remoteAudio.srcObject = stream;
      remoteVideo.srcObject = stream;
      remoteVideo.muted = true;
      const hasVideo = callMode === "video" && stream.getVideoTracks().length > 0;
      remoteVideo.hidden = !hasVideo;
      remotePlaceholder.hidden = hasVideo;
      $("#remoteVideoLabel").hidden = !hasVideo;
      $("#callVideoStage").classList.toggle("has-video", hasVideo || Boolean(localVideo.srcObject));
      if (hasVideo) remoteVideo.play().catch((error) => console.warn("Remote video playback needs user interaction.", error));
      remoteAudio.play().catch((error) => {
        console.warn("Remote audio playback needs user interaction.", error);
        setStatus("Tap the page once to enable audio playback.");
      });
    };
    peerConnection.onconnectionstatechange = () => {
      if (!peerConnection) return;
      if (peerConnection.connectionState === "connected") {
        setConnectionStatus("Connected · 00:00");
        setStatus("You're together. Enjoy your moment. ♡");
      } else if (peerConnection.connectionState === "failed") {
        setConnectionStatus("Connection failed");
        setStatus("Couldn't connect directly. Configure a TURN server and try again.");
      } else if (peerConnection.connectionState === "disconnected") {
        setConnectionStatus("Reconnecting…");
        setStatus("The connection paused. Waiting for the other person to reconnect.");
      }
    };
    return peerConnection;
  };

  const createAndSendOffer = async () => {
    const connection = createPeerConnection();
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await emit("webrtc:offer", connection.localDescription.toJSON());
  };

  const displayError = (error) => {
    setStatus(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  };

  const initialize = async () => {
    if (!window.io) {
      setConnectionStatus("Calling server unavailable");
      setStatus("Start the Node.js signaling server to enable private calls.");
      createRoomButton.disabled = true;
      joinRoomButton.disabled = true;
      return;
    }
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load WebRTC network settings.");
      const config = await response.json();
      if (Array.isArray(config.iceServers) && config.iceServers.length) iceServers = config.iceServers;
    } catch (error) {
      console.error("Could not load call configuration.", error);
      setStatus("Couldn't load call networking settings. Refresh and try again.");
    }
    socket = window.io({ reconnection: true, reconnectionAttempts: 8, timeout: 8000 });
    socket.on("connect", () => {
      if (!roomId) {
        setConnectionStatus("Ready to connect");
        setStatus("Create a private room or join with a room ID to begin.");
      }
    });
    socket.on("disconnect", () => {
      if (roomId) {
        endLocalCall("The signaling connection was lost. Reconnect and create or join a room again.");
        setRoomState(null, false);
      }
      setConnectionStatus("Signaling disconnected");
    });
    socket.on("connect_error", (error) => {
      setConnectionStatus("Signaling unavailable");
      setStatus(`Couldn't connect to the calling server: ${error.message}`);
    });
    socket.on("room:peer-joined", () => {
      setRoomState(roomId, true);
      setStatus("Your person joined. You can start an audio or video call.");
    });
    socket.on("room:peer-left", () => {
      peerPresent = false;
      if (isInCall || callPending || !incomingCall.hidden) endLocalCall("The other person disconnected.");
      setRoomState(roomId, false);
      setStatus("The other person disconnected. You can wait for them to rejoin.");
    });
    socket.on("call:incoming", ({ mode }) => {
      callMode = mode;
      updateModeButton();
      $("#chooseCallMode").disabled = true;
      $("#incomingCaller").textContent = "Your person";
      incomingCall.hidden = false;
      startCallButton.disabled = true;
      setStatus(`Incoming ${mode} call…`);
      setConnectionStatus("Incoming call");
    });
    socket.on("call:accepted", async () => {
      if (!callPending) return;
      try {
        callPending = false;
        startCallButton.disabled = true;
        setStatus("They answered. Connecting your call…");
        setCallActive(true);
        await createAndSendOffer();
      } catch (error) {
        displayError(error);
        socket.emit("call:end");
        endLocalCall("Couldn't start the call. Please try again.");
      }
    });
    socket.on("call:rejected", () => {
      endLocalCall("The call was declined.");
    });
    socket.on("call:ended", () => {
      endLocalCall("The other person ended the call.");
      setConnectionStatus("Call ended");
    });
    socket.on("webrtc:offer", async (description) => {
      try {
        if (!peerConnection) createPeerConnection();
        await peerConnection.setRemoteDescription(description);
        await flushRemoteCandidates();
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await emit("webrtc:answer", peerConnection.localDescription.toJSON());
      } catch (error) {
        displayError(new Error(`Couldn't answer the call: ${error.message}`));
        socket.emit("call:end");
        endLocalCall("The call couldn't be connected.");
      }
    });
    socket.on("webrtc:answer", async (description) => {
      try {
        if (!peerConnection) throw new Error("The call connection is not ready.");
        await peerConnection.setRemoteDescription(description);
        await flushRemoteCandidates();
      } catch (error) {
        displayError(new Error(`Couldn't connect the call: ${error.message}`));
        socket.emit("call:end");
        endLocalCall("The call couldn't be connected.");
      }
    });
    socket.on("webrtc:ice-candidate", async (candidate) => {
      if (!peerConnection || !peerConnection.remoteDescription) {
        remoteCandidates.push(candidate);
        return;
      }
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Could not add a remote ICE candidate.", error);
        setStatus("A network candidate failed. The connection may need a TURN server.");
      }
    });
  };

  createRoomButton.addEventListener("click", async () => {
    createRoomButton.disabled = true;
    try {
      const result = await emit("room:create");
      setRoomState(result.roomId, false);
      setStatus("Your private room is ready. Share the ID and wait for them to join.");
    } catch (error) {
      displayError(error);
    } finally {
      createRoomButton.disabled = false;
    }
  });

  joinRoomButton.addEventListener("click", async () => {
    const requestedRoomId = roomIdInput.value.trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(requestedRoomId)) {
      setStatus("Enter a valid 12-character room ID.");
      roomIdInput.focus();
      return;
    }
    joinRoomButton.disabled = true;
    try {
      const result = await emit("room:join", { roomId: requestedRoomId });
      setRoomState(result.roomId, Boolean(result.peerId));
      setStatus(result.peerId ? "You joined your person's private room." : "You joined the room. Waiting for the other person.");
    } catch (error) {
      displayError(error);
    } finally {
      joinRoomButton.disabled = false;
    }
  });

  roomIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") joinRoomButton.click();
  });

  $("#copyRoomId").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(roomId || "");
      $("#copyRoomId").textContent = "Copied!";
      window.setTimeout(() => { $("#copyRoomId").textContent = "Copy ID"; }, 1800);
    } catch (error) {
      displayError(new Error("Couldn't copy automatically. Select and copy the room ID instead."));
    }
  });

  $("#leaveRoom").addEventListener("click", async () => {
    try {
      if (isInCall) await emit("call:end");
      await emit("room:leave");
      endLocalCall("You left the room. Create or join a room whenever you're ready.");
      setRoomState(null, false);
    } catch (error) {
      displayError(error);
    }
  });

  $("#toggleCallMode").addEventListener("click", () => {
    callMode = callMode === "audio" ? "video" : "audio";
    updateModeButton();
  });
  $("#chooseCallMode").addEventListener("click", () => {
    callMode = callMode === "audio" ? "video" : "audio";
    updateModeButton();
  });

  startCallButton.addEventListener("click", async () => {
    if (!peerPresent) {
      setStatus("Wait for the other person to join before starting a call.");
      return;
    }
    startCallButton.disabled = true;
    setStatus("Allow camera and microphone access to start your call…");
    try {
      localStream = await requestMedia(callMode);
      showLocalMedia();
      callPending = true;
      $("#toggleCallMode").disabled = true;
      $("#chooseCallMode").disabled = true;
      await emit("call:invite", { mode: callMode });
      if (callPending) controls.hidden = false;
      setStatus(`Calling your person by ${callMode}…`);
      setConnectionStatus("Ringing");
    } catch (error) {
      callPending = false;
      $("#toggleCallMode").disabled = false;
      $("#chooseCallMode").disabled = false;
      controls.hidden = true;
      if (localStream) stopMedia();
      displayError(error);
    } finally {
      startCallButton.disabled = !peerPresent || isInCall || callPending;
    }
  });

  $("#acceptCall").addEventListener("click", async () => {
    $("#acceptCall").disabled = true;
    try {
      setStatus("Allow camera and microphone access to answer…");
      localStream = await requestMedia(callMode);
      showLocalMedia();
      createPeerConnection();
      await emit("call:accept");
      incomingCall.hidden = true;
      setCallActive(true);
      setStatus("You answered. Connecting your call…");
    } catch (error) {
      if (localStream) stopMedia();
      displayError(error);
      socket.emit("call:reject");
      incomingCall.hidden = true;
      $("#chooseCallMode").disabled = false;
      startCallButton.disabled = !peerPresent;
    } finally {
      $("#acceptCall").disabled = false;
    }
  });

  $("#rejectCall").addEventListener("click", async () => {
    try {
      await emit("call:reject");
      incomingCall.hidden = true;
      $("#chooseCallMode").disabled = false;
      startCallButton.disabled = !peerPresent;
      setStatus("You declined the call.");
    } catch (error) {
      displayError(error);
    }
  });

  $("#endCall").addEventListener("click", async () => {
    try {
      if (isInCall || callPending || incomingCall.hidden === false) await emit("call:end");
      endLocalCall("You ended the call.");
    } catch (error) {
      endLocalCall("You ended the call.");
      displayError(error);
    }
  });

  $("#toggleMicrophone").addEventListener("click", () => {
    const track = localStream && localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    updateMicrophoneUI();
  });

  $("#toggleCamera").addEventListener("click", () => {
    const track = localStream && localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const disabled = !track.enabled;
    $("#toggleCamera").classList.toggle("is-camera-off", disabled);
    $("#toggleCamera").setAttribute("aria-pressed", String(disabled));
    $("#toggleCamera").setAttribute("aria-label", disabled ? "Turn camera on" : "Turn camera off");
    $("#toggleCamera").title = disabled ? "Turn camera on" : "Turn camera off";
    $("#toggleCamera").querySelector("small").textContent = disabled ? "Camera off" : "Camera";
  });

  $("#switchCamera").addEventListener("click", async () => {
    const track = localStream && localStream.getVideoTracks()[0];
    if (!track) return;
    const previousFacingMode = facingMode;
    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    let replacementStream;
    try {
      replacementStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: nextFacingMode } }
      });
      const replacementTrack = replacementStream.getVideoTracks()[0];
      const sender = peerConnection && peerConnection.getSenders().find((item) => item.track === track);
      if (!replacementTrack || !sender) throw new Error("Camera switching is not supported on this device.");
      replacementTrack.enabled = track.enabled;
      await sender.replaceTrack(replacementTrack);
      localStream.removeTrack(track);
      track.stop();
      localStream.addTrack(replacementTrack);
      facingMode = nextFacingMode;
      localVideo.srcObject = localStream;
    } catch (error) {
      if (replacementStream) replacementStream.getTracks().forEach((item) => item.stop());
      facingMode = previousFacingMode;
      displayError(new Error("This device could not switch cameras."));
    }
  });

  $("#fullscreenCall").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (callVideoStage.requestFullscreen) await callVideoStage.requestFullscreen();
      else if (remoteVideo.webkitEnterFullscreen) remoteVideo.webkitEnterFullscreen();
      else throw new Error("Full screen is not supported in this browser.");
    } catch (error) {
      displayError(error);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && peerConnection && peerConnection.connectionState === "connected") updateCallTimer();
  });

  setRoomState(null, false);
  updateModeButton();
  initialize();
})();

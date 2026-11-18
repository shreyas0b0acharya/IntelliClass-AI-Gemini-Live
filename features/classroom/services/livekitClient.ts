import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalAudioTrack,
} from "livekit-client";

export interface LivekitConnectionConfig {
  url: string;
  token: string;
  isConductor: boolean;
  onTrackSubscribed?: (
    track: Track,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => void;
  onTrackUnsubscribed?: (
    track: Track,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  onError?: (error: Error) => void;
}

export async function connectToLivekitRoom(
  config: LivekitConnectionConfig
): Promise<Room> {
  console.log(`🎥 [LiveKit Client] Connecting to LiveKit room... (url: "${config.url}", isConductor: ${config.isConductor})`);

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  room.on(RoomEvent.Connected, () => {
    console.log(`✅ [LiveKit Client] Connected! Room name: "${room.name}", Local identity: "${room.localParticipant.identity}", State: "${room.state}"`);
  });

  room.on(RoomEvent.Disconnected, (reason) => {
    console.warn(`⚪ [LiveKit Client] Disconnected from room. Reason:`, reason);
  });

  room.on(RoomEvent.Reconnecting, () => {
    console.log("🔄 [LiveKit Client] Reconnecting to room...");
  });

  room.on(RoomEvent.Reconnected, () => {
    console.log("✅ [LiveKit Client] Reconnected successfully.");
  });

  room.on(RoomEvent.TrackSubscribed, (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    console.log(`🎧 [LiveKit Client] TrackSubscribed: kind="${track.kind}", name="${publication.trackName}", source="${track.source}", from="${participant.identity}"`);
    config.onTrackSubscribed?.(track, publication, participant);
  });

  if (config.onTrackUnsubscribed) {
    room.on(RoomEvent.TrackUnsubscribed, config.onTrackUnsubscribed);
  }

  if (config.onParticipantConnected) {
    room.on(RoomEvent.ParticipantConnected, (p) => {
      console.log(`👤 [LiveKit Client] Participant joined: "${p.identity}"`);
      config.onParticipantConnected?.(p);
    });
  }

  if (config.onParticipantDisconnected) {
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      console.log(`👤 [LiveKit Client] Participant left: "${p.identity}"`);
      config.onParticipantDisconnected?.(p);
    });
  }

  await room.connect(config.url, config.token);
  return room;
}

/**
 * Conductor Audio Bridge:
 * Publishes the Web Audio MediaStreamTrack (generated from Gemini Live 24kHz PCM)
 * as a high-fidelity WebRTC Opus audio track to LiveKit SFU.
 */
export async function publishBridgedAudioTrack(
  room: Room,
  mediaStreamTrack: MediaStreamTrack
): Promise<LocalAudioTrack> {
  console.log(`📡 [LiveKit Client] Publishing Web Audio bridged track ("ai-professor-audio") to SFU...`);
  const localAudioTrack = new LocalAudioTrack(mediaStreamTrack);

  const publication = await room.localParticipant.publishTrack(localAudioTrack, {
    name: "ai-professor-audio",
    source: Track.Source.Microphone,
  });

  console.log(`✅ [LiveKit Client] Bridged audio track published! (trackSid="${publication.trackSid}", name="${publication.trackName}")`);
  return localAudioTrack;
}

/**
 * Floor Control: Student microphone activation
 * Requires conductor approval via /api/classroom/[sessionId]/grant-floor beforehand.
 */
export async function setStudentMicrophone(
  room: Room,
  enabled: boolean
): Promise<void> {
  console.log(`🎤 [LiveKit Client] Setting student microphone enabled: ${enabled}`);
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Microphone access requires a secure HTTPS connection or localhost. Please connect via HTTPS or localhost to use the microphone."
    );
  }
  await room.localParticipant.setMicrophoneEnabled(enabled);
}

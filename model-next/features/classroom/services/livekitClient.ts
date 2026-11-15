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
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  if (config.onTrackSubscribed) {
    room.on(RoomEvent.TrackSubscribed, config.onTrackSubscribed);
  }

  if (config.onTrackUnsubscribed) {
    room.on(RoomEvent.TrackUnsubscribed, config.onTrackUnsubscribed);
  }

  if (config.onParticipantConnected) {
    room.on(RoomEvent.ParticipantConnected, config.onParticipantConnected);
  }

  if (config.onParticipantDisconnected) {
    room.on(RoomEvent.ParticipantDisconnected, config.onParticipantDisconnected);
  }

  if (config.onError) {
    room.on(RoomEvent.Disconnected, () => {
      // Disconnection handling
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
  const localAudioTrack = new LocalAudioTrack(mediaStreamTrack);

  await room.localParticipant.publishTrack(localAudioTrack, {
    name: "ai-professor-audio",
    source: Track.Source.Microphone,
  });

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
  await room.localParticipant.setMicrophoneEnabled(enabled);
}

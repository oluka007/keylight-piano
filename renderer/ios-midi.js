// MIDI for the iPhone/iPad app. iOS WebKit has no Web MIDI, so the Swift host (ios/Keylight/MidiBridge.swift, CoreMIDI) speaks
// the same JSON RPC as the Android host: list / open / close / send / clear requests, and ports / data / error events with
// the byte stream already split per port. The adapter (parser, ports, hot-plug, MIDIAccess) is therefore android-midi.js as it is;
// only the transport differs: ios/Keylight/WebViewController.swift defines globalThis.KeylightNative.postMessage over
// webkit.messageHandlers.keylight, and the host answers through globalThis.__keylightNativeReceive.
export { requestMIDIAccess, nativeRequest, onNativeEvent } from './android-midi.js'
import { nativeRequest } from './android-midi.js'

/** Shows the system Bluetooth MIDI pairing sheet (CoreAudioKit). Resolves true once it is on screen; the keyboard then arrives as a normal MIDI port. */
export const pairBluetooth = () => nativeRequest('blePair')

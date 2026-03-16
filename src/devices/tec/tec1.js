/**
 * TEC-1 Headless Emulator Module
 *
 * Encapsulates the full TEC-1 computer emulation: Z80 CPU, 2KB RAM,
 * 2KB Monitor ROM, 6-digit 7-segment display, 20-key keyboard,
 * 8255 PPI for I/O, and buzzer audio.
 *
 * Frame-oriented API matching PMI-80 pattern.
 */

import createZ80 from "../../z80.js";
import { MONITOR_ROM } from "./tecdoc.js";

/**
 * CPU clock frequency in Hz (TEC-1 hardware spec).
 * @type {number}
 */
const FCPU = 2000000; // 2 MHz

/**
 * All valid key names for the TEC-1 keyboard.
 * @type {string[]}
 */
export const KEY_NAMES = [
  "kb0","kb1","kb2","kb3","kb4","kb5","kb6","kb7","kb8","kb9",
  "kba","kbb","kbc","kbd","kbe","kbf",
  "kbplus","kbminus","kbgo","kbad",
];

/**
 * Create a new TEC-1 emulator instance.
 *
 * @param {object} [options] - Configuration options
 * @param {number} [options.sampleRate] - Audio sample rate in Hz (default: 44100)
 * @returns {object} TEC-1 emulator instance
 */
export const createTEC = (options = {}) => {
  const sampleRate = options.sampleRate ?? 44100;

  // Full 64KB address space, but only 2KB RAM at 0x0800-0x0FFF
  const ram = new Uint8Array(65536);

  let initialized = false;

  // Port registers (8255 PPI)
  let portA = 0; // Keyboard input (read)
  let portB = 0; // Display multiplex (IC9) + buzzer (bit 7)
  let portC = 0; // Display segment data (IC10)

  // Display state (6 digits)
  const displayState = new Array(6).fill(null);

  // Audio
  const tPerSample = FCPU / sampleRate;
  let buzzer = false;
  // Buzzer transition events recorded during cpu.steps(): [{ t, state }, ...]
  const audioEvents = [];

  // Keyboard state
  let currentKeys = {};

  // CPU
  let cpu = null;

  // ── Memory functions ─────────────────────────────────────────────────────

  const byteTo = (addr, value) => {
    // ROM is read-only at 0x0000-0x07FF
    if (addr >= 0x0000 && addr <= 0x07FF) return;
    ram[addr] = value & 0xFF;
  };

  const byteAt = (addr) => {
    // ROM at 0x0000-0x07FF
    if (addr >= 0x0000 && addr <= 0x07FF) {
      return MONITOR_ROM[addr] ?? 0xFF;
    }
    return ram[addr] ?? 0;
  };

  // ── Port I/O (8255 PPI) ───────────────────────────────────────────────

  const portOut = (addr, value, unused) => {
    // Z80 calls with 3 args: port, value, combined
    // Use only lower byte of port address
    const port = addr & 0xFF;

    if (port === 1) {
      // Port B: Display multiplex + buzzer
      portB = value & 0xFF;

      // Bit 7 = buzzer (1 = on, 0 = off) — record transition for audio reconstruction
      const newBuzzer = (value & 0x80) !== 0;
      if (newBuzzer !== buzzer) {
        audioEvents.push({ t: cpu.T(), state: newBuzzer });
        buzzer = newBuzzer;
      }

    } else if (port === 2) {
      // Port C: Display segment data
      portC = value & 0xFF;
      // if (dbgCounter % 1000 === 0) console.log("port 2 (segments):", portC.toString(16));
    }

    // Convert TEC-1 segment map to standard: A=01,B=08,C=20,D=80,E=40,F=02,G=04,dp=10 → a=1,b=2,c=4,d=8,e=16,f=32,g=64,dp=128
    const mapSegments = (v) => {
      let s = 0;
      if (v & 0x01) s |= 0x01;  // A → a
      if (v & 0x08) s |= 0x02;  // B → b
      if (v & 0x20) s |= 0x04;  // C → c
      if (v & 0x80) s |= 0x08;  // D → d
      if (v & 0x40) s |= 0x10;  // E → e
      if (v & 0x02) s |= 0x20;  // F → f
      if (v & 0x04) s |= 0x40;  // G → g
      if (v & 0x10) s |= 0x80;  // dp
      return s;
    };

    // Update display - must be called after BOTH port 1 and 2 are written
    // (matching old TEC-1 behavior)
    if (portB & 0x01) displayState[5] = mapSegments(portC);
    if (portB & 0x02) displayState[4] = mapSegments(portC);
    if (portB & 0x04) displayState[3] = mapSegments(portC);
    if (portB & 0x08) displayState[2] = mapSegments(portC);
    if (portB & 0x10) displayState[1] = mapSegments(portC);
    if (portB & 0x20) displayState[0] = mapSegments(portC);
  };

  const portIn = (addr, unused) => {
    // Z80 calls with 2 args: port, combined
    const port = addr & 0xFF;

    if (port === 0) {
      // Port A: Keyboard input
      // Return key code or 0xFF if no key pressed
      const k = currentKeys;
      let result = 0xFF;
      if (k.kb0) result = 0x00;
      else if (k.kb1) result = 0x01;
      else if (k.kb2) result = 0x02;
      else if (k.kb3) result = 0x03;
      else if (k.kb4) result = 0x04;
      else if (k.kb5) result = 0x05;
      else if (k.kb6) result = 0x06;
      else if (k.kb7) result = 0x07;
      else if (k.kb8) result = 0x08;
      else if (k.kb9) result = 0x09;
      else if (k.kba) result = 0x0A;
      else if (k.kbb) result = 0x0B;
      else if (k.kbc) result = 0x0C;
      else if (k.kbd) result = 0x0D;
      else if (k.kbe) result = 0x0E;
      else if (k.kbf) result = 0x0F;
      else if (k.kbplus) result = 0x10;
      else if (k.kbminus) result = 0x11;
      else if (k.kbgo) result = 0x12;
      else if (k.kbad) result = 0x13;
      // Debug output
      // console.log("portIn 0: keys=", Object.keys(k), "->", result.toString(16));
      return result;
    }

    return 0xFF;
  };

  // ── Audio generation ───────────────────────────────────────────────────

  const generateAudio = (frameStartT, tStates) => {
    const numSamples = Math.ceil(tStates / tPerSample);
    const buffer = new Float32Array(numSamples);

    // Reconstruct square wave from buzzer transition events captured during cpu.steps()
    let level = buzzer ? 0.3 : 0;
    let evIdx = 0;
    for (let i = 0; i < numSamples; i++) {
      const sampleT = frameStartT + i * tPerSample;
      while (evIdx < audioEvents.length && audioEvents[evIdx].t <= sampleT) {
        level = audioEvents[evIdx].state ? 0.3 : 0;
        evIdx++;
      }
      buffer[i] = level;
    }
    audioEvents.length = 0;
    return buffer;
  };

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Reset the emulator.
   */
  const reset = () => {
    cpu = createZ80({ byteAt, byteTo, portIn, portOut });
    cpu.reset();
    buzzer = false;
    initialized = true;

    // Reset display
    for (let i = 0; i < 6; i++) {
      displayState[i] = null;
    }
  };

  /**
   * Execute a frame of emulation.
   *
   * @param {number} tStates - Number of T-states to execute
   * @param {object} keys - Key state object { kb0: bool, kb1: bool, ... }
   * @returns {object} Frame result { initialized, display, audio }
   */
  const frame = (tStates, keys) => {
    if (!cpu) {
      return {
        initialized: false,
        display: [],
        audio: new Float32Array(0)
      };
    }

    currentKeys = keys ?? {};
    const frameStartT = cpu.T();

    // Reset display state at start of frame
    for (let i = 0; i < 6; i++) {
      displayState[i] = null;
    }

    // Execute CPU
    cpu.steps(tStates);

    // Generate audio from transitions recorded during cpu.steps()
    const audio = generateAudio(frameStartT, tStates);

    return {
      initialized: true,
      display: [...displayState],
      audio,
      cpu: cpu.status()
    };
  };

  /**
   * Get current display state.
   * @returns {Array} Display state array
   */
  const getDisplay = () => [...displayState];

  /**
   * Get CPU status for debugging.
   * @returns {object} CPU registers
   */
  const getCPU = () => cpu ? cpu.status() : null;

  /**
   * Trigger NMI (keyboard interrupt).
   */
  const nmi = () => {
    if (cpu) cpu.nmi();
  };

  return {
    reset,
    frame,
    getDisplay,
    getCPU,
    nmi
  };
};

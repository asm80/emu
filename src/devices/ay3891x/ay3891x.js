/**
 * AY-3-8912 Programmable Sound Generator (PSG)
 *
 * Standalone emulation of the GI AY-3-8912 / Yamaha YM2149 sound chip,
 * used in ZX Spectrum 128k, MSX, Amstrad CPC, and many other vintage systems.
 *
 * Three square-wave tone channels (A, B, C), one noise generator with
 * 17-bit LFSR, and one envelope generator shared across all channels.
 *
 * @module ay3891x
 */

/**
 * Exponential volume table: 16 levels, index 0 = silence, 15 = full volume.
 * Approximates the real chip's -3 dB per step (doubling every 2 steps).
 *
 * @type {Float32Array}
 */
const VOL_TABLE = new Float32Array(16);
for (let i = 0; i < 16; i++) {
  VOL_TABLE[i] = i === 0 ? 0 : Math.pow(2, (i - 15) * 0.5) * 0.7;
}

/**
 * Precomputed envelope waveforms: 16 shapes × 32 steps, each step is a
 * volume index 0–15. Encodes all AY envelope shapes (attack/decay/hold/repeat).
 *
 * @type {Uint8Array}
 */
const ENV_WAVEFORMS = new Uint8Array(16 * 32);
(() => {
  // Ramp shapes: 0-7 all decay or attack once, then hold 0 or 15
  for (let shape = 0; shape < 16; shape++) {
    const attack   = (shape & 0x04) !== 0;
    const alternate = (shape & 0x08) !== 0 && (shape & 0x02) !== 0;
    const hold      = (shape & 0x08) !== 0 && (shape & 0x01) !== 0;
    const cont      = (shape & 0x08) !== 0;

    for (let step = 0; step < 32; step++) {
      let vol;
      if (step < 16) {
        vol = attack ? step : (15 - step);
      } else {
        if (!cont) {
          vol = attack ? 0 : 0;
        } else if (hold) {
          vol = attack ? 15 : 0;
        } else if (alternate) {
          // Second half is inverted
          const s = step - 16;
          vol = attack ? (15 - s) : s;
        } else {
          // Repeat
          const s = step - 16;
          vol = attack ? s : (15 - s);
        }
      }
      ENV_WAVEFORMS[shape * 32 + step] = vol;
    }
  }
})();

/**
 * Create a new AY-3-8912 emulator instance.
 *
 * @param {object} [options]
 * @param {number} [options.sampleRate=44100]      - Audio output sample rate in Hz
 * @param {number} [options.clockHz=1773400]        - AY chip clock in Hz (ZX Spectrum 128k default)
 * @param {number} [options.cpuClockHz=3500000]     - Host CPU clock in Hz (unused, kept for API symmetry)
 * @returns {object} AY-3-8912 instance
 */
export const createAY = ({ sampleRate = 44100, clockHz = 1773400, cpuClockHz = 3500000 } = {}) => {
  /** 16 AY registers */
  const regs = new Uint8Array(16);

  /** Currently selected register index (via writeRegisterSelect) */
  let selectedReg = 0;

  // Tone channels: float accumulators for sub-sample precision
  let toneCounterA = 0, toneStateA = 0;
  let toneCounterB = 0, toneStateB = 0;
  let toneCounterC = 0, toneStateC = 0;

  // Noise generator: 17-bit LFSR
  let noiseCounter = 0;
  let noiseLFSR = 1;
  let noiseState = 0;

  // Envelope generator
  let envCounter = 0;
  let envStep = 0;

  /**
   * Pre-allocated output buffer — sized for 10 fps worst case.
   * generate() returns a subarray view — no allocation per call.
   *
   * @type {Float32Array}
   */
  const audioBuf = new Float32Array(Math.ceil(sampleRate / 10) + 2);

  /**
   * Generate audio samples for a given number of CPU T-states.
   *
   * @param {number} tStates - T-states elapsed (used to compute sample count)
   * @returns {Float32Array} Subarray view into the pre-allocated buffer
   */
  const generate = (tStates) => {
    const nSamples = Math.ceil(tStates * sampleRate / cpuClockHz);
    // AY-3-8912 internally divides the input clock by 8 before all generators.
    // Without this prescaler, tones would be 8× too high in frequency.
    const samplesPerClock = clockHz / sampleRate / 8;

    for (let i = 0; i < nSamples; i++) {
      // Tone channel A
      const periodA = Math.max(1, ((regs[1] & 0x0F) << 8) | regs[0]);
      toneCounterA += samplesPerClock / periodA;
      if (toneCounterA >= 1.0) {
        toneCounterA -= Math.floor(toneCounterA);
        toneStateA ^= 1;
      }

      // Tone channel B
      const periodB = Math.max(1, ((regs[3] & 0x0F) << 8) | regs[2]);
      toneCounterB += samplesPerClock / periodB;
      if (toneCounterB >= 1.0) {
        toneCounterB -= Math.floor(toneCounterB);
        toneStateB ^= 1;
      }

      // Tone channel C
      const periodC = Math.max(1, ((regs[5] & 0x0F) << 8) | regs[4]);
      toneCounterC += samplesPerClock / periodC;
      if (toneCounterC >= 1.0) {
        toneCounterC -= Math.floor(toneCounterC);
        toneStateC ^= 1;
      }

      // Noise generator: 17-bit right-shift LFSR, taps at bit0 XOR bit3
      const noisePeriod = Math.max(1, regs[6] & 0x1F);
      noiseCounter += samplesPerClock / noisePeriod;
      if (noiseCounter >= 1.0) {
        noiseCounter -= Math.floor(noiseCounter);
        noiseState = noiseLFSR & 1;                          // output = current bit0
        const feedback = (noiseLFSR ^ (noiseLFSR >> 3)) & 1;
        noiseLFSR = ((noiseLFSR >> 1) | (feedback << 16)) & 0x1FFFF;
      }

      // Envelope generator
      const envPeriod = Math.max(1, ((regs[12] & 0xFF) << 8) | regs[11]);
      envCounter += samplesPerClock / envPeriod;
      if (envCounter >= 1.0) {
        envCounter -= Math.floor(envCounter);
        envStep = (envStep + 1) & 31;
      }
      const envelopeVol = ENV_WAVEFORMS[(regs[13] & 0x0F) * 32 + envStep];

      // Mixer register (reg 7): bit=0 means ENABLED (active low)
      // Channel output = (toneEnabled ? toneState : 0) | (noiseEnabled ? noiseState : 0)
      const mixer = regs[7];
      const mixA = ((mixer & 0x01) === 0 ? toneStateA : 0) | ((mixer & 0x08) === 0 ? noiseState : 0);
      const mixB = ((mixer & 0x02) === 0 ? toneStateB : 0) | ((mixer & 0x10) === 0 ? noiseState : 0);
      const mixC = ((mixer & 0x04) === 0 ? toneStateC : 0) | ((mixer & 0x20) === 0 ? noiseState : 0);

      const volA = (regs[8]  & 0x10) ? envelopeVol : (regs[8]  & 0x0F);
      const volB = (regs[9]  & 0x10) ? envelopeVol : (regs[9]  & 0x0F);
      const volC = (regs[10] & 0x10) ? envelopeVol : (regs[10] & 0x0F);

      const sampleA = mixA ? VOL_TABLE[volA] : 0;
      const sampleB = mixB ? VOL_TABLE[volB] : 0;
      const sampleC = mixC ? VOL_TABLE[volC] : 0;

      audioBuf[i] = (sampleA + sampleB + sampleC) / 3.0;
    }

    return audioBuf.subarray(0, nSamples);
  };

  return {
    /**
     * Select the active register for subsequent read/write operations.
     *
     * @param {number} reg - Register index 0–15
     */
    writeRegisterSelect: (reg) => {
      selectedReg = reg & 0x0F;
    },

    /**
     * Write a value to the currently selected register.
     * Writing to register 13 resets the envelope generator.
     *
     * @param {number} val - Byte value (0–255)
     */
    writeRegisterValue: (val) => {
      regs[selectedReg] = val & 0xFF;
      if (selectedReg === 13) {
        envStep = 0;
        envCounter = 0;
      }
    },

    /**
     * Read the value of the currently selected register.
     *
     * @returns {number} Register value (0–255)
     */
    readRegister: () => regs[selectedReg],

    /**
     * Generate audio samples for the given number of CPU T-states.
     *
     * @param {number} tStates - CPU T-states elapsed since last call
     * @returns {Float32Array} Audio samples (view into pre-allocated buffer)
     */
    generate,

    /** Reset all registers and generator state to power-on defaults. */
    reset: () => {
      regs.fill(0);
      selectedReg = 0;
      toneCounterA = toneCounterB = toneCounterC = 0;
      toneStateA = toneStateB = toneStateC = 0;
      noiseCounter = 0; noiseLFSR = 1; noiseState = 0;
      envCounter = 0; envStep = 0;
    },

    /**
     * Get a snapshot of internal state for save-state support.
     *
     * @returns {object} State snapshot
     */
    getState: () => ({
      regs: Array.from(regs),
      selectedReg,
      toneCounterA, toneStateA,
      toneCounterB, toneStateB,
      toneCounterC, toneStateC,
      noiseCounter, noiseLFSR, noiseState,
      envCounter, envStep,
    }),

    /**
     * Restore internal state from a snapshot.
     *
     * @param {object} obj - State snapshot from getState()
     */
    setState: (obj) => {
      regs.set(obj.regs);
      selectedReg  = obj.selectedReg;
      toneCounterA = obj.toneCounterA; toneStateA = obj.toneStateA;
      toneCounterB = obj.toneCounterB; toneStateB = obj.toneStateB;
      toneCounterC = obj.toneCounterC; toneStateC = obj.toneStateC;
      noiseCounter = obj.noiseCounter; noiseLFSR  = obj.noiseLFSR; noiseState = obj.noiseState;
      envCounter   = obj.envCounter;   envStep    = obj.envStep;
    },
  };
};

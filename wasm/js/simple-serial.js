/**
 * Simple UART peripheral for the ASM80 emulator.
 *
 * Unlike the ACIA 6850 this device has no control register and no baud-rate
 * dividers — it is the minimal "bit-bang" serial that many homebrew boards use:
 *
 *   statusPort  — read: bit(availableMask)=1 when RX data waiting,
 *                        bit(readyMask)=1 when TX is ready (always ready here)
 *   inPort      — read: receive next byte from keyboard; clears RX flag
 *   outPort     — write: transmit byte → onTx callback
 *
 * All three ports can be mapped to the same address or different addresses.
 * The peripheral registers as a single contiguous block covering
 * [minPort … maxPort].
 *
 * Corresponds to the .emu config keys:
 *   serial simple
 *   serial.in               <port>
 *   serial.out              <port>
 *   serial.status           <port>
 *   serial.status.available <mask>   ; bit(s) set when data available
 *   serial.status.ready     <mask>   ; bit(s) set when TX ready
 */

/**
 * @typedef {Object} SimpleSerialOptions
 * @property {number}   inPort          I/O port for reading received bytes
 * @property {number}   outPort         I/O port for writing transmitted bytes
 * @property {number}   statusPort      I/O port for reading status flags
 * @property {number}   [availableMask=0x01]  Bit mask: RX data available
 * @property {number}   [readyMask=0x02]      Bit mask: TX ready
 * @property {function} [onTx]          Callback(charCode) on TX write
 */

/**
 * Create a simple serial peripheral.
 *
 * @param {SimpleSerialOptions} opts
 * @returns {object}  Peripheral device compatible with createPeripheralBus().register()
 */
export const createSimpleSerial = ({
  inPort,
  outPort,
  statusPort,
  availableMask = 0x01,
  readyMask     = 0x02,
  onTx,
}) => {
  let _rxData  = 0xFF;
  let _rxReady = false;

  const minPort = Math.min(inPort, outPort, statusPort);
  const maxPort = Math.max(inPort, outPort, statusPort);

  // Absolute-port read/write (called by the offset-based wrappers below)
  const _read = (absPort) => {
    if (absPort === statusPort) {
      return (_rxReady ? availableMask : 0) | readyMask;
    }
    if (absPort === inPort) {
      const byte = _rxData & 0xFF;
      _rxReady = false;
      return byte;
    }
    return 0xFF;
  };

  const _write = (absPort, value) => {
    if (absPort === outPort) {
      onTx?.(value & 0xFF);
    }
  };

  // Push a received byte into the RX buffer (called from terminal keyboard handler)
  const rxPush = (charCode) => {
    _rxData  = charCode & 0xFF;
    _rxReady = true;
  };

  const reset = () => {
    _rxData  = 0xFF;
    _rxReady = false;
  };

  return {
    basePort:  minPort,
    portCount: maxPort - minPort + 1,
    read:  (offset) => _read(minPort + offset),
    write: (offset, value) => _write(minPort + offset, value),
    rxPush,
    reset,
  };
};

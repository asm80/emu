/**
 * ACIA emulation — 2 consecutive I/O ports.
 *
 * Register map (offset from basePort):
 *   +0  Command/Status port
 *         write → command register (stored, not decoded in MVP)
 *         read  → status register:
 *                   bit 4  TDRE  Transmit Data Register Empty — always 1 (ready to send)
 *                   bit 3  RDRF  Receive Data Register Full   — 1 when RX buffer non-empty
 *                   bits 7,6,5,2,1,0 hardwired to 0
 *   +1  Data port
 *         write → transmit byte (calls onTx)
 *         read  → receive byte from RX FIFO; returns 0x00 if buffer empty
 *
 * Implements the peripheral interface for createPeripheralBus:
 *   { basePort, portCount, read, write }
 * Plus extras for external control:
 *   rxPush(charCode)  — queue a byte into the RX buffer (called by terminal UI)
 *   reset()           — clear buffers and registers (called on CPU reset)
 *
 * @param {{ basePort: number, onTx: (charCode: number) => void }} opts
 * @returns {{ basePort, portCount, read, write, rxPush, reset }}
 */
export const createAcia6551 = ({ basePort, onTx }) => {
  /** RX FIFO buffer — bytes waiting to be read by the CPU. */
  let _rxBuffer = [];
  /** Command register value (last value written to port +0). */
  let _cmdReg   = 0x00;

  /**
   * Queues a character into the receive buffer.
   * Called by the terminal UI when the user presses a key.
   * @param {number} charCode  0–255
   */
  const rxPush = (charCode) => {
    _rxBuffer.push(charCode & 0xFF);
  };

  /**
   * Resets all internal state (buffers and registers).
   * Should be called whenever the CPU is reset.
   */
  const reset = () => {
    _rxBuffer = [];
    _cmdReg   = 0x00;
  };

  /**
   * CPU IN instruction handler — read from ACIA register.
   * @param {number} offset  0 = Status, 1 = Data
   * @returns {number}  0–255
   */
  const read = (offset) => {
    if (offset === 0) {
      // Status register
      const tdre = 1 << 4;   // always ready to transmit
      const rdrf = _rxBuffer.length > 0 ? (1 << 3) : 0;
      return tdre | rdrf;
    }
    if (offset === 1) {
      // Data register: consume one byte from the RX FIFO
      const byte = _rxBuffer.shift();
      return byte !== undefined ? byte : 0x00;
    }
    return 0xFF;
  };

  /**
   * CPU OUT instruction handler — write to ACIA register.
   * @param {number} offset  0 = Command, 1 = Data
   * @param {number} value   0–255
   */
  const write = (offset, value) => {
    if (offset === 0) {
      // Command register
      _cmdReg = value & 0xFF;
      return;
    }
    if (offset === 1) {
      // Data register: transmit byte to the terminal
      onTx(value & 0xFF);
    }
  };

  return { basePort, portCount: 2, read, write, rxPush, reset };
};

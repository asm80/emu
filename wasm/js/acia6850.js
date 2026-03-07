/**
 * Motorola MC6850 ACIA emulation — 2 consecutive I/O ports.
 *
 * Register map (offset from basePort):
 *   +0  Control (write) / Status (read)
 *   +1  TX Data (write) / RX Data (read)
 *
 * Status register bits:
 *   bit 0  RDRF  Receive Data Register Full   — 1 when a byte is waiting
 *   bit 1  TDRE  Transmit Data Register Empty — 1 when ready to send (always after TX)
 *   bit 2  DCD   Data Carrier Detect          — hardwired 0
 *   bit 3  CTS   Clear To Send               — hardwired 0
 *   bit 4  FE    Framing Error               — hardwired 0
 *   bit 5  OVRN  Overrun Error               — 1 if a byte arrived before previous was read
 *   bit 6  PE    Parity Error                — hardwired 0
 *   bit 7  IRQ   Interrupt Request           — hardwired 0 (interrupts not implemented)
 *
 * Control register (relevant bits for MVP):
 *   bits 1:0  Clock divider / Master Reset: 0b11 = master reset
 *   bit  4    Word length: 0 = 7-bit data, 1 = 8-bit data
 *
 * RX buffer holds exactly one byte (like real hardware). If a second byte
 * arrives before the first is read, OVRN is set.
 *
 * Implements the peripheral interface for createPeripheralBus:
 *   { basePort, portCount, read, write }
 * Plus extras for external control:
 *   rxPush(charCode)  — deliver a received byte to the chip (called by terminal UI)
 *   reset()           — master reset: clears registers and RX buffer
 *
 * @param {{ basePort: number, onTx: (charCode: number) => void }} opts
 * @returns {{ basePort, portCount, read, write, rxPush, reset }}
 */
export const createAcia6850 = ({ basePort, onTx }) => {
  // Status register bit masks
  const RDRF = 0x01;
  const TDRE = 0x02;
  const OVRN = 0x20;

  /** Stored received byte (one-byte buffer, like real HW). */
  let _rxData  = 0xFF;
  /** Status register — starts with TDRE set (ready to transmit). */
  let _status  = TDRE;
  /** Control register. */
  let _control = 0x00;

  /** Returns true when 8-bit mode is active (control bit 4 set). */
  const _is8bit = () => (_control & 0x10) !== 0;

  /**
   * Master reset — clears RX buffer and status (except TDRE).
   */
  const reset = () => {
    _rxData  = 0xFF;
    _status  = TDRE;
    _control = 0x00;
  };

  /**
   * Deliver a byte from the outside world (terminal keyboard) into the chip.
   * Mirrors MC6850.prototype.receive from the original implementation.
   * @param {number} charCode  0–255
   */
  const rxPush = (charCode) => {
    let byte = charCode & 0xFF;
    if (!_is8bit()) byte &= 0x7F;       // 7-bit mode: strip MSB
    if (_status & RDRF) {
      _status |= OVRN;                  // overrun: previous byte not yet read
      return;
    }
    _status |= RDRF;
    _rxData  = byte;
  };

  /**
   * CPU IN — read from ACIA register.
   * @param {number} offset  0 = Status, 1 = RX Data
   * @returns {number}
   */
  const read = (offset) => {
    if (offset === 0) {
      return _status;
    }
    if (offset === 1) {
      // getData: consume the RX byte, clear RDRF and OVRN
      const byte = _is8bit() ? _rxData : (_rxData & 0x7F);
      _status &= ~(RDRF | OVRN) & 0xFF;
      return byte;
    }
    return 0xFF;
  };

  /**
   * CPU OUT — write to ACIA register.
   * @param {number} offset  0 = Control, 1 = TX Data
   * @param {number} value   0–255
   */
  const write = (offset, value) => {
    if (offset === 0) {
      // Control register
      if ((value & 0x03) === 0x03) {
        reset();                        // master reset sequence
        return;
      }
      _control = value & 0xFF;
      return;
    }
    if (offset === 1) {
      // TX Data: transmit the byte
      let byte = value & 0xFF;
      if (!_is8bit()) byte &= 0x7F;    // 7-bit mode: strip MSB
      _status &= ~TDRE & 0xFF;         // clear TDRE while "transmitting"
      onTx(byte);
      _status |= TDRE;                 // immediately ready again (no real baud delay)
    }
  };

  return { basePort, portCount: 2, read, write, rxPush, reset };
};

/**
 * Peripheral I/O bus — dispatcher pro CPU IN/OUT instrukce.
 *
 * Zařízení (devices) implementují interface:
 *   { basePort: number, portCount: number,
 *     read(offset): number, write(offset, value): void,
 *     rxPush?(charCode): void, reset?(): void }
 *
 * Bus routuje CPU port na příslušné zařízení podle rozsahu
 * [basePort, basePort + portCount).
 */
export const createPeripheralBus = () => {
  const devices = [];

  return {
    /** Zaregistruje zařízení na sběrnici. */
    register: (dev) => devices.push(dev),

    /** Odstraní všechna zařízení (při re-konfiguraci). */
    unregisterAll: () => { devices.length = 0; },

    /** CPU IN instrukce — vrátí 0xFF pokud žádné zařízení neodpovídá. */
    portIn: (port) => {
      for (const d of devices) {
        if (port >= d.basePort && port < d.basePort + d.portCount)
          return d.read(port - d.basePort) & 0xFF;
      }
      return 0xFF;
    },

    /** CPU OUT instrukce — ignoruje pokud žádné zařízení neodpovídá. */
    portOut: (port, val) => {
      for (const d of devices) {
        if (port >= d.basePort && port < d.basePort + d.portCount) {
          d.write(port - d.basePort, val & 0xFF);
          return;
        }
      }
    },

    /** Reset všech zařízení (voláno při CPU reset). */
    reset: () => {
      for (const d of devices) d.reset?.();
    },
  };
};

/**
 * Intel 8080 WASM emulator — public API entry point.
 *
 * All exports here are callable from JS (Worker or test harness).
 * Memory layout shared with JS via WebAssembly.Memory (2 pages = 128 KB).
 */

export {
  configureIntercept,
  setInterceptCount,
  getInterceptCount,
  memGet,
  memSet,
  REGION_RAM,
  REGION_ROM,
  REGION_MMIO,
  OFFSET_REGS,
  OFFSET_KEYBOARD,
} from "./memory";

export {
  getSpeakerBit,
  setSpeakerBit,
  cpuReset    as reset,
  cpuStep     as step,
  cpuStatus   as status,
  cpuSetReg   as setReg,
  cpuInterrupt as interrupt,
  cpuGetCycles  as getCycles,
  cpuRunTicks   as runTicks,
  cpuGetPC    as getPC,
  cpuIsHalted as isHalted,
} from "./cpu";

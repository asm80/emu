window.JSSpeccy = window.JSSpeccy || {};

window['CPUZ80'] = (function () {

  var mr, mw, portOut, portIn;

  var fakeMemory = {
    "read": function (addr) {
      return mr(addr);
    },
    "write": function (addr, val) {
      mw(addr, val);
    }
  };
  var fakeIO = {
    "read": function (addr) {
      return portIn(addr);
    },
    "write": function (addr, val) {
      //console.log("PORTOUT",addr,val);
      portOut(addr, val);
    }
  };

  var proc;

  var reset = function () {
    proc.reset();
    T = 0;
  };
  var T = 0;

  /*
PATCH
  */


  return {
    "steps": function (Ts) {
      var tc;

      while (Ts > 0) {
        proc.setTstates(0);
        proc.runFrame(1);
        tc = proc.getTstates();
        Ts -= tc;
        T += tc;


        //if (tracer) goTrace(proc);
      };
    },
    "T": function () {
      return T;
    },
    "memr": function (addr) {
      return mr(addr)
    },

    "reset": reset,
    'proc': function () {
      return proc;
    },
    'interrupt': function () {
      proc.requestInterrupt();
    },
    "nmi": function () {
      proc.requestNMI();

    },
    "init": function (bt, ba, tck, porto, porti) {
      JSSpeccy.buildZ80({
        traps: [],
        applyContention: false
      });
      mw = bt;
      mr = ba;
      ticks = tck;
      portOut = porto;
      portIn = porti;
      proc = window.JSSpeccy.Z80({
        memory: fakeMemory,
        ioBus: fakeIO,
        display: {
          nextEventTime: null
        }
      });
      reset();
    },
    "status": function () {
      var bc = proc.getBC();
      var de = proc.getDE();
      var hl = proc.getHL();
      var af = proc.getAF();
      var bc_ = proc.getBC_();
      var de_ = proc.getDE_();
      var hl_ = proc.getHL_();
      var af_ = proc.getAF_();
      var ix = proc.getIX();
      var iy = proc.getIY();
      var i = proc.getI();
      var r = proc.getR();

      return {
        "pc": proc.getPC(),
        "sp": proc.getSP(),
        "af": af,
        "bc": bc,
        "de": de,
        "hl": hl,
        "af_": af_,
        "bc_": bc_,
        "de_": de_,
        "hl_": hl_,
        "a": af >> 8,
        "b": bc >> 8,
        "c": bc & 0xff,
        "d": de >> 8,
        "e": de & 0xff,
        "f": af & 0xff,
        "h": hl >> 8,
        "l": hl & 0xff,
        "ix": ix,
        "iy": iy,
        "i": i,
        "r": r
      };
    },
    "set": function (reg, value) {
      switch (reg) {
        case "PC":
          proc.setPC(value);
          return;
        case "AF":
          proc.setAF(value);
          return;
        case "BC":
          proc.setBC(value);
          return;
        case "DE":
          proc.setDE(value);
          return;
        case "HL":
          proc.setHL(value);
          return;
        case "AF_":
          proc.setAF_(value);
          return;
        case "BC_":
          proc.setBC_(value);
          return;
        case "DE_":
          proc.setDE_(value);
          return;
        case "HL_":
          proc.setHL_(value);
          return;
        case "IX":
          proc.setIX(value);
          return;
        case "IY":
          proc.setIY(value);
          return;
        case "SP":
          proc.setSP(value);
          return;
      }
    },
    "flagsToString": function () {
      var f = '',
        fx = "SZYHXPNC";
      var procf = proc.getAF() & 0xff;
      for (var i = 0; i < 8; i++) {
        var n = procf & (0x80 >> i);
        if (n == 0) {
          f += fx[i].toLowerCase();
        } else {
          f += fx[i]
        }
      }
      return f;
    }
  };

})();

(function(name, definition) {
    if (typeof module != 'undefined') module.exports = definition();
    else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);
    else this[name] = definition();
}('CPU6800', function() {


var vectorRESET = 0xfffe,
	vectorNMI = 0xfffc,
	vectorSWI = 0xfffa,
	vectorINT = 0xfff8,

    fCAR = 1,
    fOVF = 2,
    fZER = 4,
    fNEG = 8,
    fINT = 16,
    fHALF = 32,
    
    T=0,
    
// regs & memory

    a, b, x, flags, sp, pc,
    breakFlag=false,
    excycles, addcycles;

var byteTo, byteAt, ticks, 
wordAt = function(addr) {
	return byteAt(addr)*256+byteAt(0xffff&(addr+1));
},
wordAtZP = function(addr) {
	return byteAt(addr&0xff)*256+byteAt(0xff&(addr+1));
},
wordTo = function(addr, data) {
	byteTo(addr,(data>>8)&0xff);
	byteTo((addr+1)&0xffff,data&0xff);
},
wordToZP = function(addr) {
	byteTo(addr & 0xff,(data>>8)&0xff);
	byteTo((addr+1)&0xff,data&0xff);
},



cycletime = [0,2,0,0,0,0,2,2,4,4,2,2,2,2,2,2,2,2,0,0,0,0,2,2,0,2,0,2,0,0,0,0,4,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,5,0,10,0,0,9,12,2,0,0,2,2,0,2,2,2,2,2,0,2,2,0,2,2,0,0,2,2,0,2,2,2,2,2,0,2,2,0,2,7,0,0,7,7,0,7,7,7,7,7,0,7,7,4,7,6,0,0,6,6,0,6,6,6,6,6,0,6,6,3,6,2,2,2,0,2,2,2,0,2,2,2,2,3,8,3,0,3,3,3,0,3,3,3,4,3,3,3,3,4,0,4,5,5,5,5,0,5,5,5,6,5,5,5,5,6,8,6,7,4,4,4,0,4,4,4,5,4,4,4,4,5,9,5,6,2,2,2,0,2,2,2,0,2,2,2,2,0,0,3,0,3,3,3,0,3,3,3,4,3,3,3,3,0,0,4,5,5,5,5,0,5,5,5,6,5,5,5,5,0,0,6,7,4,4,4,0,4,4,4,5,4,4,4,4,0,0,5,6],

addrmode = [-1,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,-1,0,-1,0,-1,-1,-1,-1,6,-1,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,-1,0,-1,0,-1,-1,0,0,0,-1,-1,0,0,-1,0,0,0,0,0,-1,0,0,-1,0,0,-1,-1,0,0,-1,0,0,0,0,0,-1,0,0,-1,0,4,-1,-1,4,4,-1,4,4,4,4,4,-1,4,4,4,4,3,-1,-1,3,3,-1,3,3,3,3,3,-1,3,3,3,3,5,5,5,-1,5,5,5,-1,5,5,5,5,2,6,2,-1,1,1,1,-1,1,1,1,1,1,1,1,1,1,-1,1,1,4,4,4,-1,4,4,4,4,4,4,4,4,4,4,4,4,3,3,3,-1,3,3,3,3,3,3,3,3,3,3,3,3,5,5,5,-1,5,5,5,-1,5,5,5,5,-1,-1,2,-1,1,1,1,-1,1,1,1,1,1,1,1,1,-1,-1,1,1,4,4,4,-1,4,4,4,4,4,4,4,4,-1,-1,4,4,3,3,3,-1,3,3,3,3,3,3,3,3,-1,-1,3,3],


bcd2dec= [
  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,  // 0x00
 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,  // 0x10
 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,  // 0x20
 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,  // 0x30
 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,  // 0x40
 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,  // 0x50
 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,  // 0x60
 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,  // 0x70
 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,  // 0x80
 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,100,101,102,103,104,105,  // 0x90
100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,  // 0xA0
110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,  // 0xB0
120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,  // 0xC0
130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,  // 0xD0
140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,  // 0xE0
150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165   // 0xF0
],
dec2bcd= [
	0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,
	0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,
	0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,
	0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,
	0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
	0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
	0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
	0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
	0x80,0x81,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
	0x90,0x91,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99
],

M1 = function() {
	var v = byteAt(pc++);
	pc &=0xffff;
	return v;
},

//Methods

methods = [
	//INH
	function(){},
	//DIR
	function() {
		//direct
		var aa = M1();
		return byteAt(aa);
	}, //IMM3
	function() {
		//direct
		var aa = M1();
		var bb = M1();
		return aa*256+bb;
	}, //EXT
	function() {
		//direct
		var aa = M1();
		var bb = M1();
		return byteAt(aa*256+bb);
	}, //IDX
	function() {
		//direct
		var aa = M1();
		return byteAt(aa+x);
	}, //IMM
	function() {
		//direct
		var aa = M1();
		return aa;
	}, //REL
	function() {
		//direct
		var aa = 128-M1();
		return aa+pc;
	}],
	leas = [
		//INH
		function(){},
		//DIR
		function() {
			//direct
			var aa = M1();
			return (aa);
		}, //IMM3
		function() {
			//direct
			var aa = M1();
			var bb = M1();
			return aa*256+bb;
		}, //EXT
		function() {
			//direct
			var aa = M1();
			var bb = M1();
			return (aa*256+bb);
		}, //IDX
		function() {
			//direct
			var aa = M1();
			return (aa+x);
		}, //IMM
		function() {
			//direct
			var aa = M1();
			return aa;
		}, //REL
		function() {
			//direct
			var aa = 128-M1();
			return aa+pc;
		}],

	stores = [
		//INH
		function(){},
		//DIR
		function(d) {
			//direct
			var aa = M1();
			byteTo(aa,d);
		}, //IMM3
		function(d) {
			
		}, //EXT
		function(d) {
			//direct
			var aa = M1();
			var bb = M1();
			byteTo(aa*256+bb,d);
		}, //IDX
		function(d) {
			//direct
			var aa = M1();
			byteTo(aa+x,d);
		}, //IMM
		function(d) {
			
		}, //REL
		function(d) {
			
		}],

		//oper
		flagsNZ = function(z) {
			flags &=~(fZER+fNEG);
			if (z===0) {
				flags|=fZER;
			}
			else {
				if (z&128) flags |= fNEG;
			}
			return z;
		},
		flagsZ = function(z) {
			flags &=~(fZER);
			if (z===0) {
				flags|=fZER;
			}
			return z;
		},
		flagsN = function(z) {
			flags &=~(fNEG);
			if (z&128) flags |= fNEG;
			return z;
		},

		flagsNZ0 = function(z) {
			flagsNZ(z);
			flags &= 0xfd;
			return z;
		},

		flagsH = function(acc, oper, result)
		{
			flags &=~(fHALF);
			if ((((acc >> 3) & 1) & ((oper >> 3) & 1)) | (((oper >> 3) & 1) & ~((result >> 3) & 1)) | (~((result >> 3) & 1) & ((acc >> 3) & 1))) {flags |= fHALF;}
		},

		flagsC = function(acc, oper, result)
		{
			flags &=~(fCAR);
			if ((((acc >> 7) & 1) & ((oper >> 7) & 1)) | (((oper >> 7) & 1) & ~((result >> 7) & 1)) | (~((result >> 7) & 1) & ((acc >> 7) & 1))) {flags |= fCAR;}
		},

		flagsV = function(acc, oper, result)
		{
			flags &=~(fOVF);
			if ((((acc >> 7) & 1) & ~((oper >> 7) & 1) & ~((result >> 7) & 1)) | (~((acc >> 7) & 1) & ((oper >> 7) & 1) & ((result >> 7) & 1))) {flags |= fOVF;}
		},
		flags7V = function(acc)
		{
			flags &=~(fOVF);
			if (acc === 0x80) {flags |= fOVF;}
			return acc;
		},
		flags0V = function(acc)
		{
			flags &=~(fOVF);
			if (acc === 0x7F) {flags |= fOVF;}
			return acc;
		},

		bit7C = function(z) {
			flags &=~(fCAR);
			if (z & 0x80) flags |= fCAR;
			return z;
		},
		bit0C = function(z) {
			flags &=~(fCAR);
			if (z & 0x01) flags |= fCAR;
			return z;
		},

		flagsZC = function(z) {
			flags &=~(fZER+fCAR);
			if (z===0) {
				flags|=fZER;
			} else {
				flags|=fCAR;
			}
			return z;
		},

		flagsVNxC = function(z) {
			flags &=~(fOVF);
			if ((flags& 9 == 1) || (flags&9 == 8)) {
				flags|=fOVF;
			} 
			return z;
		},


		flagsN7VZC = function(z) {
			return flagsN(flags7V(flagsZC(z)));
		},

helperEXT = function(cb) {
	var addr = M1()*256+M1();
	var data = cb(byteAt(addr));
	if (data!==null) byteTo(addr,data&0xff);
},

helperIDX = function(cb) {
	var addr = M1()+IX;
	var data = cb(byteAt(addr));
	if (data!==null) byteTo(addr,data&0xff);
},

rel8 = function(b) {
	if (b<128) return b;
	return b-256;
},


step = function() {
	breakFlag=false;
	var instructCode = M1();
	var mode = addrmode[instructCode];
	var operand = null;
	var store = null;
	var lea = null;
	if (mode>=0) {
		operand = methods[mode];
		store = stores[mode];
		lea = leas[mode];

	}

	var temp,op, saveC;

	

	//console.log(pc,byteAt(0),instructCode,mode);


	//BIG SWITCH
	switch (instructCode) {

		case 0x01: break; //NOP

		case 0x06: flags = a & 0x3f; break; //TAP
		case 0x07: a = flags; break; //TPA
		case 0x08: x = (x+1)&0xffff; flagsZ(x); break; //INX
		case 0x09: x = (x-1)&0xffff; flagsZ(x); break; //DEX
		case 0x0a: flags &= (fOVF ^ 0x3f); break; //CLV
		case 0x0b: flags |= fOVF; break; //SEV
		case 0x0c: flags &= (fCAR ^ 0x3f); break; //CLC
		case 0x0d: flags |= fCAR; break; //SEC
		case 0x0e: flags &= (fINT ^ 0x3f); break; //CLI
		case 0x0f: flags |= fINT; break; //SEI

		case 0x10: //SBA dir
			temp = a;
			temp -= b;
			flagsC(a,b,temp);
			flagsV(a,b,temp);
			a = temp&0xff;
			flagsN(a);
			flagsZ(a);
		break;

		case 0x11: //CBA dir
			temp = a;
			temp -= b;
			if (b>a) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(a,b,temp);
			flagsN(temp & 0xff);
			flagsZ(temp & 0xff);
		break;

		case 0x16: b = flagsNZ0(a); break; //TAB
		case 0x17: a = flagsNZ0(b); break; //TBA

		case 0x19:  
			temp = a;
			if (((a & 0xF) > 9) | (flags & fHALF))
			{
				a += 0x06;
				flagsV(temp, 0x06, a);
			}
			if ((((a & 0xF0) >> 8) > 9) | (flags & fCAR))
			{
				a += 0x60;
				flagsV(temp, 0x60, a);
			}
			if (((a & 0xF) > 9) & ((a & 0xF0) == 0x90))
			{
				a += 0x60;
				flagsV(temp, 0x60, a);
			}
			if (((a & 0xF0) >> 8) > 9)
			{
				flags.C = 1;
			}
			flagsN(a);
			flagsZ(a);
		break; //DAA


		case 0x1b: //ABA
			temp = a;
			temp += b;
			flagsH(a,b,temp);
			flagsC(a,b,temp);
			flagsV(a,b,temp);
			a = temp & 0xff;
			flagsN(a);
			flagsZ(a);

		break;

		case 0x20: //BRA
			temp = M1();
			pc += rel8(temp);
		break;

		case 0x23: //BHI
			temp = M1();
			if (!((flags & fCAR) | (flags.fZER))) pc += rel8(temp);
		break;
		case 0x24: //BLS
			temp = M1();
			if ( ((flags & fCAR) | (flags.fZER))) pc += rel8(temp);
		break;


		case 0x24: //BCC
			temp = M1();
			if (!(flags & fCAR)) pc += rel8(temp);
		break;
		case 0x25: //BCS
			temp = M1();
			if ( (flags & fCAR)) pc += rel8(temp);
		break;

		case 0x26: //BNE
			temp = M1();
			if (!(flags & fZER)) pc += rel8(temp);
		break;
		case 0x27: //BEQ
			temp = M1();
			if ( (flags & fZER)) pc += rel8(temp);
		break;

		case 0x28: //BVC
			temp = M1();
			if (!(flags & fOVF)) pc += rel8(temp);
		break;
		case 0x29: //BVS
			temp = M1();
			if ( (flags & fOVF)) pc += rel8(temp);
		break;

		case 0x2A: //BPL
			temp = M1();
			if (!(flags & fNEG)) pc += rel8(temp);
		break;
		case 0x2B: //BMI
			temp = M1();
			if ( (flags & fNEG)) pc += rel8(temp);
		break;

		case 0x2C: //BGE
			temp = M1();
			if (!((flags & fNEG) ^ (flags.fOVF))) pc += rel8(temp);
		break;
		case 0x2D: //BLT
			temp = M1();
			if ( ((flags & fNEG) ^ (flags.fOVF))) pc += rel8(temp);
		break;

		case 0x2E: //BGT
			temp = M1();
			if (!((flags & fNEG) ^ (flags.fOVF)) && !(flags & fZER)) pc += rel8(temp);
		break;
		case 0x2F: //BLE
			temp = M1();
			if ( ((flags & fNEG) ^ (flags.fOVF)) &&  (flags & fZER)) pc += rel8(temp);
		break;


		case 0x30: x = (sp + 1) & 0xffff; break; //TSX
		case 0x35: sp = (x - 1) & 0xffff; break; //TXS

		case 0x31: sp = (sp + 1) & 0xffff; break; //INS
		case 0x34: sp = (sp - 1) & 0xffff; break; //DES

		case 0x32: sp = (sp+1)&0xffff; a = byteAt(sp); break; //PULA
		case 0x33: sp = (sp+1)&0xffff; b = byteAt(sp); break; //PULA

		case 0x36: byteTo(sp,a); sp = (sp-1)&0xffff; break; //PSHA
		case 0x37: byteTo(sp,b); sp = (sp-1)&0xffff; break; //PSHA

		case 0x39: sp+=2;pc=(byteAt(sp-1)<<8)+byteAt(sp); break; //RTS

		case 0x3B:
			flags = byteAt(++sp) & 0x3f;
			b = byteAt(++sp);
			a = byteAt(++sp);
			sp+=2;x=(byteAt(sp-1)<<8)+byteAt(sp); 
			sp+=2;pc=(byteAt(sp-1)<<8)+byteAt(sp); 
		break; //RTI

		//wai,swi
		case 0x3f: 
			byteTo(sp--, pc & 0xff);
			byteTo(sp--, (pc >> 8) & 0xFF);
			byteTo(sp--, x & 0xFF);
			byteTo(sp--, (x >> 8) & 0xFF);
			byteTo(sp--, a);
			byteTo(sp--, b);
			byteTo(sp--, flags);
			flags |= fINT;
			pc=wordAt(vectorSWI);
		break;	

		case 0x40: //NEGA 
			a = flagsN7VZC((0 - a) & 0xff);
		break;
		case 0x50: //NEGB
			b = flagsN7VZC((0 - b) & 0xff);
		break;
		case 0x60: //NEG idx 
			helperIDX(function(data){return flagsN7VZC((0 - data) & 0xff);}	);
		break;
		case 0x70: //NEG ext
			helperEXT(function(data){return flagsN7VZC((0 - data) & 0xff);}	);
		break;

		case 0x43: //COMA 
			a = flagsNZ0((~a & 0xff)); flags|=fCAR;
		break;
		case 0x53: //COMB
			b = flagsNZ0(~b & 0xff); flags|=fCAR;
		break;
		case 0x63: //COM idx 
			helperIDX(function(data){flags|=fCAR;return flagsNZ0(~data & 0xff);}	);
		break;
		case 0x73: //COM ext
			helperEXT(function(data){flags|=fCAR;return flagsNZ0(~data & 0xff);}	);
		break;

		case 0x44: //LSRA 
			temp = a; bit0C(a); temp = (temp >> 1);
			a = flagsNZ(temp & 0xff);flagsVNxC(a);break;
		case 0x54: //LSRB
			temp = b; bit0C(b); temp = (temp >> 1);
			b = flagsNZ(temp & 0xff);flagsVNxC(b);break;
		case 0x64: //LSR idx 
			helperIDX(function(data){temp = data; bit0C(data); temp = (temp >> 1);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);break;
		case 0x74: //LSR ext
			helperEXT(function(data){temp = data; bit0C(data); temp = (temp >> 1);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);
		break;

		case 0x46: //RORA 
			temp = a; saveC=flags&1;bit0C(a); temp = (temp >> 1) + (saveC << 7);
			a = flagsNZ(temp & 0xff);flagsVNxC(a);break;
		case 0x56: //RORB
			temp = b; saveC=flags&1;bit0C(b); temp = (temp >> 1) + (saveC << 7);
			b = flagsNZ(temp & 0xff);flagsVNxC(b);break;
		case 0x66: //ROR idx 
			helperIDX(function(data){temp = data; saveC=flags&1;bit0C(data); temp = (temp >> 1) + (saveC << 7);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);break;
		case 0x76: //ROR ext
			helperEXT(function(data){temp = data; saveC=flags&1;bit0C(data); temp = (temp >> 1) + (saveC << 7);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);
		break;

		case 0x47: //ASRA 
			temp = a; bit0C(a); temp = (temp >> 1) + (temp & 0x80);
			a = flagsNZ(temp & 0xff);flagsVNxC(a);break;
		case 0x57: //ASRB
			temp = b; bit0C(b); temp = (temp >> 1) + (temp & 0x80);
			b = flagsNZ(temp & 0xff);flagsVNxC(b);break;
		case 0x67: //ASR idx 
			helperIDX(function(data){temp = data; bit0C(data); temp = (temp >> 1) + (temp & 0x80);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);break;
		case 0x77: //ASR ext
			helperEXT(function(data){temp = data; bit0C(data); temp = (temp >> 1) + (temp & 0x80);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);
		break;

		case 0x48: //ASLA 
			temp = a; bit7C(a); temp = (temp << 1);
			a = flagsNZ(temp & 0xff);flagsVNxC(a);break;
		case 0x58: //ASLB
			temp = b; bit7C(b); temp = (temp << 1);
			b = flagsNZ(temp & 0xff);flagsVNxC(b);break;
		case 0x68: //ASL idx 
			helperIDX(function(data){temp = data; bit7C(data); temp = (temp << 1);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);break;
		case 0x78: //ASL ext
			helperEXT(function(data){temp = data; bit7C(data); temp = (temp << 1);
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);
		break;


		case 0x49: //ROLA 
			temp = a; saveC=flags&1;bit7C(a); temp = (temp << 1) + saveC;
			a = flagsNZ(temp & 0xff);flagsVNxC(a);break;
		case 0x59: //ROLB
			temp = b; saveC=flags&1;bit7C(b); temp = (temp << 1) + saveC;
			b = flagsNZ(temp & 0xff);flagsVNxC(b);break;
		case 0x69: //ROL idx 
			helperIDX(function(data){temp = data; saveC=flags&1;bit7C(data); temp = (temp << 1) + saveC;
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);break;
		case 0x79: //ROL ext
			helperEXT(function(data){temp = data; saveC=flags&1;bit7C(data); temp = (temp << 1) + saveC;
			data = flagsNZ(temp & 0xff); return flagsVNxC(data);}	);
		break;


		case 0x4A: //DECA 
			a = flagsNZ((flags7V(a) - 1) & 0xff);
		break;
		case 0x5A: //DECB
			b = flagsNZ((flags7V(b) - 1) & 0xff);
		break;
		case 0x6A: //DEC idx 
			helperIDX(function(data){return flagsNZ((flags7V(data) - 1) & 0xff);}	);
		break;
		case 0x7A: //DEC ext
			helperEXT(function(data){return flagsNZ((flags7V(data) - 1) & 0xff);}	);
		break;

		case 0x4C: //INCA 
			a = flagsNZ((flags0V(a) + 1) & 0xff);break;
		case 0x5C: //INCB
			b = flagsNZ((flags0V(b) + 1) & 0xff);break;
		case 0x6C: //INC idx 
			helperIDX(function(data){return flagsNZ((flags0V(data) + 1) & 0xff);}	);break;
		case 0x7C: //INC ext
			helperEXT(function(data){return flagsNZ((flags0V(data) + 1) & 0xff);}	);
		break;

		case 0x4d: //TSTA 
			flagsNZ0(a & 0xff); flags&=0x3e;
		break;
		case 0x5d: //TSTB
			flagsNZ0(b & 0xff); flags&=0x3E;
		break;
		case 0x6d: //TST idx 
			helperIDX(function(data){ flagsNZ0(data);flags&=0x3E; return null;}	);
		break;
		case 0x7d: //TST ext
			helperEXT(function(data){ flagsNZ0(data);flags&=0x3E; return null;}	);
		break;

		case 0x6e: //JMP
			pc = x + operand;
			break;
		case 0x7e: //JMP
			pc = (operand()<<8)+operand();
			break;

		case 0x4F: //CLRA 
			a = flagsN7VZC(0);
		break;
		case 0x5F: //CLRB
			b = flagsN7VZC(0);
		break;
		case 0x6F: //CLR idx 
			helperIDX(function(data){return flagsN7VZC(0);}	);
		break;
		case 0x7F: //CLR ext
			helperEXT(function(data){return flagsN7VZC(0);}	);
		break;

		//--------	

		case 0x80:
		case 0x90:
		case 0xa0:
		case 0xb0: //SUBA dir
			temp = a;
			op = operand();
			temp -= op;
			if (op>a) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(a,op,temp);
			a = temp & 0xff;
			flagsN(a);
			flagsZ(a);
		break;
		case 0xc0:
		case 0xd0:
		case 0xe0:
		case 0xf0: //SUBB dir
			temp = b;
			op = operand();
			temp -= op;
			if (op>b) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(b,op,temp);
			b = temp & 0xff;
			flagsN(b);
			flagsZ(b);
		break;

		case 0x81:
		case 0x91:
		case 0xa1:
		case 0xb1: //CMPA dir
			temp = a;
			op = operand();
			temp -= op;
			if (op>a) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(a,op,temp);
			flagsN(temp & 0xff);
			flagsZ(temp & 0xff);
		break;
		case 0xc1:
		case 0xd1:
		case 0xe1:
		case 0xf1: //CMPB dir
			temp = b;
			op = operand();
			temp -= op;
			if (op>b) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(b,op,temp);
			flagsN(temp & 0xff);
			flagsZ(temp & 0xff);
		break;

		case 0x82:
		case 0x92:
		case 0xa2:
		case 0xb2: //SBCA dir
			temp = a;
			op = operand();
			temp -= op;
			temp -= flags&1;
			if (op>a) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(a,op,temp);
			a = temp & 0xff;
			flagsN(a);
			flagsZ(a);
		break;
		case 0xc2:
		case 0xd2:
		case 0xe2:
		case 0xf2: //SBCB dir
			temp = b;
			op = operand();
			temp -= op;
			temp -= flags&1;
			if (op>b) {flags |=fCAR;} else {flags &= 0x3e;}
			flagsV(b,op,temp);
			b = temp & 0xff;
			flagsN(b);
			flagsZ(b);
		break;



		case 0x84:
		case 0x94:
		case 0xa4:
		case 0xb4: //ANDA dir
			a = flagsNZ0(a & operand()); break;
		case 0xc4:
		case 0xd4:
		case 0xe4:
		case 0xf4: //ANDB dir
			b = flagsNZ0(b & operand()); 
		break;


		case 0x85:
		case 0x95:
		case 0xa5:
		case 0xb5: //BITA dir
			flagsNZ0(a & operand()); break;
		case 0xc5:
		case 0xd5:
		case 0xe5:
		case 0xf5: //BITB dir
			flagsNZ0(b & operand()); 
		break;



		case 0x86:
		case 0x96:
		case 0xa6:
		case 0xb6: //LDAA dir
			a = flagsNZ0(operand()); break;
		case 0xc6:
		case 0xd6:
		case 0xe6:
		case 0xf6: //LDAB dir
			b = flagsNZ0(operand()); 
		break;


		case 0x97:
		case 0xa7:
		case 0xb7: //STAA dir
			store(flagsNZ0(a)); break;
		case 0xd7:
		case 0xe7:
		case 0xf7: //STAB dir
			store(flagsNZ0(b)); 
		break;

		case 0x88:
		case 0x98:
		case 0xa8:
		case 0xb8: //EORA dir
			a = flagsNZ0(a ^ operand()); break;
		case 0xc8:
		case 0xd8:
		case 0xe8:
		case 0xf8: //EORB dir
			b = flagsNZ0(b ^ operand()); 
		break;

		case 0x89:
		case 0x99:
		case 0xa9:
		case 0xb9: //ADCA dir
			temp = a;
			op = operand();
			temp += op + (flags&1);
			flagsH(a,op,temp);
			flagsC(a,op,temp);
			flagsV(a,op,temp);
			a = temp & 0xff;
			flagsN(a);
			flagsZ(a);
		break;
		case 0xc9:
		case 0xd9:
		case 0xe9:
		case 0xf9: //ADCB dir
			temp = b;
			op = operand();
			temp += op + (flags&1);
			flagsH(b,op,temp);
			flagsC(b,op,temp);
			flagsV(b,op,temp);
			b = temp & 0xff;
			flagsN(b);
			flagsZ(b);
		break;


		case 0x8a:
		case 0x9a:
		case 0xaa:
		case 0xba: //ORAA dir
			a = flagsNZ0(a | operand()); break;
		case 0xca:
		case 0xda:
		case 0xea:
		case 0xfa: //ORAB dir
			b = flagsNZ0(b | operand()); 
		break;

		case 0x8b:
		case 0x9b:
		case 0xab:
		case 0xbb: //ADDA dir
			temp = a;
			op = operand();
			temp += op;
			flagsH(a,op,temp);
			flagsC(a,op,temp);
			flagsV(a,op,temp);
			a = temp & 0xff;
			flagsN(a);
			flagsZ(a);
		break;
		case 0xcb:
		case 0xdb:
		case 0xeb:
		case 0xfb: //ADDB dir
			temp = b;
			op = operand();
			temp += op;
			flagsH(b,op,temp);
			flagsC(b,op,temp);
			flagsV(b,op,temp);
			b = temp & 0xff;
			flagsN(b);
			flagsZ(b);
		break;

		case 0x8c: //CPX imm
			temp = (M1()<<8)+M1();
			op = temp;
			temp = x - temp;
			flagsV(x, op, temp);
			flagsN(temp>>8);
			flagsZ(temp);
		break;
		case 0x9c: //CPX dir
			temp = wordAtZP(M1());
			op = temp;
			temp = x - temp;
			flagsV(x, op, temp);
			flagsN(temp>>8);
			flagsZ(temp);
		break;
		case 0xac: //CPX idx
			temp = wordAt(M1() + x);
			op = temp;
			temp = x - temp;
			flagsV(x, op, temp);
			flagsN(temp>>8);
			flagsZ(temp);
		break;
		case 0xbc: //CPXext
			temp = (M1()<<8)+M1();
			temp = wordAt(temp);
			op = temp;
			temp = x - temp;
			flagsV(x, op, temp);
			flagsN(temp>>8);
			flagsZ(temp);
		break;

		//nD
		case 0xad: //JSR
			op = M1();
			byteTo(sp--, pc&0xff);
			byteTo(sp--, (pc>>8)&0xff);
			pc = x + op;
		break;
		case 0xbd: //JSR
			op = (M1()<<8)+M1();
			byteTo(sp--, pc&0xff);
			byteTo(sp--, (pc>>8)&0xff);
			pc = op;
		break;


		case 0x8e: //LDS imm
			sp = (M1()<<8)+M1();
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;
		case 0x9e: //LDS dir
			sp = wordAtZP(M1());
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;
		case 0xae: //LDS idx
			sp = wordAt(M1() + x);
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;
		case 0xbe: //LDSext
			temp = (M1()<<8)+M1();
			sp = wordAt(temp);
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;

		case 0xce: //LDX imm
			x = (M1()<<8)+M1();
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;
		case 0xde: //LDX dir
			x = wordAtZP(M1());
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;
		case 0xee: //LDX idx
			x = wordAt(M1() + x);
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;
		case 0xfe: //LDXext
			temp = (M1()<<8)+M1();
			x = wordAt(temp);
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;


		case 0x9f: //STS dir
			wordToZP(M1(), sp);
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;
		case 0xaf: //STS idx
			wordTo(M1() + x, sp);
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;
		case 0xbf: //STS ext
			temp = (M1()<<8)+M1();
			wordTo(temp, sp);
			flags &= ~fOVF;
			flagsN(sp>>8);
			flagsZ(sp);
		break;

		case 0xdf: //STX dir
			wordToZP(M1(), x);
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;
		case 0xef: //STX idx
			wordTo(M1() + x, x);
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;
		case 0xff: //STX ext
			temp = (M1()<<8)+M1();
			wordTo(temp, x);
			flags &= ~fOVF;
			flagsN(x>>8);
			flagsZ(x);
		break;



	} //END OF BIG SWITCH
	
	pc &=0xffff;
	var time = cycletime[instructCode];
  T+=time; 
  if (ticks) ticks(time);
  return time; 

},

reset = function(){

	pc=wordAt(vectorRESET);
	//sp=255;
	a=b=x=0;
	flags=16;
	breakFlag=false;
	T=0;
};

var toHexN = function(n,d) {
  var s = n.toString(16);
  while (s.length <d) {s = '0'+s;}
  return s.toUpperCase();
};

var toHex2 = function(n) {return toHexN(n & 0xff,2);};
var toHex4 = function(n) {return toHexN(n,4);};

var ds = [["-",0],["NOP",1],["-",0],["-",0],["-",0],["-",0],["TAP",1],["TPA",1],["INX",1],["DEX",1],["CLV",1],["SEV",1],["CLC",1],
["SEC",1],["CLI",1],["SEI",1],["SBA",1],["CBA",1],["-",0],["-",0],["-",0],["-",0],["TAB",1],["TBA",1],["-",0],["DAA",1],["-",0],["ABA",1],
["-",0],["-",0],["-",0],["-",0],["BRA ~",2],["-",0],["BHI ~",2],["BLS ~",2],["BCC ~",2],["BCS ~",2],["BNE ~",2],["BEQ ~",2],["BVC ~",2],["BVS ~",2],
["BPL ~",2],["BMI ~",2],["BGE ~",2],["BLT ~",2],["BGT ~",2],["BLE ~",2],["TSX",1],["INS",1],["PULA",1],["PULB",1],["DES",1],["TXS",1],["PSHA",1],["PSHB",1],
["-",0],["RTS",1],["-",0],["RTI",1],["-",0],["-",0],["WAI",1],["SWI",1],["NEGA",1],["-",0],["-",0],["COMA",1],["LSRA",1],["-",0],["RORA",1],["ASRA",1],
["ASLA",1],["ROLA",1],["DECA",1],["-",0],["INCA",1],["TSTA",1],["-",0],["CLRA",1],["NEGB",1],["-",0],["-",0],["COMB",1],["LSRB",1],["-",0],["RORB",1],
["ASRB",1],["ASLB",1],["ROLB",1],["DECB",1],["-",0],["INCB",1],["TSTB",1],["-",0],["CLRB",1],["NEG @,X",2],["-",0],["-",0],["COM @,X",2],["LSR @,X",2],
["-",0],["ROR @,X",2],["ASR @,X",2],["ASL @,X",2],["ROL @,X",2],["DEC @,X",2],["-",0],["INC @,X",2],["TST @,X",2],["JMP @,X",2],["CLR @,X",2],["NEG ^",3],
["-",0],["-",0],["COM ^",3],["LSR ^",3],["-",0],["ROR ^",3],["ASR ^",3],["ASL ^",3],["ROL ^",3],["DEC ^",3],["-",0],["INC ^",3],["TST ^",3],["JMP ^",3],
["CLR ^",3],["SUBA #@",2],["CMPA #@",2],["SBCA #@",2],["-",0],["ANDA #@",2],["BITA #@",2],["LDAA #@",2],["-",0],["EORA #@",2],["ADCA #@",2],["ORAA #@",2],
["ADDA #@",2],["CPX #^",3],["BSR ~",2],["LDS #^",3],["-",0],["SUBA @",2],["CMPA @",2],["SBCA @",2],["-",0],["ANDA @",2],["BITA @",2],["LDAA @",2],
["STAA @",2],["EORA @",2],["ADCA @",2],["ORAA @",2],["ADDA @",2],["CPX @",2],["-",0],["LDS @",2],["STS @",2],["SUBA @,X",2],["CMPA @,X",2],
["SBCA @,X",2],["-",0],["ANDA @,X",2],["BITA @,X",2],["LDAA @,X",2],["STAA @,X",2],["EORA @,X",2],["ADCA @,X",2],["ORAA @,X",2],["ADDA @,X",2],
["CPX @,X",2],["JSR @,X",2],["LDS @,X",2],["STS @,X",2],["SUBA ^",3],["CMPA ^",3],["SBCA ^",3],["-",0],["ANDA ^",3],["BITA ^",3],["LDAA ^",3],
["STAA ^",3],["EORA ^",3],["ADCA ^",3],["ORAA ^",3],["ADDA ^",3],["CPX ^",3],["JSR ^",3],["LDS ^",3],["STS ^",3],["SUBB #@",2],["CMPB #@",2],
["SBCB #@",2],["-",0],["ANDB #@",2],["BITB #@",2],["LDAB #@",2],["-",0],["EORB #@",2],["ADCB #@",2],["ORAB #@",2],["ADDB #@",2],["-",0],["-",0],
["LDX #^",3],["-",0],["SUBB @",2],["CMPB @",2],["SBCB @",2],["-",0],["ANDB @",2],["BITB @",2],["LDAB @",2],["STAB @",2],["EORB @",2],["ADCB @",2],
["ORAB @",2],["ADDB @",2],["-",0],["-",0],["LDX @",2],["STX @",2],["SUBB @,X",2],["CMPB @,X",2],["SBCB @,X",2],["-",0],["ANDB @,X",2],["BITB @,X",2],
["LDAB @,X",2],["STAB @,X",2],["EORB @,X",2],["ADCB @,X",2],["ORAB @,X",2],["ADDB @,X",2],["-",0],["-",0],["LDX @,X",2],["STX @,X",2],["SUBB ^",3],
["CMPB ^",3],["SBCB ^",3],["-",0],["ANDB ^",3],["BITB ^",3],["LDAB ^",3],["STAB ^",3],["EORB ^",3],["ADCB ^",3],["ORAB ^",3],["ADDB ^",3],["-",0],
["-",0],["LDX ^",3],["STX ^",3]];


var disasm = function(i,a,b,pc) {
      var sx = ds[i];
      var s = sx[0];
      var d8 = toHex2(a);
      var rel8 = (a<128) ? toHex4(a+pc+2) : toHex4(pc + a - 256+2);
      s=s.replace("~"," $"+rel8);
      s=s.replace("@","$"+d8);
      var d16 = toHex2(a)+toHex2(b);
      s=s.replace("^","$"+d16);
      return [s,sx[1]];
    };

return {
	"steps": function(Ts){
		//T=0;
		while (Ts>0){
			Ts-=step(); 
			if (breakFlag) {T+=Ts;return;}
		}
	}, 
	"T":function(){return T;}, 
	"memr":function(addr){return byteAt(addr)}, 
	"reset":reset, 
	"init": function(bt,ba,tck){
		byteTo=bt; 
		byteAt = ba; 
		ticks=tck; 
		sp = 0;
		a = 0;
		b = 0;
		pc = 0;
		flags = 0;
		x = 0;
		reset();
	},
	"status": function() {
		return {
			"pc":pc,
			"sp":sp,
			"a":a,
			"b":b,
			"x":x,
			"flags":(flags & 0x3f),
			"break":breakFlag
		};
	},
	"interrupt": function() {
		if (flags & fINT) {
			return;
		}
		byteTo(sp--, pc & 0xff);
		byteTo(sp--, (pc >> 8) & 0xFF);
		byteTo(sp--, x & 0xFF);
		byteTo(sp--, (x >> 8) & 0xFF);
		byteTo(sp--, a);
		byteTo(sp--, b);
		byteTo(sp--, flags);
		flags |= fINT;
		pc=wordAt(vectorINT);

		T+=12;
		//console.log(pc);
	},
	"nmi": function() {
		byteTo(sp--, pc & 0xff);
		byteTo(sp--, (pc >> 8) & 0xFF);
		byteTo(sp--, x & 0xFF);
		byteTo(sp--, (x >> 8) & 0xFF);
		byteTo(sp--, a);
		byteTo(sp--, b);
		byteTo(sp--, flags);
		flags |= fINT;
		pc=wordAt(vectorNMI);
		T+=12;
		//console.log(pc);
	},
	"set":function(reg,value) {
		switch (reg.toLowerCase()) {
			case "pc": pc=value;return;
			case "a": a=value;return;
			case "b": b=value;return;
			case "x": x=value;return;
			case "sp": sp=value;return;
			case "flags": flags=value & 0x3f;return;
		}
	},
	"flagsToString": function() {
		var f='',fx = "--HINZVC";
		for (var i=0;i<8;i++) {
			var n = flags&(0x80>>i);
			if (n===0) {f+=fx[i].toLowerCase();} else {f+=fx[i];}
		}
		return f;
	},
	"disasm": disasm
};

}));

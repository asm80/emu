(function(name, definition) {
    if (typeof module != 'undefined') module.exports = definition();
    else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);
    else this[name] = definition();
}('CPU65816', function() {

//vezmeme to odsud: https://www.defence-force.org/computing/oric/coding/annexe_2/index.htm

var ResetTo = 0xfffc,
    IrqTo   = 0xfffe,
    NMITo   = 0xfffa,

    fCAR = 1,
    fZER = 2,
    fINT = 4,
    fDEC = 8,
    fBKC = 16,
    fIDX = 16,
    fACC = 32,
    fOVF = 64,
    fNEG = 128,
    
    T=0,
    
// regs & memory

    a, x, y, flags, sp, pc,
    dbr, dp, pbr,
    breakFlag=false,
    emulation=true,
    exbytes = 0,
    excycles, addcycles;

    var isAcc16 = function(){return (flags&&fACC==0 && !emulation);}
    var isIdx16 = function(){return (flags&&fIDX==0 && !emulation);}

var byteTo, byteAt, ticks, 
wordAt = function(addr) {
	return byteAt(addr)+byteAt(0xffff&(addr+1))*256;
},

m1 = function() {return byteAt(pc);},

excyc = function() { //1
	if (flags & fACC) excycles++; //add 1 cycle if A is 16bit
},
exdp = function() { //1,2
	if (dp!=0) excycles++;
	if (flags & fACC) excycles++; //add 1 cycle if A is 16bit
},

exx = function(x) { //3
	if (x & 0xff == 0xff) excycles++;
},


/*
imm = immediate
abs = absolute
abx = absolute indexed, X
aby = absolute indexed, Y
dp = direct page
dpx = dp indexed, X
dpy = dp indexed, Y
ind = Absolute Indirect
idx = DP Indexed Indirect, X
idy = DP Indirect Indexed, Y
rel = relative
idp = DP Indirect
idl = DP Indirect Long
idly = DP indirect long indexed, Y
isy = SR Indirect Indexed, Y
abl = Absolute Long
alx = Absolute Long Indexed, X
iax = Absolute Indexed Indirect Long
ial = Absolute Indexed Indirect
rell = relative long
bm = 
sr = Stack Relative

*/
aimp = function() {
	exbytes=0;
	return null;
},

aimm = function() {
	exbytes = 1;
	if (flags & fACC) exbytes++; //16bit
	excyc();
	return pc;
},
aabs = function()  {exbytes = 2;excyc();return wordAt(pc);},
aabl = function()  {exbytes = 3;excyc();return wordAt(pc);},

adp = function() {exbytes = 1;exdp();return (dp<<8) + byteAt(pc);}, //direct page addr
//dp indexed, X
adpx = function() {exbytes = 1;exdp();return (dp<<8) + (255&(x+byteAt(pc)));},
//dp indexed, Y
adpy = function()  {exbytes = 1;exdp();	return (dp<<8) + (255&(y+byteAt(pc)));},
aidx = function()  {exbytes = 1;exdp();	return wordAt((dp<<8) + (255&(x+byteAt(pc))));},



aidy = function()  {	
	if (addcycles) {
		var a1=wordAt(byteAt(pc));
		var a2=(a1+y)&0xffff;
		if ((a1&0xff00)!=(a2&0xff00)) excycles++;
		return a2;
	}
	else {
		return (wordAt(byteAt(pc))+y)&0xffff;
	}
},



aima,aabx,aaby,aind,aidy,arel,aidp,aidl,aidly,aisy,aabl,aalx,aiax,aial,arell,abm,asr,

absoluteXAddr = function()  {	if (addcycles) {
		var a1=wordAt(pc);
		var a2=(a1+x)&0xffff;
		if ((a1&0xff00)!=(a2&0xff00)) excycles++;
		return a2;
	}
	else {
		return (wordAt(pc)+x)&0xffff;
	}
},
absoluteYAddr = function()  {
	if (addcycles) {
		var a1=wordAt(pc);
		var a2=(a1+y)&0xffff;
		if ((a1&0xff00)!=(a2&0xff00)) excycles++;
		return a2;
	}
	else {
		return (wordAt(pc)+y)&0xffff;
	}
},
branchRelAddr = function() {
	excycles++;
	var addr=immediateByte()
	pc++;
	addr= (addr&128)? pc-((addr^255)+1) : pc+addr;
	if ((pc&0xff00)!=(addr&0xff00)) excycles++;
	pc=addr&0xffff;
},

// stack

stPush = function(z) {byteTo(sp+256, z&255);sp--;sp&=255;},
stPop = function() {sp++;sp&=255;return byteAt(sp+256);},
stPushWord = function(z) {stPush((z>>8)&255);stPush(z&255);},
stPopWord = function() {var z=stPop();z +=256*stPop();return z;},


//oper
flagsNZ = function(z) {
	flags &=~(fZER+fNEG);
	if (z==0) {
		flags|=fZER;
	}
	else {
		flags |=z&128;
	}
},

flagVadc = function(m,n,s) {
	var m7 = (m & 0x80)?1:0;
	var n7 = (n & 0x80)?1:0;
	var s7 = (s & 0x80)?1:0;
	var v = 0;
	if ((m7==0)&&(n7==0) && (s7==1)) v=1;
	if ((m7==1)&&(n7==1) && (s7==0)) v=1;
	return v;
},
flagVsbc = function(m,n,s) {
	var m7 = (m & 0x80)?1:0;
	var n7 = (n & 0x80)?1:0;
	var s7 = (s & 0x80)?1:0;
	var v = 0;
	if ((m7==0)&&(n7==1) && (s7==0)) v=1;
	if ((m7==1)&&(n7==0) && (s7==1)) v=1;
	return v;
},


opORA = function(x) {
	a|=byteAt(x());
	flagsNZ(a);
},
opASL = function(x) {
	var addr = x();
	var tbyte = byteAt(addr);
	flags &=~(fCAR+fNEG+fZER);
	if (tbyte&128) flags |= fCAR;
	if (tbyte=tbyte<<1) {
		flags |=tbyte&128;
	}
	else {
		flags |=fZER;
	}
	byteTo(addr, tbyte);
},
opLSR = function(x) {
	var addr=x();
	var tbyte=byteAt(addr);
	flags &=~(fCAR+fNEG+fZER);
	flags |=tbyte&1;
	if (tbyte=tbyte>>1) {}
	else {
		flags |=fZER;
	}
	byteTo(addr, tbyte);
},
opBCL = function(x) {
	if (flags&x) {
		pc++;
	}
	else {
		branchRelAddr();
	}
},
opBST = function(x) {
	if (flags&x) {
		branchRelAddr();
	}
	else {
		pc++;
	}
},
opCLR = function(x) {
	flags &=~x;
},
opSET = function(x) {
	flags |= x;
},
opAND = function(x) {
	a &= byteAt(x());
	flagsNZ(a);
},
opBIT = function(x) {
	var tbyte=byteAt(x());
	flags &=~(fZER+fNEG+fOVF);
	if ((a&tbyte)==0) flags |=fZER;
	flags |=tbyte&(128+64);
},
opROL = function(x) {
	var addr=x();
	var tbyte=byteAt(addr);
	if (flags&fCAR) {
		if (tbyte&128) {}
		else {
			flags &=~fCAR;
		}
		tbyte=(tbyte<<1)|1;
	}
	else {
		if (tbyte&128) flags|=fCAR;
		tbyte=tbyte<<1;
	}
	flagsNZ(tbyte);
	byteTo(addr, tbyte);
},
opEOR = function(x) {
	a^=byteAt(x());
	flagsNZ(a);
},
opADC = function(x) {
	var data=byteAt(x());
	var olddata = data;
	if (flags&fDEC) {
		data = bcd2dec[data]+bcd2dec[a]+((flags&fCAR)?1:0);
		flags &= ~(fCAR+fOVF+fNEG+fZER);
		//flagV
		if (flagVadc(olddata, a, data)) {
			flags |= fOVF;
		};
		if (data>99) {
			flags|=fCAR;
			data -=100;
		}
		if (data==0) {
			flags|=fZER;
		}
		else {
			flags |=data&128;
		}
		a=dec2bcd[data];
	}
	else {
		data += a+((flags&fCAR)?1:0);
		flags &= ~(fCAR+fOVF+fNEG+fZER);
		if (data>255) {
			flags|=fCAR;
			data &=255;
		}
		if (data==0) {
			flags|=fZER;
		}
		else {
			flags |=data&128;
		}
		//flagV
		if (flagVadc(olddata, a, data)) {
			flags |= fOVF;
		};

		a=data;
	}
},
opROR = function(x) {
	var addr=x();
	var tbyte=byteAt(addr);
	if (flags&fCAR){
		if (tbyte&1) {}
		else flags&=~fCAR;
		tbyte=(tbyte>>1)|128;
	}
	else{
		if (tbyte&1) flags|=fCAR;
		tbyte=tbyte>>1;
	};
	flagsNZ(tbyte);
	byteTo(addr, tbyte);
},
opSTA = function(x) {
	byteTo(x(),a);
},
opSTY = function(x) {
	byteTo(x(),y);
},
opSTX = function(y) {
	byteTo(y(),x);
},
opCPY = function(x) {
	var tbyte=byteAt(x());
	flags &=~(fCAR+fZER+fNEG);
	if (y==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (y>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
},
opCPX = function(y) {
	var tbyte=byteAt(y());
	flags &=~(fCAR+fZER+fNEG);
	if (x==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (x>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
},
opCMP = function(x) {
	var tbyte=byteAt(x());
	flags &=~(fCAR+fZER+fNEG);
	if (a==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (a>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
},
opSBC = function(x) {
	var data=byteAt(x());
	var olddata = data;
	if (flags&fDEC) {
		data = bcd2dec[a]-bcd2dec[data]-((flags&fCAR)?0:1);
		flags &= ~(fCAR+fZER+fNEG+fOVF);
		if(flagVsbc(olddata,a,data)) {
			flags |= fOVF;
		}

		if (data==0) {
			flags |=fZER+fCAR;
		}
		else if (data>0) {
			flags |=fCAR;
		}
		else {
			flags|=fNEG;
			data +=100;
		}
		a=dec2bcd[data];
	}
	else {
		data = a-data-((flags&fCAR)?0:1);
		flags &=~(fCAR+fZER+fOVF+fNEG);
		if (data==0) {
			flags |=fZER+fCAR;
		}
		else if (data>0) {
			flags |=fCAR;
		}
		flags |=data&128;

		if (flagVsbc(olddata,a,data)) {
			flags|=fOVF;
		}

		a=data&255;
	}
},
opDECR = function(x) {
	var addr=x();
	var tbyte=(byteAt(addr)-1)&255;
	flags &=~(fZER+fNEG);
	if (tbyte) {
		flags |=tbyte&128;
	}
	else {
		flags|=fZER;
	}
	byteTo(addr, tbyte);
},
opINCR = function(x) {
	var addr=x();
	var tbyte=(byteAt(addr)+1)&255;
	flags &=~(fZER+fNEG);
	if (tbyte) {
		flags |=tbyte&128;
	}
	else {
		flags|=fZER;
	}
	byteTo(addr, tbyte);
},
opLDA = function(x) {
	a=byteAt(x());
	flagsNZ(a);
},
opLDY = function(x) {
	y=byteAt(x());
	flagsNZ(y);
},
opLDX = function(y) {
	x=byteAt(y());
	flagsNZ(x);
},


///instrukce
  ini = function() {pc++;},
  
i00 = function() {
	flags |= fBKC;
	stPushWord(pc);
	stPush(flags);
	flags |= fINT;
	pc=wordAt(IrqTo);
	//pc = 0x18;
	breakFlag=true;
},

ibrk,iora,icop,itsb,iasl,iphp,iasl,iphd,itsb,iasl,ibpl,itrb,iasl,
iclc,iinc,itcs,itrb,iasl,ijsr,iand,ijsr,iand,ibit,iand,irol,iand,iplp,iand,irol,ipld,ibit,iand,irol,iand,
ibmi,iand,iand,iand,ibit,iand,irol,iand,isec,iand,idec,itsc,ibit,iand,irol,iand,irti,ieor,iwdm,ieor,imvp,ieor,ilsr,ieor,
ipha,ieor,ilsr,iphk,ijmp,ieor,ilsr,ieor,ibvc,ieor,ieor,ieor,imvn,ieor,ilsr,ieor,icli,ieor,iphy,itcd,ijmp,ieor,ilsr,ieor,
irts,iadc,iper,iadc,istz,iadc,iror,iadc,ipla,iadc,iror,irtl,ijmp,iadc,iror,iadc,ibvs,iadc,iadc,iadc,istz,iadc,iror,iadc,
isei,iadc,iply,itdc,ijmp,iadc,iror,iadc,ibra,ista,ibrl,ista,isty,ista,istx,ista,idey,ibit,itxa,iphb,isty,ista,istx,ista,
ibcc,ista,ista,ista,isty,ista,istx,ista,itya,ista,itxs,itxy,istz,ista,istz,ista,ildy,ildx,ildy,ildx,
itay,itax,iplb,ildy,ildx,ibcs,ildy,ildx,iclv,itsx,ityx,ildy,ildx,
icpy,icmp,irep,icmp,icpy,icmp,idec,icmp,iiny,icmp,idex,iwai,icpy,icmp,idec,icmp,ibne,icmp,icmp,icmp,ipei,icmp,idec,icmp,
icld,icmp,iphx,istp,ijmp,icmp,idec,icmp,icpx,isbc,isep,isbc,icpx,isbc,iinc,isbc,iinx,isbc,inop,ixba,icpx,isbc,iinc,isbc,
ibeq,isbc,isbc,isbc,ipea,isbc,iinc,isbc,ised,isbc,iplx,ixce,ijsr,isbc,iinc,isbc,


ilda = function(ad) {
	a = byteAt(ad); flagsNZ(a);
},

i01 = function() { opORA(indirectXAddr); pc++; },
i05 = function() { opORA(zeroPageAddr); pc++; },
i06 = function() { opASL(zeroPageAddr); pc++; },
i08 = function() { stPush(flags); },
i09 = function() { a |= immediateByte(); flagsNZ(a); pc++; },
i0a = function() {
	if (a&128) {
		flags |= fCAR;
	}
	else {
		flags &= ~fCAR;
	}
	a=a<<1;
	flagsNZ(a);
	a&=255;
},
i0d = function() { opORA(absoluteAddr); pc+=2; },
i0e = function() { opASL(absoluteAddr); pc+=2; },
i10 = function() { opBCL(fNEG); },
i11 = function() { opORA(indirectYAddr); pc++; },
i15 = function() { opORA(zeroPageXAddr); pc++; },
i16 = function() { opASL(zeroPageXAddr); pc++; },
i18 = function() { opCLR(fCAR); },
i19 = function() { opORA(absoluteYAddr); pc+=2; },
i1d = function() { opORA(absoluteXAddr); pc+=2; },
i1e = function() { opASL(absoluteXAddr); pc+=2; },
i20 = function() { stPushWord((pc+1)&0xffff); pc=wordAt(pc); },
i21 = function() { opAND(indirectXAddr); pc++; },
i24 = function() { opBIT(zeroPageAddr); pc++; },
i25 = function() { opAND(zeroPageAddr); pc++; },
i26 = function() { opROL(zeroPageAddr); pc++; },
i28 = function() { flags = stPop(); },
i29 = function() { a &= immediateByte(); flagsNZ(a); pc++; },
i2a = function() {
	if (flags&fCAR) {
		if ((a&128)==0) flags &=~fCAR;
		a=(a<<1)|1;
	}
	else {
		if(a&128) flags|=fCAR;
		a=a<<1;
	};
	flagsNZ(a);
	a&=255;
},
i2c = function() { opBIT(absoluteAddr); pc+=2; },
i2d = function() { opAND(absoluteAddr); pc+=2; },
i2e = function() { opROL(absoluteAddr); pc+=2; },
i30 = function() { opBST(fNEG); },
i31 = function() { opAND(indirectYAddr); pc++; },
i35 = function() { opAND(zeroPageXAddr); pc++; },
i36 = function() { opROL(zeroPageXAddr); pc++; },
i38 = function() { opSET(fCAR); },
i39 = function() { opAND(absoluteYAddr); pc+=2; },
i3d = function() { opAND(absoluteXAddr); pc+=2; },
i3e = function() { opROL(absoluteXAddr); pc+=2; },
i40 = function() { flags=stPop(); pc=stPopWord(); },
i41 = function() { opEOR(indirectXAddr); pc++; },
i45 = function() { opEOR(zeroPageAddr); pc++; },
i46 = function() { opLSR(zeroPageAddr); pc++; },
i48 = function() { stPush(a); },
i49 = function() { a ^= immediateByte(); flagsNZ(a); pc++; },
i4a = function() { 
	flags &=~(fCAR+fNEG+fZER);
	if (a&1) flags |=fCAR;
	if (a=a>>1) {}
	else {
		flags |=fZER;
	}
	a&=255;
},
  
  i4c = function() {pc=wordAt(pc);},
  
i4d = function() { opEOR(absoluteAddr); pc+=2; },
i4e = function() { opLSR(absoluteAddr); pc+=2; },
i50 = function() { opBCL(fOVF); },
i51 = function() { opEOR(indirectYAddr); pc++; },
i55 = function() { opEOR(zeroPageXAddr); pc++; },
i56 = function() { opLSR(zeroPageXAddr); pc++; },
i58 = function() { opCLR(fINT); },
i59 = function() { opEOR(absoluteYAddr); pc+=2; },
i5d = function() { opEOR(absoluteXAddr); pc+=2; },
i5e = function() { opLSR(absoluteXAddr); pc+=2; },
i60 = function() { pc=stPopWord(); pc++; },
i61 = function() { opADC(indirectXAddr); pc++; },
i65 = function() { opADC(zeroPageAddr); pc++; },
i66 = function() { opROR(zeroPageAddr); pc++; },
i68 = function() { a=stPop(); flagsNZ(a); },
i69 = function() {
	var data=immediateByte();
	var olddata = data;
	var cy=0;
	if (flags&fDEC) {
		data = bcd2dec[data]+bcd2dec[a]+((flags&fCAR)?1:0);
		flags &= ~(fCAR+fOVF+fNEG+fZER);
		if (data>99) {
			flags|=fCAR;
			data -=100;
		}
		if (data==0) {
			flags |= fZER;
		}
		else {
			flags |= data&128;
		}
		//flagV
		if (flagVadc(olddata, a, data)) {
			flags |= fOVF;
		};

		a=dec2bcd[data];
	}
	else {
		data += a+((flags&fCAR)?1:0);
		flags &= ~(fCAR+fOVF+fNEG+fZER);
		if (data>255) {
			flags|=fCAR;
			data &=255;
			cy=1;
		}
		if (data==0) {
			flags |= fZER;
		}
		else {
			flags |= data&128;
		}
		//flagV
		if (flagVadc(olddata, a, data)) {
			flags |= fOVF;
		};

		a=data;
	}
	pc++;
},
i6a = function() {
	if (flags&fCAR) {
		if ((a&1)==0) flags &=~fCAR;
		a=(a>>1)|128;
	}
	else {
		if(a&1) flags|=fCAR;
		a=a>>1;
	}
	flagsNZ(a);
	a&=255;
}  ,
  
  i6c = function() {var ta=wordAt(pc); pc=wordAt(ta); },
  
i6d = function() { opADC(absoluteAddr); pc+=2; },
i6e = function() { opROR(absoluteAddr); pc+=2; },
i70 = function() { opBST(fOVF); },
i71 = function() { opADC(indirectYAddr); pc++; },
i75 = function() { opADC(zeroPageXAddr); pc++; },
i76 = function() { opROR(zeroPageXAddr); pc++; },
i78 = function() { opSET(fINT); },
i79 = function() { opADC(absoluteYAddr); pc+=2; },
i7d = function() { opADC(absoluteXAddr); pc+=2; },
i7e = function() { opROR(absoluteXAddr); pc+=2; },
i81 = function() { opSTA(indirectXAddr); pc++; },
i84 = function() { opSTY(zeroPageAddr); pc++; },
i85 = function() { opSTA(zeroPageAddr); pc++; },
i86 = function() { opSTX(zeroPageAddr); pc++; },
i88 = function() { y--; y&=255; flagsNZ(y); },
i8a = function() { a=x; flagsNZ(a); },
i8c = function() { opSTY(absoluteAddr); pc+=2; },
i8d = function() { opSTA(absoluteAddr); pc+=2; },
i8e = function() { opSTX(absoluteAddr); pc+=2; },
i90 = function() { opBCL(fCAR); },
i91 = function() { opSTA(indirectYAddr); pc++; },
i94 = function() { opSTY(zeroPageXAddr); pc++; },
i95 = function() { opSTA(zeroPageXAddr); pc++; },
i96 = function() { opSTX(zeroPageYAddr); pc++; },
i98 = function() { a=y; flagsNZ(a); },
i99 = function() { opSTA(absoluteYAddr); pc+=2; },
i9a = function() { sp=x; },
i9d = function() { opSTA(absoluteXAddr); pc+=2; },
ia0 = function() { y=immediateByte(); flagsNZ(y); pc++; },
ia1 = function() { opLDA(indirectXAddr); pc++; },
ia2 = function() { x=immediateByte(); flagsNZ(x); pc++; },
ia4 = function() { opLDY(zeroPageAddr); pc++; },
ia5 = function() { opLDA(zeroPageAddr); pc++; },
ia6 = function() { opLDX(zeroPageAddr); pc++; },
ia8 = function() { y=a; flagsNZ(y); },
ia9 = function() { a=immediateByte(); flagsNZ(a); pc++; },//
iaa = function() { x=a; flagsNZ(x); },
iac = function() { opLDY(absoluteAddr); pc+=2; },
iad = function() { opLDA(absoluteAddr); pc+=2; },
iae = function() { opLDX(absoluteAddr); pc+=2; },
ib0 = function() { opBST(fCAR); },
ib1 = function() { opLDA(indirectYAddr); pc++; },
ib4 = function() { opLDY(zeroPageXAddr); pc++; },
ib5 = function() { opLDA(zeroPageXAddr); pc++; },
ib6 = function() { opLDX(zeroPageYAddr); pc++; },
ib8 = function() { opCLR(fOVF); },
ib9 = function() { opLDA(absoluteYAddr); pc+=2; },
iba = function() { x=sp; },
ibc = function() { opLDY(absoluteXAddr); pc+=2; },
ibd = function() { opLDA(absoluteXAddr); pc+=2; },
ibe = function() { opLDX(absoluteYAddr); pc+=2; },
ic0 = function() {
	var tbyte=immediateByte();
	flags &=~(fCAR+fZER+fNEG);
	if (y==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (y>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
	pc++;
},
ic1 = function() { opCMP(indirectXAddr); pc++; },
ic4 = function() { opCPY(zeroPageAddr); pc++; },
ic5 = function() { opCMP(zeroPageAddr); pc++; },
ic6 = function() { opDECR(zeroPageAddr); pc++; },
ic8 = function() { y++; y&=255; flagsNZ(y); },
ic9 = function() {
	var tbyte=immediateByte();
	flags &=~(fCAR+fZER+fNEG);
	if (a==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (a>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
	pc++;
},
ica = function() { x--; x&=255; flagsNZ(x); },
icc = function() { opCPY(absoluteAddr); pc+=2; },
icd = function() { opCMP(absoluteAddr); pc+=2; },
ice = function() { opDECR(absoluteAddr); pc+=2; },
id0 = function() { opBCL(fZER); },
id1 = function() { opCMP(indirectYAddr); pc++; },
id5 = function() { opCMP(zeroPageXAddr); pc++; },
id6 = function() { opDECR(zeroPageXAddr); pc++; },
id8 = function() { opCLR(fDEC); },
id9 = function() { opCMP(absoluteYAddr); pc+=2; },
idd = function() { opCMP(absoluteXAddr); pc+=2; },
ide = function() { opDECR(absoluteXAddr); pc+=2; },
ie0 = function() {
	var tbyte=immediateByte();
	flags &=~(fCAR+fZER+fNEG);
	if (x==tbyte) {
		flags |=fCAR+fZER;
	}
	else if (x>tbyte) {
		flags |=fCAR;
	}
	else {
		flags |=fNEG;
	}
	pc++;
},
ie1 = function() { opSBC(indirectXAddr); pc++; },
ie4 = function() { opCPX(zeroPageAddr); pc++; },
ie5 = function() { opSBC(zeroPageAddr); pc++; },
ie6 = function() { opINCR(zeroPageAddr); pc++; }  ,
  
  ie8 = function() { x++; x&=255; flagsNZ(x); },
ie9 = function() {
	var data=immediateByte();
	var olddata=data;
	if (flags&fDEC) {
		data = bcd2dec[a]-bcd2dec[data]-((flags&fCAR)?0:1);
		flags &= ~(fCAR+fZER+fNEG+fOVF);
		if(flagVsbc(olddata,a,data)) {
			flags |= fOVF;
		}
		if (data==0) {
			flags |=fZER+fCAR;
		}
		else if (data>0) {
			flags |=fCAR;
		}
		else {
			flags|=fNEG;
			data +=100;
		}
		a=dec2bcd[data];
	}
	else {
		data = a-data-((flags&fCAR)?0:1);
		flags &=~(fCAR+fZER+fOVF+fNEG);
		if (data==0) {
			flags |= fZER+fCAR;
		}
		else if (data>0) {
			flags |= fCAR;
		}
		else {
			//flags |= fOVF;
		}
		data &= 255;
		flags |= data&128;

		if(flagVsbc(olddata,a,data)) {
			flags |= fOVF;
		}

		a=data;
	}
	pc++;
},
iea = function() {},
iec = function() { opCPX(absoluteAddr); pc+=2; },
ied = function() { opSBC(absoluteAddr); pc+=2; },
iee = function() { opINCR(absoluteAddr); pc+=2; },
if0 = function() { opBST(fZER); },
if1 = function() { opSBC(indirectYAddr); pc++; },
if5 = function() { opSBC(zeroPageXAddr); pc++; },
if6 = function() { opINCR(zeroPageXAddr); pc++; },
if8 = function() { opSET(fDEC); },
if9 = function() { opSBC(absoluteYAddr); pc+=2; },
ifd = function() { opSBC(absoluteXAddr); pc+=2; },
ife = function() { opINCR(absoluteXAddr); pc+=2; },

cycletime = [
	7, 6, 0, 0, 0, 3, 5, 0, 3, 2, 2, 0, 0, 4, 6, 0,  // 00
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 10
	6, 6, 0, 0, 3, 3, 5, 0, 4, 2, 2, 0, 4, 4, 6, 0,  // 20
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 30
	6, 6, 0, 0, 0, 3, 5, 0, 3, 2, 2, 0, 3, 4, 6, 0,  // 40
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 50
	6, 6, 0, 0, 0, 3, 5, 0, 4, 2, 2, 0, 5, 4, 6, 0,  // 60
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 70
	0, 6, 0, 0, 3, 3, 3, 0, 2, 0, 2, 0, 4, 4, 4, 0,  // 80
	2, 6, 0, 0, 4, 4, 4, 0, 2, 5, 2, 0, 0, 5, 0, 0,  // 90
	2, 6, 2, 0, 3, 3, 3, 0, 2, 2, 2, 0, 4, 4, 4, 0,  // A0
	2, 5, 0, 0, 4, 4, 4, 0, 2, 4, 2, 0, 4, 4, 4, 0,  // B0
	2, 6, 0, 0, 3, 3, 5, 0, 2, 2, 2, 0, 4, 4, 3, 0,  // C0
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // D0
	2, 6, 0, 0, 3, 3, 5, 0, 2, 2, 2, 0, 4, 4, 6, 0,  // E0
	2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0   // F0
],

extracycles= [
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 00
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 10
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 20
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 30
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 40
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 50
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 60
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 70
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 80
	2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 90
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // A0
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0,  // B0
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // C0
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // D0
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // E0
	2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0   // F0
],

admode = [aimp,aidx,aimm,asr,adp,adp,adp,aidl,aimp,aimm,aima,aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,adp,adpx,adpx,aidly,aimp,aaby,aimp,aimp,aabs,aabx,aabx,aalx,aabs,aidx,aabl,asr,adp,adp,adp,aidl,aimp,aimm,aima,aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,adpx,adpx,adpx,aidly,aimp,aaby,aimp,aimp,aabx,aabx,aabx,aalx,aimp,aidx,aimp,asr,abm,adp,adp,aidl,aimp,aimm,aima,aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,abm,adpx,adpx,aidly,aimp,aaby,aimp,aimp,aabl,aabx,aabx,aalx,aimp,aidx,arell,asr,adp,adp,adp,aidl,aimp,aimm,aima,aimp,aind,aabs,aabs,aabl,arel,aidy,aidp,aisy,adpx,adpx,adpx,aidly,aimp,aaby,aimp,aimp,aial,aabx,aabx,aalx,arel,aidx,arell,asr,adp,adp,adp,aidl,aimp,aimm,aimp,aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,adpx,adpx,adpy,aidly,aimp,aaby,aimp,aimp,aabs,aabx,aabx,aalx,aimm,aidx,aimm,asr,adp,adp,adp,aidl,aimp,aimm,aimp,aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,adpx,adpx,adpy,aidly,aimp,aaby,aimp,aimp,aabx,aabx,aaby,aalx,aimm,aidx,aimm,asr,adp,adp,adp,aidl,aimp,aimm,aimp,aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,aidp,adpx,adpx,aidly,aimp,aaby,aimp,aimp,aiax,aabx,aabx,aalx,aimm,aidx,aimm,asr,adp,adp,adp,aidl,aimp,aimm,aimp,
aimp,aabs,aabs,aabs,aabl,arel,aidy,aidp,aisy,aabs,adpx,adpx,aidly,aimp,aaby,aimp,aimp,aial,aabx,aabx,aalx], //,

instruct = [ibrk,iora,icop,iora,itsb,iora,iasl,iora,iphp,iora,iasl,iphd,itsb,iora,iasl,iora,ibpl,iora,iora,iora,itrb,iora,iasl,iora,iclc,iora,iinc,itcs,itrb,iora,iasl,iora,ijsr,iand,ijsr,iand,ibit,iand,irol,iand,iplp,iand,irol,ipld,ibit,iand,irol,iand,ibmi,iand,iand,iand,ibit,iand,irol,iand,isec,iand,idec,itsc,ibit,iand,irol,iand,irti,ieor,iwdm,ieor,imvp,ieor,ilsr,ieor,ipha,ieor,ilsr,iphk,ijmp,ieor,ilsr,ieor,ibvc,ieor,ieor,ieor,imvn,ieor,ilsr,ieor,icli,ieor,iphy,itcd,ijmp,ieor,ilsr,ieor,irts,iadc,iper,iadc,istz,iadc,iror,iadc,ipla,iadc,iror,irtl,ijmp,iadc,iror,iadc,ibvs,iadc,iadc,iadc,istz,iadc,iror,iadc,isei,iadc,iply,itdc,ijmp,iadc,iror,iadc,ibra,ista,ibrl,ista,isty,ista,istx,ista,idey,ibit,itxa,iphb,isty,ista,istx,ista,ibcc,ista,ista,ista,isty,ista,istx,ista,itya,ista,itxs,itxy,istz,ista,istz,ista,ildy,ilda,ildx,ilda,ildy,ilda,ildx,ilda,itay,ilda,itax,iplb,ildy,ilda,ildx,ilda,ibcs,ilda,ilda,ilda,ildy,ilda,ildx,ilda,iclv,ilda,itsx,ityx,ildy,ilda,ildx,ilda,icpy,icmp,irep,icmp,icpy,icmp,idec,icmp,iiny,icmp,idex,iwai,icpy,icmp,idec,icmp,ibne,icmp,icmp,icmp,ipei,icmp,idec,icmp,icld,icmp,iphx,istp,ijmp,icmp,idec,icmp,icpx,isbc,isep,isbc,icpx,isbc,
iinc,isbc,iinx,isbc,inop,ixba,icpx,isbc,iinc,isbc,ibeq,isbc,isbc,isbc,ipea,isbc,iinc,isbc,ised,isbc,iplx,ixce,ijsr,isbc,iinc,isbc],

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

step = function() {
	breakFlag=false;
	var opcode =m1();
	excycles=0;

	//co v 16bit modu?
	pc++;
	pc &=0xffff;


	var ad = admode[opcode]();
	console.log(opcode,ad,pc,admode[opcode]);

	instruct[opcode](ad);

	pc+=exbytes;
	
	//zase, co 16bit?
	pc &=0xffff;
	var time = cycletime[opcode]+excycles;
  T+=time; 
  if (ticks) ticks(time);
  return time; 

},

reset = function(){
    pc=wordAt(ResetTo);
	//pc=0;
	sp=255;
	a=x=y=dbr=pbr=dp=0;
	flags=32;
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

var ds = [["BRK",1],["ORA (@,X)",2],["-",0],["SLO (@,X)",2],["-",0],["ORA *@",2],["ASL *@",2],["SLO *@",2],["PHP",1],
["ORA #@",2],["ASL A",1],["ANC #@",2],["-",0],["ORA ^",3],["ASL ^",3],["SLO ^",3],["BPL @",2],["ORA (@),Y",2],["-",0],
["SLO (@),Y",2],["-",0],["ORA *@,X",2],["ASL *@,X",2],["SLO *@,X",2],["CLC",1],["ORA ^,Y",3],["-",0],["SLO ^,Y",3],["-",0],
["ORA ^,X",3],["ASL ^,X",3],["SLO ^,X",3],["JSR ^",3],["AND (@,X)",2],["-",0],["RLA (@,X)",2],["BIT *@",2],["AND *@",2],
["ROL *@",2],["RLA *@",2],["PLP",1],["AND #@",2],["ROL A",1],["-",0],["BIT ^",3],["AND ^",3],["ROL ^",3],["RLA ^",3],
["BMI @",2],["AND (@),Y",2],["-",0],["RLA (@),Y",2],["-",0],["AND *@,X",2],["ROL *@,X",2],["RLA *@,X",2],["SEC",1],
["AND ^,Y",3],["-",0],["RLA ^,Y",3],["-",0],["AND ^,X",3],["ROL ^,X",3],["RLA ^,X",3],["RTI",1],["EOR (@,X)",2],
["-",0],["SRE (@,X)",2],["-",0],["EOR *@",2],["LSR *@",2],["SRE *@",2],["PHA",1],["EOR #@",2],["LSR A",1],["ALR #@",2],
["JMP ^",3],["EOR ^",3],["LSR ^",3],["SRE ^",3],["BVC @",2],["EOR (@),Y",2],["-",0],["SRE (@),Y",2],["-",0],
["EOR *@,X",2],["LSR *@,X",2],["SRE *@,X",2],["CLI",1],["EOR ^,Y",3],["-",0],["SRE ^,Y",3],["-",0],["EOR ^,X",3],
["LSR ^,X",3],["SRE ^,X",3],["RTS",1],["ADC (@,X)",2],["-",0],["RRA (@,X)",2],["-",0],["ADC *@",2],["ROR *@",2],
["RRA *@",2],["PLA",1],["ADC #@",2],["ROR A",1],["ARR #@",2],["JMP (^)",3],["ADC ^",3],["ROR ^",3],["RRA ^",3],
["BVS @",2],["ADC (@),Y",2],["-",0],["RRA (@),Y",2],["-",0],["ADC *@,X",2],["ROR *@,X",2],["RRA *@,X",2],["SEI",1],
["ADC ^,Y",3],["-",0],["RRA ^,Y",3],["-",0],["ADC ^,X",3],["ROR ^,X",3],["RRA ^,X",3],["-",0],["STA (@,X)",2],
["-",0],["SAX (@,X)",2],["STY *@",2],["STA *@",2],["STX *@",2],["SAX *@",2],["DEY",1],["-",0],["TXA",1],["XAA #@",2],
["STY ^",3],["STA ^",3],["STX ^",3],["SAX ^",3],["BCC @",2],["STA (@),Y",2],["-",0],["AHX (@),Y",2],["STY *@,X",2],
["STA *@,X",2],["STX *@,Y",2],["SAX *@,Y",2],["TYA",1],["STA ^,Y",3],["TXS",1],["TAS ^,Y",3],["SHY ^,X",3],["STA ^,X",3],
["SHX ^,Y",3],["AHX ^,Y",3],["LDY #@",2],["LDA (@,X)",2],["LDX #@",2],["-",0],["LDY *@",2],["LDA *@",2],["LDX *@",2],["-",0],
["TAY",1],["LDA #@",2],["TAX",1],["LAX #@",2],["LDY ^",3],["LDA ^",3],["LDX ^",3],["-",0],["BCS @",2],["LDA (@),Y",2],["-",0],
["-",0],["LDY *@,X",2],["LDA *@,X",2],["LDX *@,Y",2],["-",0],["CLV",1],["LDA ^,Y",3],["TSX",1],["LAS ^,Y",3],["LDY ^,X",3],
["LDA ^,X",3],["LDX ^,Y",3],["-",0],["CPY #@",2],["CMP (@,X)",2],["-",0],["DCP (@,X)",2],["CPY *@",2],["CMP *@",2],["DEC *@",2],
["DCP *@",2],["INY",1],["CMP #@",2],["DEX",1],["AXS #@",2],["CPY ^",3],["CMP ^",3],["DEC ^",3],["DCP ^",3],["BNE @",2],
["CMP (@),Y",2],["-",0],["DCP (@),Y",2],["-",0],["CMP *@,X",2],["DEC *@,X",2],["DCP *@,X",2],["CLD",1],["CMP ^,Y",3],["-",0],
["DCP ^,Y",3],["-",0],["CMP ^,X",3],["DEC ^,X",3],["DCP ^,X",3],["CPX #@",2],["SBC (@,X)",2],["-",0],["ISC (@,X)",2],
["CPX *@",2],["SBC *@",2],["INC *@",2],["ISC *@",2],["INX",1],["SBC #@",2],["NOP",1],["-",0],["CPX ^",3],["SBC ^",3],
["INC ^",3],["ISC ^",3],["BEQ @",2],["SBC (@),Y",2],["-",0],["ISC (@),Y",2],["-",0],["SBC *@,X",2],["INC *@,X",2],["ISC *@,X",2],
["SED",1],["SBC ^,Y",3],["-",0],["ISC ^,Y",3],["-",0],["SBC ^,X",3],["INC ^,X",3],["ISC ^,X",3]];

var disasm = function(i,a,b,pc) {
      var sx = ds[i];
      var s = sx[0];
      var d8 = toHex2(a);
      var rel8 = (a<128) ? toHex4(a+pc+2) : toHex4(pc + a - 256+2);
      s=s.replace(" @"," $"+rel8);
      s=s.replace("@","$"+d8);
      var d16 = toHex2(b)+toHex2(a);
      s=s.replace("^","$"+d16);
      return [s,sx[1]];
    };

return {
	"steps": function(Ts){
		//T=0;
		while (Ts>0){
			Ts-=step(); 
			if (breakFlag) {T+=Ts;return;}
		}; 
	}, 
	"T":function(){return T}, 
	"memr":function(addr){return byteAt(addr)}, 
	"reset":reset, 
	"init": function(bt,ba,tck){
		byteTo=bt; 
		byteAt = ba; 
		ticks=tck; 
		reset();
	},
	"status": function() {
		return {
			"pc":pc,
			"sp":sp,
			"a":a,
			"x":x,
			"y":y,
			"flags":flags,
			"break":breakFlag
		};
	},
	"interrupt": function() {
		if (flags & fINT) {
			return;
		}
		//flags |= fBKC;
		stPushWord(pc);
		stPush(flags);
		flags |= fINT;
		pc=wordAt(IrqTo);
		T+=7;
		//console.log(pc);
	},
	"nmi": function() {
		stPushWord(pc);
		stPush(flags);
		flags |= fINT;
		pc=wordAt(NMITo);
		T+=7;
		//console.log(pc);
	},
	"set":function(reg,value) {
		switch (reg.toUpperCase()) {
			case "PC": pc=value;return;
			case "A": a=value;return;
			case "X": x=value;return;
			case "Y": y=value;return;
			case "SP": sp=value;return;
			case "FLAGS": flags=value;return;
		}
	},
	"flagsToString": function() {
		var f='',fx = "NVMXDIZC";
		for (var i=0;i<8;i++) {
			var n = flags&(0x80>>i);
			if (n==0) {f+=fx[i].toLowerCase();} else {f+=fx[i]}
		}
		return f;
	},
	"disasm": disasm
};

}));

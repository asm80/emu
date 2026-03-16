var toHexN = function(n,d) {
    var s = n.toString(16);
    while (s.length <d) {s = '0'+s;}
    return s.toUpperCase();
};

var toHex2 = function(n) {return toHexN(n & 0xff,2);};
var toHex4 = function(n) {return toHexN(n & 0xffff,4);};




var lastled={r:true,g:true,y:true};

var PMDLED = function(led,state) {
    if (lastled[led]==state) return;
    if (state) {
        $("#led-"+led).attr("class","on");
    } else {
        $("#led-"+led).attr("class","off");
    }
    lastled[led]=state;
}


var CPMFS = (function(window) {
    var disk = null;
    var sectrans = [1,7,13,19,25,5,11,17,23,3,9,15,21,2,8,14,20,26,6,12,18,24,4,10,16,22];
    var spt = 26;
    var fat = [];
    var dir = [];
    var fulldir = [];
    var getsec = function (secnum) {
        var track = Math.floor(secnum / spt);
        var sec = sectrans[secnum % spt] - 1;
        var phy = (sec + (track * spt))*128;
        var out = [];
        for (var i=0;i<128;i++) {
            out[i] = disk[phy + i];
        }
        return out;
    };

    var getfn = function(sec,pos) {
        var out = '';
        for(var i=0;i<11;i++) {
            out+=String.fromCharCode(sec[pos+1+i]);
        }
        return out;
    };

    var getextent = function(s,pos,idx) {
        var u = s[pos];
        var ex = s[pos+12];
        var s2 = s[pos+14];
        var rc = s[pos+15];
        var name = getfn(s,pos);
        var al = [];
        for(var i=0;i<16;i++) {
            if(s[pos+16+i]==0) break;
            al.push(s[pos+16+i]);
            fat[s[pos+16+i]] = name;
        }
        return {name:name,u:u,ex:ex,s2:s2,rc:rc,al:al, pos:pos, idx:idx};
    };

    var getdir = function() {
        var out = [];
        fat=[];
        fulldir=[];
        for (var i=0;i<243;i++) {fat[i]=null;}
        for (var i=0;i<16;i++) {
            s = getsec(52+i);
            fulldir.push(getextent(s,0,i));
            if (s[0]!=0xe5) out.push(getextent(s,0,i));
            fulldir.push(getextent(s,32,i));
            if (s[32]!=0xe5) out.push(getextent(s,32,i));
            fulldir.push(getextent(s,64,i));
            if (s[64]!=0xe5) out.push(getextent(s,64,i));
            fulldir.push(getextent(s,96,i));
            if (s[96]!=0xe5) out.push(getextent(s,96,i));
        }
        dir=out;
        return out;
    };

    var fn2cpm = function(s) {
        s = s.toUpperCase()+"           ";
        s = s.substr(0,12);
        var out = [" "," "," "," "," "," "," "," "," "," "," "];
        var i;
        for (i=0;i<8;i++) {
            if (s[i]=='.') break;
            if (!s[i]) break;
            out[i]=s[i];
        }

        if (s[i]=='.') i++;
        out[8]=s[i++];
        out[9]=s[i++];
        out[10]=s[i++];
        var str='';
        for(i=0;i<11;i++) {str += out[i];}
        return str;
    };

    var findfile = function(fn) {
        getdir();
        var norm = fn2cpm(fn);
        var out=[];
        for(var i=0;i<dir.length;i++) {
            if (dir[i].name==norm) {
                out.push(dir[i]);
            }
        }
        out.sort(function (a,b){if (a.ex>b.ex) return 1; else return -1;});
        return out;
    };

    var readfile = function(fn) {
        var exts = findfile(fn);
        var data = [];
        for (var e=0;e<exts.length;e++) {
            var al = exts[e].al;
            var rc = exts[e].rc;
            for (var a=0;a<al.length;a++){
                var block = al[a];
                var rec = (rc<8)?rc:8;
                var d = getblock(block,rec);
                //console.log(block,rec);
                rc-=d.length/128;
                data = [].concat.apply(data,d);
            }
        }
        return data;
    };

    var deletefile = function(fn) {
        var exts = findfile(fn);
        var data = [];
        for (var e=0;e<exts.length;e++) {
            var idx = exts[e].idx;
            var d = getsec(52+idx);
            d[exts[e].pos] = 0xe5;
            setsec(52+idx,d);
        }
        return getdir();
    };

    var freedirnum = function() {
        dirs = 64;
        for (i=0;i<64;i++) {
            if (fulldir[i].u<64) dirs--;
        }
        return dirs;
    };

    var freefatnum = function() {
        fats = 241;
        for (i=2;i<243;i++) {
            if (fat[i]!==null) fats--;
        }
        return fats;
    };

    var getfreedir = function() {
        for (i=0;i<64;i++) {
            if (fulldir[i].u>64) return i;
        }
        return null;
    };


    var getfreeblock = function(offset) {
        offset = offset ? offset+1 : 2;
        for (i=offset;i<243;i++) {
            if (fat[i]===null) return i;
        }
        return null;
    };


    var writefile = function(fn,data) {
        deletefile(fn);
        var recs = Math.ceil(data.length/128);
        var exts = Math.ceil(recs/128);
        var blocks = Math.ceil(recs/8);
        var freeblocks = freefatnum();
        if (blocks>freeblocks) throw("No free blocks");
        var freedirs = freedirnum();
        if (exts>freedirs) throw("No free directory entries");
        var name = fn2cpm(fn);
        var ptr = 0;
        for (var e=0;e<exts;e++) {
            //vytvorim zaznam do dir
            var dir = getfreedir();
            var idx = fulldir[dir].idx;
            var pos = fulldir[dir].pos;
            var out = getsec(52+idx);
            var rc = (recs>128)?128:recs;

            out[pos+0] = 0;
            for(var i=0;i<11;i++) {out[pos+i+1]=name.charCodeAt(i);}
            out[pos+12] = e; //ex
            out[pos+13] = 0; 
            out[pos+14] = 0; 
            out[pos+15] = rc;



            for (var i=0;i<16;i++) {out[pos+i+16]=0;}
            var block = 0;
            for (var i=0;i<16;i++) {
                block = getfreeblock(block);
                if (!block) throw("No free blocks");
                ptr = setblock(block, recs,data,ptr);
                out[pos+i+16] = block;
                recs -=8;
                if(recs<0) break;
            }
            //ulozeni do dir
            
            setsec(52+idx,out);
        }
        getdir();
    }

    var setblock = function(al,recs, data, ptr) {
        var out = [],d;
        for(var i=0;i<recs;i++) {
            if (i==8) break;
            out=[];
            for (var j=0;j<128;j++) {
                out[j] = data[ptr+j];
            }

            setsec(al*8+52+i,out);
            ptr+=128;
        }
        return ptr;
    };


    var getblock = function(al,recs) {
        var out = [],d;
        for(var i=0;i<recs;i++) {
            if (i==8) break;
            d = getsec(al*8+52+i);
            for (var j=0;j<128;j++) out.push(d[j]);
        }
        return out;
    };

    var setsec = function (secnum,dta) {
        var track = Math.floor(secnum / spt);
        var sec = sectrans[secnum % spt] - 1;
        var phy = (sec + (track * spt))*128;
        var out = [];
        for (var i=0;i<128;i++) {
            disk[phy + i] = dta[i];
        }
    };


    return {
        open: function(dsk){disk = dsk;return getdir();},
        dir: function(){return getdir();},
        getsec:getsec,
        getblock:getblock,
        getfat: function(){return fat;},
        findfile:findfile,
        readfile:readfile,
        writefile:writefile,
        deletefile:deletefile,
        freefatnum:freefatnum,
        freedirnum:freedirnum,
        fn2cpm:fn2cpm
    };

})(window);


var traceur = false;


;(function(window){
    var cnt = 3;
	var RAM = new Uint8Array(new ArrayBuffer(65536));
	var pmiDisplay = null;

    var readFDC = function (drv,trk,sec,addr) {
        var geom = drives[drv];
        var logic = sec - 1 + (geom.sectors * trk);
        for (var i=0;i<128;i++) {
            byteTo(addr+i,drivefiles[drv][logic*128+i]);
        }
        fdc.dskstatus=0;
    };
    var writeFDC = function (drv,trk,sec,addr) {
        var geom = drives[drv];
        var logic = sec - 1 + (geom.sectors * trk);
        for (var i=0;i<128;i++) {
            drivefiles[drv][logic*128+i] = byteAt(addr+i);
        }
        fdc.dskstatus=0;
        
        if (drv==1) {
            brefresh = true;
        }
        
    };
    
	var byteTo = function(addr,b) {
/*
        if (addr == 16000)  {
            console.log(EMU.CPU.status());
        }
        */
        //if ((addr>=0x0000) && (addr<0x2000)) return; //ROM


        RAM[addr] = b & 0xff;};
	var byteAt = function(addr) {
        if (traceur)   {
//            console.log(toHex4(EMU.CPU.status().pc-1),EMU.CPU.status());
        }


        return RAM[addr] || 0;};


	var portOut = function (port, value) {

        switch (port&0xff) {
            case 1: // CON OUT
                bTerminal.outchar(String.fromCharCode(value));
                return;

            case 10:
                fdc.drv = value & 0xff; return;
            case 11:
                fdc.trk = value & 0xff; return;
            case 12:
                fdc.sec = value & 0xff; return;
            case 15:
                fdc.dma = (fdc.dma & 0xff00) | (value & 0xff); return;
            case 16:
                fdc.dma = (fdc.dma & 0x00ff) | ((value & 0xff)<<8); return;
            case 13: //FDC command
                
                if (fdc.drv>=drives.length) {
                    fdc.dskstatus = 1; //illegal drive
                    return;
                }

                if (fdc.trk>=drives[fdc.drv].tracks) {
                    fdc.dskstatus = 2; //illegal track
                    return;
                }
                if (fdc.sec == 0 || fdc.sec>drives[fdc.drv].sectors) {
                    fdc.dskstatus = 3; //illegal sector
                    return;
                }

                if (value==0) {
                    //read
                    if(fdc.dma>(65536-128)) {
                        fdc.dskstatus=5;
                    } else {
                        readFDC(fdc.drv, fdc.trk,fdc.sec,fdc.dma);
                    }
                    return;
                }
                if (value==1) {
                    //write
                    if(fdc.dma>(65536-128)) {
                        fdc.dskstatus=6;
                    } else {
                        writeFDC(fdc.drv, fdc.trk,fdc.sec,fdc.dma);
                    }
                    return;
                }
                fdc.dskstatus=7;
                return;

        }
        //console.log((port&0xff), value);

        return;
	};

    var portIn = function (port) {
        
        switch(port&0xff){
            case 0:
                return (termkey) ? 0xff : 00;
            case 1:
                if (termkey) {var k = termkey; termkey=null;return k;}
                return 0;
            case 4:
                return 0xff;
            case 10:
                return fdc.drv;    
            case 11:
                return fdc.trk;    
            case 12:
                return fdc.sec;    

            case 13:
                return (fdc.iocount==0) ? 0xff : 0;
            case 14:
                return fdc.dskstatus;    
            case 15:
                return fdc.dma & 0xff;    
            case 16:
                return (fdc.dma & 0xff) >> 8;    

        }        
        return 0x1a;
    };

	var hexLine = function(ln) {
		if (ln[0]!=':') return false;
		var len = parseInt(ln[1]+ln[2], 16);
		var start = parseInt(ln[3]+ln[4]+ln[5]+ln[6], 16);
		var typ = parseInt(ln[7]+ln[8], 16);
		if (typ==0) {
			for (i=0;i<len;i++) {
				RAM[start+i] = parseInt(ln[9+2*i]+ln[10+2*i], 16);
			}
		}
	}

	

	window.EMU = {
		CPU:null,
		init: function(cpu) {
			RAM = [];
			EMU.CPU = cpu;
			EMU.CPU.init(byteTo,byteAt, null, portOut, portIn);
            //mgstart();
		},
		readHex: function(hex){
			var hexlines = hex.split(/\n/);
			for(var i=0;i<hexlines.length;i++){
				hexLine(hexlines[i]);
			}
		},
        readCom: function(com){
            for(var i=0;i<com.length;i++){
                var n = parseInt(com[i*3+1]+com[i*3+2],16);
                RAM[0x100+i] = n;
            }
        },
		RAM: function(){return RAM;},
/*
        INTERRUPT: function(vector) {
//            console.log(vector);
            EMU.CPU.interrupt(vector);

        },
        */
        RESET: function() {
            EMU.CPU.init(byteTo,byteAt, null, portOut, portIn);
        },
		T:0,
		MEMDUMP:0,
		linemap:null
	}
})(window);





var readHash = function() {
    var hash=document.location.hash;
    if (hash.substr(0,6)=='#load/') {
        var fn = hash.substr(6);
        var f = FS.load(fn+".com");
        if (!f) return;
            
            var out=[];
            for(var i=0;i<f.length;i+=3){
                var n = parseInt(f[i+1]+f[i+2],16);
                out[i/3] = n;
            }
            CPMFS.open(drivefiles[1]);
            var efn = fn.replace(".z80",'.com');
            CPMFS.deletefile(efn);
            CPMFS.writefile(efn,out);
            console.log(out);
            $("header h3 button").attr("onclick", "document.location.href='index.html#load/"+fn+"'");
            document.location.hash='';
    }
};

var fileExt = function(name){
    if (!name) return "";
    return name.substr(name.lastIndexOf(".")+1);
}

var dsksave = function() {
    FS.save("disk.cpm",drivefiles[1]);
};

$(document).ready(function(){

    $("td.but").mousedown(function(){
        keyd($(this).attr("id"));
    });
    $("td.but").mouseup(function(){
        keyu($(this).attr("id"));
    });

    $("#reset-button").mouseup(function(){
        EMU.RESET();
        EMU.CPU.set("PC", 0xF200);
        EMU.CPU.set("SP", 0x0000);
        EMU.readHex(cpm);
        EMU.readHex(bios);
    });

    $("#break-button").mouseup(function(){
        if (!STOP) {
            $("#accordion").hide();
            $("#emulator").show();
            DBG.bindEMU(EMU);
            bTerminal.keylock(false);
            STOP=true;}
        else {
            DBG.stop();
            $("#accordion").show();
            $("#emulator").hide();
            bTerminal.keylock(true);
            STOP=false;            
        }

    });



    updateFiles();
    renderDrive();

    DBG.init("#emulator");

    $( "#accordion" ).accordion({heightStyle: "fill"});

    $("#filesystem li a").click(function(n){
        var read;
        var fn = $(this).attr("data-file");
        var ext = fileExt(fn).toUpperCase();
        if (ext == 'HEX') {
            read = confirm("You are about overwrite work memory with this .hex file. Are you sure to continue?");
            if (read) {
                EMU.readHex(FS.load(fn));
                return false;
                }
            }

            if (ext == 'COM') {
                read = confirm("You are about overwrite work memory with this .hex file. Are you sure to continue?");
                if (read) {
                    EMU.readCom(FS.load(fn));
                    return false;
                    }
                }

        
        if (ext == 'CPM') {
            read = true;
            if (mgf.length>0) {
                read = confirm("You are about overwrite work tape. Are you sure to continue?");
            }
            if (read) {
                mgf = JSON.parse(FS.load(fn));
                window.localStorage['cpm'] = JSON.stringify(mgf);
                $('#mginfo').html("Tape length:"+mgf.length);
                return false;
                }
            }
        }
    );

});
FS = new LFS(localStorage);
var updateFiles = function () {
    var dir = FS.dir().sort();
    dir = dir.filter(function(fn){
        var ok = false;
        if (fn.indexOf('.z80.hex')>0) ok = true;
        if (fn.indexOf('.cpm')>0) ok = true;
        if (fn.indexOf('.com')>0) ok = true;
        return ok;
    });
    $("#filesystem").html("");
    for (var i=0;i<dir.length;i++) {
        var fnid = dir[i].replace(/\./g,'-');
        $("#filesystem").append('<li><a href="#'+fnid+'" data-file="'+dir[i]+'">'+dir[i]+'</a></li>');
    }
};

var renderDrive = function() {
    if (brefresh) {
        var dir = CPMFS.open(drivefiles[1]);
        var fnz = '';
        for(var i = 0; i<dir.length;i++) {
            if (dir[i].ex>0) continue;
            var name = dir[i].name;
            name = name.substr(0,8).trim() + '.' + name.substr(8,3).trim();
            
            fnz+='<li>'+name+'</li>';
        }
        $('#bdir').html("<ul>"+fnz+"</ul>");
        brefresh = null;
    }

    setTimeout(renderDrive,2000);
};

/*
var bios = FS.load("bios.z80.hex");
var cpm = FS.load("cpm.z80.hex");
*/
var termkey = null;

//var serport = new MC6850();
EMU.init(CPUZ80);
EMU.CPU.set("PC", 0xF200);
EMU.CPU.set("SP", 0x0000);
EMU.readHex(cpm);
EMU.readHex(bios);


var drives = [{tracks:77, sectors:26, name:"dsk0.cpm"},
                 {tracks:77, sectors:26, name:"dsk1.cpm"}];



var drivefiles = [];

drivefiles[0] = bootdisk;
//drivefiles[1] = emptydisk;

drivefiles[1] = FS.load("disk.cpm");
if (drivefiles[1]==null) {

    drivefiles[1] = new Uint8Array(256256);
    for(var i=0;i<77*26;i++) {
        drivefiles[1][128*i+0] = 0xe5;
        drivefiles[1][128*i+32] = 0xe5;
        drivefiles[1][128*i+64] = 0xe5;
        drivefiles[1][128*i+96] = 0xe5;
    }
    dsksave();
}

readHash();brefresh=true;



var fdc = {
    drv:0,
    trk:0,
    sec:0,
    iocount:0,
    dma:0,
    dskstatus:0
};

bTerminal.init('#tdisplay',function(c) {termkey = (c.charCodeAt(0));}, true);
//serport.hook("transmit", function (b) {bTerminal.outchar(String.fromCharCode(b));});

var brefresh = 1;

var nope = false; 

var blinkT = 0;

var STOP = false;
//var STOP = true;



var MOZ=false;
var cts = null;
var FCPU = 3500000;

if (window.webkitAudioContext && typeof(window.webkitAudioContext)=='function'){
	cts= new webkitAudioContext();
};

if (window.AudioContext && typeof(window.AudioContext)=='function'){
	cts= new AudioContext(); MOZ=true;
};

cts = false;

if (cts) {

var kHz4 = 0;
var kHz1 = 0;
var s4 = false;
var s1 = false;
var s0 = false;

var audbuf = [];

var SOUND = cts.sampleRate;
var SLEN = 1024;
var TPERS = FCPU / SOUND;
var TTS = Math.floor(TPERS * SLEN);
var audptr = 0;
var audT = 0;
if (!MOZ) {
	var audnode =  cts.createJavaScriptNode(SLEN,1,1);
} else {
	var audnode =  cts.createScriptProcessor(SLEN,1,1);
}



var myrun = function(e) {
	var datalen=SLEN;
    	var data = e.outputBuffer.getChannelData(0);
    var akT = 0;
    var minx = sound.shift();
    for (var i = 0; i < datalen; ++i) {
      data[i] = 0;
      if (s4) data[i] = (kHz4>6)?0.3:0;
      if (s1) data[i] += (kHz1>3)?0.3:0;
      if (s0) data[i] = 0.1;
      kHz4++;
      kHz1++;
      if(kHz4==12) kHz4 = 0;
	  if(kHz1==6) kHz1 = 0;
	  if (minx) {
	  	//FCPU / SOUND
	  	if (minx[0]< (TPERS * i)) {
	  		//console.log(minx);
//	  		s1 = (minx[1]&1)?true:false;
	  		s0 = (minx[1]&0x40)?true:false;
//	  		s0 = (minx[1]&4)?true:false;
		  	minx = sound.shift();
	  	}
	  }
    }


	if (nope) {console.log("slow");return;}
	nope = true;
	sound = [];
	soundT = EMU.CPU.T();


	//FCPU / SOUND * SLEN
	//2000000 / 48000 * 1024
	if (!STOP) EMU.CPU.steps(TTS); //@2MHz
	//if (sound.length>0) {console.log(sound);}
	//AND1.render(EMU.RAM());
    bTerminal.animate();
	nope = false;
};
	audnode.onaudioprocess = myrun;
	audnode.connect(cts.destination);


} else {
    var ANIM = Math.floor(FCPU/60);

	window.requestAnimFrame = (function(){
	  return  window.requestAnimationFrame       || 
	          window.webkitRequestAnimationFrame || 
	          window.mozRequestAnimationFrame    || 
	          window.oRequestAnimationFrame      || 
	          window.msRequestAnimationFrame     || 
	          function( callback ){
	            window.setTimeout(callback, 1000 / 60);
	          };
	})();


	function animloop(){
//			requestAnimFrame(animloop);

	        //window.setTimeout(animloop,1000/50);
	        if (nope) {console.log("slow");return;}

	        nope = true;
	        if (!STOP) EMU.CPU.steps(ANIM); //@2.5MHz
            bTerminal.animate();
	        //PMDISPSYNC2(EMU.RAM(),blinkT);
//			EMU.CPU.steps(10000); //@2.5MHz
//	        IQDISP(EMU.RAM());
			window.setTimeout(animloop,1000/60);

	        nope = false;
	};


	animloop();
}

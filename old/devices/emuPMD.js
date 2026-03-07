var toHexN = function(n,d) {
    var s = n.toString(16);
    while (s.length <d) {s = '0'+s;}
    return s.toUpperCase();
};

var toHex2 = function(n) {return toHexN(n & 0xff,2);};
var toHex4 = function(n) {return toHexN(n & 0xffff,4);};
/*

var PMDISPSYNC = function(RAM, blinkT) {
    var canvas = document.getElementById('pmdcanvas');
    var context = canvas.getContext('2d');
    var idata = context.getImageData(0,0,288,256);
    var buf = new ArrayBuffer(idata.data.length);
    var buf8 = new Uint8ClampedArray(buf);
    var data = new Uint32Array(buf);
    //var data = idata.data;
    for (var addr=0xc000;addr<65536;addr++) {
        var disp = addr - 0xc000;
        var line = disp >> 6;
        var pos = disp & 0x3f;
        if (pos>47) continue;
        var canbeg = (line*288) + (pos * 6);
        var nbyte = RAM[addr];
        var bright = (nbyte&0x40)?255:192;
        var blink = (nbyte&0x80);
        if (blink && blinkT>50) bright = 0;
        for (i=0;i<6;i++) {
            if (nbyte & 1) {
            	data[(canbeg+i)] = (255<<24) | (bright<<16) | (bright<<8) | (bright);
            } else {
            	data[(canbeg+i)] = (255<<24);
            }
            nbyte = nbyte>>1;
        }
    }

    idata.data.set(buf8);
    context.putImageData(idata,0,0);


};
*/

var METMODE = 1;

var hasClamp = true;
try {
    if (Uint8ClampedArray) hasClamp = true;
} catch (e) {
    hasClamp = false;
}


var PMDISPSYNC2 = function(RAM, blinkT) {
    var canvas = document.getElementById('pmdcanvas2');
    var context = canvas.getContext('2d');
    //var idata = context.getImageData(0,0,576,512); //288,256
    var idata = context.createImageData(576,512);

    var buf = new ArrayBuffer(idata.data.length);
    var buf8 = hasClamp? new Uint8ClampedArray(buf) : idata.data;
    var data = new Uint32Array(buf);
    var cnone = (255<<24);

    //var data = idata.data;
    for (var addr=0xc000;addr<65536;addr++) {
        var disp = addr - 0xc000;
        var line = disp >> 6;
        var pos = disp & 0x3f;
        if (pos>47) continue;
        var canbeg = (line*576) + (pos * 6);
        var nbyte = RAM[addr];
        var bright = (nbyte&0x40)?255:192;
        var blink = (nbyte&0x80);
        if (blink && blinkT>50) bright = 0;
        var brightMET = bright * METMODE;
        var cbi2;
        if (hasClamp) {
            var clamp = (255<<24) | (brightMET<<16) | (bright<<8) | (brightMET);
            for (i=0;i<6;i++) {
        	   cbi2 = (canbeg+i)*2;
                if (nbyte & 1) {
                	data[cbi2] = clamp;
            	   data[cbi2+1] = clamp;
            	   data[cbi2+576] = clamp;
            	   data[cbi2+577] = clamp;
                } else {
                	data[cbi2] = cnone;
            	   data[cbi2+1] = cnone;
            	   data[cbi2+576] = cnone;
            	   data[cbi2+577] = cnone;
                }
                nbyte = nbyte>>1;
            }
        } else {
                for (i=0;i<6;i++) {
                   cbi2 = (canbeg+i)*8;
                    if (nbyte & 1) {
                        buf8[cbi2+0] = brightMET;
                        buf8[cbi2+1] = bright;
                        buf8[cbi2+2] = brightMET;
                        buf8[cbi2+3] = 255;
                        buf8[cbi2+4] = brightMET;
                        buf8[cbi2+5] = bright;
                        buf8[cbi2+6] = brightMET;
                        buf8[cbi2+7] = 255;
                        buf8[cbi2+2304+0] = brightMET;
                        buf8[cbi2+2304+1] = bright;
                        buf8[cbi2+2304+2] = brightMET;
                        buf8[cbi2+2304+3] = 255;
                        buf8[cbi2+2304+4] = brightMET;
                        buf8[cbi2+2304+5] = bright;
                        buf8[cbi2+2304+6] = brightMET;
                        buf8[cbi2+2304+7] = 255;

                    } else {
                        buf8[cbi2+0] = 0;
                        buf8[cbi2+1] = 0;
                        buf8[cbi2+2] = 0;
                        buf8[cbi2+3] = 255;
                        buf8[cbi2+4] = 0;
                        buf8[cbi2+5] = 0;
                        buf8[cbi2+6] = 0;
                        buf8[cbi2+7] = 255;
                        buf8[cbi2+2304+0] = 0;
                        buf8[cbi2+2304+1] = 0;
                        buf8[cbi2+2304+2] = 0;
                        buf8[cbi2+2304+3] = 255;
                        buf8[cbi2+2304+4] = 0;
                        buf8[cbi2+2304+5] = 0;
                        buf8[cbi2+2304+6] = 0;
                        buf8[cbi2+2304+7] = 255;

                    }
                    nbyte = nbyte>>1;
                }
        }
    }

    //idata.data = data;
    if (hasClamp) {
        idata.data.set(buf8);
    } else {
        idata.data = buf8;
    }

    context.putImageData(idata,0,0);


};


var mgf = [], mgwait, mgt, mgrec=false;

var keylock = true;

var mg_rec = function() {
    mgstart();
    $('#mginfo').html("RECORDING");
};
var mg_play = function() {
    mgf = JSON.parse(window.localStorage['pmdtape']);
    mgplay();
    $('#mginfo').html("PLAYBACK");
};
var mg_stop = function() {
    window.localStorage['pmdtape'] = JSON.stringify(mgf);
    mgrec = false;
    mgplayback = false;
    $('#mginfo').html("Tape length:"+mgf.length);
};
var fileExt = function(name){
    return name.substr(name.lastIndexOf(".")+1);
}
var mg_save = function() {
    var fn = prompt("File name");
    if (!fn) return false;
    var ext = fileExt(fn).toUpperCase();
    if (!ext || ext!='PMDTAPE') fn+= '.pmdtape';
    if (FS.load(fn)) {
        if (! confirm("File "+fn+" already exists. Are you sure to overwrite?")) return false;
    }

    //console.log(ext,fn);

    FS.save(fn,window.localStorage['pmdtape']);

    updateFiles();
};


function mgstart() {
    mgf = [];
    mgwait = true;
    mgrec = true;
    mgt = 0;
    mglast = 0;
};
/*
function mgo(PA,T) {
    if (!mgrec) return;
    if (mgwait && ((PA&0x80)>0)) {
        //go!
        mgt = T;
        mgwait = false;
        mglast = 0x80;
        return;
    }

    var mgnew = PA & 0x80;
    if (mgnew!=mglast) {
        mgf.push(T-mgt);
        if (mgf.length % 50 == 0) $('#mginfo').html("RECORDING "+mgf.length);
        mglast = mgnew;
        mgt = T;
    }
};
*/
var mgplast=0x80;
var mgpos = 0;
var mgpt = 0;
var mgplayback = false;
var mgdelay = 0;
function mgplay() {
    mgplast=0x00;
    mgpt=0;
    mgplayback = true;
    mgpos = 1;
    mgdelay = mgf[0];
};
/*
function mgi(T) {
    if (!mgplayback) return 0x80;
    if (mgpt==0) {mgpt = T;}
    var diff = T-mgpt;
    mgdelay -= diff;
    mgpt = T;
    if (mgdelay >0) return mgplast;
    mgdelay = mgf[mgpos++];
    mgplast ^= 0x80;
    if (mgpos % 50 == 0) $('#mginfo').html("PLAYBACK "+(mgf.length - mgpos));
    if (mgpos>mgf.length) mgplayback = false;
    //console.log(mgplast);
    return mgplast;

};
*/
/*
//audio, omg!
var audbuf = [];
var cts= new webkitAudioContext();
var audptr = 0;
var audT = 0;
var audnode = cts.createJavaScriptNode(1024,1,1);
var audx=0;
audnode.onaudioprocess = function(e) {
    var data = e.outputBuffer.getChannelData(0);
    for (var i = 0; i < data.length; ++i) {
      data[i] = audbuf[i+1024*audx];
      //data[i] = (i & 0x0010) >> 4;
    }
    audx = audx?0:1;
};

audnode.connect(cts.destination);
*/

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


var KEYS = {
    //  K0, 1, Q, A, Sp
    0: [112, [97,49], 81,65,32 ],  //F1, 1, Q, A, Spc
    // k1, 2, W, S, Y
    1: [113,[98,50],87,83,89 ],  //F2
    // k2, 3, E, D, X
    2: [114,[99,51],69,68,88 ],  //F3
    //k3, 4, R, F, C
    3: [115,[100,52],82,70,67 ],  //...
    // k4, 5, T, G, V
    4: [116,[101,53],84,71,86],  
    // k5, 6, Z, H, B
    5: [117,[102,54],90,72,66 ],  
    // k6, 7, U, J, N
    6: [118,[103,55],85,74,78 ],  
    // k7, 8, I, K, M
    7: [119,[104,56],73,75,77 ],  
    // k8, 9, O, L, comma
    8: [120,[105,57],79,76,188 ],  
    // k9, 0, P, ", .
    9: [121,[96,48],80,222,190 ],  
    // k10, minus, [, ;, /
    10: [122,189,219,186,191 ],  //F1, 1, Q, A, Spc
    // k11, bkslash, ], =
    11: [123,220,221,187,0 ],  //F1, 1, Q, A, Spc
    //wrk, INS, <--, [<--, ***
    12: [192,45,[37,8],38,0 ],  //  `   ins  lft  up
    // cd, DEL, HOME, END, lEOL
    13: [9,46,36,35,0 ],  //Tab, DEL, HOME,  END
    // rcl, CLR, -->, -->], rEOL
    14: [33,34,39,40,13 ],  //pgup, pgdn, right, down
    15: [27,0,0,0,0 ]  //F1, 1, Q, A, Spc
};

var PMDKEY = function (PA) {
    var col = PA&0x0f;
    var o = 0;
    //console.log("COL",col);
    for (var i=0;i<5;i++) {
    	var nkey = KEYS[col][i];
    	var kk = false;
    	if (typeof(nkey)=='object') {
    		//console.log(nkey, typeof nkey);
    		for(var l=0;l<nkey.length;l++) {

    			if (keymap[nkey[l]]) {
    				kk=keymap[nkey[l]];
    				break;
    			}
    		}
    	} else {
    		kk = keymap[nkey];
    	}
        if (kk) {
            o+=32;
//            console.log(col,i);
        }
        o = o>>1;
    }

    if (keymap[16]) o |= 0x20;
    if (keymap[27]) o |= 0x40; //STOP - ScrlLock

    o = 255-o;


    return o;
};


var traceur = false;

var sound = [];
var soundT = 0;

;(function(window){
    var cnt = 3;
	var RAM = new Uint8Array(new ArrayBuffer(65536));
	var pmiDisplay = null;
	var byteTo = function(addr,b) {
/*
        if (addr == 16000)  {
            console.log(EMU.CPU.status());
        }
        */
        if ((addr>0x8000) && (addr<0x9000)) return; //ROM

        RAM[addr] = b & 0xff;};
	var byteAt = function(addr) {
        if (traceur)   {
//            console.log(toHex4(EMU.CPU.status().pc-1),EMU.CPU.status());
        }

        if(addr == 0xcf6) {traceur = false;}
        if(addr == 0x6c1) {traceur = true;}

        return RAM[addr] || 0;};

        var PA, PB, PC;
        var ROMPA, ROMPB, ROMPC;

	var portOut = function (port, value) {
        //console.log("OUT", port, value);
        if (port == 0x1e) {
        	mgf.push(value);
            //console.log("MG ",value);
            $('#mginfo').html("RECORDING "+mgf.length);
        }
        if (port == 0xf4) {
            PA=value;
            PB = PMDKEY(PA);
        }
        if (port == 0xf6) {
            PC = value;
            sound.push([EMU.CPU.T()-soundT, PC&7]);
            PMDLED("r", (PC&8)>0);
            PMDLED("y", (PC&7)>0);
        }
        if (port == 0xf8) {
            ROMPA=value;
        };
        if (port == 0xf9) {
            ROMPB=value;
        };
        if (port == 0xfa) {
            ROMPC=value;
        };
	};

    var portIn = function (port) {
        //console.log("IN", port);
        if (port == 0x1e) {
//            console.log(toHex4(EMU.CPU.status().pc-1),EMU.CPU.status());
			if (mgplayback) {
				$('#mginfo').html("PLAYBACK "+(mgf.length - mgpos -1));
				//console.log(mgf[mgpos])
				if(mgpos == mgf.length) {mgplayback=false;}
				return mgf[mgpos++];
			}
            return 0;
        }
        if (port == 0x1f) {
            return 01 | (mgplayback?2:0);
        };
        if (port == 0xf4) {
            return PA;
        };
        if (port == 0xf5) {
            PB = PMDKEY(PA);
            return PB;
        };
        if (port == 0xf6) {
            return PC;
        };
        if (port == 0xf8) {
            return ROM[ROMPB + 256*ROMPC];
        };
        if (port == 0xf9) {
            return ROMPB;
        };
        if (port == 0xfa) {
            return ROMPC;
        };

        //console.log(port);

        return 0xff;
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
            mgstart();
		},
		readHex: function(hex){
			var hexlines = hex.split(/\n/);
			for(var i=0;i<hexlines.length;i++){
				hexLine(hexlines[i]);
			}
		},
		RAM: function(){return RAM;},
        INTERRUPT: function(vector) {
//            console.log(vector);
            EMU.CPU.interrupt(vector);

        },
        RESET: function() {
            EMU.CPU.init(byteTo,byteAt, null, portOut, portIn);
        },
		T:0,
		MEMDUMP:0,
		linemap:null
	}
})(window);



///keyboard
///
var keymap = [];

//test - key captured
var keytest = function(key) {
	if (key==16) return true;
	for (var i=0;i<16;i++) {
		var row = KEYS[i];
		for (var j=0;j<row.length;j++) {
			if (row[j]==key) return true;
			if (typeof(row[j])=='object') {
				for (var l=0;l<row[j].length;l++) {
					if (row[j][l]==key) return true;
				}
			}
		}
	}
	return false;
};

var keyd = function(key) {
    //$("#"+key).addClass("pressed");
    keymap[key] = true;
    
};
var keyu = function(key) {
    //$("#"+key).removeClass("pressed");
    //console.log(key);
    keymap[key] = false;
};


var readHash = function() {
    var hash=document.location.hash;
    if (hash.substr(0,6)=='#load/') {
        var fn = hash.substr(6);
        var f = FS.load(fn+".hex");
        if (!f) return;
            document.location.hash='';
            EMU.readHex(f);
            $("header h3 button").attr("onclick", "document.location.href='index.html#load/"+fn+"'");
    }
};


$(document).ready(function(){
    readHash();

    $("td.but").mousedown(function(){
        keyd($(this).attr("id"));
    });
    $("td.but").mouseup(function(){
        keyu($(this).attr("id"));
    });
window.onkeydown = function(e) {
    if (!keylock) return;

    var key = e.keyCode;
    //console.log(e);
    if (e.ctrlKey) {key = 27;}
    //console.log(key);
    //e.preventDefault();
    if (key && keytest(key)) {
        keyd(key); 
        if (key<32 || key>100) e.preventDefault();
        //e.preventDefault();
    }
    return;
};
window.onkeyup = function(e) {
    if (!keylock) return;

    var key = e.keyCode;
    //console.log(key);
    if (e.ctrlKey) {key = 27;}
    if (key==145 && keymap[16]) {
        EMU.RESET();
        EMU.CPU.set("PC",0x8000);
        e.preventDefault();
    }
    if (key && keytest(key)) {
        keyu(key);
        if (key<32 || key>100) e.preventDefault();
        //e.preventDefault();
    }
    return;
};
    $("#reset-button").mouseup(function(){
        EMU.RESET();
        EMU.CPU.set("PC",0x8000);
    });
    $("#break-button").mouseup(function(){
        if (!STOP) {
            $("#accordion").hide();
            $("#emulator").show();
            DBG.bindEMU(EMU);
            keylock = false;
            STOP=true;}
        else {
            DBG.stop();
            $("#accordion").show();
            $("#emulator").hide();
            keylock = true;
            STOP=false;            
        }

    });

    updateFiles();
    DBG.init("#emulator");

    if (window.localStorage['pmdtape']) {
        mgf = JSON.parse(window.localStorage['pmdtape']);
        $('#mginfo').html("Tape length:"+mgf.length);
    }
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
        
        if (ext == 'PMDTAPE') {
            read = true;
            if (mgf.length>0) {
                read = confirm("You are about overwrite work tape. Are you sure to continue?");
            }
            if (read) {
                mgf = JSON.parse(FS.load(fn));
                window.localStorage['pmdtape'] = JSON.stringify(mgf);
                $('#mginfo').html("Tape length:"+mgf.length);
                return false;
                }
            }
        }
    );
    $("button#mgrec").button({icons:{primary:"ui-icon-bullet"}});
    $("button#mgplay").button({icons:{primary:"ui-icon-play"}});
    $("button#mgstop").button({icons:{primary:"ui-icon-pause"}});
    $("button#mgsave").button({icons:{primary:"ui-icon-disk"}});

    $(".demotape").click(function(){
    	var h = $(this).attr("href");
    	$.get("./demo/"+h,{}, function(data) {
    		data = JSON.parse(data);
    		mgf = data[1];
    		alert("Tape "+h+" has been entered into virtual tape player. \n\n----Message---\n"+data[0]);
    		mg_stop();
    	})
    	return false;
    });

});
FS = new LFS(localStorage);
var updateFiles = function () {
    var dir = FS.dir().sort();
    dir = dir.filter(function(fn){
        var ok = false;
        if (fn.indexOf('.a80.hex')>0) ok = true;
        if (fn.indexOf('.pmdtape')>0) ok = true;
        return ok;
    });
    $("#filesystem").html("");
    for (var i=0;i<dir.length;i++) {
        var fnid = dir[i].replace(/\./g,'-');
        $("#filesystem").append('<li><a href="#'+fnid+'" data-file="'+dir[i]+'">'+dir[i]+'</a></li>');
    }
};

EMU.init(CPU8080);
EMU.CPU.set("PC", 0x8000);
//FS = new LFS(localStorage);
//EMU.readHex(FS.load('pmi80.a80.hex'));
//EMU.readHex(monitor2a);
EMU.readHex(monitor);
if(document.location.hash=='#metmode') {METMODE=0;}

//window.setTimeout(function(){EMU.CPU.steps(100);EMU.renderDisplay();},2);

var nope = false; 

var blinkT = 0;

var STOP = false;


var MOZ=false;
var cts = null;

if (window.webkitAudioContext && typeof(window.webkitAudioContext)=='function'){
	cts= new webkitAudioContext();
};

if (window.AudioContext && typeof(window.AudioContext)=='function'){
	cts= new AudioContext(); MOZ=true;
};

if (cts) {

var kHz4 = 0;
var kHz1 = 0;
var s4 = false;
var s1 = false;
var s0 = false;

var audbuf = [];

var FCPU = 2000000;
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
      if (s1) data[i] += (kHz1>24)?0.3:0;
      if (s0) data[i] = 0.3;
      kHz4++;
      kHz1++;
      if(kHz4==12) kHz4 = 0;
	  if(kHz1==48) kHz1 = 0;
	  if (minx) {
	  	//FCPU / SOUND
	  	if (minx[0]< (TPERS * i)) {
	  		//console.log(minx);
	  		s1 = (minx[1]&1)?true:false;
	  		s4 = (minx[1]&2)?true:false;
	  		s0 = (minx[1]&4)?true:false;
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
	PMDISPSYNC2(EMU.RAM(),blinkT);
	blinkT++; 
	if (blinkT==100) blinkT = 0;
	nope = false;
};
	audnode.onaudioprocess = myrun;
	audnode.connect(cts.destination);


} else {

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
	        if (!STOP) EMU.CPU.steps(40000); //@2.5MHz
	        //PMDISPSYNC2(EMU.RAM(),blinkT);
//			EMU.CPU.steps(10000); //@2.5MHz
	        PMDISPSYNC2(EMU.RAM(),blinkT);
			window.setTimeout(animloop,1000/50);

	        blinkT++; 
	        if (blinkT==100) {blinkT = 0;}
	        nope = false;
	};


	animloop();
}
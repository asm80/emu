//PMI monitor
var monitor = 
":100000003E8AD3FB00C32E0022DF1FE122E21F2124\n"+
":1000100000003922E41F21DD1FF9C5D5F5E122DDFD\n"+
":100020001F2AEC1F3AEE1F77212002C3400021D97E\n"+
":100030001F22E41FC33D00FFC3E61FFFFF21E701AE\n"+
":1000400031D91F22FC1FCD160121EF1F22FC1F3EBC\n"+
":100050001DCDAB00CD1601210B020606BE23CA6DD5\n"+
":1000600000232305C25C00210202C340004E236628\n"+
":1000700069E93E16CDAB00CDD7007E32FA1F3E189F\n"+
":1000800002CDFB002AF81F3AFA1F772322F81FCD72\n"+
":10009000BB00C37A001E1620191912151B1E1E164E\n"+
":1000A0002019051011131EFFFFFFFF1108002AFC85\n"+
":1000B0001F1936191DC2AE002B77C901F11F2AF88E\n"+
":1000C0001F7CCDC6007DD5570F0F0F0FE60F020323\n"+
":1000D0007AE60F0203D1C9CDBB00CD1601C8D29775\n"+
":1000E000012AF81FE60F29292929856F22F81FC345\n"+
":1000F000D70001F61F2AFA1FC3C500CDF200CD16A6\n"+
":1001000001C8D29D01000000E60F29292929856F29\n"+
":1001100022FA1FC3FB00CD4001D216010F4FCD4084\n"+
":1001200001DA1E01CD400179FE90C908090D0B0AC4\n"+
":1001300013140E0C0F051A0D0B0AE4DFD9DBDDFFDB\n"+
":10014000E5C5D5110000427A32FE1F3E7FD3F8008C\n"+
":100150007B2FD3FA002AFC1F194E21BE01097ED342\n"+
":10016000F8003AFE1FB7C288010E09219A01DBFA96\n"+
":1001700000E6700707D2820107D2810107DA880101\n"+
":10018000090909197E32FE1F1C3E0ABBC24B013A07\n"+
":10019000FE1F07D1C1E1C921F001C3400021F901CF\n"+
":1001A000C34000808488918D8C89858182868A9A5B\n"+
":1001B0008F8E8B8783FF9493FF9792FFFF904079F8\n"+
":1001C000243019120278001808034621060E07236E\n"+
":1001D0002F0C47634871377F092B0B2C5D3F426121\n"+
":1001E0007B11FFFFFFFFFF1E131601191F08001EE2\n"+
":1001F0000E1212180A0D120E050E121218190D0AFF\n"+
":10020000100A1E190E12121112191E927200912953\n"+
":1002100002975A029A7E02944C03938C03FFFFFFCD\n"+
":100220001E0B121F051011131E3E20CDAB002AE23B\n"+
":100230001F22F81FCDD7002AF81F22E21F3E06D347\n"+
":10024000F8003E0FD3FA0021E91FF9D1C1F12AE4E9\n"+
":100250001FF92AE21FE52ADF1FC93E0BCDAB002A9A\n"+
":10026000EC1F22F81FCDD7002AF81F22EC1F7E3288\n"+
":10027000EE1F36CF2AE21F2B22E21FC329023E12B5\n"+
":10028000CDAB00CD1601D26700E60F010600212A92\n"+
":10029000010B090C0DCA4F00BEC28E02212F01CDE9\n"+
":1002A000CD025D213401CDCD026322F61FC5CDCA3A\n"+
":1002B00002E54E23666922F81FCDD700D17D1213C7\n"+
":1002C0007C12C10DC29C02C34F00213901060009F6\n"+
":1002D0006E261FC906093EC7CDEE02791F4F3E8F1D\n"+
":1002E0001FCDEE023E47CDEE0205C2D602C9162052\n"+
":1002F000D3F81E041DC2F402EE4015C2F002C9FF7D\n"+
":1003000006081600CD4203DA0403CD4203DA0403E3\n"+
":10031000CD4203D21003CD4203D2100315CD4203C8\n"+
":10032000DA1C03CD4203DA1C0314CD4203D22903A5\n"+
":10033000CD4203D229037A17791F4F160005C21C3C\n"+
":1003400003C91E021DC24403DBFA17C93E05CDAB2B\n"+
":1003500000CDD700CDFB0021950022FC1FCD16015A\n"+
":100360003E23D3F83E0FD3FA16F03EC7CDF0023A43\n"+
":10037000FA1F4FCDD4023E10CDAB002AF81F4ECD50\n"+
":10038000D4022CC27E03219E00C343003E14CDAB99\n"+
":1003900000CDD700CDFB0021950022FC1FCD16011A\n"+
":1003A0002AF81F3E07D3F83E0FD3FA16A0CD42031A\n"+
":1003B000DAAB0315C2AD03CD00033AFA1FB9C2CCC4\n"+
":1003C00003CD0003712CC2C103C38603DAE7033EE9\n"+
":1003D0000FCDAB007901F61FCDC60021EF1F22FC27\n"+
":1003E0001FCD1601C3A00321ED03C39A031E1620DF\n"+
":1003F0001905130A101EFFFFFFFFFFFFFFFFFFFF9E\n"+
":00000001FF";


var toHexN = function(n,d) {
    var s = n.toString(16);
    while (s.length <d) {s = '0'+s;}
    return s.toUpperCase();
};

var toHex2 = function(n) {return toHexN(n & 0xff,2);};
var toHex4 = function(n) {return toHexN(n & 0xffff,4);};


var DISP7 = DISP7 || function (elements, id) {
        var html = '';
        var dosvit =[];
        for (var i = 0; i < elements; i++) {
            html += '	<table align="center" class="sevenseg sd' + i + id + '">' +
                '<tr class="thin">' +
                '<td class="bg narrow"></td>' +
                '<td data-id="seg_a" class="off wide"></td>' +
                '<td class="bg narrow"></td>' +
                '</tr>' +
                '<tr class="thick">' +
                '<td data-id="seg_f" class="off narrow"></td>' +
                '<td class="bg wide"></td>' +
                '<td data-id="seg_b" class="off narrow"></td>' +
                '</tr>' +
                '<tr class="thin">' +
                '<td class="bg narrow"></td>' +
                '<td data-id="seg_g" class="off wide"></td>' +
                '<td class="bg narrow"></td>' +
                '</tr>' +
                '<tr class="thick">' +
                '<td data-id="seg_e" class="off narrow"></td>' +
                '<td class="bg wide"></td>' +
                '<td data-id="seg_c" class="off narrow"></td>' +
                '</tr>' +
                '<tr class="thin">' +
                '<td class="bg narrow"></td>' +
                '<td data-id="seg_d" class="off wide"></td>' +
                '<td class="bg narrow"></td>' +
                '</tr>' +
                '</table>';
                dosvit[i] = {a:0,b:0,c:0,d:0,e:0,f:0};
        }
        document.getElementById(id).innerHTML = html;
         
        var set = function (d, s, f) {
        	if (d>=elements) return;
            if (f) {
            	dosvit[d][s] = 20;
                $(".sd" + d + id + " td[data-id=seg_" + s + "]").removeClass("off");
                $(".sd" + d + id + " td[data-id=seg_" + s + "]").addClass("on");
            } else {
            	if (dosvit[d][s]>0) {
            		dosvit[d][s] = dosvit[d][s]-1;
            		return;
            	}

                $(".sd" + d + id + " td[data-id=seg_" + s + "]").removeClass("on");
                $(".sd" + d + id + " td[data-id=seg_" + s + "]").addClass("off");
            }
        };

        return set;
    };

var PMIDISP = function(id) {
    var disp = DISP7(9, id);
    return function(p,val) {
        for (var i=0;i<7;i++) {
            disp(p,"abcdefg".substr(i,1),val & 1);
            val = val>>1;
        }
    }
};

var PMIKB = function (pc) {
    var segment = 15-(pc&0x0f);
    var out = 7;
    switch(segment) {
        case 8: out = (keymap.kbeq?0:1) + (keymap.kb3?0:2) + (keymap.kb1?0:4); break;
        case 7: out =                 1 + (keymap.kb7?0:2) + (keymap.kb5?0:4); break;
        case 6: out =                 1 + (keymap.kbb?0:2) + (keymap.kb9?0:4); break;
        case 5: out = (keymap.kbm?0:1)  + (keymap.kbe?0:2) + (keymap.kbc?0:4); break;
        case 4: out = (keymap.kbbr?0:1) + (keymap.kbf?0:2) + (keymap.kbd?0:4); break;
        case 3: out =                 1 + (keymap.kbr?0:2) + (keymap.kbex?0:4);break;
        case 2: out = (keymap.kbl?0:1)  + (keymap.kba?0:2) + (keymap.kb8?0:4); break;
        case 1: out = (keymap.kbs?0:1)  + (keymap.kb6?0:2) + (keymap.kb4?0:4); break;
        case 0: out =                 1 + (keymap.kb2?0:2) + (keymap.kb0?0:4); break;
    }
    //console.log(toHex2(pc),toHex2(out));
    // if (out!=7) console.log(toHex2(pc),toHex2(out));
    return out;
};



var mgf = [], mgwait, mgt, mgrec=false;

var mg_rec = function() {
    mgstart();
    $('#mginfo').html("RECORDING");
};
var mg_play = function() {
    mgf = JSON.parse(window.localStorage['pmitape']);
    mgplay();
    $('#mginfo').html("PLAYBACK");
};
var mg_stop = function() {
    window.localStorage['pmitape'] = JSON.stringify(mgf);
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
    if (!ext || ext!='PMITAPE') fn+= '.pmitape';
    if (FS.load(fn)) {
        if (! confirm("File "+fn+" already exists. Are you sure to overwrite?")) return false;
    }

    console.log(ext,fn);

    FS.save(fn,window.localStorage['pmitape']);

    updateFiles();
};


function mgstart() {
    mgf = [30000];
    mgwait = true;
    mgrec = true;
    mgt = 0;
    mglast = 0;
};

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

;(function(window){
    var cnt = 3;
	var RAM = [];
	var pmiDisplay = null;
	var byteTo = function(addr,b) {
        if (addr == 0x1fe6 && cnt>0) {
            console.log(addr, b, EMU.CPU.status());
            cnt--;
        }
        if (addr<0x0400) return; //ROM
        RAM[addr] = b & 0xff;};
	var byteAt = function(addr) {return RAM[addr] || 0;};

	var PA, PB, PC = 0;

    var portA = function(value,port) {
        var segment = 15-(EMU.PIO.PORTC()&0x0f);
        pmiDisplay(segment,255-EMU.PIO.PORTA());
        
        mgo(EMU.PIO.PORTA()&0xc0,EMU.CPU.T());
    };
    var portC = function(value,port) {
        //var segment = 15-(EMU.PIO.PORTC()&0x0f);
        //pmiDisplay(segment,255-EMU.PIO.PORTA());
    };


	var portOut = function (port, value) {
        if (port == 0xf8) {EMU.PIO.PA(value); return;}
        if (port == 0xf9) {EMU.PIO.PB(value); return;}
        if (port == 0xfa) {EMU.PIO.PC(value); return;}
        if (port == 0xfb) {EMU.PIO.CTRL(value); return;}
        /*
		if (port == 0xfa) {
			//PC1
			PC = value;
			var segment = 15-(PC&0x0f);
			pmiDisplay(segment,255-PA);
			return
		};
		if (port == 0xf8) { //PA
			PA = value;
			var segment = 15-(PC&0x0f);
			pmiDisplay(segment,255-PA);
            //$("#pa").html(PA&0xc0);
            mgo(PA&0xc0,EMU.CPU.T());
		}
        */
	};

    var portIn = function (port) {
        if (port == 0xfa) {
            var kb = PMIKB(EMU.PIO.PORTC());
            var port = kb<<4 | 0x0f | mgi(EMU.CPU.T());
            EMU.PIO.PORTC(port);

            return EMU.PIO.PC();}
        /*
        if (port == 0xfa) {
            //PC1
            var kb = PMIKB(PC);
            var port = kb<<4 | 0x0f | mgi(EMU.CPU.T());
            return port;
        };
        */
    }
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
			pmiDisplay = PMIDISP('sdisplay'); //wip
			RAM = [];
			EMU.CPU = cpu;
            EMU.PIO = new I8255();
            EMU.PIO.hook(0,portA);
            EMU.PIO.hook(2,portC);
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



var keymap = {
    kb0:false,
    kb1:false,
    kb2:false,
    kb3:false,
    kb4:false,
    kb5:false,
    kb6:false,
    kb7:false,
    kb8:false,
    kb9:false,
    kba:false,
    kbb:false,
    kbc:false,
    kbd:false,
    kbe:false,
    kbf:false,
    kbeq:false,
    kbs:false,
    kbl:false,
    kbm:false,
    kbbr:false,
    kbr:false,
    kbex:false,
    kbi:false,
    kbre:false
};

var keyd = function(key) {
    $("#"+key).addClass("pressed");
    keymap[key] = true;
};
var keyu = function(key) {
    $("#"+key).removeClass("pressed");
    keymap[key] = false;
    if (key=='kbre') {
        EMU.RESET();
    }

    if (key=='kbi') {
        EMU.INTERRUPT(0x38);
    }
};

var keydecode = function (key) {
    var id=0;
    switch (key) {
        //numpad
        case 96: id="kb0"; break;
        case 97: id="kb1"; break;
        case 98: id="kb2"; break;
        case 99: id="kb3"; break;
        case 100: id="kb4"; break;
        case 101: id="kb5"; break;
        case 102: id="kb6"; break;
        case 103: id="kb7"; break;
        case 104: id="kb8"; break;
        case 105: id="kb9"; break;

        //alpha
        case 65: id="kba"; break;
        case 66: id="kbb"; break;
        case 67: id="kbc"; break;
        case 68: id="kbd"; break;
        case 69: id="kbe"; break;
        case 70: id="kbf"; break;

        //spec
        case 73: id="kbi"; break;
        case 76: id="kbl"; break;
        case 77: id="kbm"; break;
        case 82: id="kbr"; break;
        case 83: id="kbs"; break;
        case 13: id="kbeq"; break; //enter =
        case 88: id="kbex"; break; //x
        case 90: id="kbre"; break; //z - re
        case 81: id="kbbr"; break; //q - br

        //nums Mac fix
        case 48: id="kb0"; break;
        case 49: id="kb1"; break;
        case 50: id="kb2"; break;
        case 51: id="kb3"; break;
        case 52: id="kb4"; break;
        case 53: id="kb5"; break;
        case 54: id="kb6"; break;
        case 55: id="kb7"; break;
        case 56: id="kb8"; break;
        case 57: id="kb9"; break;    }
    return id;
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
    var key = e.keyCode;
    var id = keydecode(key);
    if (key) {
        keyd(id); e.preventDefault();
    }
    return;
};
window.onkeyup = function(e) {
    var key = e.keyCode;
    var id = keydecode(key);
    if (key) {
        keyu(id);e.preventDefault();
    }
    return;
};

    updateFiles();

    if (window.localStorage['pmitape']) {
        mgf = JSON.parse(window.localStorage['pmitape']);
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
        
        if (ext == 'PMITAPE') {
            read = true;
            if (mgf.length>0) {
                read = confirm("You are about overwrite work tape. Are you sure to continue?");
            }
            if (read) {
                mgf = JSON.parse(FS.load(fn));
                window.localStorage['pmitape'] = JSON.stringify(mgf);
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

});
FS = new LFS(localStorage);
var updateFiles = function () {
    var dir = FS.dir().sort();
    dir = dir.filter(function(fn){
        var ok = false;
        if (fn.indexOf('.a80.hex')>0) ok = true;
        if (fn.indexOf('.pmitape')>0) ok = true;
        return ok;
    });
    $("#filesystem").html("");
    for (var i=0;i<dir.length;i++) {
        var fnid = dir[i].replace(/\./g,'-');
        $("#filesystem").append('<li><a href="#'+fnid+'" data-file="'+dir[i]+'">'+dir[i]+'</a></li>');
    }
};


EMU.init(CPU8080);
//FS = new LFS(localStorage);
//EMU.readHex(FS.load('pmi80.a80.hex'));
EMU.readHex(monitor);

//window.setTimeout(function(){EMU.CPU.steps(100);EMU.renderDisplay();},2);

var nope = false; 

function animloop(){
        requestAnimFrame(animloop);
        if (nope) return;
        nope = true;
        EMU.CPU.steps(18518);2057
        nope = false;
};


animloop();

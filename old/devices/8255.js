/***********************
8255 emulation

(C) 2013 martin maly, www.retrocip.cz

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
***************/

(function(name, definition) {
    if (typeof module != 'undefined') module.exports = definition();
    else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);
    else this[name] = definition();
}('I8255', function() {

var I8255 = I8255 || function () {
	this.reset();
	this.CTRL(0x9b);
	this._hooks = {0:[],1:[],2:[]};
	
};

I8255.prototype.reset = function() {
	this.cPA = this.cPB = this.cPC = this.cCTRL = 0;
	this._interface = [0,0,0];
	this._INTEa = 0; 
	this._INTEa2= 0; 
	this._INTEb = 0; 
};


I8255.prototype.hook = function(port,cb) {
	this._hooks[port].push(cb);
};

I8255.prototype.setPort = function(a,n) {
	if (n!==undefined) this._interface[a] = n;
	var hox = this._hooks[a];
	if (hox) {for(var i=0;i<hox.length;i++) {
		var fn = hox[i];
		fn(this._interface[a], a);
	}}
};

I8255.prototype.PA = function(n) {
	if (n===undefined) {this.RDa();
		if (this._AMODE>0) {return this._ADIR ? this._latchA : this.cPA;}
		return this._ADIR ? this._interface[0] : this.cPA;
	}
	this.cPA = n;
	if (!this._ADIR) {
		this.setPort(0,n);
	}
	if (((this._AMODE==1) && (this._ADIR===0)) || (this._AMODE>1)) {
		if(this._INTEa) {
			this._interface[2] |= 0x08; //set INTRb
			this._INTRa = 1;
			this.setPort(2);			
		}
		this._interface[2] |= 0x80; //set OBFb
		this._OBFa = 1;
		this.setPort(2);			

	}
};
I8255.prototype.PB = function(n) {
	if (n===undefined) {this.RDb();
		if (this._BMODE==1) {return this._BDIR ? this._latchB : this.cPB;}
		return this._BDIR ? this._interface[1] : this.cPB;
	}
	this.cPB = n;
	if (!this._BDIR) {
		this.setPort(1,n);
	}
	if ((this._BMODE==1) && (this._BDIR===0)) {
		if(this._INTEb) {
			this._interface[2] |= 0x01; //set INTRb
			this._INTRb = 1;
			this.setPort(2);			
		}
		this._interface[2] |= 0x02; //set OBFb
		this._OBFb = 1;
		this.setPort(2);			

	}
};
I8255.prototype.PC = function(n) {
	var cl,ch;
	if (n===undefined) {
		
		cl = this._CLDIR ? (this._interface[2] & 0x0f) : (this.cPC & 0x0f);
		ch = this._CHDIR ? (this._interface[2] & 0xf0) : (this.cPC & 0xf0);
		return cl | ch;
	}
	this.cPC = n;
	var hook = false;
	cl = this._CLDIR ? (this._interface[2] & 0x0f) : (this.cPC & 0x0f);
	ch = this._CHDIR ? (this._interface[2] & 0xf0) : (this.cPC & 0xf0);
	if (!this._CLDIR | !this._CHDIR) this.setPort(2, cl | ch);
};
I8255.prototype.CTRL = function(n) {
	if (n===undefined) {return this.cCTRL;}
	this.cCTRL = n;
	if (n & 0x80) {
		// control
		this._CLDIR = (n & 0x01)?1:0;
		this._BDIR  = (n & 0x02)?1:0;
		this._BMODE = (n & 0x04)?1:0;
		this._CHDIR = (n & 0x08)?1:0;
		this._ADIR  = (n & 0x10)?1:0;
		this._AMODE = (n & 0x60)>>5;
	} else {
		var bit = (n & 0x0e)>>1;
		if (this._BMODE>0) {
			if (bit==2) this._INTEb = (n&1) ? 1: 0; 
			return;
		}
		if (this._AMODE==1) {
			if (bit==4 && this._ADIR==1) this._INTEa = (n&1) ? 1: 0; 
			if (bit==6 && this._ADIR===0) this._INTEa = (n&1) ? 1: 0; 
			return;
		}
		if (this._AMODE>1) {
			if (bit==4) this._INTEa = (n&1) ? 1: 0; 
			if (bit==6) this._INTEa2 = (n&1) ? 1: 0; 
			return;
		}
		// set bit C
		if (n&1) {
			//set
			this._interface[2] |= (1<<bit);
		} else {
			this._interface[2] &= (1<<bit) ^ 0xff;
		}
		this.setPort(2);
	}
};

I8255.prototype.RDb = function() {
	var flag = false;
	if (this._IBFb) {
		this._IBFb = 0;
		this._interface[2] &= 0xFB; //reset IBFb
		flag = true;
	}
	if (this._INTRb) {
		this._INTRb = 0;
		this._interface[2] &= 0xFE; //reset IBFb
		flag = true;
	}

	if (flag) this.setPort(2);
};
I8255.prototype.RDa = function() {
	var flag = false;
	if (this._IBFa) {
		this._IBFa = 0;
		this._interface[2] &= 0xBF; //reset IBFa
		flag = true;
	}
	if (this._INTRa) {
		this._INTRa = 0;
		this._interface[2] &= 0xF7; //reset IBFa
		flag = true;
	}

	if (flag) this.setPort(2);
};

I8255.prototype.PORTA = function(n) {
	if (n===undefined) {return this._interface[0];}
	this._interface[0] = n;
};
I8255.prototype.PORTB = function(n) {
	if (n===undefined) {return this._interface[1];}
	this._interface[1] = n;
};
I8255.prototype.PORTC = function(n) {
	var flag;
	if (n===undefined) {return this._interface[2];}
	this._interface[2] = n;

	//MODE1 ctrl B
	if (this._BMODE == 1) {
		if (this._BDIR) {
			//BGRP, MODE1, Input
			//STBb
			if ((n & 4) === 0) {
				this._latchB = this._interface[1];
				this._interface[2] |= 0x02; //set IBFb
				this._IBFb = 1;
				this.setPort(2);
			} else {
				if (this._interface[2] & 0x02 ) {
					if (this._INTEb) {
						this._interface[2] |= 0x01; //set INTRb
						this._INTRb = 1;
						this.setPort(2);	
					}
				}
			}
		} else {
			//BGRP, MODE1, Output
			if ((n & 4) === 0) {
				flag = false;
				if (this._OBFb) {
					this._OBFb = 0;
					this._interface[2] &= 0xFB; //reset OBFb
					flag = true;
				}
				if (this._INTRb) {
					this._INTRb = 0;
					this._interface[2] &= 0xFE; //reset INTRb
					flag = true;
				}

				if (flag) this.setPort(2);

			}
		}
	}

	//MODE1 ctrl A
	if (this._AMODE == 1) {
		if (this._ADIR) {
			//AGRP, MODE1, Input
			//STBb
			if ((n & 16) === 0) {
				this._latchA = this._interface[1];
				this._interface[2] |= 0x20; //set IBFa
				this._IBFa = 1;
				this.setPort(2);
			} else {
				if (this._interface[2] & 0x20 ) {
					if (this._INTEa) {
						this._interface[2] |= 0x08; //set INTRa
						this._INTRa = 1;
						this.setPort(2);	
					}
				}
			}
		} else {
			//BGRP, MODE1, Output
			if ((n & 64) === 0) {
				flag = false;
				if (this._OBFa) {
					this._OBFa = 0;
					this._interface[2] &= 0x7f; //reset OBFb
					flag = true;
				}
				if (this._INTRa) {
					this._INTRa = 0;
					this._interface[2] &= 0xf7; //reset INTRb
					flag = true;
				}

				if (flag) this.setPort(2);

			}
		}
	}

	//MODE2 ctrl A
	if (this._AMODE > 1) {
			//AGRP, MODE2
			if ((n & 64) === 0) {
				flag = false;
				if (this._OBFa) {
					this._OBFa = 0;
					this._interface[2] &= 0x7f; //reset OBFb
					flag = true;
				}
				if (this._INTRa) {
					this._INTRa = 0;
					this._interface[2] &= 0xf7; //reset INTRb
					flag = true;
				}
			}

			//STBa
			if ((n & 16) === 0) {
				this._latchA = this._interface[1];
				this._interface[2] |= 0x20; //set IBFa
				this._IBFa = 1;
				flag=true;
			} else {
				if (this._interface[2] & 0x20 ) {
					if (this._INTEa2) {
						this._interface[2] |= 0x08; //set INTRa
						this._INTRa = 1;
						flag=true;
					}
				}
			}
			if (flag) this.setPort(2);

	}


};
return  I8255;

}));
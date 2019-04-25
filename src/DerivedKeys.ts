export class DerivedKeys {
    aesKey: number[] = [];
    aesIV: number[] = [];
    hmacKey: number[] = [];
    
    constructor() { }

    getByte(i: number) {
        if (i < 16) {
            return this.aesKey[i];
        }
        else if (i < 32) {
            return this.aesIV[i - 16];
        }
        else {
            return this.hmacKey[i - 32];
        }
    }
    setByte(i: number, val: number) {
        if (i < 16) {
            this.aesKey[i] = val;
            return;
        }
        else if (i < 32) {
            this.aesIV[i - 16] = val;
            return;
        }
        else {
            this.hmacKey[i - 32] = val;
            return;
        }
    }
}

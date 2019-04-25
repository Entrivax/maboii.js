export class MasterKeys {
    constructor(public data: MasterKey, public tag: MasterKey) { }
}

export class MasterKey {
    constructor(
        public hmacKey: number[],
        public typeString: number[],
        public rfu: number,
        public magicBytesSize: number,
        public magicBytes: number[],
        public xorPad: number[]
    ) {}
}
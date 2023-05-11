import { getBigInt128, setBigInt128 } from './data-view-extends.js'

export class BigInt128Array {
    static of (...items: bigint[]): BigInt128Array {
        return new BigInt128Array(items)
    }
    
    static from (arrayLike: ArrayLike<bigint>): BigInt128Array
    static from<U>(arrayLike: ArrayLike<U>, mapfn: (v: U, k: number) => bigint, thisArg?: any): BigInt128Array
    static from<U>(arrayLike: ArrayLike<U>, mapfn?: (v: U, k: number) => bigint, thisArg?: any) {
        if (mapfn) {
            const array: bigint[] = []
            for (let i = 0; i < arrayLike.length; i++) 
                array.push(mapfn.call(thisArg, arrayLike[i], i))
            
            return new BigInt128Array(array)
        } else {
            const v = new BigInt128Array(arrayLike.length)
            v.set(arrayLike as ArrayLike<bigint>)
        }
    }
    
    readonly BYTES_PER_ELEMENT: number = 16
    readonly buffer: ArrayBufferLike
    readonly byteLength: number
    readonly byteOffset: number
        
    constructor (length?: number)
    constructor (array: Iterable<bigint>)
    constructor (buffer: ArrayBufferLike, byteOffset?: number, length?: number)
    constructor (fisrtArg: number | Iterable<bigint> | ArrayBufferLike, byteOffset?: number, length?: number) {
        if (typeof fisrtArg === 'number') {
            const length = fisrtArg
            this.buffer = new ArrayBuffer(length * this.BYTES_PER_ELEMENT)
            this.byteOffset = 0
            this.byteLength = length * this.BYTES_PER_ELEMENT
        } else if (fisrtArg instanceof ArrayBuffer || fisrtArg instanceof SharedArrayBuffer) {
            this.buffer = fisrtArg
            this.byteOffset = byteOffset ?? 0
            
            let byteLength = 0
            if (length) {
                byteLength = length * this.BYTES_PER_ELEMENT
                if (byteLength + this.byteOffset > fisrtArg.byteLength) 
                    throw new RangeError(`valid typed array length: ${length}`)
            } else {
                byteLength = fisrtArg.byteLength - this.byteOffset
                if (byteLength % this.BYTES_PER_ELEMENT !== 0) 
                    throw new RangeError('byte length of BigInt128Array should be a multiple of 16')
            }
            
            this.byteLength = byteLength
        } else {
            const array: bigint[] = []
            for (const value of fisrtArg) 
                array.push(value)
            
            this.buffer = new ArrayBuffer(array.length * this.BYTES_PER_ELEMENT)
            this.byteOffset = 0
            this.byteLength = array.length * this.BYTES_PER_ELEMENT
            this.set(array)
        }
    }
    
    get length () {
        return this.byteLength / this.BYTES_PER_ELEMENT
    }
    
    set (array: ArrayLike<bigint>, offset: number = 0) {
        const dv = new DataView(this.buffer)
        for (let i = 0; i < array.length; i++) 
            setBigInt128(dv, this.byteOffset + offset + i * this.BYTES_PER_ELEMENT, array[i])
    }
    
    at (index: number) {
        const length = this.length
        while (index < 0) 
            index += length
        
        const dv = new DataView(this.buffer)
        return getBigInt128(dv, this.byteOffset + index * this.BYTES_PER_ELEMENT)
    }
    
    subarray (begin: number = 0, end: number = this.length) {
        const length = end - begin
        return new BigInt128Array(this.buffer, this.byteOffset + begin * this.BYTES_PER_ELEMENT, length)
    }
    
    [Symbol.iterator] () {
        let index = 0
        const array = this
        return {
            next () {
                if (index < array.length) 
                    return { value: array.at(index++), done: false }
                else 
                    return { done: true }
            },
        }
    }
      
    // [Symbol.toStringTag]: 'BigInt128Array'
    
    toString () {
        const values: bigint[] = []
        for (const value of this) 
            values.push(value)
        return values.join(',')
    }
}

Object.defineProperty(BigInt128Array.prototype, Symbol.toStringTag, {
    configurable: false,
    writable: false,
    enumerable: false,
    value: 'BigInt128Array',
})




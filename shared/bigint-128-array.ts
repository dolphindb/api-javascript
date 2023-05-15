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
            if (length !== undefined) {
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
        
        return new Proxy(this, {
            get (target, key) {
                if (typeof key === 'string') {
                    const index = Number(key)
                    // only positive integer index is allowed
                    if (Number.isInteger(index) && index >= 0 && index < target.length) 
                        return target.at(index)
                }
                
                return Reflect.get(target, key)
            },
            set (target, key, value) {
                if (typeof key === 'string') {
                    const index = Number(key)
                    if (Number.isInteger(index) && index >= 0 && index < target.length) 
                        target.set([value], index)
                    
                    // ignore invalid number index setter, and never set value to target
                    return true
                }
                
                return Reflect.set(target, key, value)
            }
        })
    }
    
    
    get length () {
        return this.byteLength / this.BYTES_PER_ELEMENT
    }
    
    
    set (array: ArrayLike<bigint>, offset: number = 0) {
        if (offset + array.length > this.length) 
            throw new RangeError('offset is out of bounds')
        
        const dv = new DataView(this.buffer)
        for (let i = 0; i < array.length; i++) {
            const byteOffset = this.byteOffset + (offset + i) * this.BYTES_PER_ELEMENT
            setBigInt128(dv, byteOffset, array[i])
        }
    }
    
    
    at (index: number) {
        const length = this.length
        
        if (index < 0) 
            index += length
        
        if (index > length || index < 0)
            return undefined
            
        const dv = new DataView(this.buffer)
        return getBigInt128(dv, this.byteOffset + index * this.BYTES_PER_ELEMENT)
    }
    
    
    subarray (begin: number = 0, end: number = this.length) {
        const length = this.length
        // subarray arguments should be the same behavior as other TypedArray
        // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray#%E8%AF%B4%E6%98%8E
        if (begin < 0)
            begin += length
        
        if (end < 0)
            end += length
        
        if (begin < 0)
            begin = 0
        else if (begin > length)
            begin = length
        
        if (end < 0)
            end = 0
        else if (end > length)
            end = length
        
            
        const newLength = Math.max(end - begin, 0)
        return new BigInt128Array(this.buffer, this.byteOffset + begin * this.BYTES_PER_ELEMENT, newLength)
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

import dayjs from 'dayjs'
import DayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(DayjsCustomParseFormat)

import 'xshell/prototype.browser'
import { concat } from 'xshell/utils.browser'
import { connect_websocket } from 'xshell/net.browser.js'


export enum DdbForm {
    scalar = 0,
    vector = 1,
    pair = 2,
    matrix = 3,
    set = 4,
    dict = 5,
    table = 6,
    chart = 7,
    chunk = 8,
}

export enum DdbType {
    void = 0,
    bool = 1,
    char = 2,
    short = 3,
    int = 4,
    long = 5,
    date = 6,
    month = 7,
    time = 8,
    minute = 9,
    second = 10,
    datetime = 11,
    timestamp = 12,
    nanotime = 13,
    nanotimestamp = 14,
    float = 15,
    double = 16,
    symbol = 17,
    string = 18,
    uuid = 19,
    functiondef = 20,
    handle = 21,
    code = 22,
    datasource = 23,
    resource = 24,
    any = 25,
    compress = 26,
    dict = 27,
    datehour = 28,
    ipaddr = 30,
    int128 = 31,
    blob = 32,
    complex = 34,
    point = 35,
    duration = 36,
    object = 37,
    
    symbol_extended = 145,
}

export enum DdbFunctionType {
    SystemFunc = 0,
    SystemProc = 1,
    OperatorFunc = 2,
    UserDefinedFunc = 3,
    PartialFunc = 4,
    DynamicFunc = 5,
    PiecewiseFunc = 6,
    JitFunc = 7,
    JitPartialFunc = 8,
}

export interface DdbFunctionDefValue {
    type: DdbFunctionType
    name: string
}

export interface DdbSymbolExtendedValue {
    base_id: number
    base: string[]
    data: Uint32Array
}

export interface DdbArrayVectorBlock {
    unit: 1 | 2 | 4
    rows: number
    lengths: Uint8Array | Uint16Array | Uint32Array
    data: DdbVectorValue
}


export type DdbValue = null | boolean | number | [number, number] | bigint | string | string[] | Uint8Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | Uint8Array[] | DdbObj[] | DdbFunctionDefValue | DdbSymbolExtendedValue | DdbArrayVectorBlock[]


export type DdbVectorValue = string | string[] | Uint8Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | Uint8Array[] | DdbObj[] | DdbSymbolExtendedValue | DdbArrayVectorBlock[]


export const nulls = {
    int8: -0x80,  // -128
    int16: -0x80_00,  // -32768
    int32: -0x80_00_00_00,  // -21_4748_3648
    int64: -0x80_00_00_00_00_00_00_00n,  // -922_3372_0368_5477_5808
    float32: -3.4028234663852886e+38,
    
    /** -Number.MAX_VALUE */
    double: -Number.MAX_VALUE,
    
    bytes16: Uint8Array.from(
        new Array(16).fill(0)
    )
} as const


export const timezone_offset = 1000 * 60 * new Date().getTimezoneOffset()


/** 可以表示所有 DolphinDB 数据库中的数据类型 */
export class DdbObj <T extends DdbValue = DdbValue> {
    static dec = new TextDecoder('utf-8')
    
    static enc = new TextEncoder()
    
    /** 维护已解析的 symbol base，比如流数据中后续的 symbol 向量可能只发送一个 base.id, base.size == 0, 依赖之前发送的 symbol base ？
        只是暂存，如果一张表有多个 symbol 列，可能这个 symbol base 会被复用，不同的对象之间 symbol base 一般不复用
    */
    static symbol_bases: Record<number, string[]> = { }
    
    /** little endian (client) */
    static le_client = Boolean(
        new Uint8Array(
            Uint32Array.of(1).buffer
        )[0]
    )
    
    /** 是否为小端 (little endian) */
    le = DdbObj.le_client
    
    /** 数据形式 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataForms/index.html */
    form: DdbForm
    
    /** 数据类型 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataTypes/index.html */
    type: DdbType
    
    /** 占用 parse 时传入的 buf 的长度 */
    length: number
    
    /** table name / column name */
    name?: string
    
    /**
        最低维、第 1 维
        - vector: rows = n, cols = 1
        - pair:   rows = 2, cols = 1
        - matrix: rows = n, cols = m
        - set:    同 vector
        - dict:   包含 keys, values 向量
        - table:  同 matrix
    */
    rows?: number
    
    /** 第 2 维 */
    cols?: number
    
    
    /** matrix 中值的类型，仅 matrix 才有 */
    datatype?: DdbType
    
    /** 实际数据。不同的 DdbForm, DdbType 使用 DdbValue 中不同的类型来表示实际数据 */
    value: T
    
    
    constructor (data: Partial<DdbObj> & { form: DdbForm, type: DdbType /* (parse 对象时必须设置) , length: number */ }) {
        Object.assign(this, data)
    }
    
    
    static parse (buf: Uint8Array, le: boolean) {
        if (!buf.length)
            return new this({
                le,
                form: DdbForm.scalar,
                type: DdbType.void,
                length: 0,
                value: null
            })
        
        const type = buf[0]
        const form = buf[1]
        
        if (buf.length <= 2) {
            return new this({
                le,
                form,
                type,
                length: 2,
                value: null,
            })
        }
        
        // set 里面 data 嵌套了一个 vector, 跳过 vector 的 type 和 form
        const i_data = form === DdbForm.set ? 4 : 2
        const buf_data = buf.subarray(i_data)
        
        switch (form) {
            case DdbForm.scalar: {
                const [length, value] = this.parse_scalar(buf_data, le, type)
                return new this({
                    le,
                    form, 
                    type,
                    length: i_data + length,
                    value,
                })
            }
            
            case DdbForm.vector:
            case DdbForm.pair:
            case DdbForm.set: {
                let vector = this.parse_vector(buf_data, le, type)
                vector.length += i_data
                vector.form = form
                return vector
            }
            
            
            case DdbForm.table: {
                // table([
                //     [1, 2] as a,
                //     [1, 2] as b
                // ])
                
                // <Buffer 
                // 00 06 form = table
                // 02 00 00 00 02 00 00 00 rows = 2, cols = 2
                // 00 行名称
                // 61 00 62 00 列名称 a, b
                
                // 04 01 form = vector, type = int
                // 02 00 00 00 01 00 00 00 cols = 2, rows = 1
                // 01 00 00 00 02 00 00 00 
                
                // 04 01 
                // 02 00 00 00 01 00 00 00 
                // 01 00 00 00 02 00 00 00>
                
                const dv = new DataView(buf.buffer, buf.byteOffset + i_data)
                
                const rows = dv.getUint32(0, le)
                const cols = dv.getUint32(4, le)
                const i_name_tail = buf_data.indexOf(0, 8)
                const name = this.dec.decode(
                    buf_data.subarray(8, i_name_tail)
                )
                
                const i_items_start = i_name_tail + 1
                
                const [len_items, colnames] = this.parse_vector_items(
                    buf_data.subarray(i_items_start),
                    le,
                    DdbType.string,
                    cols
                ) as [number, string[]]
                
                let value = new Array(cols)
                let i_start = i_items_start + len_items
                for (let i = 0;  i < cols;  i++) {
                    const type = buf_data[i_start] as DdbType
                    
                    let col = this.parse_vector(
                        buf_data.subarray(i_start + 2),
                        le,
                        type
                    )
                    
                    col.length += 2
                    
                    col.name = colnames[i]
                    
                    value[i] = col
                    
                    i_start += col.length
                }
                
                return new this({
                    le,
                    form,
                    type,
                    length: i_data + i_start,
                    name,
                    rows,
                    cols,
                    value,
                })
            }
            
            
            case DdbForm.dict: {
                // <Buffer 19 05 type = any, form = dict
                // 12 01 keys.type = string, keys.form = vector
                // 03 00 00 00 01 00 00 00 keys.cols = 3, keys.rows = 1
                // 63 00 62 00 61 00 
                
                // 19 01 values.type = any, values.form = vector
                // 03 00 00 00 01 00 00 00 values.cols = 3, values.rows = 1
                // 04 00 03 00 00 00 04 00 02 00 00 00 04 00 01 00 00 00>
                
                let keys = this.parse_vector(
                    buf_data.subarray(2),
                    le,
                    buf_data[0]
                )
                
                keys.length += 2
                
                let values = this.parse_vector(
                    buf_data.subarray(keys.length + 2),
                    le,
                    buf_data[keys.length]
                )
                
                values.length += 2
                
                return new this({
                    le,
                    form,
                    type,
                    length: i_data + keys.length + values.length,
                    rows: keys.rows,
                    cols: 2,
                    value: [
                        keys,
                        values
                    ],
                })
            }
            
            
            case DdbForm.matrix: {
                // matrix([
                //     [1, 2, 3],
                //     [3, 2, 1]
                // ])
                
                // <Buffer 00 has_row_label = , has_col_label = 
                // 04 03 type = int, form = matrix
                // 03 00 00 00 02 00 00 00 rows = 3, cols = 2
                // 01 00 00 00 02 00 00 00 03 00 00 00 03 00 00 00 02 00 00 00 01 00 00 00>
                
                const dv = new DataView(buf.buffer, buf.byteOffset + i_data)
                
                const label_flags = buf_data[0]
                const has_row_labels = Boolean(label_flags & 0x01)
                const has_col_labels = Boolean(label_flags & 0x02)
                
                if (has_row_labels || has_col_labels)
                    throw new Error('matrix 暂不支持 row labels 和 col labels')
                
                const datatype = buf_data[1] as DdbType
                const rows = dv.getUint32(3, le)
                const cols = dv.getUint32(7, le)
                
                const [len_items, value] = this.parse_vector_items(
                    buf_data.subarray(11),
                    le,
                    datatype,
                    rows * cols  // 假设小于 2**32
                )
                
                return new this({
                    le,
                    form, 
                    type,
                    length: i_data + 11 + len_items,
                    rows,
                    cols,
                    datatype,
                    value,
                })    
            }
            
            
            default:
                return new this({
                    le,
                    form,
                    type,
                    length: i_data + buf_data.length,
                    value: buf_data
                })
        }
    }
    
    
    static parse_scalar (buf: Uint8Array, le: boolean, type: DdbType): [number, DdbValue] {
        switch (type) {
            case DdbType.void:
                return [1, null]
            
            
            case DdbType.bool: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt8(0)
                return [1, value === nulls.int8 ? null : Boolean(value)]
            }
            
            
            case DdbType.char: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt8(0)
                return [1, value === nulls.int8 ? null : value]
            }
            
            
            case DdbType.short: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt16(0, le)
                return [2, value === nulls.int16 ? null : value]
            }
            
            
            case DdbType.int:
            // datetime
            case DdbType.date:
            case DdbType.month:
            case DdbType.time:
            case DdbType.minute:
            case DdbType.second:
            case DdbType.datetime: 
            case DdbType.datehour: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt32(0, le)
                return [4, value === nulls.int32 ? null : value]
            }
            
            
            case DdbType.float: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getFloat32(0, le)
                return [4, value === nulls.float32 ? null : value]
            }
            
            
            case DdbType.double: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getFloat64(0, le)
                return [8, value === nulls.double ? null : value]
            }
            
            
            case DdbType.long:
            // timestamp
            case DdbType.timestamp:
            case DdbType.nanotime:
            case DdbType.nanotimestamp: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getBigInt64(0, le)
                return [8, value === nulls.int64 ? null : value]
            }
            
            
            case DdbType.string:
            case DdbType.symbol:
            case DdbType.code:
            case DdbType.functiondef: {
                const i_head = type === DdbType.functiondef ? 1 : 0
                let i_zero = buf.indexOf(0, i_head)
                let i_end: number  // 整个字符串（包括 0）的末尾，excluding
                if (i_zero === -1)
                    i_end = i_zero = buf.length
                else
                    i_end = i_zero + 1
                // 调整了 i_zero 到字符串（不包括 0）的末尾，excluding
                
                const str = this.dec.decode(
                    buf.subarray(i_head, i_zero)
                )
                
                return [
                    i_end,
                    type === DdbType.functiondef ?
                        {
                            type: buf[0] as DdbFunctionType,
                            name: str
                        }
                    :
                        str
                ]
            }
            
            
            case DdbType.uuid:
            case DdbType.ipaddr:
            case DdbType.int128:
                return [
                    16,
                    buf.slice(0, 16)
                ]
            
            
            case DdbType.blob: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const length = dv.getUint32(0, le)
                
                return [
                    4 + length,
                    buf.slice(4, 4 + length)
                ]
            }
            
            
            case DdbType.complex:
            case DdbType.point: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                return [
                    16,
                    [
                        dv.getFloat64(0, le),
                        dv.getFloat64(8, le)
                    ] as [number, number]
                ]
            }
            
            
            default:
                return [0, buf]
        }
    }
    
    
    /** parse: rows, cols, items  
        返回的 ddbobj.length 不包括 vector 的 type 和 form
    */
    static parse_vector (buf: Uint8Array, le: boolean, type: DdbType): DdbObj {
        const dv = new DataView(buf.buffer, buf.byteOffset)
        
        const rows = dv.getUint32(0, le)
        
        let i_items_start = 8
        
        if (type < 64 || type >= 128) {
            const [len_items, value] = this.parse_vector_items(
                buf.subarray(i_items_start),
                le,
                type,
                rows
            )
            
            return new this({
                le,
                form: DdbForm.vector,
                type,
                length: i_items_start + len_items,
                cols: 1,
                rows,
                value,
            })
        }
        
        
        // array vector
        
        // av = array(INT[], 0, 3)
        // append!(av, [1..4])
        // append!(av, [1..70000])
        // av
        
        // <Buffer 44 01  type = array vector, form = vector
        // 02 00 00 00 74 11 01 00 rows = 2, cols = 70004 (0x011174)
        
        // block 0
        // 01 00 block.rows = 1
        // 04 block.unit = 4
        // 00 reserved
        // 04 00 00 00 block.lengths = [4]
        // 01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 block.data
        
        // block 1
        // 01 00 block.rows = 1
        // 04 block.unit = 4
        // 00 reserved
        // 70 11 01 00 block.lengths = [70000 (0x00011170)]
        // 01 00 00 00 02 00 00 00 ... 279992 more bytes> block.data
        
        const cols = dv.getUint32(4, le)
        
        let blocks: DdbArrayVectorBlock[] = [ ]
        
        let i_block_start = i_items_start
        
        // 解析一个 block
        for (let i_row = 0;  i_row < rows;  ) {
            /** 对应 array vector 中元素个数 */
            const rows = dv.getUint16(i_block_start, le)
            
            /** 每个 length 占用的字节数 */
            const unit = dv.getUint8(i_block_start + 2)
            
            /** array vector 每个元素的子元素长度 */
            let lengths: Uint32Array | Uint16Array | Uint8Array
            
            const i_lengths_start = i_block_start + 4
            const i_data_start = i_lengths_start + rows * unit
            
            const lengths_buf = buf.slice(
                i_lengths_start,
                i_data_start
            )
            
            switch (unit) {
                case 1:
                    lengths = lengths_buf
                    break
                
                case 2:
                    lengths = new Uint16Array(lengths_buf.buffer)
                    break
                
                case 4:
                    lengths = new Uint32Array(lengths_buf.buffer)
                    break
                    
                default:
                    throw new Error(`array vector 存在非法 unit = ${unit}`)
            }
            
            let total_length = 0
            for (const x of lengths)
                total_length += x
            
            const [len_items, data] = this.parse_vector_items(
                buf.subarray(i_data_start),
                le,
                type - 64,
                total_length
            )
            
            blocks.push({
                unit,
                rows,
                lengths,
                data
            })
            
            i_block_start = i_data_start + len_items
            
            i_row += rows
        }
        
        
        return new this({
            le,
            form: DdbForm.vector,
            type,
            length: i_block_start,
            cols,
            rows,
            value: blocks
        })
    }
    
    
    /** 有可能没有字节对齐，不能直接使用原有 message 的 arraybuffer, 统一复制出来，让原有 arraybuffer 被回收掉比较好 */
    static parse_vector_items (
        buf: Uint8Array, 
        le: boolean,
        type: DdbType, 
        length: number
    ): [
        number, 
        DdbVectorValue
    ] {
        switch (type) {
            case DdbType.bool:
            case DdbType.char:
                return [
                    length,
                    new Int8Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + length
                        )
                    )
                ]
            
            case DdbType.short:
                return [
                    2 * length,
                    new Int16Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 2 * length
                        )
                    )
                ]
            
            
            case DdbType.int:
            // datetime
            case DdbType.date:
            case DdbType.month:
            case DdbType.time:
            case DdbType.minute:
            case DdbType.second:
            case DdbType.datetime:
                return [
                    4 * length,
                    new Int32Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 4 * length
                        )
                    )
                ]
            
            
            case DdbType.float:
                return [
                    4 * length,
                    new Float32Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 4 * length
                        )
                    )
                ]
            
            
            case DdbType.double:
                return [
                    8 * length,
                    new Float64Array(
                        buf.buffer.slice(
                            buf.byteOffset, 
                            buf.byteOffset + 8 * length
                        )
                    )
                ]
            
            
            case DdbType.long:
            // timestamp
            case DdbType.timestamp:
            case DdbType.nanotime:
            case DdbType.nanotimestamp:
                return [
                    8 * length,
                    new BigInt64Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 8 * length
                        )
                    )
                ]
            
            
            case DdbType.string: 
            case DdbType.symbol: 
            case DdbType.code: {
                let value = new Array<string>(length)
                let i_head = 0, i_tail = i_head
                for (let i = 0;  i < length;  i++) {
                    i_tail = buf.indexOf(0, i_head)
                    value[i] = this.dec.decode(
                        buf.subarray(i_head, i_tail)
                    )
                    i_head = i_tail + 1
                }
                return [i_head, value]
            }
            
            
            case DdbType.symbol_extended: {
                // <Buffer 91 01 type = symbol extended, form = vector
                // 05 00 00 00 01 00 00 00 row = 5, col = 1
                
                // buf:
                // 00 00 00 00 symbol base id = 0 (uint32)
                // 02 00 00 00 symbol base size = 2
                // 00 61 61 00 以 \0 分割的字符串
                // 01 00 00 00 01 00 00 00 01 00 00 00 01 00 00 00 01 00 00 00>
                
                const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
                const base_id = dv.getUint32(0, le)
                const base_size = dv.getUint32(4, le)
                
                let base_length = 0
                let base = this.symbol_bases[base_id]
                
                // base_size 为 0 时复用之前的 symbol base
                if (base_size) {
                    [base_length, base] = this.parse_vector_items(
                        buf.subarray(8),
                        le,
                        DdbType.string,
                        base_size
                    ) as [number, string[]]
                    
                    this.symbol_bases[base_id] = base
                }
                
                const value_start = 8 + base_length
                const value_end = value_start + length * 4
                
                const data = new Uint32Array(
                    buf.buffer.slice(
                        buf.byteOffset + value_start,
                        buf.byteOffset + value_end
                    )
                )
                
                return [
                    value_end,
                    {
                        base_id,
                        base,
                        data
                    }
                ]
            }
            
            
            case DdbType.uuid:
            case DdbType.ipaddr:
            case DdbType.int128:
                return [
                    16 * length,
                    new Uint8Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 16 * length
                        )
                    )
                ]
            
            
            case DdbType.blob: {
                // <Buffer 20 01 type = blob, form = vector
                // 02 00 00 00 01 00 00 00 cols = 2, rows = 1
                // 04 00 00 00 61 62 63 64 
                // 04 00 00 00 61 62 63 64>
                
                let value = new Array<Uint8Array>(length)
                const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
                let i_head = 0
                for (let i = 0;  i < length;  i++) {
                    const sublen = dv.getUint32(i_head, le)
                    const i_blob_head = i_head + 4
                    const i_blob_tail = i_blob_head + sublen
                    value[i] = buf.slice(i_blob_head, i_blob_tail)
                    i_head = i_blob_tail
                }
                
                return [i_head, value]
            }
            
            
            case DdbType.complex:
            case DdbType.point: 
                return [
                    16 * length,
                    new Float64Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 16 * length
                        )
                    )
                ]
            
            
            case DdbType.any: {
                // [1, 2, 'a', 'aaa']
                // any[4](<Buffer 
                // 04 00 DdbType.int, DdbForm.scalar
                // 01 00 00 00 
                // 04 00 DdbType.int, DdbForm.scalar
                // 02 00 00 00 
                // 02 00 DdbType.char, DdbForm.scalar
                // 61 
                // 12 00 DdbType.string, DdbForm.scalar
                // 61 61 61 00>)
                
                
                let values = new Array<DdbObj>(length)
                let i_head = 0
                for (let i = 0;  i < length;  i++) {
                    const obj = this.parse(
                        buf.subarray(i_head),
                        le
                    )
                    values[i] = obj
                    i_head += obj.length
                }
                
                return [
                    i_head,
                    values
                ]
            }
            
            
            default:
                return [0, buf]
        }
    }
    
    
    pack (): Uint8Array {
        const { form, type, value } = this
        
        let header = new Uint8Array(
            new ArrayBuffer(2)
        )
        header[0] = type
        header[1] = form
        
        const body = (() => {
            switch (form) {
                case DdbForm.scalar:
                    switch (type) {
                        case DdbType.void:
                            return [Uint8Array.of(1)]
                        
                        case DdbType.bool:
                            return [
                                Int8Array.of(
                                    value === null ?
                                        nulls.int8
                                    :
                                        Number(value)
                                )
                            ]
                        
                        
                        case DdbType.char:
                            return [
                                Int8Array.of(
                                    (value === null ?
                                        nulls.int8
                                    :
                                        value as number
                                    )
                                )
                            ]
                        
                        
                        case DdbType.short:
                            return [
                                Int16Array.of(
                                    value === null ?
                                        nulls.int16
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.int:
                        // datetime
                        case DdbType.date:
                        case DdbType.month:
                        case DdbType.time:
                        case DdbType.minute:
                        case DdbType.second:
                        case DdbType.datetime:
                        case DdbType.datehour:
                            return [
                                Int32Array.of(
                                    value === null ?
                                        nulls.int32
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.float:
                            return [
                                Float32Array.of(
                                    value === null ?
                                        nulls.float32
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.double:
                            return [
                                Float64Array.of(
                                    value === null ?
                                        nulls.double
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.long:
                        // timestamp
                        case DdbType.timestamp:
                        case DdbType.nanotime:
                        case DdbType.nanotimestamp:
                            return [
                                BigInt64Array.of(
                                    value === null ?
                                        nulls.int64
                                    :
                                        value as bigint
                                )
                            ]
                        
                        
                        case DdbType.string:
                        case DdbType.symbol:
                        case DdbType.code:
                            return [
                                DdbObj.enc.encode(value as string),
                                Uint8Array.of(0),
                            ]
                        
                        case DdbType.functiondef:
                            return [
                                Uint8Array.of((value as DdbFunctionDefValue).type),
                                DdbObj.enc.encode((value as DdbFunctionDefValue).name),
                                Uint8Array.of(0)
                            ]
                        
                        case DdbType.uuid:
                        case DdbType.ipaddr:
                        case DdbType.int128:
                            return [this.value as Uint8Array]
                        
                        
                        case DdbType.blob:
                            return [
                                Uint32Array.of(
                                    (this.value as Uint8Array).byteLength
                                ),
                                this.value as Uint8Array
                            ]
                        
                        
                        case DdbType.complex:
                        case DdbType.point:
                            return [Float64Array.from(this.value as [number, number])]
                        
                        
                        case DdbType.duration:
                            return [value as Uint8Array]
                            
                        case DdbType.handle:
                            throw new Error('DolphinDB Server 不支持 handle 的反序列化')
                        
                        default:
                            throw new Error(`${DdbType[type]} 暂时不支持序列化`)
                    }
                
                
                case DdbForm.vector:
                case DdbForm.pair:
                    // pack array vector
                    if (form === DdbForm.vector && 64 <= type && type < 128)
                        return [
                            Uint32Array.of(this.rows, this.cols),
                            ... (this.value as DdbArrayVectorBlock[]).map(block => ([
                                Uint16Array.of(block.rows),
                                Uint8Array.of(block.unit, 0),
                                block.lengths,
                                block.data as any
                            ])).flat()
                        ]
                    
                    return [
                        Uint32Array.of(this.rows, 1),
                        ... DdbObj.pack_vector_body(value as DdbVectorValue, type, this.rows)
                    ]
                
                
                case DdbForm.set:
                    return [
                        new DdbObj({
                            ...this,
                            form: DdbForm.vector,
                        }).pack()
                    ]
                
                
                case DdbForm.table:
                    return [
                        Uint32Array.of(this.rows, this.cols),
                        DdbObj.enc.encode(this.name || ''),
                        
                        // column names
                        Uint8Array.of(0),
                        ...DdbObj.pack_vector_body(
                            (this.value as DdbObj[]).map((col, i) => 
                                col.name || `col${i}`
                            ),
                            DdbType.string,
                            this.cols
                        ),
                        
                        // column vectors
                        ...(this.value as DdbObj[]).map(col => 
                            col.pack()
                        )
                    ]
                
                
                case DdbForm.dict:
                    return [
                        (value as [DdbObj, DdbObj])[0].pack(),
                        (value as [DdbObj, DdbObj])[1].pack(),
                    ]
                
                
                case DdbForm.matrix:
                    return [
                        Uint8Array.of(0, this.datatype, this.form),
                        Uint32Array.of(this.rows, this.cols),
                        ... DdbObj.pack_vector_body(value as DdbVectorValue, this.datatype, this.rows * this.cols)
                    ]
                
                
                default:
                    throw new Error(`${DdbForm[form]} 暂不支持序列化`)
            }
        })()
        
        
        if (!body)
            return new Uint8Array(0)
        
        return concat([
            header,
            ...body
        ])
    }
    
    
    static pack_vector_body (
        value: DdbVectorValue,
        type: DdbType,
        length: number
    ): ArrayBufferView[] {
        switch (type) {
            case DdbType.bool:
                return [value as Int8Array]
            
            
            case DdbType.char:
                return [value as Int8Array]
            
            
            case DdbType.short:
                return [value as Int16Array]
            
            
            case DdbType.int:
            // datetime
            case DdbType.date:
            case DdbType.month:
            case DdbType.time:
            case DdbType.minute:
            case DdbType.second:
            case DdbType.datetime:
                return [value as Int32Array]
            
            
            case DdbType.float:
                return [value as Float32Array]
            
            
            case DdbType.double:
                return [value as Float64Array]
            
            case DdbType.long:
            // timestamp
            case DdbType.timestamp:
            case DdbType.nanotime:
            case DdbType.nanotimestamp:
                return [value as BigInt64Array]
            
            
            case DdbType.string: 
            case DdbType.symbol: 
            case DdbType.code: {
                let bufs = new Array<Uint8Array>(length * 2)
                for (let i = 0;  i < length;  i++) {
                    bufs[2 * i] = this.enc.encode((value as string[])[i])
                    bufs[2 * i + 1] = Uint8Array.of(0)
                }
                return bufs
            }
            
            
            case DdbType.uuid:
            case DdbType.ipaddr:
            case DdbType.int128:
                return [value as Uint8Array]
            
            
            case DdbType.blob: {
                let bufs = new Array<ArrayBufferView>(length * 2)
                for (let i = 0;  i < length;  i++) {
                    const blob_value = (value as Uint8Array[])[i]
                    bufs[2 * i] = Uint32Array.of(blob_value.length)
                    bufs[2 * i + 1] = blob_value
                }
                return bufs
            }
            
            
            case DdbType.complex:
            case DdbType.point: 
                return [value as Float64Array]
            
            
            case DdbType.any: {
                // [1, 2, 'a', 'aaa']
                // any[4](<Buffer 
                // 04 00 DdbType.int, DdbForm.scalar
                // 01 00 00 00 
                // 04 00 DdbType.int, DdbForm.scalar
                // 02 00 00 00 
                // 02 00 DdbType.char, DdbForm.scalar
                // 61 
                // 12 00 DdbType.string, DdbForm.scalar
                // 61 61 61 00>)
                
                let bufs = new Array<Uint8Array>(length)
                for (let i = 0;  i < length;  i++)
                    bufs[i] = (value as DdbObj[])[i].pack()
                return bufs
            }
            
            
            case DdbType.symbol_extended: {
                const { base_id, base, data } = value as DdbSymbolExtendedValue
                
                return [
                    Uint32Array.of(
                        base_id || 0,
                        base.length,
                    ),
                    ...this.pack_vector_body(base, DdbType.string, base.length),
                    data
                ]
            }
            
            default:
                throw new Error(`vector ${DdbType[type]} 暂不支持序列化`)
        }
    }
    
    
    toString () {
        const type = (() => {
            const tname = DdbType[this.type]
            
            switch (this.form) {
                case DdbForm.scalar:
                    if (this.type === DdbType.functiondef)
                        return `functiondef<${DdbFunctionType[(this.value as DdbFunctionDefValue).type]}>`
                    
                    return tname
                
                case DdbForm.vector:
                    if (64 <= this.type && this.type < 128)
                        return `${DdbType[this.type - 64]}[][${this.rows}]`
                    return `${tname}[${this.rows}]`
                
                case DdbForm.pair:
                    return `pair<${tname}>`
                
                case DdbForm.set:
                    return `set<${tname}>[${this.rows}]`
                
                case DdbForm.table:
                    return `table[${this.rows} rows][${this.cols} cols]`
                
                case DdbForm.dict:
                    return `dict<${DdbType[(this.value[0] as DdbObj).type]}, ${DdbType[(this.value[1] as DdbObj).type]}>`
                
                case DdbForm.matrix:
                    return `matrix<${DdbType[this.datatype]}>[${this.rows} rows][${this.cols} cols]`
                
                default:
                    return `${DdbForm[this.form]} ${tname}`
            }
        })()
        
        const data = (() => {
            switch (this.form) {
                case DdbForm.pair:
                    return `${this.value[0]}, ${this.value[1]}`
                    
                case DdbForm.scalar:
                    switch (this.type) {
                        case DdbType.functiondef:
                            return `'${(this.value as DdbFunctionDefValue).name}'`
                            
                        case DdbType.string:
                            return `'${this.value}'`
                    }
                    break
            }
            
            return this.value
        })()
        
        return `${type}(${ this.name ? `'${this.name}', ` : '' }${data})\n`
    }
    
    
    to_cols () {
        return (this.value as DdbObj[]).map(col => {
            let col_: {
                title: string
                dataIndex: string
                render?: any
            } = {
                title: col.name,
                dataIndex: col.name,
            }
            
            switch (col.type) {
                case DdbType.timestamp:
                    col_.render = timestamp2str
                    break
                    
                case DdbType.date:
                    col_.render = date2str
                    break
                    
                case DdbType.ipaddr:
                    col_.render = value =>
                        (value as Uint8Array).slice().reverse().join('.').replace(/^(0\.)+/, '')
                    break
            }
            
            return col_
        })
    }
    
    
    to_rows <T extends Record<string, any> = Record<string, any>> () {
        if (this.form !== DdbForm.table)
            throw new Error('this.form is not DdbForm.table, cannot call to_rows')
        
        let rows = new Array<T>(this.rows)
        
        for (let i = 0;  i < this.rows;  i++) {
            let row: any = { }
            for (let j = 0;  j < this.cols;  j++) {
                const { type, name, value: values }: DdbObj = this.value[j]  // column
                
                switch (type) {
                    case DdbType.bool: {
                        const value = values[i]
                        row[name] = value === nulls.int8 ?
                                null
                            :
                                Boolean(value)
                        break
                    }
                    
                    case DdbType.ipaddr:
                        row[name] = (values as Uint8Array).subarray(16 * i, 16 * (i + 1))
                        break
                        
                    case DdbType.symbol_extended: {
                        const { base, data } = values as DdbSymbolExtendedValue
                        row[name] = base[data[i]]
                        break
                    }
                    
                    default:
                        row[name] = values[i]
                }
            }
            rows[i] = row
        }
        
        return rows
    }
    
    
    to_dict <T = Record<string, any>> () {
        if (this.form !== DdbForm.dict)
            throw new Error('this.form is not DdbForm.dict, cannot convert to Object')
        
        const [{ value: keys }, { value: values }] = this.value as [DdbObj<DdbObj[]>, DdbObj<DdbObj[]>]
        
        let obj = { }
        
        for (let i = 0;  i < this.rows;  i++)
            obj[keys[i] as any] = values[i].value
        
        return obj as T
    }
}


export class DdbVoid extends DdbObj<undefined> {
    constructor () {
        super({
            form: DdbForm.scalar,
            type: DdbType.void,
            length: 0,
            value: null,
        })
    }
}


export class DdbBool extends DdbObj<boolean> {
    constructor (value: boolean | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.bool,
            length: 1,
            value,
        })
    }
}

export class DdbChar extends DdbObj<string> {
    constructor (value: string | number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.char,
            length: 1,
            value: typeof value === 'string' ?
                    value.charCodeAt(0)
                :
                    value
        })
    }
}

export class DdbInt extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.int,
            length: 4,
            value,
        })
    }
}

export class DdbString extends DdbObj<string> {
    constructor (value: string) {
        super({
            form: DdbForm.scalar,
            type: DdbType.string,
            length: 0,
            value
        })
    }
}

export class DdbLong extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.long,
            length: 8,
            value
        })
    }
}

export class DdbDouble extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.double,
            length: 8,
            value
        })
    }
}

export class DdbDateTime extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.datetime,
            length: 4,
            value
        })
    }
}

export class DdbTimeStamp extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.timestamp,
            length: 8,
            value
        })
    }
}

export class DdbNanoTimeStamp extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.nanotimestamp,
            length: 8,
            value
        })
    }
}

export class DdbPair extends DdbObj<Int32Array> {
    constructor (l: number | null, r: number | null = null) {
        super({
            form: DdbForm.pair,
            type: DdbType.int,
            length: 0,
            rows: 2,
            cols: 1,
            value: Int32Array.of(
                l === null ? nulls.int32 : l,
                r === null ? nulls.int32 : r,
            )
        })
    }
}

export class DdbFunction extends DdbObj<DdbFunctionDefValue> {
    constructor (name: string, type: DdbFunctionType) {
        super({
            form: DdbForm.scalar,
            type: DdbType.functiondef,
            length: 0,
            value: { type, name }
        })
    }
}


export class DdbVectorInt extends DdbObj<Int32Array> {
    constructor (ints: (number | null)[] | Int32Array, name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.int,
            length: 0,
            rows: ints.length,
            cols: 1,
            value: ints instanceof Int32Array ?
                    ints
                :
                    Int32Array.from(ints, v => 
                        v === null ?
                            nulls.int32
                        :
                            v
                    ),
            name,
        })
    }
}

export class DdbVectorDouble extends DdbObj<Float64Array> {
    constructor (doubles: (number | null)[] | Float64Array, name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.double,
            length: 0,
            rows: doubles.length,
            cols: 1,
            value: doubles instanceof Float64Array ?
                    doubles
                :
                    Float64Array.from(doubles, v => 
                        v === null ?
                            nulls.double
                        :
                            v
                    ),
            name,
        })
    }
}

export class DdbVectorString extends DdbObj<string[]> {
    constructor (strings: string[], name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.string,
            length: 0,
            rows: strings.length,
            cols: 1,
            value: strings,
            name,
        })
    }
}

export class DdbVectorAny extends DdbObj {
    constructor (objs: DdbObj<DdbValue>[], name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.any,
            length: 0,
            rows: objs.length,
            cols: 1,
            value: objs,
            name,
        })
    }
}

export class DdbVectorSymbol extends DdbObj <DdbSymbolExtendedValue> {
    constructor (strings: string[], name?: string) {
        let map = new Map<string, number>([
            ['', 0]
        ])
        
        let data = new Uint32Array(strings.length)
        
        for (let i = 0;  i < strings.length;  i++) {
            const x = strings[i]
            
            let index = map.get(x)
            
            if (index === undefined) {
                index = map.size
                map.set(x, index)
            }
            
            data[i] = index
        }
        
        super({
            form: DdbForm.vector,
            type: DdbType.symbol_extended,
            length: 0,
            rows: strings.length,
            cols: 1,
            value: {
                base: [...map.keys()],
                base_id: null,
                data,
            },
            name
        })
    }
}

export class DdbSetInt extends DdbObj<Int32Array> {
    constructor (ints: (number | null)[] | Set<number> | Int32Array) {
        super({
            form: DdbForm.set,
            type: DdbType.int,
            length: 0,
            rows: ints instanceof Set ? 
                    ints.size
                :
                    ints.length,
            cols: 1,
            value: ints instanceof Int32Array ?
                    ints
                :
                    Int32Array.from(ints, v => 
                        v === null ?
                            nulls.int32
                        :
                            v
                    ),
        })
    }
}

export class DdbSetDouble extends DdbObj<Float64Array> {
    constructor (doubles: (number | null)[] | Set<number> | Float64Array) {
        super({
            form: DdbForm.set,
            type: DdbType.double,
            length: 0,
            rows: doubles instanceof Set ? 
                    doubles.size
                :
                    doubles.length,
            cols: 1,
            value: doubles instanceof Int32Array ?
                    doubles
                :
                    Int32Array.from(doubles, v => 
                        v === null ?
                            nulls.int32
                        :
                            v
                    ),
        })
    }
}

export class DdbSetString extends DdbObj<string[]> {
    constructor (strings: string[] | Set<string>) {
        if (strings instanceof Set)
            strings = [...strings]
        
        super({
            form: DdbForm.set,
            type: DdbType.string,
            length: 0,
            rows: strings.length,
            cols: 1,
            value: strings
        })
    }
}


export class DdbTable extends DdbObj <DdbObj[]> {
    constructor (columns: DdbObj[], name: string = '') {
        super({
            form: DdbForm.table,
            type: DdbType.void,
            length: 0,
            rows: columns[0].rows,
            cols: columns.length,
            name,
            value: columns,
        })
    }
}

export function date2str (date: number, format = 'YYYY.MM.DD') {
    return date === nulls.int32 ? 
        ''
    :
        dayjs(
            timezone_offset + 1000 * 3600 * 24 * date
        ).format(format)
}


export function datetime2str (datetime: number, format = 'YYYY.MM.DD HH:mm:ss') {
    return datetime === nulls.int32 ?
        ''
    :
        dayjs(
            timezone_offset + 1000 * datetime
        ).format(format)
}


/** format timestamp (bigint) to string 
    - timestamp: bigint value
    - format?:  
        format string, default to `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function timestamp2str (timestamp: bigint, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    return timestamp === nulls.int64 ?
        ''
    :
        dayjs(
            timezone_offset + Number(timestamp)
        ).format(format)
}


/** parse timestamp string to bigint value  
    - str: timestamp string, If it is an empty string, it will return the corresponding empty value (nulls.int64)
    - format?:  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function str2timestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    if (!str)
        return nulls.int64
        
    if (str.length !== format.length)
        throw new Error('The length of the timestamp string is not equal to the length of the format string')
    
    return BigInt(
        -timezone_offset +
        dayjs(str, format).valueOf()
    )
}


/** format nanotimestamp value (bigint) to string 
    - nanotimestamp: bigint value
    - format?:  
        format string, default is `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        Seconds are in the format ss (must be included); nanoseconds are in the format SSSSSSSSS (must be included)  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function nanotimestamp2str (nanotimestamp: bigint, format = 'YYYY.MM.DD HH:mm:ss.SSSSSSSSS') {
    if (nanotimestamp === nulls.int64)
        return ''
    
    const i_second_start = format.indexOf('ss')
    if (i_second_start === -1)
        throw new Error('The format string must contain the format for seconds (ss)')
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    if (i_nanosecond_start === -1)
        throw new Error('The format string must contain the format for nanoseconds (SSSSSSSSS)')
    
    return (
        dayjs(
            timezone_offset + (Number(nanotimestamp) / 1000000)
        ).format(
            format.slice(0, i_second_end)
        ) + 
        format.slice(i_second_end, i_nanosecond_start) + 
        String(nanotimestamp % 1000000000n)
    )
}

/** parse nano timestamp string to bigint value  
    - str: nano timestamp string, If it is an empty string, it will return the corresponding empty value (nulls.int64)
    - format?:  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        Seconds are in the format ss (must be included); nanoseconds are in the format SSSSSSSSS (must be included)  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function str2nanotimestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSSSSSSSS') {
    if (!str)
        return nulls.int64
    
    if (str.length !== format.length)
        throw new Error('nanotimestamp string length is not equal to format string length')
    
    const i_second_start = format.indexOf('ss')
    if (i_second_start === -1)
        throw new Error('The format string must contain the format for seconds (ss)')
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    if (i_nanosecond_start === -1)
        throw new Error('Format string must contain nanosecond format (SSSSSSSSS)')
    
    return (
            BigInt(
                -timezone_offset +
                dayjs(
                    str.slice(0, i_second_end),
                    format.slice(0, i_second_end)
                ).valueOf()
            ) * 1000000n
        +
            BigInt(
                str.slice(i_nanosecond_start, i_nanosecond_start + 9)
            )
    )
}


export class DDB {
    /** 当前的 session id (http 或 tcp) */
    sid = '0'
    
    /** utf-8 text decoder */
    dec = new TextDecoder('utf-8')
    
    enc = new TextEncoder()
    
    
    /** DolphinDB WebSocket URL
        e.g. `ws://127.0.0.1:8848/`, `wss://dolphindb.com`
    */
    url: string
    
    websocket = null as WebSocket
    
    /** little endian (server) */
    le = true
    
    /** little endian (client) */
    static le_client = Boolean(
        new Uint8Array(
            Uint32Array.of(1).buffer
        )[0]
    )
    
    /** Whether to automatically log in after the connection is established, the default is true */
    autologin = true
    
    /** DolphinDB username */
    username = 'admin'
    
    /** DolphinDB password */
    password = '123456'
    
    /** python session flag (2048) */
    python = false
    
    print_message_buffer = false
    
    print_object_buffer = false
    
    print_message = true
    
    parse_object = true
    
    
    /** message handlers */
    handlers: DdbMessageHandler[] = [ ]
    
    
    /** resolver, rejector, promise of last rpc */
    presolver (ddbobj: DdbObj) { }
    prejector (error: Error) { }
    presult = Promise.resolve(null) as Promise<DdbObj>
    
    
    get connected () {
        return this.websocket?.readyState === WebSocket.OPEN
    }
    
    
    /**
        Initialize an instance of DolphinDB Client using the WebSocket URL  
        (without establishing an actual network connection)
        - url?: DolphinDB WebSocket URL. e.g.：`ws://127.0.0.1:8848`, Defaults to the current page URL
        - options?:
            - autologin?: Whether to log in automatically after establishing a connection, default `true`
            - username?: DolphinDB username, default `'admin'`
            - password?: DolphinDB password, default `'123456'`
            - python?: set python session flag, default `false`
        
        @example
        let ddb = new DDB('ws://127.0.0.1:8848')
        
        // Encrypt with HTTPS
        let ddbsecure = new DDB('wss://dolphindb.com', {
            autologin: true,
            username: 'admin',
            password: '123456',
            python: false
        })
    */
    constructor (url?: string, options: {
        autologin?: boolean
        username?: string
        password?: string
        python?: boolean
    } = { }) {
        if (!url) {
            const _url = new URL(location.href)
            
            const hostname = _url.searchParams.get('hostname') || location.hostname
            
            const port = _url.searchParams.get('port') || location.port
            
            url = `${ location.protocol === 'https:' ? 'wss' : 'ws' }://${hostname}${ port ? `:${port}` : '' }/`
        }
        
        this.url = url
        
        if (options.autologin !== undefined)
            this.autologin = options.autologin
        
        if (options.username !== undefined)
            this.username = options.username
        
        if (options.password !== undefined)
            this.password = options.password
        
        if (options.python !== undefined)
            this.python = options.python
    }
    
    
    /** Establish the actual WebSocket connection to the DolphinDB corresponding to the URL
        - options?:
            - url?: DolphinDB WebSocket URL. By default, the WebSocket URL passed in when the instance is initialized is used
            - autologin?: Whether to log in automatically after establishing a connection, default `true`
            - username?: DolphinDB username, default `'admin'`
            - password?: DolphinDB password, default `'123456'`
            - python?: set python session flag, default `false`
    */
    async connect (options: {
        url?: string
        autologin?: boolean
        username?: string
        password?: string
        python?: boolean
     } = { }) {
        if (options.url !== undefined)
            this.url = options.url
        
        if (options.autologin !== undefined)
            this.autologin = options.autologin
        
        if (options.username !== undefined)
            this.username = options.username
        
        if (options.password !== undefined)
            this.password = options.password
        
        if (options.python !== undefined)
            this.python = options.python
        
        this.disconnect()
        
        await connect_websocket(this.url, {
            protocols: this.python ? ['python'] : [ ],
            
            on_open: async (event, websocket) => {
                this.websocket = websocket
                await this.rpc('connect', { })
            },
            
            on_message: event => {
                const buf = new Uint8Array(event.data as ArrayBuffer)
                
                if (this.print_message_buffer)
                    console.log(buf)
                
                const message = this.parse_message(buf)
                
                if (this.handlers.length) {
                    const _handlers = [...this.handlers].reverse()
                    for (const handler of _handlers)
                        handler(message, this)
                }
                
                const { type, data } = message
                
                switch (type) {
                    case 'print':
                        if (this.print_message)
                            console.log(data)
                        return
                    
                    case 'object':
                        this.presolver(data)
                        return
                    
                    case 'error':
                        this.prejector(data)
                        return
                }
            }
        })
        
        await this.eval(
            this.python ?
                'def pnode_run (nodes, func_name, args, add_node_alias):\n' +
                '    nargs = size(args)\n' +
                '    func = funcByName(func_name)\n' +
                '    \n' +
                '    if not nargs:\n' +
                '        return pnodeRun(func, nodes, add_node_alias)\n' +
                '    \n' +
                '    args_partial = [ ]\n' +
                '    args_partial.append(func)\n' +
                '    for a in args:\n' +
                '        args_partial.append(a)\n' +
                '    \n' +
                '    return pnodeRun(\n' +
                '        unifiedCall(partial, args_partial),\n' +
                '        nodes,\n' +
                '        add_node_alias\n' +
                '    )\n'
            :
                'def pnode_run (nodes, func_name, args, add_node_alias = true) {\n' +
                '    nargs = size(args)\n' +
                '    func = funcByName(func_name)\n' +
                '    \n' +
                '    if (!nargs)\n' +
                '        return pnodeRun(func, nodes, add_node_alias)\n' +
                '    \n' +
                '    args_partial = array(any, 1 + nargs, 1 + nargs)\n' +
                '    args_partial[0] = func\n' +
                '    args_partial[1:] = args\n' +
                '    return pnodeRun(\n' +
                '        unifiedCall(partial, args_partial),\n' +
                '        nodes,\n' +
                '        add_node_alias\n' +
                '    )\n' +
                '}\n',
            { urgent: true }
        )
        
        if (this.autologin)
            if (this.python)
                await this.eval(`login(${this.username.quote('double')}, ${this.password.quote('double')})`, { urgent: true })
            else
                await this.call('login', [this.username, this.password], { urgent: true })
    }
    
    
    get_rpc_options ({
        urgent = false,
        secondary = false,
        async: _async = false,
        pickle = false,
        clear = false,
        api = false,
        compress = false,
        
        cancellable = true,
        priority = urgent ? 8 : 4,
        parallelism = 8,
        root_id = '',
        limit,
    }: {
        // --- flags ---
        urgent?: boolean
        
        /** API 提交的任务, secondary 必须为 false */
        secondary?: boolean
        
        /** 是否异步任务（不返回结果） */
        async?: boolean
        
        /** 让服务端以 pickle 协议返回数据 */
        pickle?: boolean
        
        /** 本次任务完成后 clear session memory */
        clear?: boolean
        
        /** 是否为 api client */
        api?: boolean
        
        compress?: boolean
        
        // --- flags end ---
        
        /** 任务是否可以取消 */
        cancellable?: boolean
        
        priority?: number
        
        /** `8` 0 ~ 64, 指定本任务并行度 */
        parallelism?: number
        
        /** 根任务编号，内部使用，API中固定为空 */
        root_id?: string
        
        /** 指定分块返回的块大小 */
        limit?: boolean
    } = { }) {
        let flag = 0
        if (urgent)
            flag += 1
        if (secondary)
            flag += 2
        if (_async)
            flag += 4
        if (pickle)
            flag += 8
        if (clear)
            flag += 16
        if (api)
            flag += 32
        if (compress)
            flag += 64
        
        // python session
        if (this.python)
            flag += 2048
        
        const options = [
            flag,
            cancellable ? 1 : 0,
            priority,
            parallelism,
            ... limit ? [
                root_id,
                limit,
            ] : [ ],
        ]
        
        return options.join('_')
    }
    
    
    disconnect () {
        if (this.connected)
            this.websocket.close(1000)
        this.presolver = buf => { }
        this.prejector = error => { }
        this.presult = Promise.resolve(null)
    }
    
    
    /** rpc through websocket (function/script/variable command)  
        - type: API 类型: 'script' | 'function' | 'variable'
        - options:
            - urgent?: 决定 `行为标识` 那一行字符串的取值（只适用于 script 和 function）
            - vars?: type === 'variable' 时必传，variable 指令中待上传的变量名
            - handler?: 处理本次 rpc 期间的消息
            - parse_object?: 在本次 rpc 期间设置 parse_object, 结束后恢复原有  
                为 false 时返回的 DdbObj 仅含有 buffer 和 le，不做解析，以便后续转发、序列化
    */
    async rpc <T extends DdbObj = DdbObj> (
        type: 'script' | 'function' | 'variable' | 'connect',
        {
            script,
            func,
            args = [ ],
            vars = [ ],
            urgent,
            handler,
            parse_object,
        }: {
            script?: string
            func?: string
            args?: (DdbObj | string | boolean)[]
            vars?: string[]
            urgent?: boolean
            handler?: DdbMessageHandler
            parse_object?: boolean
    }) {
        if (!this.websocket)
            await this.connect()
        
        if (!this.connected)
            throw new Error(`${this.url} is already disconnected`)
        
        // 临界区：保证多个 rpc 并发时形成 promise 链
        // ddb 世界观：需要等待上一个 rpc 结果从 server 返回之后才能发起下一个调用  
        // 违反世界观可能造成:  
        // 1. 并发多个请求只返回第一个结果（阻塞，需后续请求疏通）
        // 2. windows 下 ddb server 返回多个相同的结果
        
        const ptail = this.presult
        let presolver: (ddbobj: DdbObj) => void
        let prejector: (error: Error) => void
        
        const presult = this.presult = new Promise<DdbObj>((resolve, reject) => {
            presolver = resolve
            prejector = reject
        })
        
        try {
            await ptail
        } catch { }
        
        this.presolver = presolver
        this.prejector = prejector
        // 临界区结束，只有一个 rpc 请求可以写 WebSocket
        
        if (urgent && type !== 'script' && type !== 'function')
            throw new Error('urgent 只适用于 script 和 funciton')
        
        args = this.to_ddbobjs(args)
        
        const command = this.enc.encode(
            (() => {
                switch (type) {
                    case 'function':
                        return 'function\n' +
                            `${func}\n` +
                            `${args.length}\n` +
                            `${Number(DDB.le_client)}\n`
                        
                    case 'script':
                        return 'script\n' +
                            script
                            
                    case 'variable':
                        return 'variable\n' +
                            `${vars.join(',')}\n` +
                            `${vars.length}\n` +
                            `${Number(DDB.le_client)}\n`
                            
                    case 'connect':
                        return 'connect\n'
                }
            })()
        )
        
        const message = concat([
            this.enc.encode(
                `API2 ${this.sid} ${command.length} / ${this.get_rpc_options({ urgent })}\n`
            ),
            command,
            ... args.map((arg: DdbObj) =>
                arg.pack()
            )
        ])
        
        const _parse_object = this.parse_object
        
        if (handler)
            this.handlers.push(handler)
        
        if (parse_object !== undefined)
            this.parse_object = parse_object
        
        try {
            this.websocket.send(message)
            
            return (await presult) as T
        } finally {
            if (handler)
                this.handlers = this.handlers.filter(h => 
                    h !== handler
                )
            this.parse_object = _parse_object
        }
    }
    
    
    /** eval script through websocket (script command)  
        - script?: Script to execute
        - options?: execution options
            - urgent?: Urgent flag to ensure that submitted scripts are processed by urgent workers to prevent being blocked by other jobs
            - handler?: Process messages during this rpc
            - parse_object?: Set parse_object during this rpc, and restore the original after the end.
                When it is false, the returned DdbObj only contains buffer and le without parsing, 
                so as to facilitate subsequent forwarding and serialization
    */
    async eval <T extends DdbObj> (
        script: string,
        {
            urgent,
            handler,
            parse_object,
        }: {
            urgent?: boolean
            handler?: DdbMessageHandler
            parse_object?: boolean
        } = { }
    ) {
        return this.rpc<T>('script', { script, urgent, handler, parse_object })
    }
    
    
    /** call function through websocket (function command) 
        - func: function name
        - args?: `[ ]` Call parameters (the incoming native string and boolean will be automatically converted to DdbObj<string> and DdbObj<boolean>)
        - options?: call options
            - urgent?: Emergency flag. Use urgent worker execution to prevent being blocked by other jobs
            - node?: When the node alias is set, it is sent to the corresponding node in the cluster for execution (using the rpc method in DolphinDB)
            - nodes?: When setting multiple node aliases, send them to the corresponding multiple nodes in the cluster for execution (using the pnodeRun method in DolphinDB)
            - func_type?: It must be passed when setting the node parameter, the function type needs to be specified, and it is not passed in other cases
            - add_node_alias?: Select to pass when setting the nodes parameter, otherwise not pass
            - handler?: Process messages during this rpc
            - parse_object?: Set parse_object during this rpc, and restore the original after the end.
                When it is false, the returned DdbObj only contains buffer and le without parsing, 
                so as to facilitate subsequent forwarding and serialization
    */
    async call <T extends DdbObj> (
        func: string,
        args: (DdbObj | string | boolean)[] = [ ],
        {
            urgent,
            node,
            nodes,
            func_type,
            add_node_alias,
            handler,
            parse_object,
        }: {
            urgent?: boolean
            node?: string
            nodes?: string[]
            func_type?: DdbFunctionType
            add_node_alias?: boolean
            handler?: DdbMessageHandler
            parse_object?: boolean
        } = { }
    ) {
        if (node) {
            if (typeof func_type === 'undefined')
                throw new Error('指定 node 时必须设置 func_type')
            
            args = [
                node,
                new DdbFunction(func, func_type),
                ...args
            ]
            func = 'rpc'
        }
        
        if (nodes) {
            args = [
                new DdbVectorString(nodes),
                func,
                new DdbVectorAny(
                    this.to_ddbobjs(args)
                ),
                ... (() => {
                    if (typeof add_node_alias !== 'undefined')
                        return [add_node_alias]
                    
                    if (this.python)
                        return [true]
                    
                    return [ ]
                })()
            ]
            func = 'pnode_run'
        }
        
        return this.rpc<T>('function', {
            func,
            args,
            urgent,
            handler,
            parse_object
        })
    }
    
    
    /** upload variable through websocket (variable command) */
    async upload (
        /** Uploaded variables' name */
        vars: string[],
        
        /** Uploaded variables' value */
        args: (DdbObj | string | boolean)[],
        
        {
            handler,
            parse_object,
        }: {
            handler?: DdbMessageHandler
            parse_object?: boolean
        } = { }
    ) {
        if (!args.length || args.length !== vars.length)
            throw new Error('variable 指令参数为空或参数名为空，或数量不匹配')
        
        return this.rpc('variable', { vars, args, handler, parse_object })
    }
    
    
    /** 解析服务端响应报文，返回去掉 header 的 data buf */
    parse_message (buf: Uint8Array, parse_object = this.parse_object): DdbMessage {
        // MSG\n
        // <message>\0
        // 'M'.codePointAt(0).to_hex_str()
        if (buf[0] === 0x4d && buf[1] === 0x53 && buf[2] === 0x47 && buf[3] === 0x0a)
            return {
                type: 'print',
                data: 
                    this.dec.decode(
                        buf.subarray(4)
                    )
            }
        
        
        // '1166953221 1 1\n'
        // 'OK\n'
        // '\x04\x00\x02\x00\x00\x00'
        
        /** index of line feed 0 */
        const i_lf_0 = buf.indexOf(0x0a)  // '\n'
        
        const parts = this.dec.decode(
            buf.subarray(0, i_lf_0)
        ).split(' ')
        
        /** session id */
        const sid = parts[0]
        if (sid !== this.sid) {
            console.log(`sid 从 ${this.sid} 变为 ${sid}`)
            this.sid = sid
        }
        
        /** 返回对象的数量 */
        const n_obj = Number(parts[1])
        
        /** 大小端: 协议中大端为 0, 小端为 1 */
        this.le = Number(parts[2]) !== 0
        
        const i_ls_1 = i_lf_0 + 1
        const i_lf_1 = buf.indexOf(0x0a, i_ls_1)  // '\n'
        /** 'OK' 表示成功，其它文本表示失败 */
        const message = this.dec.decode(
            buf.subarray(i_ls_1, i_lf_1)
        )
        
        if (message !== 'OK')
            return {
                type: 'error',
                data: new Error(message)
            }
        
        const buf_obj = buf.subarray(i_lf_1 + 1)
        
        if (this.print_object_buffer)
            console.log(buf_obj)
        
        return {
            type: 'object',
            data: parse_object ?
                    Object.assign(
                        DdbObj.parse(buf_obj, this.le),
                        { buffer: buf_obj }
                    )
                :
                    new DdbObj({
                        form: DdbForm.scalar,
                        type: DdbType.void,
                        length: 0,
                        le: this.le,
                    })
        }
    }
    
    
    /** 自动转换 js string, boolean 为 DdbObj */
    to_ddbobj (value: DdbObj | string | boolean): DdbObj {
        if (value instanceof DdbObj)
            return value
            
        const type = typeof value
        
        switch (type) {
            case 'string':
                return new DdbString(value as string)
            
            case 'boolean':
                return new DdbBool(value as boolean)
            
            default: 
                throw new Error(`不能自动转换 ${type} 至 DdbObj`)
        }
    }
    
    
    /** 转换 js 数组为 DdbObj[] */
    to_ddbobjs (values: any[]) {
        return values.map(value => 
            this.to_ddbobj(value)
        )
    }
}


export interface DdbMessageHandler {
    (message: DdbMessage, _this: DDB): any
}


export interface DdbPrintMessage {
    type: 'print'
    data: string
}

export interface DdbObjectMessage {
    type: 'object'
    data: DdbObj
}

export interface DdbErrorMessage {
    type: 'error',
    data: Error
}

export type DdbMessage = DdbPrintMessage | DdbObjectMessage | DdbErrorMessage


export let ddb = (window as any).ddb = new DDB()

export default ddb

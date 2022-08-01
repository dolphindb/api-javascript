import type { InspectOptions } from 'util'

import { WebSocket } from 'ws'

import dayjs from 'dayjs'
import DayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(DayjsCustomParseFormat)

import ipaddrjs from 'ipaddr.js'
const { fromByteArray: buf2ipaddr } = ipaddrjs

import { connect_websocket } from 'xshell/net.js'
import { concat, inspect, typed_array_to_buffer } from 'xshell/utils.js'


export enum DdbForm {
    scalar = 0,
    vector = 1,
    pair = 2,
    matrix = 3,
    set = 4,
    dict = 5,
    table = 6,
    chart = 7,
    
    /** Node internal communication may be used, calling function execution script generally does not return this type */
    chunk = 8,
    
    /** sysobj */
    object = 9,
}


/** DolphinDB DataType  
    对应的 array vector 类型为 64 + 基本类型
    对应的 extended 类型为 128 + 基本类型
*/
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
    
    symbol_extended = 145,  // 128 + DdbType.symbol
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

export enum DdbDurationUnit {
    ns = 0,
    us = 1,
    ms = 2,
    s = 3,
    m = 4,
    H = 5,
    d = 6,
    w = 7,
    M = 8,
    y = 9,
    B = 10
}

export interface DdbFunctionDefValue {
    type: DdbFunctionType
    name: string
}

export interface DdbDurationValue {
    unit: DdbDurationUnit
    
    /** int32 */
    data: number
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
    data: Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array
}

export interface DdbMatrixValue {
    rows: DdbObj<DdbVectorValue>
    cols: DdbObj<DdbVectorValue>
    data: DdbVectorValue
}

export type DdbDictValue = [DdbObj<DdbVectorValue>, DdbObj<DdbVectorValue>]

export enum DdbChartType {
    area = 0,
    bar = 1,
    column = 2,
    histogram = 3,
    line = 4,
    pie = 5,
    scatter = 6,
    trend = 7,
    kline = 8,
}

export interface DdbChartValue {
    /** original: chartType */
    type: DdbChartType
    
    stacking: boolean
    
    /** 直方图 (Histogram), plotHist 函数返回的 chart 可能具有该属性  
        原属性 binStart  
        数值类型的 DdbObj 都有可能？  
    */
    bin_start?: DdbObj
    
    /** 原属性 binEnd */
    bin_end?: DdbObj
    
    /** 原属性 binCount */
    bin_count?: DdbObj
    
    titles: {
        chart: string
        x_axis: string
        y_axis: string
    }
    
    extras?: {
        multi_y_axes: boolean
    }
    
    data: DdbObj<DdbMatrixValue>
}

export type DdbScalarValue = 
    null | boolean | number | bigint | string |
    Uint8Array | // uuid, ipaddr, int128, blob
    [number, number] | // complex, point
    DdbFunctionDefValue |
    DdbDurationValue

export type DdbVectorValue = 
    Uint8Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | 
    string[] | // string[]
    Uint8Array[] | // blob
    DdbObj[] | // any
    DdbSymbolExtendedValue | 
    DdbArrayVectorBlock[]

export type DdbValue = DdbScalarValue | DdbVectorValue | DdbMatrixValue | DdbDictValue | DdbChartValue


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
    
    /** 实际数据。不同的 DdbForm, DdbType 使用 DdbValue 中不同的类型来表示实际数据 */
    value: T
    
    /** 原始二进制数据，仅在 parse_object 为 false 时通过 parse_message 生成的顶层对象有这个属性 */
    buffer?: Uint8Array
    
    
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
            
            
            case DdbForm.dict: 
            case DdbForm.chart: {
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
                
                let dict = new this({
                    le,
                    form: DdbForm.dict,
                    type,
                    length: i_data + keys.length + values.length,
                    rows: keys.rows,
                    cols: 2,
                    value: [
                        keys,
                        values
                    ],
                })
                
                if (form === DdbForm.dict)
                    return dict
                else {
                    const {
                        chartType: type,
                        stacking,
                        binStart: bin_start,
                        binEnd: bin_end,
                        binCount: bin_count,
                        title: titles,
                        extras,
                        data,
                        ... others
                    } = dict.to_dict<{
                        chartType: DdbObj<DdbChartType>
                        stacking: DdbBool
                        binStart: DdbObj
                        binEnd: DdbObj
                        binCount: DdbObj
                        title: DdbVectorString
                        extras?: DdbObj
                        data: DdbObj<DdbMatrixValue>
                    }>()
                    
                    const [chart, x_axis, y_axis] = titles.value
                    
                    dict.form = DdbForm.chart
                    
                    dict.value = {
                        type: type.value,
                        stacking: stacking.value,
                        titles: {
                            chart,
                            x_axis,
                            y_axis,
                        },
                        ... bin_start ? { bin_start, bin_end, } : { },
                        ... bin_count ? { bin_count } : { },
                        ... extras ? (() => {
                            const { multiYAxes: multi_y_axes = false, ...extras_others } = extras.to_dict<{ multiYAxes: boolean }>({ strip: true })
                            
                            return {
                                extras: {
                                    multi_y_axes,
                                    ...extras_others,
                                }
                            }
                        })() : { },
                        data,
                        ...others,
                    }
                    
                    return dict
                }
            }
            
            
            case DdbForm.matrix: {
                // rename!(
                //     1..9$3:3,
                //     [1, 2, 3],
                //     ['c1', 'c2', 'c3']
                // )
                
                // <Buffer 04 03 type = int, form = matrix
                // 03 has_row_label (& 0x01) = 1, has_col_label (& 0x02) = 1
                
                // row labels
                // 04 01 type = int, form = vector
                // 03 00 00 00 01 00 00 00 rows = 3, cols = 1
                // 01 00 00 00 02 00 00 00 03 00 00 00 vector values
                
                // col labels
                // 12 01 type = string, form = vector
                // 03 00 00 00 01 00 00 00 rows = 3, cols = 1
                // 63 31 00 63 32 00 63 33 00 
                
                // matrix data
                // 04 03 type = matrix.type, form = matrix
                // 03 00 00 00 03 00 00 00 rows = 3, cols = 3
                
                const dv = new DataView(buf.buffer, buf.byteOffset + i_data)
                
                const label_flags = buf_data[0]
                const has_row_labels = Boolean(label_flags & 0x01)
                const has_col_labels = Boolean(label_flags & 0x02)
                
                let row_labels: DdbObj<DdbVectorValue> | null = null
                let col_labels: DdbObj<DdbVectorValue> | null = null
                
                let offset = 1
                
                if (has_row_labels) {
                    row_labels = this.parse_vector(
                        buf_data.subarray(offset + 2),
                        le,
                        buf_data[offset] as DdbType
                    )
                    row_labels.length += 2
                    offset += row_labels.length
                }
                
                if (has_col_labels) {
                    col_labels = this.parse_vector(
                        buf_data.subarray(offset + 2),
                        le,
                        buf_data[offset] as DdbType
                    )
                    col_labels.length += 2
                    offset += col_labels.length
                }
                
                if (buf_data[offset] !== type)
                    throw new Error('matrix.datatype !== matrix.type')
                
                const rows = dv.getUint32(offset + 2, le)
                const cols = dv.getUint32(offset + 6, le)
                
                const [len_items, data] = this.parse_vector_items(
                    buf_data.subarray(offset + 10),
                    le,
                    type,
                    rows * cols  // 假设小于 2**32
                )
                
                offset += 10 + len_items
                
                return new this({
                    le,
                    form, 
                    type,
                    length: i_data + offset,
                    rows,
                    cols,
                    value: {
                        rows: row_labels,
                        cols: col_labels,
                        data,
                    },
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
    
    
    static parse_scalar (buf: Uint8Array, le: boolean, type: DdbType): [number, DdbScalarValue] {
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
            case DdbType.handle:
            case DdbType.functiondef: 
            
            // mysql 插件 connect 方法会返回 resource 类型的对象
            case DdbType.resource: {
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
            
            
            case DdbType.duration: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                return [
                    8,
                    {
                        unit: dv.getUint32(4, le),
                        data: dv.getInt32(0, le)
                    } as DdbDurationValue
                ]
            }
            
            default:
                throw new Error(`${DdbType[type] || type} 暂时不支持解析`)
        }
    }
    
    
    /** parse: rows, cols, items  
        返回的 ddbobj.length 不包括 vector 的 type 和 form
    */
    static parse_vector (buf: Uint8Array, le: boolean, type: DdbType): DdbObj<DdbVectorValue> {
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
                data: data as Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array
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
            case DdbType.datehour:
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
            case DdbType.handle:
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
            
            // case DdbType.duration: -> 实际会返回一个 any vector
            // [2y, 1M, 3d, 7H, 11m, 12s, 15ms, 16us, 17ns]
            // <Buffer 19 01 type = any, form = vector
            // 09 00 00 00 01 00 00 00 rows = 9, cols = 1
            // 24 00 type = DdbType.duration, form = scalar
            // 02 00 00 00 09 00 00 00 
            // 24 00 01 00 00 00 08 00 00 00 24 00 03 00 00 00 06 00 00 00 24 00 07 00 00 00 05 00 00 00 ... 50 more bytes>
            
            
            default:
                return [0, buf]
        }
    }
    
    
    pack (): Uint8Array {
        const { form, type, value } = this
        
        let header = new Uint8Array(2)
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
                        case DdbType.handle:
                        case DdbType.resource:
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
                        
                        
                        case DdbType.duration: {
                            const { unit, data } = this.value as DdbDurationValue
                            return [Int32Array.of(data, unit)]
                        }
                        
                        default:
                            throw new Error(`${DdbType[type] || type} 暂时不支持序列化`)
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
                        (value as DdbDictValue)[0].pack(),
                        (value as DdbDictValue)[1].pack(),
                    ]
                
                case DdbForm.chart: {
                    const {
                        type,
                        stacking,
                        bin_start,
                        bin_end,
                        bin_count,
                        titles: {
                            chart,
                            x_axis,
                            y_axis,
                        },
                        extras,
                        data
                    } = this.value as DdbChartValue
                    
                    const {
                        value: [keys, values]
                    } = new DdbDict({
                        chartType: new DdbInt(type),
                        stacking,
                        ... bin_start ? {
                            binStart: bin_start,
                            binEnd: bin_end
                        } : { },
                        ... bin_count ? {
                            binCount: bin_count
                        } : { },
                        title: new DdbVectorString([chart, x_axis, y_axis]),
                        ... extras ? (() => {
                            const { multi_y_axes, ...extras_other } = extras
                            
                            return {
                                extras: new DdbDict({
                                    multiYAxes: multi_y_axes,
                                    ...extras_other
                                })
                            }
                        })() : { },
                        data,
                    })
                    
                    return [
                        keys.pack(),
                        values.pack(),
                    ]
                }
                
                case DdbForm.matrix: {
                    const { rows, cols, data } = value as DdbMatrixValue
                    
                    return [
                        Uint8Array.of(
                            (rows && 0x01) | (cols && 0x02),
                        ),
                        ... rows ? [rows.pack()] : [ ],
                        ... cols ? [cols.pack()] : [ ],
                        Uint8Array.of(this.type, this.form),
                        Uint32Array.of(this.rows, this.cols),
                        ... DdbObj.pack_vector_body(data, this.type, this.rows * this.cols)
                    ]
                }
                
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
            case DdbType.datehour:
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
            case DdbType.handle:
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
    
    
    [inspect.custom] (depth: number, options: InspectOptions, _inspect) {
        const type = this.inspect_type()
        
        const data = (() => {
            switch (this.form) {
                case DdbForm.scalar:
                    return format(this.type, this.value, this.le, options)
                
                case DdbForm.vector:
                case DdbForm.pair:
                case DdbForm.set: {
                    const form = this.form
                    
                    function format_array (items: string[], ellipsis: boolean) {
                        const str_items = items.join(', ') + (ellipsis ? ', ...' : '')
                        
                        return form === DdbForm.pair ?
                                str_items
                            :
                                str_items.bracket('square')
                    }
                    
                    
                    if (64 <= this.type && this.type < 128) {  // array vector
                        // 因为 array vector 目前只支持：Logical, Integral（不包括 INT128, COMPRESS 类型）, Floating, Temporal
                        // 都对应 TypedArray 中的一格，所以直接根据 index 去取即可
                        // av = array(INT[], 0, 5)
                        // append!(av, [1..1])
                        // append!(av, [1..70000])
                        // append!(av, [1..1])
                        // append!(av, [1..500])
                        // ...
                        // av
                        const _type = this.type - 64
                        
                        const limit = 10
                        
                        let items = new Array(
                            Math.min(limit, this.rows)
                        )
                        
                        let i_items = 0
                        
                        for (const { lengths, data } of this.value as DdbArrayVectorBlock[]) {
                            let acc_len = 0
                            
                            for (const length of lengths) {
                                let _items = new Array(
                                    Math.min(limit, length)
                                )
                                
                                for (let i = 0;  i < _items.length;  i++)
                                    _items[i] = format(_type, data[acc_len + i], this.le, options)
                                
                                items[i_items++] = format_array(
                                    _items,
                                    length > limit
                                )
                                
                                acc_len += length
                            }
                            
                            if (i_items >= limit)
                                break
                        }
                        
                        return format_array(
                            items,
                            this.rows > limit
                        )
                    }
                    
                    switch (this.type) {
                        case DdbType.symbol_extended: {
                            const limit = 50 as const
                            
                            const { base, data } = this.value as DdbSymbolExtendedValue
                            
                            let items = new Array(
                                Math.min(limit, data.length)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = inspect(base[data[i]], options)
                            
                            return format_array(
                                items,
                                data.length > limit
                            )
                        }
                        
                        case DdbType.uuid: 
                        case DdbType.int128: 
                        case DdbType.ipaddr: {
                            const limit = 10 as const
                            
                            const value = this.value as Uint8Array
                            
                            const len_data = value.length / 16
                            
                            let items = new Array(
                                Math.min(limit, len_data)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = format(
                                    this.type,
                                    value.subarray(16 * i, 16 * (i + 1)),
                                    this.le,
                                    options
                                )
                            
                            return format_array(
                                items,
                                len_data > limit
                            )
                        }
                        
                        case DdbType.complex:
                        case DdbType.point: {
                            const limit = 20 as const
                            
                            const value = this.value as Float64Array
                            
                            const len_data = value.length / 2
                            
                            let items = new Array(
                                Math.min(limit, len_data)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = format(
                                    this.type,
                                    value.subarray(2 * i, 2 * (i + 1)),
                                    this.le,
                                    options
                                )
                            
                            return format_array(
                                items,
                                len_data > limit
                            )
                        }
                        
                        default: {
                            const limit = 50 as const
                            
                            let items = new Array(
                                Math.min(limit, (this.value as any[]).length)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = format(this.type, this.value[i], this.le, options)
                            
                            return format_array(
                                items,
                                (this.value as any[]).length > limit
                            )
                        }
                    }
                    
                }
            }
            
            if (this.value instanceof Uint8Array)
                return inspect(
                    typed_array_to_buffer(this.value),
                    options
                )
            
            return inspect(this.value, options)
        })()
        
        return `${options.colors ? type.blue : type}(${ this.name ? `${inspect(this.name, options)}, ` : '' }${data})`
    }
    
    
    inspect_type () {
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
                return `table[${this.rows}r][${this.cols}c]`
            
            case DdbForm.dict:
                return `dict<${DdbType[(this.value[0] as DdbObj).type]}, ${DdbType[(this.value[1] as DdbObj).type]}>[${this.rows}]`
            
            case DdbForm.chart:
                return `chart<${DdbChartType[(this.value as DdbChartValue).type]}>`
            
            case DdbForm.matrix:
                return `matrix<${tname}>[${this.rows}r][${this.cols}c]`
            
            default:
                return `${DdbForm[this.form]} ${tname}`
        }
    }
    
    
    /** 自动转换 js string, boolean 为 DdbObj */
    static to_ddbobj (value: DdbObj | string | boolean): DdbObj {
        if (value && value instanceof DdbObj)
            return value
        
        const type = typeof value
        
        switch (type) {
            case 'string':
                return new DdbString(value as string)
            
            case 'boolean':
                return new DdbBool(value as boolean)
            
            default: 
                throw new Error(`Cannot automatically convert ${type} to DdbObj`)
        }
    }
    
    
    /** 转换 js 数组为 DdbObj[] */
    static to_ddbobjs (values: any[]) {
        return values.map(value => 
            this.to_ddbobj(value)
        )
    }
    
    
    to_rows <T extends Record<string, any> = Record<string, any>> () {
        if (this.form !== DdbForm.table)
            throw new Error('this.form is not DdbForm.table, cannot to_rows')
        
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
    
    
    /** convert dict<string, any> to js object (Record<string, any>)
        - options?:
            - strip?: `false` Whether to directly extract and strip the value in DdbObj as the value of js object (discard the rest of the information in DdbObj, only keep the value)
            - deep?: `false` Whether to convert recursively
    */
    to_dict <T extends Record<string, DdbObj> = Record<string, DdbObj>> (): T
    to_dict <T extends Record<string, any> = Record<string, any>> (options: { strip: true }): T
    to_dict <T extends Record<string, any> = Record<string, any>> (options?: { strip?: boolean, deep?: boolean }): T
    to_dict <T = Record<string, any>> ({
        strip,
        deep,
    }: {
        strip?: boolean
        deep?: boolean
    } = { }) {
        if (this.form !== DdbForm.dict)
            throw new Error('this.form is not DdbForm.dict and cannot be converted to js object')
        
        const [{ value: keys, type: key_type }, { value: values, type: value_type }] = this.value as DdbDictValue
        
        if (key_type !== DdbType.string || value_type !== DdbType.any)
            throw new Error('Not dict<string, any>, automatic conversion to js object is not supported for the time being')
        
        if (deep && !strip)
            throw new Error('strip = true must be set when deep = true')
        
        let obj = { }
        
        for (let i = 0;  i < this.rows;  i++) {
            let value: DdbObj = values[i]
            if (deep && value.form === DdbForm.dict)
                obj[keys[i]] = value.to_dict({ strip, deep })
            else
                obj[keys[i]] = strip ? value.value : value
        }
        
        return obj as T
    }
}


/** Formats a single element (value) as a string according to DdbType, null returns a 'null' string */
export function format (type: DdbType, value: DdbValue, le: boolean, options: InspectOptions): string {
    switch (type) {
        case DdbType.bool:
            return inspect(
                (value === null || value === nulls.int8) ?
                    null
                :
                    Boolean(value),
                options
            )
        
        case DdbType.char:
            return inspect(
                (value === null || value === nulls.int8) ?
                    null
                :
                    // ascii printable
                    // http://facweb.cs.depaul.edu/sjost/it212/documents/ascii-pr.htm
                    (32 <= (value as number) && (value as number) <= 126) ?
                        String.fromCharCode(value as number)
                    :
                        value,
                options
            )
        
        case DdbType.short:
            return inspect(
                (value === null || value === nulls.int16) ?
                    null
                :
                    value,
                options
            )
        
        case DdbType.int:
            return inspect(
                (value === null || value === nulls.int32) ?
                    null
                :
                    value,
                options
            )
        
        case DdbType.long:
            return (value === null || value === nulls.int64) ?
                'null'
            :
                options.colors ?
                    String(value).green
                :
                    String(value)
        
        case DdbType.date:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    date2str(value as number).green
                :
                    date2str(value as number)
        
        case DdbType.month:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    month2str(value as number).green
                :
                    month2str(value as number)
        
        case DdbType.time:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    time2str(value as number).green
                :
                    time2str(value as number)
        
        case DdbType.minute:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    minute2str(value as number).green
                :
                    minute2str(value as number)
        
        case DdbType.second:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    second2str(value as number).green
                :
                    second2str(value as number)
        
        case DdbType.datetime:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    datetime2str(value as number).green
                :
                    datetime2str(value as number)
        
        case DdbType.timestamp:
            return (value === null || value === nulls.int64) ?
                'null'
            :
                options.colors ?
                    timestamp2str(value as bigint).green
                :
                    timestamp2str(value as bigint)
        
        case DdbType.nanotime:
            return (value === null || value === nulls.int64) ?
                'null'
            :
                options.colors ?
                    nanotime2str(value as bigint).green
                :
                    nanotime2str(value as bigint)
        
        case DdbType.nanotimestamp:
            return (value === null || value === nulls.int64) ?
                'null'
            :
                options.colors ?
                    nanotimestamp2str(value as bigint).green
                :
                    nanotimestamp2str(value as bigint)
        
        case DdbType.float:
            return (value === null || value === nulls.float32) ?
                'null'
            :
                inspect(value as number, options)
        
        case DdbType.double:
            return (value === null || value === nulls.double) ?
                'null'
            :
                inspect(value as number, options)
        
        case DdbType.symbol:
        case DdbType.string:
            return inspect(value as string, options)
        
        case DdbType.uuid: 
            return options.colors ?
                uuid2str(value as Uint8Array, le).green
            :
                uuid2str(value as Uint8Array, le)
        
        case DdbType.functiondef:
            return inspect(
                (value as DdbFunctionDefValue).name,
                options
            )
        
        case DdbType.handle:
        case DdbType.code:
        case DdbType.resource:
            return inspect(value as string, options)
        
        case DdbType.datehour:
            return (value === null || value === nulls.int32) ?
                'null'
            :
                options.colors ?
                    datehour2str(value as number).green
                :
                    datehour2str(value as number)
        
        case DdbType.ipaddr:
            return options.colors ?
                ipaddr2str(value as Uint8Array, le).green
            :
                ipaddr2str(value as Uint8Array, le)
        
        case DdbType.int128:
            return options.colors ?
                int1282str(value as Uint8Array, le).green
            :
                int1282str(value as Uint8Array, le)
        
        case DdbType.blob:
            return inspect(
                (value as Uint8Array).length > 100 ?
                    DdbObj.dec.decode(
                        (value as Uint8Array).subarray(0, 98)
                    ) + '…'
                :
                    DdbObj.dec.decode(value as Uint8Array),
                options
            )
        
        case DdbType.point: {
            let [x, y] = value as [number, number]
            if (x === nulls.double)
                x = null
            if (y === nulls.double)
                y = null
                
            return options.colors ?
                `(${String(x).green}, ${String(y).green})`
            :
                `(${String(x)}, ${String(y)})`
        }
        
        case DdbType.complex: {
            let [x, y] = value as [number, number]
            if (x === nulls.double)
                x = null
            if (y === nulls.double)
                y = null
            
            return options.colors ?
                    `${String(x).green}+${`${String(y)}i`.green}`
                :
                    `${String(x)}+${String(y)}i`
        }
        
        case DdbType.duration: {
            const { data, unit } = value as DdbDurationValue
            const str = `${data}${DdbDurationUnit[unit]}`
            return options.colors ? str.green : str
        }
        
        default:
            return inspect(value, options)
    }
}


/** formatted vector, the index-th item in the collection is a string, a null value returns a 'null' string */
export function formati (obj: DdbObj<DdbVectorValue>, index: number, options: InspectOptions): string {
    if (64 <= obj.type && obj.type < 128) {  // array vector
        // 因为 array vector 目前只支持：Logical, Integral（不包括 INT128, COMPRESS 类型）, Floating, Temporal
        // 都对应 TypedArray 中的一格，所以 lengths.length 等于 block 中的 row 的个数
        // av = array(INT[], 0, 5)
        // append!(av, [1..1])
        // append!(av, [1..70000])
        // append!(av, [1..1])
        // append!(av, [1..500])
        // ...
        // av
        
        const _type = obj.type - 64
        
        let offset = 0
        
        for (const { lengths, data, rows } of obj.value as DdbArrayVectorBlock[]) {
            let acc_len = 0
            
            if (offset + rows <= index) {
                offset += rows
                continue  // 跳过这个 block
            }
            
            for (const length of lengths) {
                if (offset < index) {
                    offset++
                    acc_len += length
                    continue
                }
                
                const limit = 10
                
                let items = new Array(
                    Math.min(limit, length)
                )
                
                for (let i = 0;  i < items.length;  i++)
                    items[i] = format(_type, data[acc_len + i], obj.le, options)
                
                return (
                    items.join(', ') + (length > limit ? ', ...' : '')
                ).bracket('square')
            }
        }
    }
    
    switch (obj.type) {
        case DdbType.string:
        case DdbType.symbol:
            return obj.value[index]
        
        case DdbType.symbol_extended: {
            const { base, data } = obj.value as DdbSymbolExtendedValue
            return base[data[index]]
        }
        
        case DdbType.uuid:
        case DdbType.int128: 
        case DdbType.ipaddr:
            return format(
                obj.type,
                (obj.value as Uint8Array).subarray(16 * index, 16 * (index + 1)),
                obj.le,
                options
            )
        
        case DdbType.blob: {
            const value = obj.value[index] as Uint8Array
            return value.length > 100 ?
                    DdbObj.dec.decode(
                        value.subarray(0, 98)
                    ) + '…'
                :
                    DdbObj.dec.decode(value)
        }
        
        case DdbType.complex:
        case DdbType.point:
            return format(
                obj.type,
                (obj.value as Float64Array).subarray(2 * index, 2 * (index + 1)),
                obj.le,
                options
            )
        
        
        default:
            return format(obj.type, obj.value[index], obj.le, options)
    }
}


export class DdbVoid extends DdbObj<undefined> {
    constructor () {
        super({
            form: DdbForm.scalar,
            type: DdbType.void,
            value: null,
        })
    }
}


export class DdbBool extends DdbObj<boolean> {
    constructor (value: boolean | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.bool,
            value,
        })
    }
}

export class DdbChar extends DdbObj<string> {
    constructor (value: string | number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.char,
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
            value,
        })
    }
}

export class DdbString extends DdbObj<string> {
    constructor (value: string) {
        super({
            form: DdbForm.scalar,
            type: DdbType.string,
            value
        })
    }
}

export class DdbLong extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.long,
            value
        })
    }
}

export class DdbDouble extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.double,
            value
        })
    }
}

export class DdbDateTime extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.datetime,
            value
        })
    }
}

export class DdbTimeStamp extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.timestamp,
            value
        })
    }
}

export class DdbNanoTimeStamp extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.nanotimestamp,
            value
        })
    }
}

export class DdbPair extends DdbObj<Int32Array> {
    constructor (l: number | null, r: number | null = null) {
        super({
            form: DdbForm.pair,
            type: DdbType.int,
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
            value: { type, name }
        })
    }
}


export class DdbVectorInt extends DdbObj<Int32Array> {
    constructor (ints: (number | null)[] | Int32Array, name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.int,
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
            rows: strings.length,
            cols: 1,
            value: strings,
            name,
        })
    }
}

export class DdbVectorAny extends DdbObj {
    constructor (objs: (DdbObj | string | boolean)[], name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.any,
            rows: objs.length,
            cols: 1,
            value: DdbObj.to_ddbobjs(objs),
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
            rows: strings.length,
            cols: 1,
            value: strings
        })
    }
}

/** Constructs a DdbDict object, which supports two usages:  
     - The incoming type is the keys of DdbObj<DdbVectorValue>, and the two parameters of values directly form the DdbDict of dict<keys.type, values.type>
     - Pass in js object (type is Record<string, boolean | string | DdbObj>), automatically converted to DdbDict of dict<string, any>
*/
export class DdbDict extends DdbObj<DdbDictValue> {
    constructor (obj: Record<string, boolean | string | DdbObj>)
    constructor (keys: DdbObj<DdbVectorValue>, values: DdbObj<DdbVectorValue>)
    constructor (arg0: DdbObj | Record<string, boolean | string | DdbObj>, arg1?: DdbObj) {
        if (arg1)
            super({
                form: DdbForm.dict,
                type: arg1.type,
                rows: (arg0 as DdbObj).rows,
                cols: 2,
                value: [arg0 as DdbObj, arg1] as DdbDictValue
            })
        else {
            const keys = Object.keys(arg0)
            super({
                form: DdbForm.dict,
                type: DdbType.any,
                rows: keys.length,
                cols: 2,
                value: [
                    new DdbVectorString(keys),
                    new DdbVectorAny(
                        Object.values(arg0)
                    )
                ] as DdbDictValue
            })
        }
    }
}


export class DdbTable extends DdbObj<DdbObj[]> {
    constructor (columns: DdbObj[], name: string = '') {
        super({
            form: DdbForm.table,
            type: DdbType.void,
            rows: columns[0].rows,
            cols: columns.length,
            name,
            value: columns,
        })
    }
}

export function date2ms (date: number | null) {
    return (date === null || date === nulls.int32) ? 
        null
    :
        timezone_offset + 1000 * 3600 * 24 * date
}

export function date2str (date: number | null, format = 'YYYY.MM.DD') {
    return (date === null || date === nulls.int32) ? 
        null
    :
        dayjs(
            date2ms(date)
        ).format(format)
}

export function month2ms (month: number | null): number | null {
    return (month === null || month === nulls.int32) ?
        null
    :
        dayjs(
            month2str(month),
            'YYYY.MM[M]'
        ).valueOf()
}

export function month2str (month: number | null) {
    if (month === null || month === nulls.int32)
        return 'null'
    
    if (month < 0)
        return String(month)
    
    const _month = month % 12
    const year = Math.trunc(month / 12)
    return `${String(year).padStart(4, '0')}.${String(_month + 1).padStart(2, '0')}M`
}

export function time2ms (time: number | null): number | null {
    return (time === null || time === nulls.int32) ?
        null
    :
        timezone_offset + time
}

export function time2str (time: number | null, format = 'HH:mm:ss.SSS') {
    return (time === null || time === nulls.int32) ?
        null
    :
        dayjs(
            time2ms(time)
        ).format(format)
}

export function minute2ms (minute: number | null): number | null {
    return (minute === null || minute === nulls.int32) ?
        null
    :
        timezone_offset + 60 * 1000 * minute
}

export function minute2str (minute: number | null, format = 'HH:mm[m]') {
    return (minute === null || minute === nulls.int32) ?
        'null'
    :
        dayjs(
            minute2ms(minute)
        ).format(format)
}

export function second2ms (second: number | null): number | null {
    return (second === null || second === nulls.int32) ?
        null
    :
        timezone_offset + 1000 * second
}

export function second2str (second: number | null, format = 'HH:mm:ss') {
    return (second === null || second === nulls.int32) ?
        'null'
    :
        dayjs(
            second2ms(second)
        ).format(format)
}

export function datetime2ms (datetime: number | null): number | null {
    return (datetime === null || datetime === nulls.int32) ?
        null
    :
        timezone_offset + 1000 * datetime
}

export function datetime2str (datetime: number | null, format = 'YYYY.MM.DD HH:mm:ss') {
    return (datetime === null || datetime === nulls.int32) ?
        'null'
    :
        dayjs(
            datetime2ms(datetime)
        ).format(format)
}

export function timestamp2ms (timestamp: bigint | null): number | null {
    return (timestamp === null || timestamp === nulls.int64) ?
        null
    :
        timezone_offset + Number(timestamp)
}

/** format timestamp (bigint) to string 
    - timestamp: bigint value
    - format?:  
        format string, default to `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function timestamp2str (timestamp: bigint | null, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    return (timestamp === null || timestamp === nulls.int64) ?
        'null'
    :
        dayjs(
            timestamp2ms(timestamp)
        ).format(format)
}

export function datehour2ms (datehour: number | null): number | null {
    return (datehour === null || datehour === nulls.int32) ?
        null
    :
        timezone_offset + 1000 * 3600 * datehour
}

export function datehour2str (datehour: number | null, format = 'YYYY.MM.DDTHH') {
    return (datehour === null || datehour === nulls.int32) ?
        'null'
    :
        dayjs(
            timezone_offset + 1000 * 3600 * datehour
        ).format(format)
}


/** parse timestamp string to bigint value  
    - str: timestamp string, If it is an empty string or 'null', it will return the corresponding empty value (nulls.int64)
    - format?:  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function str2timestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    if (!str || str === 'null')
        return nulls.int64
    
    if (str.length !== format.length)
        throw new Error('The length of the timestamp string is not equal to the length of the format string')
    
    return BigInt(
        -timezone_offset +
        dayjs(str, format).valueOf()
    )
}

export function nanotime2ns (nanotime: bigint | null): bigint | null {
    return nanotimestamp2ns(nanotime)
}

export function nanotime2str (nanotime: bigint | null, format = 'HH:mm:ss.SSSSSSSSS') {
    if (nanotime === null || nanotime === nulls.int64)
        return 'null'
    
    if (nanotime < 0n)
        return String(nanotime)
    
    const i_second_start = format.indexOf('ss')
    if (i_second_start === -1)
        throw new Error('The format string must contain the format for seconds (ss)')
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    if (i_nanosecond_start === -1)
        throw new Error('The format string must contain the format for nanoseconds (SSSSSSSSS)')
    
    return (
        dayjs(
            timezone_offset + (Number(nanotime) / 1000000)
        ).format(
            format.slice(0, i_second_end)
        ) + 
        format.slice(i_second_end, i_nanosecond_start) + 
        String(nanotime % 1000000000n).padStart(9, '0')
    )
}

export function nanotimestamp2ns (nanotimestamp: bigint | null): bigint | null {
    return (nanotimestamp === null || nanotimestamp === nulls.int64) ?
        null
    :
        BigInt(timezone_offset) * 1000000n + nanotimestamp
}

/** format nanotimestamp value (bigint) to string 
    - nanotimestamp: bigint value
    - format?:  
        format string, default is `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        Seconds are in the format ss (must be included); nanoseconds are in the format SSSSSSSSS (must be included)  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function nanotimestamp2str (nanotimestamp: bigint | null, format = 'YYYY.MM.DD HH:mm:ss.SSSSSSSSS') {
    // tests:
    // nanotimestamp2str(0n)
    // nanotimestamp2str(-1n)
    // nanotimestamp2str(-9_9999_9999n)
    // nanotimestamp2str(-10_0000_0000n)
    // nanotimestamp2str(-10_0000_0001n)
    
    if (nanotimestamp === null || nanotimestamp === nulls.int64)
        return 'null'
    
    const i_second_start = format.indexOf('ss')
    if (i_second_start === -1)
        throw new Error('The format string must contain the format for seconds (ss)')
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    if (i_nanosecond_start === -1)
        throw new Error('The format string must contain the format for nanoseconds (SSSSSSSSS)')
    
    const remainder = nanotimestamp % 1000000000n
    const borrow = remainder < 0n
    
    return (
        dayjs(
            timezone_offset +
            // 去掉 9 位的纳秒部分，转化为毫秒
            Number(
                (nanotimestamp - remainder + (borrow ? -1000000000n : 0n)) / 1000000n
            )
        ).format(
            format.slice(0, i_second_end)
        ) + 
        format.slice(i_second_end, i_nanosecond_start) + 
        String(
            borrow ?
                (remainder + 1000000000n) % 1000000000n
            :
                remainder
        ).padStart(9, '0')
    )
}

/** parse nano timestamp string to bigint value  
    - str: nano timestamp string, If it is an empty string or 'null', it will return the corresponding empty value (nulls.int64)
    - format?:  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        Seconds are in the format ss (must be included); nanoseconds are in the format SSSSSSSSS (must be included)  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function str2nanotimestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSSSSSSSS') {
    if (!str || str === 'null')
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


export function ipaddr2str (buffer: Uint8Array, le = true, ipv6?: boolean) {
    let buf = buffer
    
    if (le)
        buf = buffer.slice().reverse()
    
    const i_non_zero = buf.findIndex(x => 
        x as any)
    
    if (
        ipv6 || 
        i_non_zero !== -1 && i_non_zero < 12
    ) // ipv6
        return buf2ipaddr([...buf]).toString()
    else  // ipv4
        return buf.subarray(12).join('.')
}

export function uuid2str (buffer: Uint8Array, le = true) {
    const str = int1282str(buffer, le)
    return `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20)}`
}

export function int1282str (buffer: Uint8Array, le = true) {
    let buf = buffer
    
    if (le)
        buf = buffer.slice().reverse()
    
    return [...buf].map(x => 
        x.toString(16)
            .padStart(2, '0')
    ).join('')
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
    
    /** 是否在建立连接后自动登录，默认 true */
    autologin = true
    
    /** DolphinDB 登录用户名 */
    username = 'admin'
    
    /** DolphinDB 登录密码 */
    password = '123456'
    
    /** python session flag (2048) */
    python = false
    
    
    // --- 内部选项, 状态
    print_message_buffer = false
    
    print_object_buffer = false
    
    print_message = true
    
    parse_object = true
    
    pnode_run_defined = false
    
    
    /** DdbMessage listeners */
    listeners: DdbMessageListener[] = [ ]
    
    pconnect = Promise.resolve()
    
    ppnoderun = Promise.resolve()
    
    presult = Promise.resolve(null)
    
    get connected () {
        return this.websocket?.readyState === WebSocket.OPEN
    }
    
    
    /**
        Initialize an instance of DolphinDB Client using the WebSocket URL  
        (without establishing an actual network connection)
        - url: DolphinDB WebSocket URL. e.g.：`ws://127.0.0.1:8848`
        - options?:
            - autologin?: Whether to log in automatically after establishing a connection, default `true`
            - username?: DolphinDB username, default `'admin'`
            - password?: DolphinDB password, default `'123456'`
            - python?: set python session flag, default `false`
        
        @example
        let ddb = new DDB('ws://127.0.0.1:8848')
        
        // 使用 HTTPS 加密
        let ddbsecure = new DDB('wss://dolphindb.com', {
            autologin: true,
            username: 'admin',
            password: '123456',
            python: false
        })
    */
    constructor (url: string, options: {
        autologin?: boolean
        username?: string
        password?: string
        python?: boolean
    } = { }) {
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
    
    
    private on_message (event: { data: ArrayBuffer }) { }
    
    
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
            
            on_message: (event: { data: ArrayBuffer }) => {
                this.on_message(event)
            }
        })
        
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
        this.on_message = () => { }
        this.presult = Promise.resolve(null)
        this.pconnect = Promise.resolve()
    }
    
    
    /** rpc through websocket (function/script/variable command)  
        - type: API 类型: 'script' | 'function' | 'variable'
        - options:
            - urgent?: 决定 `行为标识` 那一行字符串的取值（只适用于 script 和 function）
            - vars?: type === 'variable' 时必传，variable 指令中待上传的变量名
            - listener?: 处理本次 rpc 期间的消息 (DdbMessage)
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
            listener,
            parse_object,
        }: {
            script?: string
            func?: string
            args?: (DdbObj | string | boolean)[]
            vars?: string[]
            urgent?: boolean
            listener?: DdbMessageListener
            parse_object?: boolean
    }) {
        if (!this.websocket) {
            const ptail = this.pconnect
            
            let resolve: () => void
            this.pconnect = new Promise<void>((_resolve, _reject) => {
                resolve = _resolve
            })
            
            await ptail
            
            try {
                if (!this.websocket)
                    await this.connect()
            } finally {
                resolve()
            }
        }
        
        
        if (!this.connected)
            throw new Error(`${this.url} is already disconnected`)
        
        
        if (func === 'pnode_run' && !this.pnode_run_defined) {
            const ptail = this.ppnoderun
            
            let resolve: () => void
            this.ppnoderun = new Promise<void>((_resolve, _reject) => {
                resolve = _resolve
            })
            
            await ptail
            
            try {
                if (!this.pnode_run_defined)
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
            } finally {
                resolve()
            }
        }
        
        
        // this 上的当前配置需要在 message 到达后使用，先保存起来
        const _handlers = [...this.listeners].reverse()
        
        
        // 临界区：保证多个 rpc 并发时形成 promise 链
        // ddb 世界观：需要等待上一个 rpc 结果从 server 返回之后才能发起下一个调用  
        // 违反世界观可能造成:  
        // 1. 并发多个请求只返回第一个结果（阻塞，需后续请求疏通）
        // 2. windows 下 ddb server 返回多个相同的结果
        
        const ptail = this.presult
        
        let resolve: (ddbobj: T) => void
        let reject: (error: Error) => void
        const presult = this.presult = new Promise<T>((_resolve, _reject) => {
            resolve = _resolve
            reject = _reject
        })
        
        try {
            await ptail
        } catch { }
        // 临界区结束，只有一个 rpc 函数调用运行到这里，可以独占 this.on_message 然后写 WebSocket
        
        
        this.on_message = ({ data: buffer }) => {
            try {
                const buf = new Uint8Array(buffer)
                
                if (this.print_message_buffer)
                    console.log(
                        typed_array_to_buffer(buf)
                    )
                
                const message = this.parse_message(buf, parse_object)
                
                listener?.(message, this)
                for (const listener of _handlers)
                    listener(message, this)
                
                const { type, data } = message
                
                switch (type) {
                    case 'print':
                        if (this.print_message)
                            console.log(data)
                        return
                    
                    case 'object':
                        resolve(data as T)
                        return
                    
                    case 'error':
                        reject(data)
                        return
                }
            } catch (error) {
                reject(error)
            }
        }
        
        args = DdbObj.to_ddbobjs(args)
        
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
        
        this.websocket.send(
            concat([
                this.enc.encode(
                    `API2 ${this.sid} ${command.length} / ${this.get_rpc_options({ urgent })}\n`
                ),
                command,
                ... args.map((arg: DdbObj) =>
                    arg.pack()
                )
            ])
        )
        
        return presult
    }
    
    
    /** eval script through websocket (script command)  
        - script?: Script to execute
        - options?: execution options
            - urgent?: Urgent flag to ensure that submitted scripts are processed by urgent workers to prevent being blocked by other jobs
            - listener?: Process messages during this rpc (DdbMessage)
            - parse_object?: Set parse_object during this rpc, and restore the original after the end.
                When it is false, the returned DdbObj only contains buffer and le without parsing, 
                so as to facilitate subsequent forwarding and serialization
    */
    async eval <T extends DdbObj> (
        script: string,
        {
            urgent,
            listener,
            parse_object,
        }: {
            urgent?: boolean
            listener?: DdbMessageListener
            parse_object?: boolean
        } = { }
    ) {
        return this.rpc<T>('script', { script, urgent, listener, parse_object })
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
            - listener?: Process messages during this rpc (DdbMessage)
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
            listener,
            parse_object,
        }: {
            urgent?: boolean
            node?: string
            nodes?: string[]
            func_type?: DdbFunctionType
            add_node_alias?: boolean
            listener?: DdbMessageListener
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
                new DdbVectorAny(args),
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
            listener,
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
            listener,
            parse_object,
        }: {
            listener?: DdbMessageListener
            parse_object?: boolean
        } = { }
    ) {
        if (!args.length || args.length !== vars.length)
            throw new Error('variable command parameter is empty or parameter name is empty, or the number does not match')
        
        return this.rpc('variable', { vars, args, listener, parse_object })
    }
    
    
    /** cancel all jobs corresponding to the ddb.sid */
    async cancel () {
        let ddb = new DDB(this.url, this)
        
        try {
            await ddb.call(
                'cancelConsoleJob',
                (
                    await ddb.eval<DdbObj<string[]>>(
                        `exec rootJobId from getConsoleJobs() where sessionId = ${this.sid}`,
                        { urgent: true }
                    )
                ).value,
                { urgent: true }
            )
        } finally {
            ddb.disconnect()
        }
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
            console.log(`session.id: ${this.sid} -> ${sid}`)
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
            console.log(
                typed_array_to_buffer(buf_obj)
            )
        
        return {
            type: 'object',
            data: parse_object ?
                    DdbObj.parse(buf_obj, this.le)
                :
                    new DdbObj({
                        form: DdbForm.scalar,
                        type: DdbType.void,
                        length: 0,
                        le: this.le,
                        buffer: buf_obj,
                    })
        }
    }
}


export interface DdbMessageListener {
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



import type { BigInt128Array } from './bigint128array.js'


export const nulls = {
    int8: -0x80,  // -128
    int16: -0x80_00,  // -32768
    int32: -0x80_00_00_00,  // -21_4748_3648
    int64: -0x80_00_00_00_00_00_00_00n,  // -922_3372_0368_5477_5808
    int128: -0x80_00_00_00_00_00_00_00_00_00_00_00_00_00_00_00n,  // -170_1411_8346_0469_2317_3168_7303_7158_8410_5728
    float32: -3.4028234663852886e+38,
    
    /** -Number.MAX_VALUE */
    double: -Number.MAX_VALUE,
    
    bytes16: Uint8Array.from(
        new Array(16).fill(0)
    )
} as const


export enum DdbForm {
    scalar = 0,
    vector = 1,
    pair = 2,
    matrix = 3,
    set = 4,
    dict = 5,
    table = 6,
    chart = 7,
    
    /** 结点内部通信可能会使用，调用函数执行脚本一般不会返回这种类型  
        Node internal communication may be used, calling function execution script generally does not return this type */
    chunk = 8,
    
    /** sysobj */
    object = 9,
}


/** DolphinDB DataType  
    对应的 array vector 类型为 64 + 基本类型  The corresponding array vector type is 64 + base type
    对应的 extended 类型为 128 + 基本类型  The corresponding extended type is 128 + base type */
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
    
    decimal32 = 37,
    decimal64 = 38,
    decimal128 = 39,
    
    object = 40,
    pynone = 41,
    
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


// server 实现中区分了 0: NULL (nothing), 1: NULL (null), 2: DFLT (default)
// Void::serialize()
//     (isNothing() ? 0 : 1) + (isDefault_ ? 2 : 0);
export enum DdbVoidType {
    undefined = 0,
    null = 1,
    default = 2
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


export interface DdbDecimal32Value {
    /** int32, data 需要除以 10^scale 得到原值  data needs to be divided by 10^scale to get the original value */
    scale: number
    
    /** int32, 空值为 null  ddb null is js null */
    data: number | null
}

export interface DdbDecimal64Value {
    /** int32, data 需要除以 10^scale 得到原值  data needs to be divided by 10^scale to get the original value */
    scale: number
    
    /** int64, 空值为 null  empty value is null */
    data: bigint | null
}

export interface DdbDecimal32VectorValue {
    scale: number
    
    data: Int32Array
}

export interface DdbDecimal64VectorValue {
    scale: number
    
    data: BigInt64Array
}

export type DdbDurationVectorValue = DdbDurationValue[]

export interface DdbSymbolExtendedValue {
    base_id: number
    base: string[]
    data: Uint32Array
}

export interface DdbArrayVectorBlock {
    unit: 1 | 2 | 4
    rows: number
    lengths: Uint8Array | Uint16Array | Uint32Array
    data: Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | BigInt128Array
}

export type DdbArrayVectorValue = DdbArrayVectorBlock[] & /* decimal 数据会有这个属性 */ { scale?: number }



export const dictables = new Set([DdbType.any, DdbType.string, DdbType.double, DdbType.float, DdbType.int, DdbType.long])


export function is_decimal_type (type: DdbType) {
    return type === DdbType.decimal32 || type === DdbType.decimal64 || type === DdbType.decimal128
}


export function is_decimal_null_value (type: DdbType, value: number | bigint) {
    return (
        (value === nulls.int128 && type === DdbType.decimal128) ||
        (value === nulls.int64 && type === DdbType.decimal64) ||
        (value === nulls.int32 && type === DdbType.decimal32)
    )
}

export function get_duration_unit (code: number) {
    let str = String.fromCharCode((code >> 24) & 255)
    str += String.fromCharCode((code >> 16) & 255)
    str += String.fromCharCode((code >> 8) & 255)
    str += String.fromCharCode(code & 255)
    return str
}



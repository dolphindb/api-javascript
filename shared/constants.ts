export const DDB_NULL_VALUES = {
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

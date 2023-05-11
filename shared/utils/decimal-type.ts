import { DDB_NULL_VALUES } from '../constants.js'
import { DdbType } from '../enums.js'

export function is_decimal_type (type: DdbType) {
  return (
    type === DdbType.decimal32 ||
    type === DdbType.decimal64 ||
    type === DdbType.decimal128
  )
}

export function is_decimal_null_value (type: DdbType, value: number | bigint) {
  return (
    (value === DDB_NULL_VALUES.int128 && type === DdbType.decimal128) ||
    (value === DDB_NULL_VALUES.int64 && type === DdbType.decimal64) ||
    (value === DDB_NULL_VALUES.int32 && type === DdbType.decimal32)
  )
}

import { assert } from 'xshell'

import { DdbDatabaseRpcError, type DDB } from '../index.js'

export async function test_error_cause(ddb: DDB) {
  console.log('测试 error cause')

  try {
    await ddb.eval('x')
  } catch (err) {
    assert(err.ddb === ddb)
    assert(err instanceof DdbDatabaseRpcError)
    assert(err.type === 'script')
    assert(err.options.script === 'x')
    assert(err.cause.stack.includes('test_error_cause'))
  }
}

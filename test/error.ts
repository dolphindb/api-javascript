import { assert } from 'xshell'

import { DdbDatabaseError, type DDB } from '../index.js'


export async function test_error_cause (ddb: DDB) {
    console.log('测试 DdbDatabaseError')
    
    try {
        await ddb.eval('x')
    } catch (err) {
        assert(err instanceof DdbDatabaseError)
        assert(err.ddb === ddb)
        assert(err.type === 'script')
        assert(err.options.script === 'x')
        assert(err.stack.includes('test_error_cause'))
    }
}

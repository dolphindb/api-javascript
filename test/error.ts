import { assert } from 'xshell'

import { DdbDatabaseError, type DDB } from '../index.js'


export async function test_error_cause (ddb: DDB) {
    console.log('测试 DdbDatabaseError')
    
    try {
        await ddb.eval('x')
    } catch (error) {
        assert(error.name === 'DdbDatabaseError')
        assert(error instanceof DdbDatabaseError)
        assert(error.ddb === ddb)
        assert(error.type === 'script')
        assert(error.options.script === 'x')
        assert(error.stack.includes('test_error_cause'))
    }
}

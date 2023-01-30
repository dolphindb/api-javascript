import { assert } from 'xshell'

import { DdbDatabaseError, DdbConnectionError, DDB } from '../index.js'
import { url } from './index.js'


export async function test_error (ddb: DDB) {
    console.log('测试 DdbDatabaseError 和 DdbConnectionError')
    
    const error_message = '错误消息'
    const error_script = `throw ${error_message.quote()}`
    
    let database_error: DdbDatabaseError
    
    try {
        await ddb.eval(error_script)
    } catch (error) {
        database_error = error
    }
    
    assert(database_error)
    assert(database_error instanceof DdbDatabaseError)
    assert(database_error.message === `throw ${error_message.quote('double')} => ${error_message}`)
    assert(database_error.name === 'DdbDatabaseError')
    assert(database_error.ddb === ddb)
    assert(database_error.type === 'script')
    assert(database_error.options.script === error_script)
    assert(database_error.stack.includes('test_error'))
    
    
    let ddbtest = new DDB(url)
    let connection_error: DdbConnectionError
    try {
        await ddbtest.connect()
        ddbtest.disconnect()
        await ddbtest.eval('1')
    } catch (error) {
        connection_error = error
    }
    
    assert(connection_error)
    assert(connection_error instanceof DdbConnectionError)
    assert(connection_error.ddb === ddbtest)
}

import { set_inspect_options } from 'xshell'

import { DDB } from '../index.js'
import { test_print } from './print.js'
import { test_types } from './types.js'
import { test_time } from './time.js'
import { test_streaming } from './streaming.js'


set_inspect_options()


// linux
export const url = 'ws://192.168.0.16:9002' as const

// windows
// export const url = 'ws://192.168.0.32:9002' as const

// local 8848
// export const url = 'ws://127.0.0.1:8848' as const


;(async function test () {
    console.log('--- 测试开始 ---'.green)
    
    let ddb = new DDB(url)
    
    const tests = [
        test_types,
        test_print,
        test_time,
        test_streaming,
    ]
    
    for (const fn_test of tests)
        await fn_test(ddb)
    
    ddb.disconnect()
    
    console.log('--- 测试通过 ---'.green)
})()

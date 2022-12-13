import util from 'util'

import { set_inspect_options } from 'xshell'

import { DDB } from '../index.js'
import { test_print } from './print.js'
import { test_types } from './types.js'
import { test_time } from './time.js'
import { test_streaming } from './streaming.js'

set_inspect_options()

export const url = 'ws://127.0.0.1:8848' as const

// test win server
// export const url = 'ws://192.168.0.32:9002' as const

// test linux server
// export const url = 'ws://192.168.0.16:9002' as const


;(async function test () {
    util.inspect.defaultOptions.colors = true
    
    console.log('--- 测试开始 ---')
    
    console.log('连接到:', url)
    let ddb = new DDB(url)
    
    const tests = [
        test_types,
        test_print,
        test_time,
        test_streaming
    ]
    
    for (const fn_test of tests)
        await fn_test(ddb)
    
    ddb.disconnect()
    
    console.log('--- 测试通过 ---')
})()

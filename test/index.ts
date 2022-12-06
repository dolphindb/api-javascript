import util from 'util'

import { set_inspect_options } from 'xshell'

import { DDB } from '../index.js'
import { test_print } from './print.js'
import { test_types } from './types.js'
import { test_time } from './time.js'
import { test_streaming } from './streaming.js'

set_inspect_options()


;(async function test () {
    util.inspect.defaultOptions.colors = true
    
    console.log('--- 测试开始 ---')
    
    console.log('连接到 ws://127.0.0.1:8848')
    let ddb = new DDB('ws://127.0.0.1:8848')
    
    // 测试流数据
    
    // let sddb = new DDB('ws://127.0.0.1:8848', {
    //     streaming: {
    //         table: 'prices',
    //         handler (message) {
    //             console.log(message)
    //         }
    //     }
    // })

    // await sddb.connect()
    
    
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

import { DDB, DdbInt, DdbVectorDouble } from './index.js'

;(async function test () {
    console.log('--- 测试开始 ---')
    
    console.log('连接到 ws://127.0.0.1:8848')
    let ddb = new DDB('ws://127.0.0.1:8848')
    await ddb.connect()
    
    console.log('测试通过 ddb.call 调用 getNodeAlias 函数')
    console.log(
        await ddb.call('getNodeAlias')
    )
    
    console.log('测试 ddb.call 上传不同类型的变量')
    console.log(
        await ddb.call('typestr', [new DdbInt(1)])
    )
    
    
    console.log('测试 ddb.call 上传不同类型的变量')
    console.log(
        await ddb.call('typestr', [new DdbVectorDouble([0.1, 0.2, 0.3])])
    )
    
    
    ddb.disconnect()
    
    console.log('--- 测试通过 ---')
})()

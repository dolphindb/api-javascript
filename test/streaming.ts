import { DDB } from '../index.js'


export async function test_streaming (ddb: DDB) {
    console.log('测试流数据')
    
    let sddb = new DDB('ws://127.0.0.1:8848', {
        streaming: {
            table: 'prices',
            handler (message) {
                 console.log(message)
            },
        }
    })
    
    await sddb.connect()
    
    sddb.disconnect()
}

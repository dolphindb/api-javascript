import { DDB } from './index.js'

;(async function test () {
    let ddb = new DDB('ws://127.0.0.1:8848')
    await ddb.connect()
    
    console.log(
        await ddb.call('getNodeAlias')
    )
    
    ddb.disconnect()
})()

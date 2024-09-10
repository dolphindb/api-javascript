import { deepEqual } from 'assert/strict'

import { assert, defer, fread, inspect, MyProxy, ramdisk, set_inspect_options, WebSocketConnectionError } from 'xshell'

import { keywords } from './language.ts'

import {
    DDB, DdbConnectionError, DdbDatabaseError, DdbForm, DdbInt, DdbLong, DdbObj, DdbType, 
    DdbVectorAny, DdbVectorDouble, DdbVectorSymbol, month2ms, DdbDurationUnit,
    type DdbStringObj, type DdbVectorAnyObj, type DdbDurationVectorValue, type DdbVectorObj, type DdbTableObj, DdbTimeStamp, type DdbDictObj, type DdbTableData, type DdbOptions,
    type DdbIotAnyVector,
} from './index.ts'


set_inspect_options()


const fpd_root = import.meta.dirname.fpd

// linux
const url = 'ws://192.168.0.122:8849' as const
// const url = 'ws://183.134.101.143:8499' as const
// const url = 'ws://192.168.0.29:9002' as const

// windows
// export const url = 'ws://192.168.0.29:9002' as const

// local 8848
// export const url = 'ws://127.0.0.1:8848' as const

const ddb_options: DdbOptions = ramdisk ? { proxy: MyProxy.work } : { }


;(async function test () {
    console.log('--- 测试开始 ---'.green)
    
    let ddb = new DDB(url, ddb_options)
    
    const tests = [
        test_parse_iot_vector_type,
        // test_pack_iot_any_vector,
        
        // test_keywords,
        // test_types,
        // test_reconnection,
        // test_connection_error,
        // test_print,
        // test_time,
        // test_streaming,
        // test_error,
        // test_invoke
    ]
    
    for (const fn_test of tests)
        await fn_test(ddb)
    
    ddb.disconnect()
    
    console.log('--- 测试通过 ---'.green)
})()



function test_keywords () {
    assert(new Set(keywords).size === keywords.length, 'keywords 中不能有重复的项')
}


async function get_printed (ddb: DDB, code: string) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            let resolved = false
            await ddb.eval(
                `print(${code})`,
                {
                    listener ({ type, data }) {
                        if (type === 'print' && !resolved) {
                            resolved = true
                            resolve(data)
                        }
                    }
                }
            )
            if (!resolved)
                reject(new Error('未输出 print 消息'))
        } catch (error) {
            reject(error)
        }
    })
}


async function test_repl (ddb: DDB) {
    let _ddb = new DDB(url, ddb_options)
    try {
        await _ddb.execute(
            'clearCachedModules()\n' +
            'use autoInspection'
        )
        await _ddb.execute('scheduleJob("6253392463056112", "巡检描述", runPlan{"6253392463056112"}, minute("09:39m"), date("2024.09.02"), date("2124.09.02"), "W", [1])')
        // await _ddb.invoke('scheduleJob', ['6253392463056112', '巡检描述', 'runPlan{"6253392463056112"}', 'minute("09:39m")', 'date("2024.09.02")', 'date("2124.09.02")', 'W', [1] ])
    } catch (error) {
        console.log('error', error)
    }
}


async function test_reconnection (ddb: DDB) {
    let _ddb = new DDB(url, ddb_options)
    
    await _ddb.connect()
    _ddb.disconnect()
    
    let error: DdbConnectionError
    
    try {
        await _ddb.connect()
    } catch (_error) {
        error = _error
    }
    
    assert(error && error instanceof DdbConnectionError)
}


async function test_connection_error (ddb: DDB) {
    let _ddb = new DDB(url, ddb_options)
    
    await _ddb.connect()
    _ddb.disconnect()
    
    let error: DdbConnectionError
    
    try {
        await _ddb.eval('1 + 1')
    } catch (_error) {
        error = _error
    }
    
    assert(error && error instanceof DdbConnectionError)
}


async function test_error (ddb: DDB) {
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
    assert(database_error.url === ddb.url)
    assert(database_error.type === 'script')
    assert(database_error.options.script === error_script)
    assert(database_error.stack.includes('test_error'))
    
    
    let ddbtest = new DDB(url, ddb_options)
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
    assert(connection_error.url === ddbtest.url)
    
    
    // --- 首次连接失败也会抛出 DdbConnectionError
    let ddbtest2 = new DDB('ws://dolphindb.com/')
    let connection_error2: DdbConnectionError
    try {
        await ddbtest2.connect()
    } catch (error) {
        connection_error2 = error
    }
    
    assert(connection_error2)
    assert(connection_error2 instanceof DdbConnectionError)
    assert(connection_error2.cause && connection_error2.cause instanceof WebSocketConnectionError)
}


async function test_print (ddb: DDB) {
    console.log('测试 print message')
    
    const str = 'test print message\n中文'
    
    assert(await get_printed(ddb, str.quote()) === str)
    
    console.log('测试 verbose 输出')
    
    let vddb = new DDB(url, { ...ddb_options, verbose: true })
    
    await vddb.call('typestr', [
        new DdbVectorAny([
            new DdbVectorSymbol(['a', 'b', 'a', 'b', 'a', 'b']),
            new DdbLong(3n)
        ])
    ])
    
    vddb.disconnect()
}


async function test_streaming (ddb: DDB, ha?: boolean) {
    console.log('测试流数据')
    
    const n = 100
    
    await ddb.eval(
        ha ?
            'try {\n' +
            '    try {\n' +
            "        dropStreamTable('prices')\n" +
            '    } catch (error) { }\n' +
            '    \n' +
            "    haStreamTable(11, table(10000:0, ['time', 'stock', 'price'], [TIMESTAMP, SYMBOL, DOUBLE]), 'prices', 100000)\n" +
            "    print('prices 流表创建成功')\n" +
            '} catch (error) {\n' +
            "    print('prices 流表创建失败')\n" +
            '    print(error)\n' +
            '}\n'
        :
            'try {\n' +
            "    if (!defined('prices', SHARED)) {\n" +
            '        share(\n' +
            '            streamTable(\n' +
            '                10000:0,\n' +
            "                ['time', 'stock', 'price'],\n" +
            '                [TIMESTAMP, SYMBOL, DOUBLE]\n' +
            '            ),\n' +
            "            'prices'\n" +
            '        )\n' +
            "        print('prices 流表创建成功')\n" +
            '    } else\n' +
            "        print('prices 流表已存在')\n" +
            '} catch (error) {\n' +
            "    print('prices 流表创建失败')\n" +
            '    print(error)\n' +
            '}\n'
    )
    
    let total_rows = 0
    
    let first = true
    
    let promise = defer<void>()
    
    let sddb = new DDB(url, {
        ...ddb_options,
        streaming: {
            table: 'prices',
            handler ({ error, data: _data, time, id, window }) {
                if (error)
                    throw error
                
                const { columns, data, name, types } = _data
                
                assert(Array.isArray(data))
                
                if (first) {
                    assert(data.length === 0, '流订阅应该返回 schema')
                    first = false
                } else
                    assert(data.length > 0)
                
                deepEqual(columns, ['time', 'stock', 'price'])
                
                assert(name === 'prices')
                assert(typeof id === 'bigint')
                assert(time)
                assert(types.length === 3)
                
                total_rows += data.length
                
                if (total_rows === n * 10)
                    promise.resolve()
            },
        }
    })
    
    await sddb.connect()
    
    await ddb.eval(
        `n = ${n}\n` +
        '\n' +
        'for (i in 0..9)\n' +
        '    append!(\n' +
        '        prices,\n' +
        '        table([\n' +
        '            (now() + 0..(n-1)) as time,\n' +
        "            take(['MSFT', 'FUTU'], n) as stock,\n" +
        '            (0..(n-1) \\ 10) as price\n' +
        '        ])\n' +
        '    )\n'
    )
    
    await promise
    console.log('流数据已全部收齐')
    
    sddb.disconnect()
}


async function test_time (ddb: DDB) {
    console.log('测试时间显示')
    
    await time2str_equal(ddb, '2022-09-01T14:30:01.095')
    await time2str_equal(ddb, '2022-07-01T00:00:00.000')
    await time2str_equal(ddb, '2022-07-02T00:00:00.000')
    await time2str_equal(ddb, '2022-06-30T00:00:00.000')
    await time2str_equal(ddb, '2022-12-22T16:57:30.248')
    
    
    console.log('测试 month2ms')
    assert(
        month2ms(
            (
                await ddb.eval<DdbObj<number>>('2022.12M')
            ).value
        ) === new Date('2022.12.01').valueOf()
    )
}


async function time2str_equal (ddb: DDB, timestr: string) {
    const code = `temporalParse('${timestr}', 'yyyy-MM-ddTHH:mm:sss.SSS')`
    
    assert(
        inspect(
            await ddb.eval(code),
            { colors: false }
        ).slice('timestamp('.length, -1) === 
        (
            await get_printed(ddb, code)
        ).replace('T', ' ')
    )
}


async function test_types (ddb: DDB) {
    console.log('测试通过 ddb.call 调用 getNodeAlias 函数')
    console.log(await ddb.call('getNodeAlias'))
    
    console.log('测试 ddb.call 上传不同类型的变量')
    const result0 = await ddb.call('typestr', [new DdbInt(1)])
    console.log(result0)
    assert(result0.form === DdbForm.scalar)
    assert(result0.type === DdbType.string)
    assert(result0.value === 'INT')
    
    console.log('测试 ddb.call 上传不同类型的变量')
    const result1 = await ddb.call('typestr', [new DdbVectorDouble([0.1, 0.2, 0.3])])
    console.log(result1)
    assert(result1.form === DdbForm.scalar)
    assert(result1.type === DdbType.string)
    assert(result1.value === 'FAST DOUBLE VECTOR')
    
    console.log('测试 array vector')
    const av = await ddb.eval(
        'av = array(INT[], 0, 3)\n' +
        'append!(av, [1..4])\n' +
        'append!(av, [1..70000])\n' +
        'av\n'
    )
    
    console.log(av)
    assert(av.form === DdbForm.vector)
    assert(av.type === DdbType.int + 64)  // array vector 的 type 比较特殊，需要偏移 64
    assert(av.rows === 2)
    
    // 测试 array vector 格式化
    // console.log(
    //     await ddb.eval<DdbVectorObj>(
    //         'av = array(DECIMAL128(2)[], 0, 1)\n' +
    //         'append!(av, [[92233720368547758.11, NULL, 100000000000000, NULL, -92233720368547758, -100000000000000]])\n' +
    //         'av\n'
    //     )
    // )
    
    // 测试 Invalid Date
    await ddb.upload(['x'], [new DdbTimeStamp(10000000000000000n)])
    
    assert(
        inspect(
            await ddb.eval('x'), 
            { colors: false }
        ) === 'timestamp(Invalid Date)'
    )
    
    console.log('测试大数据')
    let bigarr = new Float64Array(10)
    bigarr.fill(0.5)
    
    await ddb.call<DdbStringObj>('typestr', [
        new DdbObj({
            form: DdbForm.vector,
            type: DdbType.double,
            length: 0,
            rows: bigarr.length,
            cols: 1,
            value: bigarr
        })
    ])
    
    await ddb.upload(['a'], [
        new DdbObj({
            form: DdbForm.vector,
            type: DdbType.double,
            length: 0,
            rows: bigarr.length,
            cols: 1,
            value: bigarr
        })
    ])
    
    assert((
        await ddb.eval<DdbVectorDouble>('a')
    ).rows === bigarr.length)
    
    
    console.log('测试 datasource')
    
    const ds = (await ddb.eval<DdbVectorAnyObj>(
        'db_path = "dfs://test-datasource"\n' + 
        'tb_name = "db"\n' + 
        'if (!existsTable(db_path, tb_name))\n' + 
        '    createTable(\n' + 
        '        database(db_path, VALUE , [1]),\n' +
        '        table(1:0,`id`name, [INT, STRING]),\n' +
        '        tb_name\n' +
        '    ).append!(table(1 2 as id, `str1`str2 as name))\n' +
        '\n' +
        'tb = loadTable(db_path, tb_name)\n' +
        'sqlDS(<select * from tb where id = 1>)\n'
    )).value[0] as DdbStringObj
    
    const { type, form, value } = ds
    
    assert(type === DdbType.datasource && form === DdbForm.scalar, '返回的 DdbObj 具有正确的 type 和 form')
    
    assert(value === 'DataSource< select [7] * from tb where id == 1 >')
    
    // 如果直接构造 DdbObj Datasource，将其送入 ddb.call, ddb将仍然认为送入的是一个 STRING 
    assert(
        (await ddb.call<DdbStringObj>('typestr', [ds])).value === 'STRING', 
        '从 js 构建的 Datasource DdbObj 会被识别为 STRING'
    )
    
    console.log('测试 pair<duration>')
    const dp = await ddb.eval<DdbVectorObj<DdbDurationVectorValue>>(
        'pair(duration("20d"), duration("2H"))'
    ) 
    
    console.log(dp)
    assert(dp.type === DdbType.duration, 'dp 的返回值应该为 Duration')
    assert(dp.value[0].data === 20 && dp.value[0].unit === DdbDurationUnit.d, 'pair<duration> 的 value 应该已解析')
    
    console.log('测试 void vector')
    const table = await ddb.eval<DdbTableObj>('select *, NULL as val from table(1..100 as id)')
    const { value: [ints, voids] } = table
    
    console.log(voids)
    assert(voids.rows === ints.rows, 'void vector 应该具有正常的 vector length')
    assert(voids.length === 10, 'void vector 应该具有正确的数据长度')
    assert(voids.value === null, 'void vector 的值应该为 null')
    
    await ddb.upload(['voidtable'], [table])
    
    console.log('测试 compress 类型')
    
    await ddb.upload(['c'], [
        await ddb.eval<DdbDictObj>('dict(["a", "b", "c"], [compress([1, 2, 3]), 123, "bbb"])')
    ])
}


async function test_from_stdjson (ddb: DDB) {
    console.log('测试 fromStdJson')
    
    console.log(
        await ddb.call('fromStdJson', [JSON.stringify({
            a: 1234,
            b: 'aaa',
            c: {
                e: 1234,
                f: 4321
            },
            f: 'blabla\n中文\u4e2d\u6587'
        })])
    )
    
    console.log(
        await ddb.call('fromStdJson', [JSON.stringify(1234)])
    )
    
    console.log(
        await ddb.call('fromStdJson', [
            JSON.stringify({
                data: {
                    code: 'select * from kline where secid == "230012"'
                }
            })
        ])
    )
}

async function test_parse_iot_vector_type (ddb: DDB) {
    
    let script = 
    'dbName = "dfs://db"\n' +
    'login(`admin,`123456)\n' +
    '\n' +
    'if (existsDatabase(dbName)) {\n' +
    '    dropDatabase(dbName)\n' +
    '}\n' +
    '\n' +
    `db = database(dbName, RANGE, 0 100, engine='TSDB')\n` +
    '\n' +
    'create table "dfs://db"."pt" (\n' +
    '    id INT,\n' +
    '    ticket SYMBOL,\n' +
    '    id2 SYMBOL,\n' +
    '    id3 IOTANY\n' +
    ')\n' +
    'partitioned by id,\n' +
    'sortColumns=[`ticket, `id],\n' +
    'sortKeyMappingFunction=[hashBucket{, 1000}],\n' +
    'latestKeyCache=true\n' +
    '\n' +
    'pt=loadTable(dbName, `pt)\n' +
    '\n' +
    'schema(loadTable(dbName, `pt))\n' +
    '\n' +
    'for (i in 1..3) {\n' +
    `    t=table(take(1,100) as id, take("aa"+string(0..100), 100) as ticket, take(string(char('A'+1..20)), 100) as id2, int(1..100) as id3)\n` +
    '    loadTable(dbName, `pt).append!(t)\n' +
    '    flushTSDBCache()\n' +
    '}\n' +
    '\n' +
    'for (i in 1..3) {\n' +
    `    t=table(take(1,100) as id, take("bb"+string(0..100), 100) as ticket, take(string(char('A'+1..20)), 100) as id2, double(1..100) as id3)\n` +
    '    loadTable(dbName, `pt).append!(t)\n' +
    '    flushTSDBCache()\n' +
    '}\n' +
    '\n' +
    'for (i in 1..10) {\n' +
    '    if (i % 2 == 0) {\n' +
    `        t=table(take(1,100) as id, take(lpad(string(i), 8, "0"), 100) as ticket, take(string(char('A'+1..20)), 100) as id2, rand(200.0, 100) as id3)\n` +
    '    } else {\n' +
    `        t=table(take(1,100) as id, take(lpad(string(i), 8, "0"), 100) as ticket, take(string(char('A'+1..20)), 100) as id2, int(1..100) as id3)\n` +
    '    }\n' +
    '    loadTable(dbName, `pt).append!(t)\n' +
//    `    flushTSDBCache()\n` +
    '}\n' +
    '\n' +
    'tt=select * from loadTable(dbName, `pt)\n' +
    'tt[`id3]\n'
    
    
    try {
        const tst = await ddb.eval(
            script
        )
        console.log('🚀 ~ test_parse_iot_vector_type ~ tst:', tst)
        await ddb.upload(['iotAnyVector'], [tst])
        await ddb.eval('print(iotAnyVector)')
    } catch (error) {
        console.log('error', error)
    }
   
}

async function test_pack_iot_any_vector (ddb: DDB) {
      // 创建 IotAnyVector 数据
      const iotAnyVectorData: DdbIotAnyVector = {
          index: [
              [DdbType.int, 0],
              [DdbType.double, 0],
              [DdbType.string, 0],
              [DdbType.int, 1],
              [DdbType.int, 2],
              [DdbType.double, 1],
              [DdbType.string, 1]
          ],
          subVec: {
              [DdbType.int]: new Int32Array([1, 2, 4]),
              [DdbType.double]: new Float64Array([1.1, 2.2]),
              [DdbType.string]: ['a', 'b']
          },
      }
    
    const iotAnyVector = new DdbObj<DdbIotAnyVector>({
        form: DdbForm.vector,
        type: DdbType.iotany,
        rows: iotAnyVectorData.index.length,
        cols: 1,
        value: iotAnyVectorData
    })
    
    try {
        await ddb.upload(['iotAnyVector'], [iotAnyVector])
        await ddb.eval('print(iotAnyVector)')
        
    } catch (error) {
        console.error('error', error)
    }
}


async function test_invoke (ddb: DDB) {
    console.log('测试 invoke')
    
    await ddb.eval(
        'def echo (data) {\n' +
        // '	print(data)\n' +
        '	return data\n' +
        '}\n'
    )
    
    const str = 'blabla\n中文"\u4e2d\u6587"\\\"\"'
    
    assert(
        (await ddb.invoke('echo', [{
            a: 1234,
            b: 'aaa',
            c: {
                e: 1234,
                f: 4321
            },
            f: str
        }]))
            .f === str
    )
    
    await ddb.execute(
        'cbool = true false false;\n' +
        "cchar = 'a' 'b' 'c';\n" +
        'cshort = 122h 32h 45h;\n' +
        'cint = 1 4 9;\n' +
        'clong = 17l 39l 72l;\n' +
        'cdate = 2013.06.13 2015.07.12 2019.08.15;\n' +
        'cmonth = 2011.08M 2014.02M 2019.07M;\n' +
        'ctime = 04:15:51.921 09:27:16.095 11:32:28.387;\n' +
        'cminute = 03:25m 08:12m 10:15m;\n' +
        'csecond = 01:15:20 04:26:45 09:22:59;\n' +
        'cdatetime = 1976.09.10 02:31:42 1987.12.13 11:58:31 1999.12.10 20:49:23;\n' +
        'ctimestamp = 1997.07.20 21:45:16.339 2002.11.26 12:40:31.783 2008.08.10 23:54:27.629;\n' +
        'cnanotime = 01:25:33.365869429 03:47:25.364828475 08:16:22.748395721;\n' +
        'cnanotimestamp = 2005.09.23 13:30:35.468385940 2007.12.11 14:54:38.949792731 2009.09.30 16:39:51.973463623;\n' +
        'cfloat = 7.5f 0.79f 8.27f;\n' +
        'cdouble = 5.7 7.2 3.9;\n' +
        'cstring = "hello" "hi" "here";\n' +
        'cdatehour = datehour(2012.06.15 15:32:10.158 2012.06.15 17:30:10.008 2014.09.29 23:55:42.693);\n' +
        'cblob = blob("dolphindb" "gaussdb" "goldendb")\n' +
        'cdecimal32 = decimal32(12 17 135.2,2)\n' +
        'cdecimal64 = decimal64(18 24 33.878,4)\n' +
        'cdecimal128 = decimal128(18 24 33.878,18)\n'
    )
    
    assert(
        // await ddb.invoke<DdbTableData>('defs')
        (await ddb.invoke<DdbTableData>('objs', [true]))
            .columns.includes('shared')
    )
}


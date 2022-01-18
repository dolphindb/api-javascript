# DolphinDB JavaScript API

<p align='center'>
    <img src='./ddb.svg' alt='DolphinDB' width='256'>
</p>

<p align='center'>
    <a href='https://www.npmjs.com/package/dolphindb' target='_blank'>
        <img alt='npm version' src='https://img.shields.io/npm/v/dolphindb.svg?style=flat-square&color=brightgreen' />
    </a>
    <a href='https://www.npmjs.com/package/dolphindb' target='_blank'>
        <img alt='npm downloads' src='https://img.shields.io/npm/dt/dolphindb?style=flat-square&color=brightgreen' />
    </a>
</p>

## 简介
DolphinDB JavaScript API 封装了操作 DolphinDB 数据库的能力，如：连接数据库、执行脚本、调用函数、上传变量等

https://www.npmjs.com/package/dolphindb

## 特性
- 使用 WebSocket 与 DolphinDB 数据库通信，用二进制格式进行数据交换
- 支持在浏览器环境和 Node.js 环境中运行
- 使用了 JavaScript 中的 Int32Array 等 TypedArray 处理二进制数据，性能较高
- 单次调用支持最大 2 GB 数据的序列化上传，下载数据量不受限制

## 安装
```bash
# 在机器上安装最新版的 Node.js 及浏览器

# 在项目中安装 npm 包
npm install dolphindb
```

## 用法
### 0. 初始化并连接到 DolphinDB
```ts
import DDB from 'dolphindb'

// 初始化 WebSocket 连接地址
let ddb = new DDB('ws://127.0.0.1:8848')

// 建立到 DolphinDB 的 WebSocket 连接（要求 DolphinDB 数据库版本不低于 1.30.16 或 2.00.4）
await ddb.connect()
```

#### connect 方法声明
```ts
async connect (
    options?: {
        /** 默认使用实例初始化时传入的 WebSocket 链接地址 */
        ws_url?: string
        
        /** 是否在建立连接后自动登录，默认 true */
        login?: boolean
        
        /** DolphinDB 登录用户名 */
        username?: string
        
        /** DolphinDB 登录密码 */
        password?: string
    } = { }
): Promise<void>
```


### 1. 调用函数
#### 例子
```ts
import { DdbInt } from 'dolphindb'

const result = await ddb.call<DdbInt>('add', [new DdbInt(1), new DdbInt(1)])

console.log(result.value === 2)  // true
```

#### DolphinDB JavaScript API 用 DdbObj 对象来表示 DolphinDB 中的数据类型
上面例子中，上传了两个参数 1 (对应 DolphinDB 中的 int 类型) 到 DolphinDB 数据库，作为 add 函数的参数，并接收函数调用的结果 result

`<DdbInt>` 用于 TypeScript 推断返回值的类型

- result 是一个 `DdbInt`，也是 `DdbObj<number>`
- result.form 是 `DdbForm.scalar`
- result.type 是 `DdbType.int`
- result.value 是 JavaScript 中原生的 `number` (int 的取值范围及精度可以用 JavaScript 的 number 准确表示)

```ts
/** 可以表示所有 DolphinDB 数据库中的数据 */
class DdbObj <T extends DdbValue = DdbValue> {
    /** 是否为小端 (little endian) */
    le: boolean
    
    /** 数据形式 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataForms/index.html */
    form: DdbForm
    
    /** 数据类型 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataTypes/index.html */
    type: DdbType
    
    /** 占用 parse 时传入的 buf 的长度 */
    length: number
    
    /** table name / column name */
    name?: string
    
    /**
        最低维、第 1 维
        - vector: rows = n, cols = 1
        - pair:   rows = 2, cols = 1
        - matrix: rows = n, cols = m
        - set:    同 vector
        - dict:   包含 keys, values 向量
        - table:  同 matrix
    */
    rows?: number
    
    /** 第 2 维 */
    cols?: number
    
    /** matrix 中值的类型，仅 matrix 才有 */
    datatype?: DdbType
    
    /** 实际数据。不同的 DdbForm, DdbType 使用 DdbValue 中不同的类型来表示实际数据 */
    value: T
    
    constructor (data: Partial<DdbObj> & { form: DdbForm, type: DdbType, length: number }) {
        Object.assign(this, data)
    }
}

class DdbInt extends DdbObj<number> {
    constructor (value: number) {
        super({
            form: DdbForm.scalar,
            type: DdbType.int,
            length: 4,
            value
        })
    }
}

// ... 还有很多快捷类，如 DdbString, DdbLong, DdbDouble, DdbVectorDouble, DdbVectorAny 等

type DdbValue = 
    null | boolean | number | [number, number] | bigint | string | string[] | 
    Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | Uint8Array[] | 
    DdbObj[] | DdbFunctionDefValue | DdbSymbolExtendedValue
    

enum DdbForm {
    scalar = 0,
    vector = 1,
    pair = 2,
    matrix = 3,
    set = 4,
    dict = 5,
    table = 6,
    chart = 7,
    chunk = 8,
}


enum DdbType {
    void = 0,
    bool = 1,
    char = 2,
    short = 3,
    int = 4,
    long = 5,
    // ...
    timestamp = 12,
    // ...
    double = 16,
    symbol = 17,
    string = 18,
    // ...
}
```

#### call 方法声明
```ts
async call <T extends DdbObj> (
    /** 函数名 */
    func: string,
    
    /** 调用参数 (传入的原生 string 和 boolean 会被自动转换为 DdbObj<string> 和 DdbObj<boolean>) */
    args?: (DdbObj | string | boolean)[] = [ ],
    
    /** 调用选项 */
    options?: {
        /** 紧急 flag，使用 urgent worker 处理，防止被其它作业阻塞 */
        urgent?: boolean
        
        /** 设置结点 alias 时发送到集群中对应的结点执行 (使用 DolphinDB 中的 rpc 方法) */
        node?: string
        
        /** 设置多个结点 alias 时发送到集群中对应的多个结点执行 (使用 DolphinDB 中的 pnodeRun 方法) */
        nodes?: string[]
        
        /** 设置 node 参数时必传，需指定函数类型，其它情况下不传 */
        func_type?: DdbFunctionType
        
        /** 设置 nodes 参数时选传，其它情况不传 */
        add_node_alias?: boolean
    } = { }
): Promise<T>
```


### 2. 执行脚本
#### 例子
```ts
import type { DdbLong } from 'dolphindb'

const result = await ddb.eval<DdbLong>(
    'def foo (a, b) {\n' +
    '    return a + b\n' +
    '}\n' +
    'foo(1l, 1l)\n'
)

console.log(result.value === 2n)  // true
```

上面例子中，通过字符串上传了一段脚本到 DolphinDB 数据库执行，并接收最后一条语句 `foo(1l, 1l)` 执行结果 result

`<DdbInt>` 用于 TypeScript 推断返回值的类型

- result 是一个 `DdbLong`，也是 `DdbObj<bigint>`
- result.form 是 `DdbForm.scalar`
- result.type 是 `DdbType.long`
- result.value 是 JavaScript 中原生的 `bigint` (long 的精度不能用 JavaScript 的 number 准确表示，但可以用 bigint 表示)

只要 WebSocket 连接不断开，在后续的会话中 `foo` 这个自定义函数会一直存在，可复用，比如后续通过 `await ddb.call<DdbInt>('foo', [new DdbInt(1), new DdbInt(1)])` 调用这个自定义函数

#### eval 方法声明
```ts
async eval <T extends DdbObj> (
    /** 执行的脚本 */
    script: string,
    
    /** 执行选项 */
    options: {
        /** 紧急 flag，使用 urgent worker 处理，防止被其它作业阻塞 */
        urgent?: boolean
    } = { }
): Promise<T>
```


### 3. 上传变量
#### 例子
```ts
import { DdbVectorDouble } from 'dolphindb'

let a = new Array(10000)
a.fill(1.0)

ddb.upload(['bar1', 'bar2'], [new DdbVectorDouble(a), new DdbVectorDouble(a)])
```

上面的例子中，上传了 `bar1`, `bar2` 两个变量，变量值是长度为 10000 的 double 向量

只要 WebSocket 连接不断开，在后续的会话中 `bar1`, `bar2` 这些变量会一直存在，可复用

#### upload 方法声明
```ts
async upload (
    /** 上传的变量名 */
    vars: string[],
    
    /** 上传的变量值 */
    args: (DdbObj | string | boolean)[]
): Promise<void>
```


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

## English | [中文](./README.zh.md)

## Overview
DolphinDB JavaScript API is a JavaScript library that encapsulates the ability to operate the DolphinDB database, such as: connecting to the database, executing scripts, calling functions, uploading variables, etc.

https://www.npmjs.com/package/dolphindb

## Features
- Use WebSocket to communicate with DolphinDB database, exchange data in binary format, and support real-time push of streaming data
- Support running in browser environment and Node.js environment
- Use TypedArray such as Int32Array in JavaScript to process binary data, with high performance
- Support serialized upload of up to 2GB of data with a single call, and the amount of downloaded data is not limited

## Installation

1. Install the latest version of Node.js and browser.
2. (Optional) Create a new project (skip this step if there's an existing project):

    ```bash
    mkdir dolphindb-example
    cd dolphindb-example
    npm init --yes
    ```
3. Open the package.json file with an editor, and add the line `"type": "module"`, below `"main": "./index.js"`. This enables the ECMAScript modules. In the following code, you can use `import { DDB } from 'dolphindb'` to import npm packages.
4. Install npm packages in your project.

    ```bash
    npm install dolphindb
    ```

## Usage
### Initializing and connecting to DolphinDB
#### NPM
```ts
import { DDB } from 'dolphindb'
// The import method for existing projects using CommonJS modules is const { DDB } = await import('dolphindb')
// Use in browser: import { DDB } from 'dolphindb/browser.js'

// Initially connect to an instance of DolphinDB using the WebSocket URL (without establishing an actual network connection)
let ddb = new DDB('ws://127.0.0.1:8848')

// Encrypt with HTTPS
// let ddb = new DDB('wss://dolphindb.com')

// Establish a connection to DolphinDB (requires DolphinDB database version at least 1.30.16 or 2.00.4)
await ddb.connect()
```

#### CDN
```html
<script type="module">
    import { DDB } from 'https://cdn.dolphindb.cn/assets/api.js'
    
    let ddb = new DDB('ws://127.0.0.1:8848')
    
    await ddb.connect()
</script>
```

Data for code completion and function prompts:
- https://cdn.dolphindb.cn/assets/docs.zh.json  
- https://cdn.dolphindb.cn/assets/docs.en.json

#### DDB options
```ts
let ddb = new DDB('ws://127.0.0.1:8848')

// Encrypt with HTTPS
let ddbsecure = new DDB('wss://dolphindb.com', {
    // Whether to log in automatically after establishing a connection, default `true`
    autologin: true,
    
    // DolphinDB username, default `'admin'`
    username: 'admin',
    
    // DolphinDB password, default `'123456'`
    password: '123456',
    
    // set python session flag, default `false`
    python: false,
    
    // set sql standrd flag,  use the SqlStandard enum to pass arguments, default `DolphinDB`
    // sql: SqlStandard.MySQL,
    // sql: SqlStandard.Oracle,
    
    // After setting this option, the database connection is only used for streaming data. For details, see `5. Streaming Data`
    streaming: undefined
})
```


### Calling functions
#### Example
```ts
import { DdbInt } from 'dolphindb'

const result = await ddb.call('add', [new DdbInt(1), new DdbInt(1)])
// TypeScript: const result = await ddb.call<DdbInt>('add', [new DdbInt(1), new DdbInt(1)])

console.log(result.value === 2)  // true
```

#### Using DdbObj objects to represent data types in DolphinDB

In the preceding example, two parameters (`new DdbInt(1)`, corresponding to the INT type in DolphinDB) are uploaded to the DolphinDB database as parameters of the add function, then the result of the function call is received.

`<DdbInt>` is used by TypeScript to infer the type of the return value

- result is a `DdbInt`, which is also a `DdbObj<number>`
- result.form is a `DdbForm.scalar`
- result.type is a `DdbType.int`
- result.value is data of `number` type in JavaScript (the value range and precision of INT can be accurately represented by JavaScript `number` type)

It is recommended to first understand the concepts related to TypedArray in JavaScript, you can refer to:  

- https://stackoverflow.com/questions/42416783/where-to-use-arraybuffer-vs-typed-array-in-javascript  
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray  


```ts
/** Can represent all data types in DolphinDB databases */
class DdbObj <T extends DdbValue = DdbValue> {
    /** is it little endian */
    le: boolean
    
    /** data form https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataForms/index.html */
    form: DdbForm
    
    /** data type  https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataTypes/index.html */
    type: DdbType
    
    /** consumed length in buf parsed */
    length: number
    
    /** table name / column name */
    name?: string
    
    /**
        Lowest dimension
        - vector: rows = n, cols = 1
        - pair:   rows = 2, cols = 1
        - matrix: rows = n, cols = m
        - set:    the same as vector
        - dict:   include keys, values vector
        - table:  the same as matrix
    */
    rows?: number
    
    /** 2nd dimension */
    cols?: number
    
    /** the actual data. Different DdbForm, DdbType use different types in DdbValue to represent actual data */
    value: T
    
    /** raw binary data, only top-level objects generated by parse_message when parse_object is false have this attribute */
    buffer?: Uint8Array
    
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

// ... There are also many utility classes, such as DdbString, DdbLong, DdbDouble, DdbVectorDouble, DdbVectorAny, etc.

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

##### Specifying form and type to manually create a DdbObj object

If there is no shortcut class, you can also specify form and type to manually create a DdbObj object:

```ts
// Created by the DdbDateTime shortcut class
new DdbDateTime(1644573600)

// Equivalent to manually creating an object of form = scalar, type = datetime through DdbObj
const obj = new DdbObj({
     form: DdbForm.scalar,
     type: DdbType.datetime,
     value: 1644573600,
     length: 0
})


// The corresponding type and value of value in js can refer to the result returned by ddb.eval (see the `eval` method declaration below)
const obj = await ddb.eval('2022.02.11 10:00:00')
console.log(obj.form === DdbForm.scalar)
console.log(obj.type === DdbType.datetime)
console.log(obj.value)

// Another example is to create a set
// refer to ddb.eval
// const obj = await ddb.eval('set([1, 2, 3])')
// console.log(obj.value)
const obj = new DdbObj({
     form: DdbForm.set,
     type: DdbType.int,
     value: Int32Array.of(1, 2, 3),
     length: 0
})

// It's easier to use shortcut classes
const obj = new DdbSetInt(
     new Set([1, 2, 3])
)
```

##### NULL object in the form of scalar

For the NULL object in the form of scalar, the value corresponding to DdbObj is null in JavaScript：

```ts
;(await ddb.eval('double()')).value === null

// create NULL object
new DdbInt(null)
new DdbDouble(null)
```


#### `call` method declaration
```ts
async call <T extends DdbObj> (
    /** function name */
    func: string,
    
    /** function arguments (The incoming native string and boolean will be automatically converted to DdbObj<string> and DdbObj<boolean>) */
    args?: (DdbObj | string | boolean)[] = [ ],
    
    /** calling options */
    options?: {
        /** Urgent flag. Use urgent worker to execute to prevent being blocked by other jobs */
        urgent?: boolean
        
        /** When the node alias is set, the function is sent to the corresponding node in the cluster for execution (using the rpc method in DolphinDB) */
        node?: string
        
        /** When setting multiple node aliases, send them to the corresponding multiple nodes in the cluster for execution (using the pnodeRun method in DolphinDB) */
        nodes?: string[]
        
        /** It must be passed when setting the node parameter, the function type needs to be specified, and it is not passed in other cases */
        func_type?: DdbFunctionType
        
        /** It may be  passed when setting the nodes parameter, otherwise may not be passed */
        add_node_alias?: boolean
    } = { }
): Promise<T>
```


### Executing the script
#### Example
```ts
const result = await ddb.eval(
    'def foo (a, b) {\n' +
    '    return a + b\n' +
    '}\n' +
    'foo(1l, 1l)\n'
)

// TypeScript:
// import type { DdbLong } from 'dolphindb'
// const result = await ddb.eval<DdbLong>(...)

console.log(result.value === 2n)  // true
```

In the preceding example, a script is uploaded through a string to the DolphinDB database for execution, and the execution result of the last statement `foo(1l, 1l)` is received.

`<DdbLong>` is used by TypeScript to infer the type of the return value

- result is a `DdbLong`, which is also a `DdbObj<bigint>`
- result.form is `DdbForm.scalar`
- result.type is `DdbType.long`
- result.value is the native `bigint` in JavaScript (the precision of long cannot be accurately represented by JavaScript number, but it can be represented by bigint)

As long as the WebSocket connection is not disconnected, the custom function `foo` will always exist in the subsequent session and can be reused, for example, you can use `await ddb.call<DdbInt>('foo', [new DdbInt(1), new DdbInt(1)])` to call this custom function

#### `eval` Method declaration

```ts
async eval <T extends DdbObj> (
    /** the script to execute */
    script: string,
    
    /** calling options */
    options: {
        /** Urgent flag. Use urgent worker to execute to prevent being blocked by other jobs */
        urgent?: boolean
    } = { }
): Promise<T>
```


### Uploading variables
#### Example
```ts
import { DdbVectorDouble } from 'dolphindb'

let a = new Array(10000)
a.fill(1.0)

ddb.upload(['bar1', 'bar2'], [new DdbVectorDouble(a), new DdbVectorDouble(a)])
```

In the preceding example, two variables, `bar1` and `bar2`, are uploaded, and the variable value is a double vector of length 10000

As long as the WebSocket connection is on, variables `bar1` and `bar2` will always exist in subsequent session and can be reused

#### `upload` method declaration
```ts
async upload (
    /** variable names */
    vars: string[],
    
    /** variable values */
    args: (DdbObj | string | boolean)[]
): Promise<void>
```


### Examples
```ts
import { nulls, DdbInt, timestamp2str, DdbVectorSymbol, DdbTable, DdbVectorDouble } from 'dolphindb'

// Format timestamp in DolphinDB as string
timestamp2str(
    (
        await ddb.call('now', [false])
        // TypeScript: await ddb.call<DdbObj<bigint>>('now', [false])
    ).value
) === '2022.02.23 17:23:13.494'

// create symbol vector
new DdbVectorSymbol(['aaa', 'aaa', 'aaa', 'aaa', 'aaa', 'bbb'])

// Create a double vector with NULL values using JavaScript native arrays
new DdbVectorDouble([0.1, null, 0.3])

// More efficient and memory efficient double vector creation using JavaScript TypedArray
let av = new Float64Array(3)
av[0] = 0.1
av[1] = nulls.double
av[2] = 0.3
new DdbVectorDouble(av)

// create DdbTable
new DdbTable(
    [
        new DdbVectorDouble([0.1, 0.2, null], 'col0'),
        new DdbVectorSymbol(['a', 'b', 'c'], 'col1')
    ],
    'mytable'
)
```

### Streaming data

```ts
// New Streaming Data Connection Configuration
let sddb = new DDB('ws://192.168.0.43:8800', {
    autologin: true,
    username: 'admin',
    password: '123456',
    streaming: {
        table: 'Streaming table name to subscribe to',
        
        // Streaming data processing callback, the type of message is StreamingData
        handler (message) {
            console.log(message)
        }
    }
})

// Establish connection
await sddb.connect()
```

The streaming data received after the connection is established will be used as the message parameter of the handler. The type of the message is StreamingData, as follows:

```ts
export interface StreamingParams {
    table: string
    action?: string
    
    handler (message: StreamingData): any
}

export interface StreamingData extends StreamingParams {
    /**
        The time the server sent the message (nano seconds since epoch)  
        std::chrono::system_clock::now().time_since_epoch() / std::chrono::nanoseconds(1)
    */
    time: bigint
    
    /** message id */
    id: bigint
    
    colnames: string[]
    
    /** Subscription topic, which is the name of a subscription.
        It is a string consisting of the alias of the node where the subscription table is located, the stream data table name, and the subscription task name (if actionName is specified), separated by `/`
    */
    topic: string
    
    /** Streaming data, the type is any vector, each element of which corresponds to a column (without name) of the subscribed table, and the content in the column (DdbObj<DdbVectorValue>) is the new data value */
    data: DdbObj<DdbVectorObj[]>
    
    /** Number of new streaming data rows */
    rows: number
    
    window: {
        /** The establishment of the connection starts offset = 0, and gradually increases as the window moves */
        offset: number
        
        /** sum of segment.row in segments */
        rows: number
        
        /** An array of data received each time */
        segments: DdbObj<DdbVectorObj[]>[]
    }
    
    /** After successfully subscribed, if the subsequently pushed message is parsed incorrectly, the error will be set and the handler will be called. */
    error?: Error
}
```


### Development

```shell
# Install the latest version of nodejs
# https://nodejs.org/en/download/current/

# Install the pnpm package manager
corepack enable
corepack prepare pnpm@latest --activate

git clone https://github.com/dolphindb/api-javascript.git

cd api-javascript

# Install project dependencies
pnpm install

# Copy .vscode/settings.template.json to .vscode/settings.json
cp .vscode/settings.template.json .vscode/settings.json

# Refer to scripts in package.json

# Construct
pnpm run build

#lint
pnpm run lint

# test
pnpm run test

# scan entries
pnpm run scan
# Manually complete untranslated entries
# Run the scan again to update the dictionary file dict.json
pnpm run scan
```

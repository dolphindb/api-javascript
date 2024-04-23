// class DdbObj {
//     port = 8848
    
//     /** ddb 连接状态 */
//     state = '未连接'
    
//     socket = null as Socket
    
//     clients = new Set<Duplex>()
    
    
//     /** dolphindb http rpc  
//         - code
//         - options
//             - session_id: 20 分钟内无操作服务端会清空 session，删除所有变量
//     */
//     async rpc_json (
//         code: string,
//         {
//             hostname = '127.0.0.1',
//             // hostname = 'localhost',
            
//             port = this.port,
//             tls = false,
//             sid = this.sid,
            
//             // TEST
//             proxy = MyProxy.whistle
//         }: {
//             hostname?: string
//             port?: number
//             tls?: boolean
//             sid?: string
//             proxy?: MyProxy | false
//         } = { }
//     ): Promise<DdbJsonObj> {
//         let result = await request_json(`${tls ? 'https' : 'http'}://${hostname}:${port}/${sid}`, {
//             body: {
//                 sessionID: sid,
//                 functionName: 'executeCode',
//                 params: [{
//                     name: 'script',
//                     form: 'scalar',
//                     type: 'string',
//                     value: encodeURIComponent(code)
//                 }]
//             },
//             proxy
//         })
        
//         this.sid = result.sessionID
        
//         result.resultCode = Number(result.resultCode)
        
//         // result.userId: 未登录时为 `''`
        
//         if (result.resultCode)
//             throw Object.assign(
//                 // result.msg: 成功时为 `''`; 失败时为错误信息
//                 new Error((result.msg as string).red),
//                 result
//             )
        
        
//         return new DdbJsonObj(result.object[0])
//     }
    
    
//     /** 创建 tcp 连接到 ddb，并完成 connect 请求，读到 chunk 后执行 on_chunk 回调
//         成功完成后 this.socket, this.sid 会被初始化
//     */
//     async connect_socket () {
//         // --- 创建 socket, attach 状态、异常事件处理
//         this.socket = new Socket({
//             allowHalfOpen: false,
//             readable: true,
//             writable: true
//         })
        
//         this.socket.on('lookup', (error, address, family, host) => {
//             console.log('socket 域名解析 (lookup) 完成', error, address, family, host)
//         })
        
//         this.socket.on('ready', () => {
//             console.log('socket 准备就绪')
//         })
        
//         this.socket.on('close', has_error => {
//             console.log('socket 成功关闭，是否出错？', has_error)
//         })
        
//         this.socket.on('timeout', () => {
//             console.log('socket 超时')
//         })
        
//         this.socket.on('error', error => {
//             console.log('socket 出错了', error)
//         })
        
        
//         // ---
//         console.log('将 socket 连接到 server')
//         await new Promise<void>(resolve => {
//             // callback 会被 socket.once('connect', callback)
//             this.socket.connect({
//                 port: this.port,
                
//                 // host: 'localhost',
//                 host: '127.0.0.1',
                
//                 family: 0,
//             }, resolve)
//         })
        
//         console.log(this.state = 'socket 已连接')
        
        
//         // ---
//         console.log('发送 connect 请求到 ddb')
        
//         this.socket.write(
//             `API ${this.sid || '0'} 8\n` +
//             'connect\n'
//         )
        
//         console.log(this.state = '已发送 connect 请求')
        
        
//         // --- 读取流数据，只等到 connect 完成，后续 chunk 交给 callback
//         await new Promise<void>(async (resolve, reject) => {
//             let last_chunk: Buffer
            
//             try {
//                 for await (const chunk of this.socket) {
//                     last_chunk = chunk
//                     console.log('ddb.socket 读取到 chunk, 转发给所有 websocket clients')
                    
//                     const ck = chunk as Uint8Array
                    
//                     if (this.state === '已发送 connect 请求') {
//                         // --- 读取 sid
//                         const i_sid_end = ck.indexOf(0x20)
                        
//                         this.sid = this.dec.decode(
//                             ck.subarray(
//                                 0,
//                                 i_sid_end
//                             )
//                         )
//                         console.log('sid = ', this.sid)
                        
//                         console.log(this.state = 'connect 完成')
                        
//                         resolve()
                        
//                         continue
//                     }
                    
//                     this.on_chunk(ck)
//                 }
                
//                 console.log('ddb.socket 完美结束 (no more data to read)')
//             } catch (error) {
//                 console.log('捕获到 socket 错误', error)
//                 console.log('最后一个 chunk', last_chunk)
//                 reject(error)
//             }
//         })
//     }
    
    
//     on_chunk (chunk: Uint8Array) {
//         for (let client of this.clients)
//             client.write(chunk)
//     }
// }


// class DdbJsonObj {
//     static ddb_null = { name: '', form: 'scalar', type: 'void', value: null } as const
    
//     static table_config: TableUserConfig = {
//         border: getBorderCharacters('void'),
//         singleLine: true,
//         columnDefault: {
//             paddingLeft: 0,
//             paddingRight: 1,
//             alignment: 'right'
//         },
//     }
    
    
//     name: string
    
//     form: DdbJsonForm
    
//     type?: DdbJsonType
    
//     /** 向量有这个属性 */
//     size?: number
    
//     value: null | boolean | number | string | DdbJsonObj | DdbJsonObj[]
    
//     constructor (data?: {
//         name: string
//         form: DdbJsonForm
//         type?: DdbJsonType
//         size?: string | number
//         value: any
//     }) {
//         const { name, form, type, size, value } = data || DdbJsonObj.ddb_null as DdbJsonObj
        
//         this.name = name
//         this.form = form
//         this.type = type
        
//         if ((typeof size === 'string' && size) || typeof size === 'number')
//             this.size = Number(size)
        
//         this.value = (() => {
//             if (form === 'scalar') {
//                 if (type === 'void')
//                     return null
                
//                 if (type === 'int' || type === 'short' || type === 'float' || type === 'double') {
//                     if (value === 'pi' || value === 'e')
//                         return value
                    
//                     return Number(value)
//                 }
                
//                 if (type === 'long')
//                     return BigInt(value)
                
//                 if (type === 'bool')
//                     return Boolean(value)
                
//                 // integral: int128
//                 // literal:  char | string | uuid
//                 // temporal: date | month | time | second | datetime | timestamp | nanotime | nanotimestamp | datehour
//                 // system:   code | ipaddr | duration
//                 //           complex | point
//                 return value
//             }
            
//             if (form === 'pair')
//                 return value
            
//             if (form === 'vector')
//                 return value
                
//             if (form === 'set')
//                 return value
                
//             if (form === 'matrix')
//                 return value
            
//             if (form === 'dictionary')
//                 return value
                
//             if (form === 'table')
//                 return value
//         })()
//     }
    
    
//     [inspect.custom] () {
//         const { form, type, value, name, size } = this
        
//         if (form === 'scalar')
//             return this.format_scalar(type, value)
        
//         if (form === 'pair') {
//             const [l, r] = value as [any, any]
//             return `${ l === null ? '' : this.format_scalar(type, l) }:${ r === null ? '' : this.format_scalar(type, r) }`
//         }
        
//         if (form === 'vector' || form === 'set') {
//             return (name ? `${name} ` : '') +
//                 (
//                     (value as any[]).map(x => 
//                         x && typeof x === 'object' ?
//                             inspect(
//                                 new DdbJsonObj(x), 
//                                 { colors: false }
//                             )
//                         :
//                             this.format_scalar(type, x)
//                     ).join(', ') || ' '
//                 ).surround(
//                     form === 'vector' ? '[' : '{',
//                     form === 'vector' ? ']' : '}',
//                 )
//         }
        
//         if (form === 'dictionary') {
//             const [keys, values] = value as [any, any]
//             let obj = { } as Record<string, DdbJsonObj | string>
//             const size = Number(keys.size)
//             if (!size) return `dict(${keys.type}, ${values.type})`
            
//             for (let i = 0;  i < size;  i++) {
//                 const key = keys.type === 'string' ? 
//                         keys.value[i]
//                     :
//                         this.format_scalar(keys.type, keys.value[i])
                
//                 const v = values.value[i]
//                 const value = typeof v === 'string' ? 
//                         v
//                     :
//                         new DdbJsonObj(v)
//                 obj[key] = value
//             }
            
//             return obj
//         }
        
//         if (form === 'matrix') {
//             const nrows = Number(value[1].value)
//             const ncols = Number(value[2].value)
//             const values = value[0].value
            
//             let data = [ ]
//             for (let i = 0;  i < nrows;  i++)
//                 for (let j = 0;  j < ncols;  j++) {
//                     const value = values[nrows * j + i]
//                     let row = data[i] || [ ]
//                     row[j] = this.format_scalar(type, value)
//                     data[i] = row
//                 }
            
//             return `matrix <${type}[${ncols}][${nrows}]>\n` +
//                 table(data, DdbJsonObj.table_config)
//         }
        
//         if (form === 'table') {
//             const nrows = Number(size)
//             const ncols = (value as any[]).length
//             const headers = (value as any[]).map(({ name }) => name)
            
//             let data = [ ]
//             for (let i = 0;  i < nrows;  i++)
//                 for (let j = 0;  j < ncols;  j++) {
//                     const col = value[j]
//                     const v = col.value[i]
//                     let row = data[i] || [ ]
//                     row[j] = this.format_scalar(col.type, v)
//                     data[i] = row
//                 }
            
//             return `table ${ name ? `${name} ` : '' }(${nrows} rows)\n` +
//                 table(
//                     [
//                         headers,
//                         ...data
//                     ],
//                     DdbJsonObj.table_config,
//                 )
//         }
        
//         return this
//     }
    
    
//     format_scalar (type: DdbJsonType, value: any) {
//         // 可以被 js 原生类型表示
//         if (
//             type === 'void' || type === 'bool' ||
//             type === 'int' || type === 'short' || type === 'long' || type === 'float' || type === 'double'
//         )
//             return value
        
//         if (type === 'string')
//             return inspect(value, { colors: false })
        
//         // 可以直接用 <value> 表示
//         if (
//             type === 'code' || type === 'point' || type === 'complex' || 
//             type === 'second' || type === 'time' || type === 'nanotime' || type === 'datehour' || type === 'duration'
//         )
//             return value || 'null'
        
//         if (type === 'month') {
//             if (!value)
//                 return 'null'
//             return `${value}M`
//         }
        
//         if (type === 'minute') {
//             if (!value)
//                 return 'null'
//             return `${value}m`
//         }
        
//         // 用 type('<value>') 表示
//         return `${type}(${(value as string).quote()})`
//     }
// }


// type DdbJsonForm = 'scalar' | 'pair' | 'vector' | 'set' | 'matrix' | 'dictionary' | 'table'

// type DdbJsonType = 
//     'void' | 'bool' | 'char' | 
//     'short' | 'int' | 'long' | 
//     'date' | 'month' | 'time' | 'minute' | 'second' | 'datetime' | 'timestamp' | 'nanotime' | 'nanotimestamp' | 
//     'float' | 'double' | 'symbol' | 'string' | 'uuid' | 'functiondef' | 'handle' | 'code' | 
//     'datasource' | 'resource' | 'any' | 'compress' | 'datehour' | 'ipaddr' | 'int128' | 'blob' | 'complex' | 'point' | 'duration'


// type DdbJsonScalar = number | string | any


// const ddb_gateway = {
//         server: null as SocketServer,
        
//         clients: new Set<Socket>(),
        
//         port: 8849,
        
//         controllers: {
//             /** alias */
//             c0: {
//                 hostname: '127.0.0.1',
//                 port: 8850,
//             },
            
//             c1: {
//                 hostname: '127.0.0.1',
//                 port: 8851,
//             },
            
//             c2: {
//                 hostname: '127.0.0.1',
//                 port: 8852,
//             }
//         },
        
//         master: '',
        
//         sids: new Map<string, string>(),
        
//         state: 'init',
        
        
//         async start () {
//             for (const alias in this.controllers) {
//                 this.master = alias
//                 break
//             }
            
//             this.server = create_socket_server(
//                 {
//                     allowHalfOpen: false,
//                     pauseOnConnect: false,
//                 },
//                 this.accept.bind(this)
//             )
            
//             this.server.on('error', error => {
//                 console.log(new Date(), 'gateway 出错:', error)
//             })
            
//             await new Promise<void>(resolve => {
//                 this.server.listen(this.port, resolve)
//             })
            
//             this.auto_switch_master()
            
//             console.log(new Date(), 'gateway 成功启动')
//         },
        
        
//         async stop () {
//             this.state = 'stopping'
//             console.log(new Date(), '正在停止 auto_switch_master')
            
//             for (const client of this.clients)
//                 client.end()
            
//             await new Promise<void>((resolve, reject) => {
//                 this.server.close(error => {
//                     if (error) {
//                         reject(error)
//                         return
//                     }
//                     resolve()
//                 })
//             })
//         },
        
        
//         /** 接收到 client tcp 连接 */
//         async accept (client: Socket) {
//             this.clients.add(client)
            
//             const port = client.remotePort
            
//             // --- 
//             console.log(port, new Date(), 'gateway accept client 连接，开始建立管道')
            
//             let controller = new Socket({
//                 allowHalfOpen: false,
//                 readable: true,
//                 writable: true,
//             })
            
//             controller.on('lookup', (error, address, family, host) => {
//                 console.log(port, new Date(), 'controller 域名解析 (lookup) 完成', error, address, family, host)
//             })
            
//             controller.on('close', has_error => {
//                 console.log(port, new Date(), 'controller 关闭连接，是否出错:', has_error)
//             })
            
//             controller.on('timeout', () => {
//                 console.log(port, new Date(), 'controller 超时')
//             })
            
//             controller.on('error', error => {
//                 console.log(port, new Date(), 'controller 出错了:', error)
//                 client.end()
//             })
            
            
//             // --- client 错误处理
//             client.on('error', error => {
//                 console.log(port, new Date(), 'client 出错，关闭与 controller 的连接', error)
//                 controller.end()
//             })
            
//             client.on('close', has_error => {
//                 this.clients.delete(client)
//                 console.log(port, new Date(), 'client 关闭连接，是否出错:', has_error)
//             })
            
            
//             // --- 
//             console.log(port, new Date(), 'gateway 开始连接到 controller')
//             const { hostname, port: master_port } = this.controllers[this.master]
//             await new Promise<void>(resolve => {
//                 // callback 会被 socket.once('connect', callback)
//                 controller.connect({
//                     port: master_port,
                    
//                     host: hostname,
//                     // host: '127.0.0.1',
                    
//                     family: 0,
//                 }, resolve)
//             })
//             console.log(port, new Date(), 'gateway 已连接到 controller')
            
//             // --- 
//             console.log(port, new Date(), 'gateway 建立 client <-> controller')
//             client.pipe(controller)
//             controller.pipe(client)
//         },
        
        
//         /** https://www.dolphindb.cn/cn/help/FunctionsandCommands/FunctionReferences/g/getActiveMaster.html?highlight=getactivemaster */
//         async get_active_master () {
//             for (const alias in this.controllers) {
//                 const { hostname, port } = this.controllers[alias] as { hostname: string, port: number }
//                 const sid = this.sids.get(alias)
//                 try {
//                     const master = (
//                         await ddb.rpc_json('getActiveMaster()', { hostname, port, sid })
//                     ).value as string
//                     console.log(new Date(), `${alias}.getActiveMaster() -> ${this.master}`)
//                     this.sids.set(alias, sid)
//                     if (!master)
//                         throw new Error(`${new Date().toString()} getActiveMaster 得到的 master 为空`)
//                     return master
//                 } catch (error) {
//                     console.log(new Date(), error)
//                 }
//             }
            
//             return this.master
//         },
        
        
//         async auto_switch_master () {
//             if (this.state === 'stopping') {
//                 this.state = 'running'
//                 console.log('gateway 恢复 auto_switch_master')
//                 return
//             }
            
//             this.state = 'running'
            
//             for (;  this.state === 'running';  ) {
//                 const master = this.master
//                 const master_ = await this.get_active_master()
//                 if (master === master_) {
//                     await delay(10 * 1000)
//                     continue
//                 }
                
//                 this.master = master_
//                 console.log(new Date(), `master 从 ${master} 切换为 ${master_}, 断开所有 clients`)
//                 for (const client of this.clients)
//                     client.end()
//                 await delay(3 * 1000)
//             }
            
//             console.log(new Date(), `gateway.state === ${this.state}, 停止 auto_switch_master`)
//             this.state = 'stopped'
//     }
// }

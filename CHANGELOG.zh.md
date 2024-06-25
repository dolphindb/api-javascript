# 版本发布说明

## 版本: 3.0.100
#### 新增功能
- 增加心跳机制，以避免连接长时间不使用后自动断开的情况。
- 新增 data() 函数，用于将 DolphinDB 中的数据转化为 JavaScript 原生数据。
- 新增 invoke() 函数，支持在调用 DolphinDB 函数时，以 JavaScript 原生数据类型的形式传入参数和返回执行结果。
- 新增 execute() 函数，支持执行 DolphinDB 代码并以 JavaScript 原生数据类型的形式返回执行结果。
- 支持 COMPRESSED 型向量数据的序列化与反序列化。
- 支持 Tensor 型数据的序列化与反序列化。
- 支持订阅高可用流表。

#### 功能优化
- 支持新版的文档解析和函数提示。
- StreamingMessage 数据结构改动，可通过 “window.data” 访问窗口数据。

#### 故障修复
- 低版本（> chrome 90, < chrome 100）浏览器时间格式化。
- toString 方法的返回结果中字符串未加引号。

## 版本：2.0.1102

#### 功能改善

添加常量 VIEW_OWNER 并高亮显示

## 版本：2.0.1101

#### 功能改善

新增对 DURATION Vector 序列化的支持。

## 版本: 2.0.1100

#### 功能改善

新增 DURATION 类型对交易所标识的支持。



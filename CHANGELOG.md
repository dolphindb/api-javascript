# Release Notes

## English | [中文](./CHANGELOG.zh.md)

## Version: 3.1.6
#### Compatibility Changes
Behavior change in invoke function:
When invoke return a table, the default behavior has changed to automatically convert it into an array of objects. To retain the original DdbTableData structure, explicitly pass the option { table: 'full' } to restore the previous behavior.

#### New Features
- Added the define function to define and cache user-defined functions, avoiding redundant re-definitions.
- Added support for uploading DATETIME, NANOTIMESTAMP, TIMESTAMP, and DATE scalars or vectors.
- Added support for uploading BOOL vectors.

#### Improvements
- Improved the invoke function:
    - Supported passing a function definition directly.
    - Allowed undefined and null values as arguments when calling a functions with DolphinDB objects, booleans, or strings as parameters.
- Adjust the maximum number of concurrently executed subjobs to 64.

#### Issues Fixed
- Fixed an issue where querying IOTANY columns containing null values caused errors.
- Fixed an issue with incorrect formatting of the imaginary part in complex numbers.


## Version: 3.0.200
#### New Features
- Added parameter offset for streaming subscription to set the position of the first message where the subscription begins.
- Added support for IOTANY vectors.

#### Improvments
- Optimized the performance of invoke method.

#### Issues Fixed
- Fixed an issue where invoke failed to execute functions defined on remote nodes.
- Fixed disconnection issues when uploading strings with \0 to server.


## Version: 3.0.100
#### New Features
- Added support for heartbeat mechanism to prevent automatic disconnection due to prolonged inactivity.
- Added function data() for converting DolphinDB data into primitive JavaScript data.
- Added function invoke() that allows passing parameters and returning execution results in primitive JavaScript data types when calling DolphinDB functions.
- Added function execute() that executes DolphinDB scripts and returns execution results in primitive JavaScript data types.
- Added support for serialization and deserialization of COMPRESSED vectors and Tensor form.
- Added support for subscription to HA stream tables.

#### Improvments
- Enhanced support for documentation and function hints for the latest server version.
- Enhanced StreamingMessage that allows accessing window data using window.data.

#### Issues Fixed
- Fixed an issue with time formatting on lower version browsers (> Chrome 90, < Chrome 100).
- Fixed an issue where strings returned by toString were not enclosed in quotes.

## Version: 2.0.1102

#### Feature Enhancement

Add constant VIEW_OWNER and highlight 

## Version: 2.0.1101

#### Feature Enhancement

Support the serializtion of DURATION vector. 

## Version: 2.0.1100

#### Feature Enhancement

Support for processing exchange identifiers as DURATION type.  



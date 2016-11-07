'use strict'
// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html
const AWS = require('aws-sdk')

const kinesis = new AWS.Kinesis()


function getStreams () {
  return new Promise((resolve, reject) => {
    kinesis.listStreams({}, (err, data) => {
      if (err) {
        console.error(err)
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function getShardId (streamName) {
  return new Promise((resolve, reject) => {
    const params = {
      StreamName: streamName,
    }
    kinesis.describeStream(params, (err, data) => {
      if (err) {
        reject(err)
      } else {
        if (data.StreamDescription.Shards.length) {
          // TODO For heavy duty cases, we would return all shard ids and spin
          // up a reader for each shards
          if (data.StreamDescription.Shards.length > 1) {
            debug('MULTIPLE SHARDS (%d) only reading the first: %s',
              data.StreamDescription.Shards.length,
              data.StreamDescription.Shards[0].ShardId
            )
          }
          resolve(data.StreamDescription.Shards[0].ShardId)
        } else {
          reject('No shards!')
        }
      }
    })
  })
}

function getShardIterator (streamName, shardId, options) {
  return new Promise((resolve, reject) => {
    const params = Object.assign({
      ShardId: shardId,
      ShardIteratorType: 'LATEST',
      StreamName: streamName,
    }, options || {})
    kinesis.getShardIterator(params, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data.ShardIterator)
      }
    })
  })
}

function readShard (shardIterator) {
  const params = {
    ShardIterator: shardIterator,
    Limit: 10000,  // https://github.com/awslabs/amazon-kinesis-client/issues/4#issuecomment-56859367
  }
  kinesis.getRecords(params, (err, data) => {
    if (err) console.log(err, err.stack)
    else {
      data.Records.forEach((x) => {
        console.log(x.Data.toString())
      })
      if (!data.NextShardIterator) {
        return  // Shard has been closed
      }

      setTimeout(function () {
        readShard(data.NextShardIterator)
        // idleTimeBetweenReadsInMillis  http://docs.aws.amazon.com/streams/latest/dev/kinesis-low-latency.html
      }, 2000)
    }
  })
}

// EXPORTS
//////////

module.exports.getStreams = getStreams
module.exports._getShardId = getShardId
module.exports._getShardIterator = getShardIterator
module.exports._readShard = readShard

module.exports.main = function (streamName, getShardIteratorOptions) {
  getShardId(streamName)
  .then((shardId) => getShardIterator(streamName, shardId, getShardIteratorOptions))
  .then((shardIterator) => readShard(shardIterator))
  .catch((err) => console.log(err, err.stack))
}

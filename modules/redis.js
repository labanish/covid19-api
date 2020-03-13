const redis = require('redis')
const bluebird = require('bluebird')

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const client = redis.createClient(process.env.REDIS_URL || '', {
  prefix: 'covid-api::'
})

client.on('error', (e) => {
  console.error(e)
})

module.exports = client

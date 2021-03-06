const puppeteer = require('puppeteer')
const redis = require('../../modules/redis')
const shared = require('../../modules/shared')
const url = process.env.BASELAB_URL || 'https://coronavirus.thebaselab.com/'

module.exports = async function () {
  let browser = null
  try {
    console.log('[INFO][BaseLab Fetcher] Starting...')
    const lastFetch = await redis.getAsync('last-baselab-fetch')
    if (+lastFetch && +new Date() - lastFetch < 2 * 60 * 60 * 1000) {
      console.log('[INFO][BaseLab Fetcher] Latest fetch less than 2 hours ago, breaking...')
      return
    }
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox'
      ]
    })
    const page = await browser.newPage()
    await page.goto(url)
    await page.waitForSelector('tbody.country_data_rows > tr')
    const data = await page.evaluate(() => {
      function percents (s) {
        return parseFloat((parseFloat(s.replace('%', '')) / 100).toFixed(5))
      }

      const rows = document.querySelectorAll('.country_data_rows > tr')
      const res = []
      rows.forEach(row => {
        const country = row.querySelector('th').innerText
        const d = row.querySelectorAll('td')
        const r = [country, +d[0].innerText, +d[1].innerText, +d[2].innerText, +d[3].innerText, percents(d[4].innerText), percents(d[5].innerText)]
        res.push(r)
      })
      return res
    })
    const res = {}
    const totalRow = data.shift()
    const total = {
      infections: totalRow[1],
      activeCases: totalRow[2],
      deaths: totalRow[3],
      recovered: totalRow[4],
      mortalityRate: totalRow[5],
      revoveryRate: totalRow[6]
    }
    data.shift() // Remove total outside china
    for (const row of data) {
      const c = shared.getCountryCode(row[0])
      res[c] = {
        infections: row[1],
        activeCases: row[2],
        deaths: row[3],
        recovered: row[4],
        mortalityRate: row[5],
        revoveryRate: row[6]
      }
    }
    const state = {
      total,
      countries: res
    }
    await redis.setAsync('baselab-data', JSON.stringify(state))
    await redis.setAsync('last-baselab-fetch', +new Date())
    await browser.close()
    console.log('[INFO][BaseLab Fetcher] Complete.')
  } catch (e) {
    console.log('[INFO][BaseLab Fetcher] Error occured. Details below.')
    console.error(e)
    await browser.close()
  }
}

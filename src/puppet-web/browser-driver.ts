/**
 * Wechaty - Wechat for Bot. Connecting ChatBots
 *
 * BrowserDriver
 *
 * Licenst: ISC
 * https://github.com/wechaty/wechaty
 *
 */
import {
  Builder,
  Capabilities,
  logging,
  WebDriver,
}               from 'selenium-webdriver'

import {
  Config,
  HeadName,
  log,
}               from '../config'

export class BrowserDriver {
  private driver: WebDriver

  constructor(private head: HeadName) {
    log.verbose('PuppetWebBrowserDriver', 'constructor(%s)', head)
  }

  public async init(): Promise<this> {
    log.verbose('PuppetWebBrowserDriver', 'init() for head: %s', this.head)

    switch (this.head) {
      case 'phantomjs':
        this.driver = await this.getPhantomJsDriver()
        break

      case 'firefox':
        this.driver = new Builder()
                            .setAlertBehavior('ignore')
                            .forBrowser('firefox')
                            .build()
        break

      case 'chrome':
        await this.initChromeDriver()
        break

      default: // unsupported browser head
        throw new Error('unsupported head: ' + this.head)
    }

    await this.driver.manage()
                      .timeouts()
                      .setScriptTimeout(10000)

    return this
  }

  private async initChromeDriver(): Promise<void> {
    log.verbose('PuppetWebBrowserDriver', 'initChromeDriver()')

    /**
     * http://stackoverflow.com/a/27733960/1123955
     * issue #56
     * only need under win32 with cygwin
     * and will cause strange error:
     *
     */

    /*
    const chrome  = require('selenium-webdriver/chrome')
    const path    = require('chromedriver').path

    const service = new chrome.ServiceBuilder(path).build()
    try {
      chrome.setDefaultService(service)
    } catch (e) { // fail safe
       // `The previously configured ChromeDriver service is still running.`
       // `You must shut it down before you may adjust its configuration.`
    }
   */

    const options = {
      args: [
        '--homepage=about:blank',
        '--no-sandbox',
      ],  // issue #26 for run inside docker
    }
    if (Config.isDocker) {
      log.verbose('PuppetWebBrowserDriver', 'initChromeDriver() wechaty in docker confirmed(should not show this in CI)')
      options['binary'] = Config.CMD_CHROMIUM
    }

    const customChrome = Capabilities.chrome()
                                    .set('chromeOptions', options)

    // TODO: chromedriver --silent
    if (!/^(verbose|silly)$/i.test(log.level())) {
      const prefs = new logging.Preferences()

      prefs.setLevel(logging.Type.BROWSER     , logging.Level.OFF)
      prefs.setLevel(logging.Type.CLIENT      , logging.Level.OFF)
      prefs.setLevel(logging.Type.DRIVER      , logging.Level.OFF)
      prefs.setLevel(logging.Type.PERFORMANCE , logging.Level.OFF)
      prefs.setLevel(logging.Type.SERVER      , logging.Level.OFF)

      customChrome.setLoggingPrefs(prefs)
    }

    /**
     * XXX when will Builder().build() throw exception???
     */
    let retry = 0
    let driverError = new Error('initChromeDriver() invalid driver error')
    let valid = false

    do {
     if (retry > 0) {
        log.warn('PuppetWebBrowserDriver', 'initChromeDriver() with retry: %d', retry)
      }

      try {
        log.verbose('PuppetWebBrowserDriver', 'initChromeDriver() new Builder()')

        this.driver = new Builder()
                      .setAlertBehavior('ignore')
                      .forBrowser('chrome')
                      .withCapabilities(customChrome)
                      .build()

        log.verbose('PuppetWebBrowserDriver', 'initChromeDriver() new Builder() done')

        valid = await this.valid(this.driver)
        log.verbose('PuppetWebBrowserDriver', 'initChromeDriver() valid() done: %s', valid)

        if (!valid) {
          const e = new Error('initChromeDriver() got invalid driver')
          log.warn('PuppetWebBrowserDriver', e.message)
          driverError = e
        }

      } catch (e) {
        if (/could not be found/.test(e.message)) {
          // The ChromeDriver could not be found on the current PATH
          log.error('PuppetWebBrowserDriver', 'initChromeDriver() Wechaty require `chromedriver` to be installed.(try to run: "npm install chromedriver" to fix this issue)')
          throw e
        }
        log.warn('PuppetWebBrowserDriver', 'initChromeDriver() exception: %s, retry: %d', e.message, retry)
        driverError = e
      }

    } while (!valid && retry++ < 3)

    if (!valid) {
      log.warn('PuppetWebBrowserDriver', 'initChromeDriver() not valid after retry: %d times: %s', retry, driverError.stack)
      throw driverError
    } else {
      log.silly('PuppetWebBrowserDriver', 'initChromeDriver() success')
    }

    return
  }

  private async getPhantomJsDriver(): Promise<WebDriver> {
    // setup custom phantomJS capability https://github.com/SeleniumHQ/selenium/issues/2069
    const phantomjsExe = require('phantomjs-prebuilt').path
    if (!phantomjsExe) {
      throw new Error('phantomjs binary path not found')
    }
    // const phantomjsExe = require('phantomjs2').path

    const phantomjsArgs = [
      '--load-images=false',
      '--ignore-ssl-errors=true',  // this help socket.io connect with localhost
      '--web-security=false',      // https://github.com/ariya/phantomjs/issues/12440#issuecomment-52155299
      '--ssl-protocol=any',        // http://stackoverflow.com/a/26503588/1123955
      // , '--ssl-protocol=TLSv1'    // https://github.com/ariya/phantomjs/issues/11239#issuecomment-42362211

      // issue: Secure WebSocket(wss) do not work with Self Signed Certificate in PhantomJS #12
      // , '--ssl-certificates-path=D:\\cygwin64\\home\\zixia\\git\\wechaty' // http://stackoverflow.com/a/32690349/1123955
      // , '--ssl-client-certificate-file=cert.pem' //
    ]

    if (Config.debug) {
      phantomjsArgs.push('--remote-debugger-port=8080') // XXX: be careful when in production env.
      phantomjsArgs.push('--webdriver-loglevel=DEBUG')
      // phantomjsArgs.push('--webdriver-logfile=webdriver.debug.log')
    } else {
      if (log && log.level() === 'silent') {
        phantomjsArgs.push('--webdriver-loglevel=NONE')
      } else {
        phantomjsArgs.push('--webdriver-loglevel=ERROR')
      }
    }

    const customPhantom = Capabilities.phantomjs()
                                      .setAlertBehavior('ignore')
                                      .set('phantomjs.binary.path', phantomjsExe)
                                      .set('phantomjs.cli.args', phantomjsArgs)

    log.silly('PuppetWebBrowserDriver', 'phantomjs binary: ' + phantomjsExe)
    log.silly('PuppetWebBrowserDriver', 'phantomjs args: ' + phantomjsArgs.join(' '))

    const driver = new Builder()
                        .withCapabilities(customPhantom)
                        .build()

    // const valid = await this.valid(driver)

    // if (!valid) {
    //   throw new Error('invalid driver founded')
    // }

    /* tslint:disable:jsdoc-format */
		/**
		 *  FIXME: ISSUE #21 - https://github.com/zixia/wechaty/issues/21
	 	 *
 	 	 *	http://phantomjs.org/api/webpage/handler/on-resource-requested.html
		 *	http://stackoverflow.com/a/29544970/1123955
		 *  https://github.com/geeeeeeeeek/electronic-wechat/pull/319
		 *
		 */
    //   	driver.executePhantomJS(`
    // this.onResourceRequested = function(request, net) {
    //    console.log('REQUEST ' + request.url);
    //    blockRe = /wx\.qq\.com\/\?t=v2\/fake/i
    //    if (blockRe.test(request.url)) {
    //        console.log('Abort ' + request.url);
    //        net.abort();
    //    }
    // }
    // `)

    // https://github.com/detro/ghostdriver/blob/f976007a431e634a3ca981eea743a2686ebed38e/src/session.js#L233
    // driver.manage().timeouts().pageLoadTimeout(2000)

    return driver
  }

  private async valid(driver: WebDriver): Promise<boolean> {
    log.verbose('PuppetWebBrowserDriver', 'valid()')

    try {
      const session = await new Promise((resolve, reject) => {

        /**
         * Be careful about this TIMEOUT, the total time(TIMEOUT x retry) should not trigger Watchdog Reset
         * because we are in state(open, false) state, which will cause Watchdog Reset failure.
         * https://travis-ci.org/wechaty/wechaty/jobs/179022657#L3246
         */
        const TIMEOUT = 7 * 1000

        let watchdogTimer: NodeJS.Timer | null

        watchdogTimer = setTimeout(() => {
          const e = new Error('valid() driver.getSession() timeout(halt?)')
          log.warn('PuppetWebBrowserDriver', e.message)

          // record timeout by set timer to null
          watchdogTimer = null
          log.verbose('PuppetWebBrowserDriver', 'watchdogTimer = %s after set null', watchdogTimer)

          // 1. Promise rejected
          reject(e)
          return

        }, TIMEOUT)

        log.verbose('PuppetWebBrowserDriver', 'valid() getSession()')
        driver.getSession()
              .then(driverSession => {
                log.verbose('PuppetWebBrowserDriver', 'valid() getSession() then() done')
                if (watchdogTimer) {
                  log.verbose('PuppetWebBrowserDriver', 'valid() getSession() then() watchdog timer exist, will be cleared')
                  clearTimeout(watchdogTimer)
                  watchdogTimer = null
                  log.verbose('PuppetWebBrowserDriver', 'watchdogTimer = %s after set null', watchdogTimer)
                } else {
                  log.verbose('PuppetWebBrowserDriver', 'valid() getSession() then() watchdog timer not exist?')
                }

                // 2. Promise resolved
                resolve(driverSession)
                return

              })
              .catch(e => {
                log.warn('PuppetWebBrowserDriver', 'valid() getSession() catch() rejected: %s', e && e.message || e)

                // do not call reject again if there's already a timeout
                if (watchdogTimer) {
                  log.verbose('PuppetWebBrowserDriver', 'valid() getSession() catch() watchdog timer exist, will set it to null and call reject()')

                  // 3. Promise rejected
                  watchdogTimer = null
                  reject(e)
                  return

                } else {
                  log.verbose('PuppetWebBrowserDriver', 'valid() getSession() catch() watchdog timer not exist, will not call reject() again')
                }

              })

      })

      log.verbose('PuppetWebBrowserDriver', 'valid() driver.getSession() done()')

      if (!session) {
        log.verbose('PuppetWebBrowserDriver', 'valid() found an invalid driver')
        return false
      }

    } catch (e) {
      log.warn('PuppetWebBrowserDriver', 'valid() driver.getSession() exception: %s', e.message)
      return false
    }

    let two
    try {
      two = await driver.executeScript('return 1+1')
      log.verbose('PuppetWebBrowserDriver', 'valid() driver.executeScript() done')
    } catch (e) {
      two = e
      log.warn('BrowserDriver', 'valid() fail: %s', e.message)
    }

    if (two !== 2) {
      log.warn('BrowserDriver', 'valid() fail: two = %s ?', two)
      return false
    }

    log.silly('PuppetWebBrowserDriver', 'valid() driver ok')
    return true
  }

  public close()              { return this.driver.close() as any as Promise<void> }
  public executeAsyncScript(script: string|Function, ...args: any[])  { return this.driver.executeAsyncScript.apply(this.driver, arguments) }
  public executeScript     (script: string|Function, ...args: any[])  { return this.driver.executeScript.apply(this.driver, arguments) }
  public get(url: string)     { return this.driver.get(url) as any as Promise<void> }
  public getSession()         { return this.driver.getSession() as any as Promise<void> }
  public manage()             { return this.driver.manage() as any }
  public navigate()           { return this.driver.navigate() as any }
  public quit()               { return this.driver.quit() as any as Promise<void> }
}

/**
 * Wechaty - Wechat for Bot. Connecting ChatBots
 *
 * Licenst: ISC
 * https://github.com/wechaty/wechaty
 *
 */
import { test } from 'ava'
import * as fs from 'fs'

// import { execSync } from 'child_process'
// import * as sinon from 'sinon'

import { Config } from '../src/config'

/**
 * need keep this !Config.isDocker because ava need at least one test() inside.
 *   × No tests found in test\docker.spec.js
 */
if (Config.isDocker) {

  test('Docker smoking test', function(t) {
    // const n = execSync('ps a | grep Xvfb | grep -v grep | wc -l').toString().replace(/\n/, '', 'g')
    // t.is(parseInt(n), 1, 'should has Xvfb started')
    t.notThrows(() => {
      // fs.accessSync(Config.CMD_CHROMIUM, fs['X_OK'])
      fs.statSync(Config.CMD_CHROMIUM).isFile()
    }, 'should exist xvfb-chrome exectable')
  })

} else {

  test('Docker test skipped', function(t) {
    t.pass('not in docker. this test is to prevent AVA `× No tests found in test\docker.spec.js` error.')
  })

}

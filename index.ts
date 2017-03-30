import {
  Config,
  Sayable,
  log,
}                         from './src/config'
import { Contact }        from './src/contact'

// ISSUE #70 import { FriendRequest }  from './src/friend-request'
import { FriendRequest }  from './src/puppet-web/friend-request'

import { IoClient }       from './src/io-client'
import {
  Message,
  MediaMessage,
  MsgType,
}                         from './src/message'
import { Puppet }         from './src/puppet'
import { PuppetWeb }      from './src/puppet-web/'
import { Room }           from './src/room'
import { UtilLib }        from './src/util-lib'
import { Wechaty }        from './src/wechaty'

const VERSION = require('./package.json').version

export {
  Config,
  Contact,
  FriendRequest,
  IoClient,
  Message,
  MediaMessage,
  MsgType,
  Puppet,
  PuppetWeb,
  Room,
  Sayable,
  UtilLib,
  VERSION,
  Wechaty,
  log, // for convenionce use npmlog with environment variable LEVEL
}

export default Wechaty


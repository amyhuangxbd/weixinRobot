/**
 * Wechaty - Wechat for Bot. Connecting ChatBots
 *
 * Web Server for puppet
 *
 * Class PuppetWebServer
 *
 * Licenst: ISC
 * https://github.com/zixia/wechaty
 *
 */
import * as io          from 'socket.io'
import * as https       from 'https'
import * as bodyParser  from 'body-parser'

import * as express     from 'express'
import { EventEmitter } from 'events'

import { log }  from '../config'

export class Server extends EventEmitter {
  private express:      express.Application
  private httpsServer:  https.Server | null

  public socketServer: SocketIO.Server | null
  public socketClient: SocketIO.Socket | null

  constructor(private port: number) {
    super()
  }

  public toString() { return `Server({port:${this.port}})` }

  public async init(): Promise<void> {
    log.verbose('PuppetWebServer', `init() on port ${this.port}`)

    try {
      this.createExpress()
      await this.createHttpsServer(this.express)
      this.createSocketIo(this.httpsServer)

      return

    } catch (e) {
      log.error('PuppetWebServer', 'init() exception: %s', e.message)
      throw e
    }
  }

  /**
   * Https Server
   */
  public async createHttpsServer(express: express.Application): Promise<https.Server> {
    this.httpsServer = <https.Server>await new Promise((resolve, reject) => {

      const srv = https.createServer({
        key:  require('./ssl-pem').key,
        cert: require('./ssl-pem').cert,
      }, express) // XXX: is express must exist here? try to get rid it later. 2016/6/11

      srv.listen(this.port, err => {
        if (err) {
          log.error('PuppetWebServer', 'createHttpsServer() exception: %s', err)
          return reject(err)
        } else {
          log.verbose('PuppetWebServer', `createHttpsServer() listen on port ${this.port}`)
          resolve(srv)
        }
      })

    })

    return this.httpsServer
  }

  /**
   * express Middleware
   */
  public createExpress(): express.Application {
    this.express = express()
    this.express.use(bodyParser.json())
    this.express.use(function(req, res, next) {
      // cannot use `*` if angular is set `.withCredentials = true`
      // see also: https://github.com/whatwg/fetch/issues/251#issuecomment-199946808
      // res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Origin', req.headers['origin'])
      res.header('Access-Control-Allow-Credentials', 'true')
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
      next()
    })
    this.express.get('/ding', function(req, res) {
      log.silly('PuppetWebServer', 'createexpress() %s GET /ding', new Date())
      res.end('dong')
    })
    return this.express
  }

  /**
   * Socket IO
   */
  public createSocketIo(httpsServer): SocketIO.Server {
    this.socketServer = io.listen(httpsServer, {
      // log: true
    })
    this.socketServer.sockets.on('connection', (s) => {
      log.verbose('PuppetWebServer', 'createSocketIo() got connection from browser')
      // console.log(s.handshake)
      if (this.socketClient) {
        log.warn('PuppetWebServer', 'createSocketIo() on(connection) there already has a this.socketClient')
        this.socketClient = null // close() ???
      }
      this.socketClient = s
      this.initEventsFromClient(s)
    })
    return this.socketServer
  }

  private initEventsFromClient(client: SocketIO.Socket): void {
    log.verbose('PuppetWebServer', 'initEventFromClient()')

    this.emit('connection', client)

    client.on('disconnect', e => {
      log.silly('PuppetWebServer', 'initEventsFromClient() on(disconnect) socket.io disconnect: %s', e)
      // 1. Browser reload / 2. Lost connection(Bad network)
      this.socketClient = null
      this.emit('disconnect', e)
    })

    client.on('error' , e => {
      // log.error('PuppetWebServer', 'initEventsFromClient() client on error: %s', e)
      log.error('PuppetWebServer', 'initEventsFromClient() on(error): %s', e.stack)
    })

    // Events from Wechaty@Broswer --to--> Server
    ; [
      'message',
      'scan',
      'login',
      'logout',
      'log',
      'unload',  // @depreciated 20160825 zixia
                  // when `unload` there should always be a `disconnect` event?
      'ding',
    ].map(e => {
      client.on(e, data => {
        // log.silly('PuppetWebServer', `initEventsFromClient() forward client event[${e}](${data}) from browser by emit it`)
        this.emit(e, data)
      })
    })

    return
  }

  public async quit(): Promise<void> {
    log.verbose('PuppetWebServer', 'quit()')
    if (this.socketServer) {
      log.verbose('PuppetWebServer', 'closing socketServer')
      this.socketServer.close()
      this.socketServer = null
    }
    if (this.socketClient) {
      log.verbose('PuppetWebServer', 'closing socketClient')
      this.socketClient = null
    }
    if (this.httpsServer) {
      log.verbose('PuppetWebServer', 'closing httpsServer')
      this.httpsServer.close()
      this.httpsServer = null
    }
    return
  }
}

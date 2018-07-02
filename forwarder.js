import TransportU2F from "@ledgerhq/hw-transport-u2f";

let delegate;

async function isSupported() {
  return await TransportU2F.isLedgerSupported();
}

async function list() {
  return await TransportU2F.list();
}

async function open(path, isDebug, scrambleKey, timeout) {
  delegate = await TransportU2F.open(path);
  transport.delegate.setDebugMode(isDebug);
  transport.delegate.setScrambleKey(scrambleKey);
  transport.delegate.setExchangeTimeout(timeout);
}

async function close() {
  return await delegate.close();
}

async function send(cla, ins, p1, p2, data, statusList)  {
  const resulBuffer = await delegate.send(
    cla,
    ins,
    p1,
    p2,
    Buffer.from(data, 'hex'),
    statusList
  );

  return resulBuffer.toString('hex');
}

/**
 * A message broker running in an embedded iframe. It routes messages between a
 * 3rd party U2F consumer page and the U2F extension.
 * @constructor
 */
class Forwarder {
  constructor() {
    /**
     * @private {Port}
     */
    this.extensionPort_ = null;
    /**
     * @private {MessagePort}
     */
    this.pagePort_ = null;
    /**
     * @private {string?}
     */
    this.pageOrigin_ = null;
  }
  /**
   * Initializes the forwarder
   */
  init() {
    var self = this;
    window.addEventListener('message', function (message) {
      if (message.data == 'init' && message.ports.length > 0) {
        self.pageOrigin_ = message.origin;
        self.pagePort_ = message.ports[0];
        self.pagePort_.addEventListener('message', self.onPageMessage_.bind(self));
        self.pagePort_.start();
        // Tell the page we are ready
        self.pagePort_.postMessage('ready');
      }
      else {
        console.error('Ledger forwarder iframe received non-init message');
      }
    }, false);
  }
  /**
   * Handles messages from the page, forwarding to the extension.
   * @param {MessageEvent} event The message event
   * @private
   */
  async onPageMessage_(event) {
    console.log('message from plugin:', event.data);

    let result;
    if (event.data.method === 'isSupported') {
      result = await isSupported();
    } else if (event.data.method === 'list') {
      result = await list();
    } else if (event.data.method === 'open') {
      result = await open(
        event.data.path,
        event.data.isDebug,
        event.data.scrambleKey,
        event.data.timeout
      );
    } else if (event.data.method === 'close') {
      result = await close();
    } else if (event.data.method === 'send') {
      result = await send(
        event.data.cla,
        event.data.ins,
        event.data.p1,
        event.data.p2,
        event.data.data,
        event.data.statusList
      );
    }
    this.pagePort_.postMessage({ id: event.data.id, result: result });
  }
}

// Initialize only if we are in our frame
var fwdr = new Forwarder();
fwdr.init();

// store the forwarder instance in the global scope for debugging
window.forwarderInstance = fwdr;

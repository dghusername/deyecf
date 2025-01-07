//const EventEmitter = require("events").EventEmitter;
const Logger = require("./Logger");
const net = require("net");
const Protocol = require("./Protocol");

const fs = require("fs");
const csvfile = "/tmp/.deye.csv";
var wifisignal = -1;
var tempvalid = 0;

class DummyCloud {
    constructor() {
//      this.eventEmitter = new EventEmitter();
        this.server = new net.Server();
    }

    initialize() {
        this.server.listen(DummyCloud.PORT, function() {
            Logger.info(`Starting deye-dummycloud on port ${DummyCloud.PORT}`);
        });

        this.server.on("connection", (socket) => {
            this.handleConnection(socket);
        });

var filesize = 0;
try {
  var {size: filesize} = fs.statSync( csvfile );
} catch {}

if( filesize == 0 ) {
  fs.writeFile( csvfile, "      ts,       date,     time,Pout, Temp,Sig, Ytd,Ytotal, U_g, I_g,  F_g,Ytd1, Ytot1,  P_1,   U_1,  I_1,Ytd2, Ytot2,   P_2,  U_2,  I_2\n", err => {

    if( err )
      Logger.error( `CSV-File initialisation failed: ${err}` );
  });
}
    }

    /**
     * @private
     * @param {net.Socket} socket
     */
    handleConnection(socket) {
        const remoteAddress = socket.remoteAddress; // As this is a getter, it may become unavailable
        Logger.info(`New connection from ${remoteAddress}`);
tempvalid = 0;
if( process.env.AA_DEBUGWIFI )
  Logger.info( `AA_DEBUGWIFI is on` );
if( process.env.AA_DEBUGUNK )
  Logger.info( `AA_DEBUGUNK is on` );

        socket.on("data", (data) => {
Logger.debug(`---------------------------------------------------`);
            Logger.trace(new Date().toISOString(), `Data received from client ${remoteAddress}: ${data.toString()}`);
            Logger.trace(new Date().toISOString(), `Data ${remoteAddress}:`, data.toString("hex"));
Logger.trace("Data", data.toString("hex").match(/.{1,2}/g));

            try {
                const packet = Protocol.parsePacket(data);
                let response;

                switch (packet.header.type) {
                    case Protocol.MESSAGE_REQUEST_TYPES.HEARTBEAT: {
                        response = Protocol.buildTimeResponse(packet);
                        break;
                    }
                    case Protocol.MESSAGE_REQUEST_TYPES.WIFI: {

if( process.env.AA_DEBUGWIFI ) {
  Logger.info( `---------------------------------------------------` );
  Logger.info( `WIFI data from client ${remoteAddress}: ${data.toString()}` );
  Logger.info( `Data ${remoteAddress}:`, data.toString("hex") );
  Logger.info( "Data", data.toString("hex").match(/.{1,2}/g) );
}
                        /*
                            There isn't much of interest in this packet
                            It can contain the SSID or the Logger SN
                            + Some counters increasing every second
                            
                            On connect, it also can contain the signal strength
                            But that's about it
                            
                            The signal strength over time would've been interesting, but it only gets sent on connect
                            With that, it's close to useless
                         */

// length	type(0)	meaning
// 0x3c		0x01	???
// 0x1f		0x04	Inverter S/N
// 0x2f		0x81	WiFiSignal(45) if bits(13) == 0 and SSID(15)

if( packet.header.payloadLength == 0x2f ) {

  const data = Protocol.parseWifiPacketPayload( packet );
  if( process.env.AA_DEBUGWIFI )
    Logger.info( `WiFi 0x2f packet:`, data );

  if( data.type == 0x81 && data.bits == 0 )
    wifisignal = data.signal;

} else if( process.env.AA_DEBUGWIFI )
  Logger.info( "Discarded WiFi packet" );
else
  Logger.debug( "Discarded WiFi packet" );

                        response = Protocol.buildTimeResponse(packet);
                        break;
                    }
                    case Protocol.MESSAGE_REQUEST_TYPES.HANDSHAKE: {
                        const data = Protocol.parseLoggerPacketPayload(packet);

                        Logger.debug(`Handshake packet data from ${remoteAddress}`, data);
/*
                        this.emitHandshake({
                            header: packet.header,
                            payload: data
                        });
*/

                        response = Protocol.buildTimeResponse(packet);
                        break;
                    }
                    case Protocol.MESSAGE_REQUEST_TYPES.DATA: {
                        const data = Protocol.parseDataPacketPayload(packet);

                        if (data) {
                            Logger.debug(`DATA packet data from ${remoteAddress}`, data);

if( data.inverter.radiator_temp_celsius.toFixed( 2 ) != -10.0 )
  tempvalid = 1;

if( data.pv[1].kWh_total > 0 && data.pv[2].kWh_total > 0 ) {

  const d = new Date();

  let csvout = ( d.getTime() / 1000 - 1721384736 ).toFixed( 0 ).toString() + ", "
   + d.toLocaleDateString( "de-DE", { day: "2-digit", month: "2-digit", year: "numeric" } ) + ", "
   + d.toLocaleTimeString( "de-DE" ) + ","
   + data.grid.active_power_w.toString().padStart( 4 ) + ","
   + data.inverter.radiator_temp_celsius.toFixed( 1 ).padStart( 6 ) + ","
   + ((wifisignal >= 0) ? wifisignal.toString().padStart( 3 ) : " NA" ) + ","
   + data.grid.kWh_today.toFixed( 1 ).padStart( 4 ) + ", "
   + data.grid.kWh_total.toFixed( 1 ) + ", "
   + data.grid.v.toString() + ","
   + data.grid.i.toFixed( 1 ).padStart( 4 ) + ","
   + data.grid.hz.toFixed( 1 ).padStart( 5 ) + ","
   + data.pv[1].kWh_today.toFixed( 1 ).padStart( 4 ) + ", "
   + data.pv[1].kWh_total.toFixed( 1 ) + ","
   + data.pv[1].w.toFixed( 1 ).padStart( 6 ) + ","
   + data.pv[1].v.toFixed( 1 ).padStart( 5 ) + ","
   + data.pv[1].i.toFixed( 1 ).padStart( 5 ) + ","
   + data.pv[2].kWh_today.toFixed( 1 ).padStart( 4 ) + ", "
   + data.pv[2].kWh_total.toFixed( 1 ) + ","
   + data.pv[2].w.toFixed( 1 ).padStart( 6 ) + ","
   + data.pv[2].v.toFixed( 1 ).padStart( 5 ) + ","
   + data.pv[2].i.toFixed( 1 ).padStart( 5 ) + "\n";

  fs.writeFile( csvfile, csvout, { flag: 'a' }, err => {
    if( err )
      Logger.error( `CSV-File write failed: ${err}` );
  });
}
/*
                            this.emitData({
                                header: packet.header,
                                payload: data
                            });
*/
                        } else {
                            Logger.debug("Discarded data packet");
                        }

                        response = Protocol.buildTimeResponse(packet);
                        break;
                    }

                    default: {
if( process.env.AA_DEBUGUNK ) {
  Logger.info( `---------------------------------------------------` );
  Logger.info( `UNKNOWN data from client ${remoteAddress}: ${data.toString()}` );
  Logger.info( `Data ${remoteAddress}:`, data.toString("hex") );
  Logger.info( "Data", data.toString("hex").match(/.{1,2}/g) );
}
                        response = Protocol.buildTimeResponse(packet);
                    }
                }

                if (response) {
                    Logger.trace("Response", response.toString("hex"));

                    socket.write(response);
                }
            } catch (e) {
                Logger.error(`Error while parsing packet from ${remoteAddress}`, e);
            }
        });

        socket.on("end", function() {
            Logger.info(`Ending connection with ${remoteAddress}`);
        });

        socket.on("close", function() {
            Logger.info(`Closing connection with ${remoteAddress}`);
        });

        socket.on("error", function(err) {
            Logger.error(`Error on dummycloud socket for ${remoteAddress}`, err);
        });
    }

/*
    emitData(data) {
        this.eventEmitter.emit(DummyCloud.PACKET_EVENTS.Data, data);
    }

    onData(listener) {
        this.eventEmitter.on(DummyCloud.PACKET_EVENTS.Data, listener);
    }

    emitHandshake(data) {
        this.eventEmitter.emit(DummyCloud.PACKET_EVENTS.Handshake, data);
    }

    onHandshake(listener) {
        this.eventEmitter.on(DummyCloud.PACKET_EVENTS.Handshake, listener);
    }
*/
}

DummyCloud.PACKET_EVENTS = {
    Data: "Data",
    Handshake: "Handshake"
};


DummyCloud.PORT = 10000;

module.exports = DummyCloud;

//const EventEmitter = require("events").EventEmitter;
const Logger = require("./Logger");
const net = require("net");
const Protocol = require("./Protocol");

const fs = require("fs");
const csvfile = "/tmp/.deye.csv";
var wifisignal = -1;

class DummyCloud {
    constructor() {
//        this.eventEmitter = new EventEmitter();
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
  fs.writeFile( csvfile, "     ts,       date,     time,Pout, Temp,Sig, Ytd,Ytotal, U_g, I_g,  F_g,Ytd1, Ytot1,  P_1,   U_1,  I_1,Ytd2, Ytot2,   P_2,  U_2,  I_2\n", err => {

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

        socket.on("data", (data) => {
Logger.debug(`---------------------------------------------------`);
            Logger.trace(new Date().toISOString(), `Data received from client: ${data.toString()}`);
            Logger.trace(new Date().toISOString(), "Data", data.toString("hex"));
Logger.trace("Data", data.toString("hex").match(/.{1,2}/g));

            try {
                const packet = Protocol.parsePacket(data);
                let response;

                switch (packet.header.type) {
                    case Protocol.MESSAGE_REQUEST_TYPES.HEARTBEAT: {
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
	case Protocol.MESSAGE_REQUEST_TYPES.WIFI: {
	  if( packet.header.payloadLength == 0x2f ) {
	    const data = Protocol.parseWifiPacketPayload(packet);
	    Logger.debug( `WiFi packet data from ${remoteAddress}`, data );
	    if( data.bits == 0 )
	      wifisignal = data.signal;
	  } else
	    Logger.debug( "Discarded WiFi packet" );
	  response = Protocol.buildTimeResponse( packet );
	  break;
	  }

                    case Protocol.MESSAGE_REQUEST_TYPES.DATA: {
                        const data = Protocol.parseDataPacketPayload(packet);

                        if (data) {
                            Logger.debug(`DATA packet data from ${remoteAddress}`, data);

if( data.pv[1].kWh_total > 0 && data.pv[2].kWh_total > 0 ) {

  const d = new Date();

  let csvout = ( d.getTime() / 1000 - 1721384736 ).toFixed( 0 ).toString() + ", "
   + d.toLocaleDateString( "de-DE", { day: "2-digit", month: "2-digit", year: "numeric" } ) + ", "
   + d.toLocaleTimeString( "de-DE" ) + ","
   + data.grid.active_power_w.toString().padStart( 4 ) + ","
   + data.inverter.radiator_temp_celsius.toFixed( 1 ).padStart( 5 ) + ","
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

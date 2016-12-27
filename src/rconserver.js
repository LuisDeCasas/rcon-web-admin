"use strict";

var Rcon = require(__dirname + "/rcon");
var db = require(__dirname + "/db");

/**
 * A single server instance
 * @param {string} id
 * @param {object} serverData
 * @constructor
 */
function RconServer(id, serverData) {
    /** @type {RconServer} */
    var self = this;
    /** @type {string} */
    this.id = id;
    /** @type {object} */
    this.serverData = serverData;
    /** @type {Rcon} */
    this.con = new Rcon(serverData.host, serverData.rcon_port);
    /** @type {boolean} */
    this.connected = false;
    /** @type {{timestamp:string, message : string}} */
    this.messages = [];

    // require this here to not get a loop because websocketuser itself require the RconServer module
    var WebSocketUser = require(__dirname + "/websocketuser");

    // on disconnect remove server from instances
    this.con.on("disconnect", function () {
        self.removeInstance();
    });

    /**
     * Temove this instance from server list
     * @param {boolean=} disconnect If true also do call disconnect
     */
    this.removeInstance = function (disconnect) {
        if (disconnect) {
            self.con.disconnect();
        }else{
            self.con = null;
            self.connected = false;
            delete RconServer.instances[self.id];
        }
    };

    /**
     * Send a command
     * @param {string} cmd
     * @param {function} callback
     */
    this.send = function (cmd, callback) {
        if (this.connected) {
            this.con.send(cmd, function (err, result) {
                if (err) {
                    console.trace(err);
                    callback(false);
                    return;
                }
                callback(result.toString());
            });
            return;
        }
        callback(false);
    };

    this.con.connect(function (err) {
        if (err) {
            console.trace(err);
            return;
        }
        // authenticate
        self.con.send(self.serverData.rcon_password, function (err) {
            if (err) {
                console.trace(err);
                return;
            }
            self.connected = true;
        }, Rcon.SERVERDATA_AUTH);

        // catch errors
        self.con.on("error", function (err) {
            console.trace(err);
        });

        // on receive message
        self.con.on("message", function (data) {
            var str = data.body.toString();
            if (str && str.length) {
                var msg = {
                    "timestamp": new Date().toString(),
                    "message": str
                };
                self.messages.push(msg);
                self.messages = self.messages.slice(-200);
                // push this message to all connected clients that have access to this server
                for (var i in WebSocketUser.instances) {
                    var user = WebSocketUser.instances[i];
                    var server = user.getServerById(self.id);
                    if(server){
                        user.send("server-message", msg);
                    }
                }
            }
        });
    });
}

/**
 * All opened server instances
 * @type {object<string, RconServer>}
 */
RconServer.instances = {};

/**
 * Connect to each servers in our pool
 */
RconServer.connectAll = function () {
    var servers = db.get("servers").value();
    if (servers) {
        for (var i in servers) {
            RconServer.get(servers[i].id);
        }
    }
};

/**
 * Get the server instance for given id
 * Connect to server if not yet connected
 * @param {string} id
 * @return {RconServer|null}
 */
RconServer.get = function (id) {
    if (RconServer.instances[id]) {
        return RconServer.instances[id];
    }
    var serverData = db.get("servers").get(id).cloneDeep().value();
    if (serverData) {
        RconServer.instances[id] = new RconServer(id, serverData);
        return RconServer.instances[id];
    }
    return null;
};

// connect to all servers and create an interval
RconServer.connectAll();
// check each x seconds connect to each server in the list
// if already connected than nothing happen
setInterval(RconServer.connectAll, 10000);

module.exports = RconServer;
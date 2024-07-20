const crypto = require("crypto");
const path = require("path");
const process = require("child_process");
const tree = require("ps-tree");
const inject = require("dll-inject");

const log = require("./utils/log");

log.Main("Starting!");

// Settings
const servers = 1; // dont change: This doesnt really work cuz of the port of the gs.
const server = path.join(__dirname, "../res/server.dll");
const redirect = path.join(__dirname, "../res/redirect.dll");
const game = "C:\\__storage\\5_3\\FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe";

let CurrentServers = [];

const args = [
    "-epicportal",
    "-skippatchcheck",
    "-auth_type=epic",
    "-auth_login=server@.",
    "-auth_password=server",
    "-nullrhi",
    "-nosound",
    "-nosplash"
];

function Server() {
    const id = crypto.randomUUID();

    let ShippingPID = "NONE";
    let injectedRedirect = false;
    let injectedServer = false;

    const client = process.spawn(game, args, { cwd: `${game.split("FortniteLauncher.exe")[0]}` });
    log.Main(`Started Launcher with PID: ${client.pid}`);

    client.stdout.on("data", (chunk) => {
        const data = chunk.toString();

        if (!injectedRedirect) {
            injectedRedirect = true;

            const interval = setInterval(() => {
                getShippingPID(client.pid, (err, pids) => {
                    if (err) {
                        log.Error(err);
                    }

                    if (pids.length > 0) {
                        // if you want to use Sinium inject a bit later or it will crash
                        // idk when to inject Sinium as i dont use it that much so arround 5 secs?
                        clearInterval(interval);
                        ShippingPID = Number(pids);
                        const error = inject.injectPID(ShippingPID, redirect);
                        if (!error) {
                            log.Main(`Injected Redirect into ${id}`);
                        } else {
                            log.Error(`Failed to inject redirect into ${id}, MCP will be mostlikely disabled.`);
                        }
                    }
                });
            }, 1000);

            setTimeout(() => {
                getShippingPID(client.pid, (err, pids) => {
                    if (err) {
                        log.Error(err);
                    }

                    if (pids.length > 0) {
                        clearInterval(interval);
                    }
                });
            }, 2 * 1000);
        }

        if (data.includes("Region ") && !injectedServer) {
            injectedServer = true;

            setTimeout(() => {
                const error = inject.injectPID(ShippingPID, server);
                if (!error) {
                    CurrentServers.push({
                        [id]: {
                            created_at: new Date().toISOString(),
                            manager: "prod@lunarfn.org",
                        }
                    });

                    log.Main(`Pushed: ${id} to servers array!`);
                }
            }, 5 * 1000)
        }

        const serverCheck = setInterval(() => {
            if (injectedServer && !inject.isProcessRunningPID(ShippingPID)) {
                const index = CurrentServers.findIndex((server) => server.hasOwnProperty(id));
                if (index !== -1) {
                    CurrentServers.splice(index, 1);
                    clearInterval(serverCheck);
                    log.Main(`${id} is not running anymore removed it from servers array!`);
                }
            }
        }, 5000)
    });
}

function getShippingPID(parentId, callback) {
    tree(parentId, (err, children) => {
        if (err) {
            return callback(err);
        }

        const pids = children.map(child => child.PID);
        callback(null, pids);
    });
}

Server();
setInterval(() => {
    const current = CurrentServers.length;

    if (current != servers) {
        log.Main(`${current} are currently hosted but user input was: ${servers}, starting a new server!`);
        Server();
    }
}, 60 * 1000);
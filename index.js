const repl = require('repl');
const { Client } = require('ssh2');

const [, , username, password, host, port = 22] = process.argv;

const connection = new Client();

connection.on('ready', () => {
    const commands = {};

    const handlers = {
        get(target, property) {
            if (!commands[target]) {

            }
        }
    };
    connection.shell((error, stream) => {
        if (error) throw error;
        stream.on('close', (code, signal) => {
            console.log(`Stream :: close :: code: ${code} signal: ${signal}`);
            connection.end();
        }).on('data', function(data) {
            console.log(`STDOUT: ${data}`);
        }).stderr.on('data', function(data) {
            console.error(`STDERR: ${data}`);
        });

        Object.assign(repl.start('> ').context, );
    });
}).on('error', error => {
    console.error(error);
}).connect({
    host, port, username, password
});

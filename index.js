(() => {
  const {EventEmitter} = require('events');
  const repl = require('repl');
  const { Client } = require('ssh2');
  const { red, green, yellow } = require('colors');
  const fs = require('fs');

  const [, , username, password, host, port = 22] = process.argv;

  class SshClient extends EventEmitter {
    constructor(config) {
      super();
      this.config = config;
      this.connection = null;
    }

    async init() {
      await this.createConnection().catch(error => {
        SshClient.error(error);
        this.close();
      });
      await this.startShell().catch(error => {
        SshClient.error(error);
        this.close();
      });
      await this.initRepl().catch(error => {
        SshClient.error(error);
        this.close();
      });
    }

    async createConnection() {
      return await new Promise((resolve, reject) => {
        this.connection = new Client()
          .once('ready', () => resolve())
          .once('error', error => reject(error));

        this.connection.connect(this.config);
      });
    }

    async startShell() {
      return await new Promise((resolve, reject) => {
        this.connection.shell((error, stream) => {
          if (error) return reject(error);
          stream.once('close', (code, signal) => {
            SshClient.info(`Stream :: close :: code: ${code} signal: ${signal}`);
            this.connection.end();
          }).on('data', function (data) {
            SshClient.info(data);
          }).stderr.on('data', function (data) {
            SshClient.error(data);
          });
          resolve();
        });
      });
    }

    async initRepl() {
      repl.start({
        useGlobal: false,
        prompt: `${this.config.username}@${host}:# `,
        eval: this.eval.bind(this)
      });
    }

    get commands() {
      return {
        exit: this.close.bind(this),
        get: this.getFile.bind(this),
        put: this.putFile.bind(this),
      }
    }

    async eval(input) {
      const [method, ...args] = input.split(/\s/);
      if (this.commands[method] instanceof Function) {
        await this.commands[method](...args);
      } else {
        console.log([method, ...args].join(' '));
        this.connection.exec([method, ...args].join(' '), {}, (err, stream) => {
          if (err) return SshClient.error(err);
          stream
            .on('data', SshClient.log)
            .stderr.on('data', SshClient.error);
        });
      }
    }

    static log(data) {
      console.log(green(`${new Date().toISOString()} [STDOUT]: ${data.toString('utf8')}`));
    }

    static error(error) {
      console.log(red(`${new Date().toISOString()} [STDERR]: ${error.toString('utf8')}`));
    }

    static info(data) {
      console.log(yellow(`${new Date().toISOString()} [STDOUT]: ${data.toString('utf8')}`));
    }

    close() {
      this.connection.end();
      process.exit();
    }

    async getFile(remoteFilePath, localFilePath) {
      return await new Promise((resolve, reject) => {
        this.connection.exec(`cat ${remoteFilePath}`, (error, stream) => {
          if (error) return reject(error);
          stream.on('data', data => {
            try {
              fs.appendFileSync(localFilePath, data);
            } catch (error) {
              SshClient.error(error);
            }
            resolve();
          }).stderr.on('data', SshClient.error);
        }); // use scp???
      });
    }

    async putFile(localFilePath, remoteFilePath) {
      return await new Promise((resolve, reject) => {
        const content = fs.readFileSync(localFilePath);
        this.connection.exec(`echo "${content}" > ${remoteFilePath}`, (error, stream) => {
          if (error) return reject(error);
          stream.stderr.on('data', SshClient.error);
        });
      });
    }
  }

  new SshClient({
    host, port, username, password
  }).init();
})();
